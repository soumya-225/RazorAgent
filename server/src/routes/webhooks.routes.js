import express from 'express';
import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';

const router = express.Router();

/**
 * POST /api/webhooks/razorpay
 * Ingest Razorpay Webhook Events
 */
router.post('/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    // Use raw body Buffer for HMAC signature verification (must match exact bytes Razorpay signed)
    const rawPayload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    // Use parsed JSON body for reading event data
    const body = req.body;

    const isValid = razorpayService.verifyWebhookSignature({
      payload: rawPayload,
      signature
    });

    if (!isValid) {
      console.warn('⚠️ Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = body.event;
    const eventData = body.payload;

    console.log(`🔔 Webhook received: ${event}`);

    // ── payment.authorized: immediately capture (SBMD recurring payment flow) ──
    if (event === 'payment.authorized') {
      const paymentEntity = eventData.payment?.entity;
      if (paymentEntity?.id && paymentEntity?.amount) {
        console.log(`⚡ Auto-capturing authorized payment ${paymentEntity.id} (₹${paymentEntity.amount / 100})`);
        try {
          await razorpayService.capturePayment(paymentEntity.id, paymentEntity.amount);
          console.log(`✅ Payment ${paymentEntity.id} captured via webhook handler`);
        } catch (capErr) {
          console.error(`Failed to auto-capture ${paymentEntity.id}: ${capErr.message}`);
        }
      }
    }

    // ── payment.captured: mark order PAID, decrement cap, reduce inventory ──
    if (event === 'payment.captured') {
      const paymentEntity = eventData.payment?.entity;
      if (paymentEntity) {
        let order = null;
        if (paymentEntity.order_id) {
          order = await prisma.order.findUnique({
            where: { razorpayOrderId: paymentEntity.order_id }
          });
        }
        if (!order && paymentEntity.invoice_id) {
          order = await prisma.order.findFirst({
            where: { razorpayPaymentLinkId: paymentEntity.invoice_id }
          });
        }

        if (order) {
          await prisma.payment.upsert({
            where: { razorpayPaymentId: paymentEntity.id },
            update: { status: 'captured' },
            create: {
              razorpayPaymentId: paymentEntity.id,
              orderId: order.id,
              amountPaise: paymentEntity.amount || order.totalAmountPaise,
              currency: paymentEntity.currency || 'INR',
              method: paymentEntity.method || 'sbmd_recurring',
              status: 'captured'
            }
          });

          if (order.status !== 'PAID') {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'PAID' }
            });

            // Decrement merchant spending cap
            if (order.merchantId) {
              await prisma.merchant.update({
                where: { id: order.merchantId },
                data: { spendingCapPaise: { decrement: order.totalAmountPaise } }
              }).catch(() => {});
            }

            // Reduce inventory for fulfilled items
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
          }

          await safetyService.logAudit({
            sessionId: 'webhook_listener',
            agentName: 'RAZORPAY_WEBHOOK',
            actionType: 'payment.captured',
            actionPayload: { paymentId: paymentEntity.id, orderId: order.id, amountPaise: paymentEntity.amount },
            explanation: `Razorpay Webhook: Payment ${paymentEntity.id} captured for Order #${order.orderNumber}.`,
            status: 'SUCCESS',
            amountInr: (paymentEntity.amount || order.totalAmountPaise) / 100,
            razorpayEntityId: paymentEntity.id
          });
        }
      }
    } else if (event === 'payment.link.expired') {
      const linkEntity = eventData.payment_link?.entity;
      if (linkEntity) {
        const order = await prisma.order.findFirst({
          where: { razorpayPaymentLinkId: linkEntity.id }
        });

        if (order) {
          await safetyService.handlePaymentTimeout(order.id, 'webhook_timeout_listener');
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = eventData.payment?.entity;
      await safetyService.logAudit({
        sessionId: 'webhook_listener',
        agentName: 'RAZORPAY_WEBHOOK',
        actionType: 'payment.failed',
        actionPayload: paymentEntity,
        explanation: `Payment ${paymentEntity?.id || 'unknown'} failed: ${paymentEntity?.error_description || 'Unknown error'}.`,
        status: 'FAILED',
        amountInr: (paymentEntity?.amount || 0) / 100,
        razorpayEntityId: paymentEntity?.id
      });
    }

    return res.status(200).json({ received: true, event });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
