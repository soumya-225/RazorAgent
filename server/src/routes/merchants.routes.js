import express from 'express';
import prisma from '../config/db.js';
import merchantRegistryService from '../services/merchantRegistryService.js';
import sbmdService from '../services/sbmdService.js';
import { optionalMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/merchants
 * List all registered merchants in the network with their store details & catalogs
 */
router.get('/', async (req, res) => {
  try {
    const merchants = await merchantRegistryService.getAllMerchants();
    return res.json({
      merchants,
      count: merchants.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/merchants/registry
 * Returns structured ACP Merchant Registry card for agent discovery
 */
router.get('/registry', async (req, res) => {
  try {
    const merchants = await merchantRegistryService.getAllMerchants();
    return res.json({
      protocol: 'ACP/1.0',
      networkName: 'RazorAgent Merchant Network',
      merchantCount: merchants.length,
      merchants: merchants.map(m => ({
        id: m.id,
        storeName: m.storeName,
        categories: m.categories,
        productCount: m.productCount,
        activeCoupon: m.activeCoupon,
        discountPercent: m.discountPercent
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/merchants/find-best-deal
 * Agent endpoint to compare prices across all registered merchants and pick the best deal
 */
router.post('/find-best-deal', async (req, res) => {
  try {
    const { query = '', category = '', maxBudgetInr = null } = req.body;
    const comparison = await merchantRegistryService.findBestDeals({
      query,
      category,
      maxBudgetInr: maxBudgetInr ? Number(maxBudgetInr) : null
    });
    return res.json(comparison);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/merchants/:id/sbmd-reserve
 * Get the current SBMD spending reserve for a merchant
 */
router.get('/:id/sbmd-reserve', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    return res.json({
      merchantId: merchant.id,
      storeName: merchant.storeName,
      reservePaise: merchant.spendingCapPaise || 0,
      reserveInr: (merchant.spendingCapPaise || 0) / 100,
      approvalThresholdPaise: merchant.approvalThresholdPaise || 0,
      approvalThresholdInr: (merchant.approvalThresholdPaise || 0) / 100
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/merchants/:id/sbmd-reserve
 * Set or top-up the SBMD spending reserve (spending cap)
 */
router.patch('/:id/sbmd-reserve', async (req, res) => {
  try {
    const { reserveInr, approvalThresholdInr } = req.body;
    const updates = {};
    if (reserveInr !== undefined) updates.spendingCapPaise = Math.round(Number(reserveInr) * 100);
    if (approvalThresholdInr !== undefined) updates.approvalThresholdPaise = Math.round(Number(approvalThresholdInr) * 100);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide reserveInr or approvalThresholdInr to update' });
    }

    const merchant = await prisma.merchant.update({
      where: { id: req.params.id },
      data: updates
    });

    return res.json({
      success: true,
      merchantId: merchant.id,
      reserveInr: merchant.spendingCapPaise / 100,
      approvalThresholdInr: merchant.approvalThresholdPaise / 100,
      message: `SBMD reserve updated to ₹${(merchant.spendingCapPaise / 100).toLocaleString('en-IN')}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
