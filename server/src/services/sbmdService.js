import prisma from '../config/db.js';
import safetyService from './safetyService.js';
import crypto from 'crypto';

class SBMDService {
  /**
   * Check whether merchant has sufficient SBMD-allocated budget to cover amount
   */
  async isEligible(merchantId, amountPaise) {
    if (!merchantId) return false;
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return false;
    return (merchant.spendingCapPaise || 0) >= (amountPaise || 0);
  }

  /**
   * Simulate executing a SBMD payment: create a Payment, decrement merchant spending cap,
   * mark order PAID, reduce inventory, and log audit. Returns the created payment record.
   */
  async executePayment({ merchantId, orderId, amountPaise, orderNumber = null, sessionId = 'session_sbmd_checkout' }) {
    if (!orderId || !amountPaise) {
      throw new Error('orderId and amountPaise are required for SBMD execution');
    }

    const merchant = merchantId ? await prisma.merchant.findUnique({ where: { id: merchantId } }) : null;
    if (merchant && (merchant.spendingCapPaise || 0) < amountPaise) {
      throw new Error('Insufficient SBMD spending cap');
    }

    // Create a synthetic SBMD payment id
    const payId = `sbmd_pay_${crypto.randomBytes(6).toString('hex')}_${Date.now()}`;

    // Create Payment record
    const payment = await prisma.payment.create({
      data: {
        razorpayPaymentId: payId,
        orderId,
        amountPaise,
        currency: 'INR',
        method: 'sbmd',
        status: 'captured'
      }
    });

    // Mark order as PAID
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } });

    // Decrement merchant spending cap if merchant exists
    if (merchantId) {
      try {
        await prisma.merchant.update({
          where: { id: merchantId },
          data: { spendingCapPaise: { decrement: amountPaise } }
        });
      } catch (err) {
        // non-fatal
        console.warn('Failed to decrement merchant spending cap:', err.message);
      }
    }

    // Reduce inventory for ordered items (best-effort)
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const items = Array.isArray(order?.items) ? order.items : [];
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
    } catch (err) {
      // ignore inventory failures
    }

    // Log audit entry
    await safetyService.logAudit({
      sessionId,
      agentName: 'CHECKOUT_AGENT',
      actionType: 'payment.sbmd.captured',
      actionPayload: { orderId, orderNumber, paymentId: payId },
      explanation: `SBMD payment captured for Order #${orderNumber || orderId} for ₹${(amountPaise / 100).toFixed(2)}.`,
      status: 'SUCCESS',
      amountInr: amountPaise / 100,
      razorpayEntityId: payId
    });

    return payment;
  }
}

export const sbmdService = new SBMDService();
export default sbmdService;
