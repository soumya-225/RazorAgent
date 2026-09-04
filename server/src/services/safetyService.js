import prisma from '../config/db.js';
import razorpayService from './razorpayService.js';

export class SafetyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SafetyError';
    this.code = code;
    this.details = details;
  }
}

class SafetyService {
  /**
   * Append-only Audit Log
   */
  async logAudit({
    sessionId = 'session_default',
    agentName = 'SAFETY_GATE',
    actionType,
    actionPayload = {},
    explanation = 'Action evaluated by safety gate',
    status = 'PENDING',
    amountInr = 0,
    razorpayEntityId = null
  }) {
    try {
      const entry = await prisma.auditLog.create({
        data: {
          sessionId,
          agentName,
          actionType,
          actionPayload: typeof actionPayload === 'object' ? actionPayload : { data: actionPayload },
          explanation,
          status,
          amountInr: parseFloat(amountInr) || 0,
          razorpayEntityId
        }
      });
      console.log(`🛡️ [AUDIT] [${status}] ${agentName} -> ${actionType}: ${explanation}`);
      return entry;
    } catch (err) {
      console.error('Failed to write audit log:', err.message);
      return null;
    }
  }

  /**
   * Intercepts money-moving actions:
   * 1. Spending cap boundary check
   * 2. Threshold approval gate (> approvalThreshold)
   * 3. Pre-execution audit logging
   * 4. Safe execution
   * 5. Post-execution audit logging & graceful failure logging
   */
  async interceptAction({
    merchantId,
    sessionId = 'session_default',
    agentName = 'ORCHESTRATOR',
    actionType,
    amountPaise = 0,
    explanation = 'Automated transaction request',
    payload = {},
    executeFn,
    sessionContext = {}
  }) {
    const amountInr = (amountPaise || 0) / 100;

    // Fetch merchant limits or use defaults
    let spendingCapPaise = 1000000; // default ₹10,000
    let approvalThresholdPaise = 500000; // default ₹5,000

    if (merchantId) {
      const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
      if (merchant) {
        spendingCapPaise = merchant.spendingCapPaise;
        approvalThresholdPaise = merchant.approvalThresholdPaise;
      }
    }

    const sessionCap = sessionContext.budgetPaise !== undefined ? sessionContext.budgetPaise : spendingCapPaise;
    const sessionSpent = sessionContext.spentPaise || 0;

    // 1. Boundary Check: Spending Cap
    if (amountPaise > 0 && sessionSpent + amountPaise > sessionCap) {
      const remainingPaise = Math.max(0, sessionCap - sessionSpent);
      const blockedMsg = `Spending cap exceeded. Required: ₹${amountInr.toFixed(2)}, Available Budget: ₹${(remainingPaise / 100).toFixed(2)}`;
      
      await this.logAudit({
        sessionId,
        agentName: 'SAFETY_GATE',
        actionType: `check_spending_limit(${actionType})`,
        actionPayload: { attemptedPaise: amountPaise, currentSpentPaise: sessionSpent, capPaise: sessionCap, payload },
        explanation: blockedMsg,
        status: 'BLOCKED',
        amountInr
      });

      throw new SafetyError('SPENDING_CAP_EXCEEDED', blockedMsg, {
        capInr: sessionCap / 100,
        spentInr: sessionSpent / 100,
        attemptedInr: amountInr,
        remainingInr: remainingPaise / 100
      });
    }

    // 2. Gating Check: High-Value Human Approval Gate
    if (amountPaise > approvalThresholdPaise && !sessionContext.isApprovedByHuman) {
      const gateMsg = `Transaction amount ₹${amountInr.toFixed(2)} exceeds high-value threshold ₹${(approvalThresholdPaise / 100).toFixed(2)}. Human approval required.`;
      
      // Create Approval Request
      const approvalReq = await prisma.approvalRequest.create({
        data: {
          merchantId,
          sessionId,
          agentName,
          actionType,
          payload,
          amountInr,
          reasoning: explanation,
          status: 'PENDING'
        }
      });

      await this.logAudit({
        sessionId,
        agentName: 'SAFETY_GATE',
        actionType: `require_human_approval(${actionType})`,
        actionPayload: { approvalRequestId: approvalReq.id, amountPaise, payload },
        explanation: gateMsg,
        status: 'WAITING_APPROVAL',
        amountInr
      });

      return {
        requiresApproval: true,
        approvalRequestId: approvalReq.id,
        status: 'WAITING_APPROVAL',
        message: gateMsg,
        amountInr
      };
    }

    // 3. Pre-execution log
    await this.logAudit({
      sessionId,
      agentName,
      actionType,
      actionPayload: payload,
      explanation: `Pre-execution: ${explanation}`,
      status: 'PENDING',
      amountInr
    });

    // 4. Safe Execution
    try {
      const result = await executeFn();
      const entityId = result?.id || result?.orderId || result?.paymentId || result?.paymentLinkId || null;

      // 5. Post-execution success log
      await this.logAudit({
        sessionId,
        agentName,
        actionType,
        actionPayload: { payload, resultSummary: result?.status || 'completed' },
        explanation: `Success: ${explanation}`,
        status: 'SUCCESS',
        amountInr,
        razorpayEntityId: entityId
      });

      return {
        success: true,
        result
      };
    } catch (err) {
      // 5. Post-execution error log
      await this.logAudit({
        sessionId,
        agentName,
        actionType,
        actionPayload: { payload, error: err.message },
        explanation: `Execution Failed: ${err.message}`,
        status: 'FAILED',
        amountInr
      });
      throw err;
    }
  }

