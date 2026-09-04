import express from 'express';
import merchantRegistryService from '../services/merchantRegistryService.js';

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

export default router;
