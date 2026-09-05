import express from 'express';
import prisma from '../config/db.js';
import checkoutAgent from '../agents/checkoutAgent.js';
import upsellAgent from '../agents/upsellAgent.js';
import campaignAgent from '../agents/campaignAgent.js';
import buyerAgent from '../agents/buyerAgent.js';
import { optionalMerchantAuth, requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * POST /api/agents/chat
 * Conversational Checkout Chat
 */
router.post('/chat', optionalMerchantAuth, async (req, res) => {
  try {
    const { message, sessionId = 'chat_session', history = [], cart = [] } = req.body;
    const merchantId = req.merchant?.id || null;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await checkoutAgent.processUserMessage({
      merchantId,
      sessionId,
      userMessage: message,
      conversationHistory: history,
      cart
    });

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/checkout
 * Initiate Order with Safety Gating
 */
router.post('/checkout', optionalMerchantAuth, async (req, res) => {
  try {
    const { items, customer, couponCode, sessionId = 'checkout_session' } = req.body;
    const merchantId = req.merchant?.id || null;

    const result = await checkoutAgent.createOrder({
      merchantId,
      sessionId,
      items,
      customer,
      couponCode,
      explanation: 'Customer placed order via RazorAgent Checkout'
    });

    return res.json(result);
  } catch (err) {
    if (err.name === 'SafetyError') {
      return res.status(403).json({
        error: 'Safety Gate Blocked Action',
        code: err.code,
        message: err.message,
        details: err.details
      });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/upsell
 * Get Smart Upsell Recommendations & Bundle Deal for a Cart
 */
router.post('/upsell', optionalMerchantAuth, async (req, res) => {
  try {
    const { cartItems, sessionId = 'upsell_session' } = req.body;
    const merchantId = req.merchant?.id || null;

    const result = await upsellAgent.recommendUpsell({
      merchantId,
      sessionId,
      cartItems
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/bundle-checkout
 * Create Payment Link for Discounted Bundle Deal
 */
router.post('/bundle-checkout', optionalMerchantAuth, async (req, res) => {
  try {
    const { bundleOffer, sessionId = 'bundle_session' } = req.body;
    const merchantId = req.merchant?.id || null;

    const result = await upsellAgent.createBundleCheckoutLink({
      merchantId,
      sessionId,
      bundleOffer
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/campaign/list
 * Fetch all active and past campaigns for merchant
 */
router.get('/campaign/list', optionalMerchantAuth, async (req, res) => {
  try {
    const merchantId = req.merchant?.id || null;
    const where = merchantId ? { merchantId } : {};
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ campaigns });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/campaign/:id/end
 * Ends/deactivates an active campaign and invalidates the coupon code
 */
router.post('/campaign/:id/end', optionalMerchantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'EXPIRED' }
    });

    return res.json({
      success: true,
      message: `Campaign "${updated.name}" has been ended. Coupon "${updated.couponCode}" is now invalid.`,
      campaign: updated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/campaign/analyze
 * Scans Inventory for Slow-Moving / High-Margin Opportunities
 */
router.post('/campaign/analyze', optionalMerchantAuth, async (req, res) => {
  try {
    const merchantId = req.merchant?.id || null;
    const analysis = await campaignAgent.analyzeOpportunities(merchantId);
    return res.json(analysis);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/campaign/run
 * Generates and Launches Targeted Growth Campaign
 */
router.post('/campaign/run', optionalMerchantAuth, async (req, res) => {
  try {
    const {
      campaignType = 'INVENTORY_CLEARANCE',
      discountPercent = 20,
      customName,
      selectedSkus = []  // merchant-selected product SKUs from the UI
    } = req.body;
    const merchantId = req.merchant?.id || null;

    const result = await campaignAgent.runCampaign({
      merchantId,
      campaignType,
      discountPercent: Number(discountPercent),
      customName,
      selectedSkus
    });

    return res.json(result);
  } catch (err) {
    if (err.name === 'SafetyError') {
      return res.status(403).json({ error: err.message, code: err.code, details: err.details });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/buyer/run
 * Runs Autonomous AI Buyer Simulation
 */
router.post('/buyer/run', async (req, res) => {
  try {
    const { budgetInr = 5000, objective = 'Buy the best value audio setup', testBudgetExceed = true } = req.body;
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const merchantBaseUrl = `${protocol}://${host}`;

    const simulation = await buyerAgent.runBuyerLoop({
      merchantBaseUrl,
      budgetInr: Number(budgetInr),
      objective,
      testBudgetExceedScenario: Boolean(testBudgetExceed)
    });

    return res.json(simulation);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
