import express from 'express';
import prisma from '../config/db.js';
import safetyService from '../services/safetyService.js';
import razorpayService from '../services/razorpayService.js';
import { optionalMerchantAuth, requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/safety/audit-logs
 * Real-time filterable audit trail feed
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { agent, status, limit = 50, sessionId } = req.query;
    const where = {};

    if (agent) where.agentName = agent;
    if (status) where.status = status;
    if (sessionId) where.sessionId = sessionId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10)
    });

    return res.json({ logs, count: logs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/safety/approvals
 * Pending human approval requests queue
 */
router.get('/approvals', optionalMerchantAuth, async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const where = {};
    if (status) where.status = status;

    const requests = await prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ requests, count: requests.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/safety/approvals/:id/decide
 * Human decision on gated high-value transaction
 */
router.post('/approvals/:id/decide', optionalMerchantAuth, async (req, res) => {
  try {
    const { decision } = req.body; // 'APPROVED' or 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'APPROVED' or 'REJECTED'" });
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request has already been ${request.status.toLowerCase()}` });
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: decision,
        reviewedAt: new Date()
      }
    });

    // Write to audit log
    await safetyService.logAudit({
      sessionId: request.sessionId || 'approval_flow',
      agentName: 'SAFETY_GATE',
      actionType: `human_approval_decision(${request.actionType})`,
      actionPayload: { approvalRequestId: request.id, decision, originalPayload: request.payload },
      explanation: `Human operator ${decision.toLowerCase()} the high-value transaction of ₹${request.amountInr.toFixed(2)}.`,
      status: decision === 'APPROVED' ? 'SUCCESS' : 'BLOCKED',
      amountInr: request.amountInr
    });

    let executionResult = null;
    if (decision === 'APPROVED') {
      // Execute the previously gated transaction
      const payload = request.payload;
      if (payload && payload.finalAmountPaise) {
        const rzpOrder = await razorpayService.createOrder({
          amount: payload.finalAmountPaise,
          currency: 'INR',
          receipt: payload.orderNumber || `ORD-APP-${Date.now()}`
        });
        executionResult = { orderId: rzpOrder.id, status: 'approved_and_executed' };
      }
    }

    return res.json({
      message: `Transaction ${decision.toLowerCase()} successfully`,
      approval: updated,
      executionResult
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/safety/demo/timeout-recovery
 * Trigger Graceful Failure Demo: Payment Timeout Auto-Recovery
 */
router.post('/demo/timeout-recovery', async (req, res) => {
  try {
    let order = await prisma.order.findFirst({
      where: { status: { in: ['CREATED', 'TIMED_OUT'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (!order) {
      // Create a test order to demonstrate timeout
      const testProduct = await prisma.product.findFirst() || { id: 'test', sku: 'WH-001', name: 'Wireless Headphones', pricePaise: 249900 };
      const orderNumber = `ORD-DEMO-${Date.now().toString().slice(-4)}`;
      order = await prisma.order.create({
        data: {
          orderNumber,
          razorpayOrderId: `order_demo_${Date.now()}`,
          totalAmountPaise: testProduct.pricePaise || 249900,
          currency: 'INR',
          status: 'CREATED',
          items: [{ productId: testProduct.id, sku: testProduct.sku, name: testProduct.name, qty: 1, pricePaise: testProduct.pricePaise || 249900 }]
        }
      });
    }

    const recovery = await safetyService.handlePaymentTimeout(order.id, 'session_timeout_demo');
    return res.json(recovery);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/safety/demo/budget-block
 * Trigger Graceful Failure Demo: Budget Cap Boundary & Fallback
 */
router.post('/demo/budget-block', async (req, res) => {
  try {
    const { budgetInr = 5000, spentInr = 4199, attemptedInr = 2200 } = req.body;
    const remainingInr = Math.max(0, budgetInr - spentInr);
    const sessionId = 'session_budget_demo';

    // Log the blocked attempt
    await safetyService.logAudit({
      sessionId,
      agentName: 'SAFETY_GATE',
      actionType: 'check_spending_limit(demo_attempt)',
      actionPayload: { budgetInr, spentInr, attemptedInr, remainingInr },
      explanation: `BLOCKED: Attempted ₹${attemptedInr} exceeds remaining budget ₹${remainingInr.toFixed(2)} (Spent ₹${spentInr} of ₹${budgetInr}).`,
      status: 'BLOCKED',
      amountInr: attemptedInr
    });

    // Execute graceful fallback search
    const fallback = await safetyService.handleBudgetExceededFallback({
      sessionId,
      requestedAmountInr: attemptedInr,
      remainingBudgetInr: remainingInr,
      category: 'Accessory'
    });

    return res.json({
      success: true,
      budgetInr,
      spentInr,
      attemptedInr,
      remainingInr,
      blocked: true,
      fallback
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
