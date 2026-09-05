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
    const payload = req.body;

    const isValid = razorpayService.verifyWebhookSignature({
      payload,
      signature
    });

    if (!isValid) {
      console.warn('⚠️ Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = payload.event;
    const eventData = payload.payload;

    console.log(`🔔 Webhook received: ${event}`);

    // Auto-capture authorized recurring payments (SBMD frictionless flow)
    if (event === 'payment.authorized') {
      const paymentEntity = eventData.payment?.entity;
      if (paymentEntity && paymentEntity.id) {
        try {
          // Only auto-capture if this is a recurring/token payment
          if (paymentEntity.token_id || paymentEntity.recurring) {
            await razorpayService.capturePayment(paymentEntity.id, paymentEntity.amount);
            console.log(`⚡ Auto-captured authorized payment: ${paymentEntity.id}`);
          }
        } catch (captureErr) {
          console.warn('Auto-capture failed:', captureErr.message);
        }
      }
    } else if (event === 'payment.captured') {
      const paymentEntity = eventData.payment?.entity;
      if (paymentEntity && paymentEntity.order_id) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: paymentEntity.order_id }
        });

        if (order) {
          await prisma.payment.upsert({
            where: { razorpayPaymentId: paymentEntity.id },
            update: { status: 'captured' },
            create: {
              razorpayPaymentId: paymentEntity.id,
              orderId: order.id,
              amountPaise: paymentEntity.amount,
              currency: paymentEntity.currency || 'INR',
              method: paymentEntity.method || 'card',
              status: 'captured'
            }
          });

          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PAID' }
          });

          await safetyService.logAudit({
            sessionId: 'webhook_listener',
            agentName: 'RAZORPAY_WEBHOOK',
            actionType: 'payment.captured',
            actionPayload: { paymentId: paymentEntity.id, orderId: order.id, amountPaise: paymentEntity.amount },
            explanation: `Webhook verified: Payment ${paymentEntity.id} captured for Order #${order.orderNumber}.`,
            status: 'SUCCESS',
            amountInr: paymentEntity.amount / 100,
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
