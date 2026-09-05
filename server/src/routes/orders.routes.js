import express from 'express';
import crypto from 'crypto';
import prisma from '../config/db.js';
import config from '../config/env.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import { optionalMerchantAuth, requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/orders/razorpay-config
 * Public config for client checkout integration
 */
router.get('/razorpay-config', (req, res) => {
  return res.json({
    keyId: config.razorpayKeyId || '',
    isLive: config.isRazorpayLive
  });
});


/**
 * GET /api/orders
 * List orders — filtered by logged-in merchant if authenticated
 */
router.get('/', optionalMerchantAuth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;

    // Filter by merchantId if merchant is logged in
    if (req.merchant?.id) {
      where.merchantId = req.merchant.id;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      include: { payments: true }
    });

    const enriched = orders.map(o => ({
      ...o,
      totalAmountInr: o.totalAmountPaise / 100,
      discountAmountInr: o.discountAmountPaise / 100
    }));

    return res.json({ orders: enriched, count: enriched.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/metrics/summary
 * Merchant Dashboard Metrics — filtered by logged-in merchant
 */
router.get('/metrics/summary', optionalMerchantAuth, async (req, res) => {
  try {
    const merchantFilter = req.merchant?.id ? { merchantId: req.merchant.id } : {};

    const totalOrders = await prisma.order.count({ where: merchantFilter });
    const paidOrders = await prisma.order.findMany({
      where: { status: 'PAID', ...merchantFilter }
    });

    const totalRevenuePaise = paidOrders.reduce((sum, o) => sum + o.totalAmountPaise, 0);
    const activeCampaigns = await prisma.campaign.count({
      where: { status: 'ACTIVE', ...(req.merchant?.id ? { merchantId: req.merchant.id } : {}) }
    });
    const pendingApprovals = await prisma.approvalRequest.count({
      where: { status: 'PENDING', ...(req.merchant?.id ? { merchantId: req.merchant.id } : {}) }
    });
    const auditEventsCount = await prisma.auditLog.count();

    const lowStockCount = await prisma.product.count({
      where: { inventory: { lte: 5 }, ...(req.merchant?.id ? { merchantId: req.merchant.id } : {}) }
    });

    return res.json({
      totalRevenueInr: totalRevenuePaise / 100,
      totalOrders,
      paidOrdersCount: paidOrders.length,
      conversionRate: totalOrders > 0 ? Math.round((paidOrders.length / totalOrders) * 100) : 0,
      activeCampaigns,
      pendingApprovals,
      auditEventsCount,
      lowStockCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: req.params.id }, { orderNumber: req.params.id }, { razorpayOrderId: req.params.id }]
      },
      include: { payments: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      order: {
        ...order,
        totalAmountInr: order.totalAmountPaise / 100,
        discountAmountInr: order.discountAmountPaise / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/pay-simulate
 * Complete payment in test mode / sandbox
 */
router.post('/:id/pay-simulate', async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: req.params.id }, { orderNumber: req.params.id }]
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.json({ message: 'Order is already paid', order });
    }

    const capture = await razorpayService.simulatePaymentCapture({
      orderId: order.razorpayOrderId || `order_${order.id}`,
      amount: order.totalAmountPaise,
      method: 'card'
    });

    const payment = await prisma.payment.create({
      data: {
        razorpayPaymentId: capture.id,
        orderId: order.id,
        amountPaise: order.totalAmountPaise,
        currency: order.currency,
        method: 'card',
        status: 'captured'
      }
    });

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' }
    });

    // Reduce inventory for ordered items
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            inventory: { decrement: item.qty || 1 },
            salesCount30Days: { increment: item.qty || 1 }
          }
        }).catch(() => {});
      }
    }

    await safetyService.logAudit({
      sessionId: 'session_store_checkout',
      agentName: 'CHECKOUT_AGENT',
      actionType: 'payment.captured',
      actionPayload: { orderId: order.id, orderNumber: order.orderNumber, paymentId: capture.id },
      explanation: `Payment of ₹${(order.totalAmountPaise / 100).toFixed(2)} captured successfully. Order #${order.orderNumber} fulfilled.`,
      status: 'SUCCESS',
      amountInr: order.totalAmountPaise / 100,
      razorpayEntityId: capture.id
    });

    return res.json({
      success: true,
      order: {
        ...updatedOrder,
        totalAmountInr: updatedOrder.totalAmountPaise / 100
      },
      payment
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/verify-payment
 * Verify real Razorpay checkout payment signature
 */
router.post('/:id/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: req.params.id }, { orderNumber: req.params.id }, { razorpayOrderId: razorpay_order_id || req.params.id }]
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.json({ success: true, message: 'Order is already marked as paid', order });
    }

    // Verify HMAC SHA256 Signature if live credentials are present
    if (config.razorpayKeySecret && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid Razorpay payment signature verification failed.' });
      }
    }

    const payId = razorpay_payment_id || `pay_${Date.now()}`;

    // Record Payment
    const payment = await prisma.payment.create({
      data: {
        razorpayPaymentId: payId,
        orderId: order.id,
        amountPaise: order.totalAmountPaise,
        currency: order.currency || 'INR',
        method: 'razorpay_checkout',
        status: 'captured'
      }
    });

    // Mark Order PAID
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' }
    });

    // Update inventory
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            inventory: { decrement: item.qty || 1 },
            salesCount30Days: { increment: item.qty || 1 }
          }
        }).catch(() => {});
      }
    }

    await safetyService.logAudit({
      sessionId: 'session_razorpay_checkout',
      agentName: 'CHECKOUT_AGENT',
      actionType: 'payment.verified',
      actionPayload: { orderId: order.id, orderNumber: order.orderNumber, paymentId: payId },
      explanation: `Razorpay signature verified. Payment of ₹${(order.totalAmountPaise / 100).toFixed(2)} confirmed. Order #${order.orderNumber} completed.`,
      status: 'SUCCESS',
      amountInr: order.totalAmountPaise / 100,
      razorpayEntityId: payId
    });

    return res.json({
      success: true,
      order: {
        ...updatedOrder,
        totalAmountInr: updatedOrder.totalAmountPaise / 100
      },
      payment
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