  /**
   * Graceful Failure Handling: Payment Timeout Auto-Recovery
   */
  async handlePaymentTimeout(orderId, sessionId = 'session_timeout_demo') {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'TIMED_OUT' }
    });

    await this.logAudit({
      sessionId,
      agentName: 'RAZORPAY_WEBHOOK',
      actionType: 'payment.link.expired',
      actionPayload: { orderId, previousStatus: order.status },
      explanation: `Payment window expired for Order #${order.orderNumber}. Triggering auto-recovery pipeline.`,
      status: 'FAILED',
      amountInr: order.totalAmountPaise / 100,
      razorpayEntityId: order.razorpayOrderId
    });

    // Generate fresh payment link with 30-min window
    const newLink = await razorpayService.createPaymentLink({
      amount: order.totalAmountPaise,
      currency: order.currency,
      description: `Payment Link for Order #${order.orderNumber} (Refreshed)`,
      expireBy: Math.floor(Date.now() / 1000) + 1800,
      customer: {
        name: order.customerName || 'Customer',
        email: order.customerEmail || 'customer@example.com',
        phone: order.customerPhone || '+919876543210'
      }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentLinkUrl: newLink.short_url,
        razorpayPaymentLinkId: newLink.id,
        status: 'CREATED'
      }
    });

    await this.logAudit({
      sessionId,
      agentName: 'CHECKOUT_AGENT',
      actionType: 'regenerate_payment_link',
      actionPayload: { orderId, newPaymentLinkId: newLink.id, newLinkUrl: newLink.short_url },
      explanation: `Original payment window expired. Generated fresh payment link with 30-minute validity for ₹${(order.totalAmountPaise / 100).toFixed(2)}.`,
      status: 'SUCCESS',
      amountInr: order.totalAmountPaise / 100,
      razorpayEntityId: newLink.id
    });

    return {
      handled: true,
      orderId,
      orderNumber: order.orderNumber,
      newPaymentLink: newLink.short_url,
      newPaymentLinkId: newLink.id,
      reason: 'Original payment window expired. Auto-recovered with a fresh 30-minute payment link.'
    };
  }

  /**
   * Graceful Failure Handling: Budget Cap Fallback Search
   */
  async handleBudgetExceededFallback({ sessionId = 'session_buyer', requestedAmountInr, remainingBudgetInr, category }) {
    const remainingPaise = Math.round(remainingBudgetInr * 100);
    
    // Find affordable products in stock within the remaining budget
    let alternatives = await prisma.product.findMany({
      where: {
        pricePaise: { lte: remainingPaise },
        inStock: true,
        ...(category ? { category: { contains: 'Accessori', mode: 'insensitive' } } : {})
      },
      orderBy: { pricePaise: 'desc' },
      take: 4
    });

    if (alternatives.length === 0) {
      alternatives = await prisma.product.findMany({
        where: {
          pricePaise: { lte: remainingPaise },
          inStock: true
        },
        orderBy: { pricePaise: 'desc' },
        take: 4
      });
    }

    const explanation = `Requested ₹${requestedAmountInr} exceeds remaining budget of ₹${remainingBudgetInr.toFixed(2)}. Gracefully searched catalog and discovered ${alternatives.length} viable alternatives fitting the remaining budget.`;

    await this.logAudit({
      sessionId,
      agentName: 'BUYER_AGENT',
      actionType: 'search_budget_alternatives',
      actionPayload: {
        requestedInr: requestedAmountInr,
        remainingInr: remainingBudgetInr,
        alternativeCount: alternatives.length,
        alternatives: alternatives.map(p => ({ sku: p.sku, name: p.name, priceInr: p.pricePaise / 100 }))
      },
      explanation,
      status: 'SUCCESS',
      amountInr: remainingBudgetInr
    });

    return {
      handled: true,
      remainingBudgetInr,
      alternatives: alternatives.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        priceInr: p.pricePaise / 100,
        pricePaise: p.pricePaise,
        category: p.category,
        description: p.description
      })),
      explanation
    };
  }
}

export const safetyService = new SafetyService();
export default safetyService;
