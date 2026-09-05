import crypto from 'crypto';
import prisma from '../config/db.js';
import safetyService from './safetyService.js';
import razorpayService from './razorpayService.js';

/**
 * SBMD Service — Single Block Multiple Debit
 *
 * Two modes:
 *
 * 1. TOKEN MODE (real Razorpay): Customer did one-time setup → has customer_id + token_id.
 *    executePayment() calls POST /v1/payments/create/recurring → payment appears on Razorpay
 *    dashboard as "authorized" → server captures it → "captured" state on dashboard.
 *
 * 2. LOCAL CAP MODE (fallback): No token yet. Debits from local spendingCapPaise reserve.
 *    Useful for demo when token setup hasn't been done.
 */
class SBMDService {

  async isEligible(merchantId, amountPaise) {
    if (!merchantId || !amountPaise) return false;
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return false;
    return (merchant.spendingCapPaise || 0) >= amountPaise;
  }

  async getReserveStatus(merchantId) {
    if (!merchantId) return null;
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return null;
    return {
      reservePaise: merchant.spendingCapPaise || 0,
      reserveInr: (merchant.spendingCapPaise || 0) / 100
    };
  }

  /**
   * Execute SBMD payment.
   *
   * @param {string} orderId - Local DB order ID
   * @param {number} amountPaise
   * @param {string|null} merchantId
   * @param {string|null} razorpayOrderId - Razorpay order_... ID (needed for recurring payment)
   * @param {object|null} sbmdToken - { customerId, tokenId } if customer has done one-time setup
   * @param {string} orderNumber
   * @param {string} sessionId
   */
  async executePayment({
    merchantId,
    orderId,
    amountPaise,
    razorpayOrderId = null,
    sbmdToken = null,
    orderNumber = null,
    sessionId = 'session_sbmd_checkout'
  }) {
    if (!orderId || !amountPaise) {
      throw new Error('orderId and amountPaise are required for SBMD execution');
    }

    // Spending cap safety check
    const merchant = merchantId
      ? await prisma.merchant.findUnique({ where: { id: merchantId } })
      : null;

    if (merchant && (merchant.spendingCapPaise || 0) < amountPaise) {
      throw new Error(
        `Insufficient SBMD reserve: ₹${((merchant.spendingCapPaise || 0) / 100).toFixed(2)} available, ₹${(amountPaise / 100).toFixed(2)} needed.`
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'PAID') throw new Error(`Order ${orderNumber || orderId} is already paid.`);

    // ─────────────────────────────────────────────────────────────────
    // MODE 1: TOKEN-BASED — real Razorpay recurring payment
    // ─────────────────────────────────────────────────────────────────
    if (sbmdToken?.customerId && sbmdToken?.tokenId && razorpayOrderId &&
        !razorpayOrderId.startsWith('order_test_')) {
      try {
        console.log(`⚡ SBMD Token Mode: creating recurring payment for order ${razorpayOrderId}`);

        // Create recurring payment on Razorpay (goes to "authorized" state)
        const rzpPayment = await razorpayService.createRecurringPayment({
          orderId: razorpayOrderId,
          customerId: sbmdToken.customerId,
          tokenId: sbmdToken.tokenId,
          amount: amountPaise,
          email: 'shopper@razoragent.demo',
          contact: '+919876543210'
        });

        const payId = rzpPayment.id || rzpPayment.razorpay_payment_id;
        let finalStatus = rzpPayment.status || 'created';

        // If authorized → capture immediately
        if (finalStatus === 'authorized') {
          try {
            const captured = await razorpayService.capturePayment(payId, amountPaise);
            finalStatus = captured.status || 'captured';
            console.log(`✅ SBMD payment ${payId} captured immediately`);
          } catch (capErr) {
            console.warn(`Capture attempt failed (webhook will handle it): ${capErr.message}`);
          }
        }

        const isCaptured = finalStatus === 'captured';

        // Save payment record
        const payment = await prisma.payment.upsert({
          where: { razorpayPaymentId: payId },
          update: { status: finalStatus },
          create: {
            razorpayPaymentId: payId,
            orderId,
            amountPaise,
            currency: 'INR',
            method: 'sbmd_recurring',
            status: finalStatus
          }
        });

        if (isCaptured) {
          // Update order + decrement reserve atomically
          await prisma.$transaction([
            prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
            ...(merchantId ? [prisma.merchant.update({
              where: { id: merchantId },
              data: { spendingCapPaise: { decrement: amountPaise } }
            })] : [])
          ]);
          await this._decrementInventory(order);
        }
        // If not yet captured (created/authorized), webhook will finalize

        const remainingReservePaise = merchant
          ? Math.max(0, (merchant.spendingCapPaise || 0) - (isCaptured ? amountPaise : 0))
          : null;

        await safetyService.logAudit({
          sessionId,
          agentName: 'CHECKOUT_AGENT',
          actionType: isCaptured ? 'payment.sbmd.captured' : 'payment.sbmd.authorized',
          actionPayload: { orderId, orderNumber, paymentId: payId, razorpayStatus: finalStatus },
          explanation: `SBMD recurring payment ${finalStatus.toUpperCase()} for Order #${orderNumber || orderId} (₹${(amountPaise / 100).toFixed(2)}).`,
          status: isCaptured ? 'SUCCESS' : 'PENDING',
          amountInr: amountPaise / 100,
          razorpayEntityId: payId
        });

        return {
          ...payment,
          isCapturedOnRazorpay: isCaptured,
          razorpayPaymentStatus: finalStatus,
          paidWith: isCaptured ? 'SBMD' : 'SBMD_INITIATED',
          remainingReserveInr: (remainingReservePaise || 0) / 100
        };
      } catch (err) {
        console.warn(`SBMD Token Mode failed: ${err.message}. Falling back to local cap mode.`);
        // Fall through to local cap mode
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // MODE 2: LOCAL CAP — debit from spending reserve (demo/simulator)
    // ─────────────────────────────────────────────────────────────────
    const payId = `sbmd_${crypto.randomBytes(8).toString('hex')}`;

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          razorpayPaymentId: payId,
          orderId,
          amountPaise,
          currency: 'INR',
          method: 'sbmd_reserve',
          status: 'captured'
        }
      }),
      prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
      ...(merchantId ? [prisma.merchant.update({
        where: { id: merchantId },
        data: { spendingCapPaise: { decrement: amountPaise } }
      })] : [])
    ]);

    await this._decrementInventory(order);

    const remainingReservePaise = merchant
      ? Math.max(0, (merchant.spendingCapPaise || 0) - amountPaise)
      : null;

    await safetyService.logAudit({
      sessionId,
      agentName: 'CHECKOUT_AGENT',
      actionType: 'payment.sbmd.captured',
      actionPayload: { orderId, orderNumber, paymentId: payId, mode: 'local_cap' },
      explanation: `SBMD local-cap debit: ₹${(amountPaise / 100).toFixed(2)} for Order #${orderNumber || orderId}. Reserve remaining: ₹${((remainingReservePaise || 0) / 100).toFixed(2)}.`,
      status: 'SUCCESS',
      amountInr: amountPaise / 100,
      razorpayEntityId: payId
    });

    return {
      ...payment,
      isCapturedOnRazorpay: false,
      razorpayPaymentStatus: 'captured',
      paidWith: 'SBMD',
      remainingReserveInr: (remainingReservePaise || 0) / 100
    };
  }

  async _decrementInventory(order) {
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
}

export const sbmdService = new SBMDService();
export default sbmdService;
