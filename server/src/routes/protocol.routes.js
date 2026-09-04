import express from 'express';
import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';

const router = express.Router();

/**
 * GET /.well-known/agent.json
 * ACP (Agent Communication Protocol) Agent Card
 */
router.get('/.well-known/agent.json', async (req, res) => {
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  const agentCard = {
    name: "RazorAgent Demo Merchant",
    description: "Electronics & Tech Accessories merchant accepting autonomous AI buyer orders via ACP & x402 protocols",
    version: "1.0.0",
    capabilities: [
      "catalog.browse",
      "catalog.search",
      "checkout.create",
      "checkout.pay",
      "recommendations.upsell"
    ],
    protocols: [
      "x402/1.0",
      "acp/1.0"
    ],
    endpoints: {
      agent_card: `${baseUrl}/.well-known/agent.json`,
      catalog: `${baseUrl}/api/catalog`,
      catalog_search: `${baseUrl}/api/catalog/search`,
      checkout: `${baseUrl}/api/protocol/checkout`,
      payment_settlement: `${baseUrl}/api/protocol/pay`,
      upsell: `${baseUrl}/api/agents/upsell`
    },
    payment_providers: [
      {
        provider: "razorpay",
        mode: "test",
        currencies: ["INR"]
      }
    ],
    currency: "INR",
    min_order_inr: 100,
    merchant_contact: "ai-store@razoragent.demo"
  };

  return res.json(agentCard);
});

/**
 * GET /api/catalog
 * JSON-LD Schema.org Structured Product Catalog for AI Buyers
 */
router.get('/api/catalog', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { inStock: true },
      orderBy: { createdAt: 'desc' }
    });

    const jsonLdCatalog = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "RazorAgent Product Catalog",
      "numberOfItems": products.length,
      "itemListElement": products.map((p, index) => ({
        "@type": "Product",
        "position": index + 1,
        "name": p.name,
        "sku": p.sku,
        "description": p.description,
        "price": p.pricePaise / 100,
        "priceCurrency": "INR",
        "availability": p.inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "category": p.category,
        "itemCondition": "https://schema.org/NewCondition",
        "offers": {
          "@type": "Offer",
          "price": p.pricePaise / 100,
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock",
          "inventoryLevel": p.inventory
        }
      }))
    };

    return res.json(jsonLdCatalog);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalog/search
 * Semantic & Filtered Search for AI Agents
 */
router.get('/api/catalog/search', async (req, res) => {
  try {
    const { q, category, max_price } = req.query;
    const where = { inStock: true };

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (max_price) {
      where.pricePaise = { lte: Math.round(Number(max_price) * 100) };
    }

    const products = await prisma.product.findMany({ where, take: 15 });

    return res.json({
      query: q || null,
      category: category || null,
      maxPriceInr: max_price ? Number(max_price) : null,
      resultsCount: products.length,
      products: products.map(p => ({
        sku: p.sku,
        name: p.name,
        description: p.description,
        priceInr: p.pricePaise / 100,
        currency: "INR",
        category: p.category,
        inventory: p.inventory
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/protocol/checkout
 * x402 Protocol Implementation: Returns HTTP 402 Payment Required with RFC headers
 */
router.post('/api/protocol/checkout', async (req, res) => {
  try {
    const { items = [], buyer = {}, sessionId = 'protocol_session' } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required.' });
    }

    // Resolve items from database
    let totalPaise = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: {
          OR: [{ id: item.productId || '' }, { sku: item.sku || '' }]
        }
      });

      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.sku || item.productId}` });
      }

      const qty = item.qty || 1;
      totalPaise += product.pricePaise * qty;
      resolvedItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty,
        pricePaise: product.pricePaise
      });
    }

    const totalInr = totalPaise / 100;
    const orderNumber = `ORD-X402-${Date.now().toString().slice(-6)}`;

    // Create Razorpay Order
    const rzpOrder = await razorpayService.createOrder({
      amount: totalPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: { protocol: 'x402', buyerAgent: buyer.name || 'AI Buyer Agent' }
    });

    // Save initial order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        razorpayOrderId: rzpOrder.id,
        customerName: buyer.name || 'Autonomous AI Buyer',
        customerEmail: buyer.email || 'buyer-agent@agentnet.org',
        totalAmountPaise: totalPaise,
        currency: 'INR',
        status: 'CREATED',
        items: resolvedItems,
        metadata: { protocol: 'x402', isSandbox: rzpOrder.isSandbox }
      }
    });

    // Log to Audit Trail
    await safetyService.logAudit({
      sessionId,
      agentName: 'CHECKOUT_AGENT',
      actionType: 'x402_challenge_issued',
      actionPayload: { orderId: order.id, orderNumber, razorpayOrderId: rzpOrder.id, totalInr },
      explanation: `x402 Payment Challenge issued for Order #${orderNumber} (₹${totalInr}). Awaiting payment proof.`,
      status: 'PENDING',
      amountInr: totalInr,
      razorpayEntityId: rzpOrder.id
    });

    // Set standard x402 HTTP headers
    res.setHeader('X-Payment-Required', 'true');
    res.setHeader('X-Payment-Amount', totalInr.toString());
    res.setHeader('X-Payment-Currency', 'INR');
    res.setHeader('X-Payment-Provider', 'razorpay');
    res.setHeader('X-Payment-Order-Id', rzpOrder.id);
    res.setHeader('X-Payment-Description', `Order #${orderNumber} — ${resolvedItems.map(i => i.name).join(', ')}`);
    res.setHeader('X-Payment-Timeout', '300');

    // Return HTTP 402
    return res.status(402).json({
      status: 402,
      protocol: "x402/1.0",
      message: "Payment Required",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: rzpOrder.id,
        amountInr: totalInr,
        amountPaise: totalPaise,
        currency: "INR",
        items: resolvedItems,
        timeoutSeconds: 300
      },
      paymentInstructions: {
        provider: "razorpay",
        orderId: rzpOrder.id,
        amountPaise: totalPaise,
        currency: "INR",
        settlementEndpoint: "/api/protocol/pay"
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/protocol/pay
 * AI Buyer posts payment token/ID to finalize settlement
 */
router.post('/api/protocol/pay', async (req, res) => {
  try {
    const { orderId, razorpayOrderId, paymentId, sessionId = 'protocol_session' } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderId || '' },
          { razorpayOrderId: razorpayOrderId || '' }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found for settlement' });
    }

    const payId = paymentId || `pay_test_${Date.now()}`;

    // Record payment
    const payment = await prisma.payment.create({
      data: {
        razorpayPaymentId: payId,
        orderId: order.id,
        amountPaise: order.totalAmountPaise,
        currency: order.currency,
        method: 'upi',
        status: 'captured'
      }
    });

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' }
    });

    await safetyService.logAudit({
      sessionId,
      agentName: 'BUYER_AGENT',
      actionType: 'x402_payment_settled',
      actionPayload: { orderId: order.id, paymentId: payId, amountInr: order.totalAmountPaise / 100 },
      explanation: `x402 Payment settled successfully. Order #${order.orderNumber} confirmed.`,
      status: 'SUCCESS',
      amountInr: order.totalAmountPaise / 100,
      razorpayEntityId: payId
    });

    return res.json({
      success: true,
      protocol: "x402/1.0",
      status: "PAID",
      orderNumber: updatedOrder.orderNumber,
      paymentId: payment.razorpayPaymentId,
      amountInr: updatedOrder.totalAmountPaise / 100,
      currency: updatedOrder.currency,
      receiptUrl: `/api/orders/${updatedOrder.id}/receipt`,
      message: "Order payment verified and fulfilled successfully."
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
