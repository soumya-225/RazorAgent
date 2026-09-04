import express from 'express';
import prisma from '../config/db.js';
import { optionalMerchantAuth, requireMerchantAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/products
 * List all products with optional filters
 */
router.get('/', optionalMerchantAuth, async (req, res) => {
  try {
    const { category, inStock, search } = req.query;
    const where = {};

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }
    if (inStock !== undefined) {
      where.inStock = inStock === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const enriched = products.map(p => {
      const marginPercent = p.pricePaise > 0 ? Math.round(((p.pricePaise - p.costPaise) / p.pricePaise) * 100) : 0;
      return {
        ...p,
        priceInr: p.pricePaise / 100,
        costInr: p.costPaise / 100,
        marginPercent,
        isSlowMoving: p.salesCount30Days < 5 && p.inventory > 5,
        isHighMargin: marginPercent >= 40
      };
    });

    return res.json({ products: enriched, count: enriched.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/coupon/:code
 * Validate a coupon code and return discount info — does NOT create any order.
 */
router.get('/coupon/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const campaign = await prisma.campaign.findUnique({
      where: { couponCode: code }
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      return res.status(404).json({ error: `Coupon '${code}' is invalid or expired.` });
    }

    return res.json({
      code: campaign.couponCode,
      discountPercent: campaign.discountPercent || 10,
      description: campaign.description || `${campaign.discountPercent || 10}% off your order`,
      validUntil: campaign.endDate || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: req.params.id }, { sku: req.params.id }]
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const marginPercent = product.pricePaise > 0 ? Math.round(((product.pricePaise - product.costPaise) / product.pricePaise) * 100) : 0;

    return res.json({
      product: {
        ...product,
        priceInr: product.pricePaise / 100,
        costInr: product.costPaise / 100,
        marginPercent
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/products
 * Create new product (Merchant only)
 */
router.post('/', requireMerchantAuth, async (req, res) => {
  try {
    const { sku, name, description, priceInr, costInr, category, inventory, imageUrl } = req.body;
    if (!sku || !name || !priceInr) {
      return res.status(400).json({ error: 'SKU, name, and price are required.' });
    }

    const pricePaise = Math.round(Number(priceInr) * 100);
    const costPaise = Math.round(Number(costInr || priceInr * 0.6) * 100);

    const product = await prisma.product.create({
      data: {
        sku: sku.toUpperCase().trim(),
        name,
        description: description || '',
        pricePaise,
        costPaise,
        category: category || 'General',
        inventory: Number(inventory) || 50,
        imageUrl: imageUrl || null,
        merchantId: req.merchant.id,
        inStock: (Number(inventory) || 50) > 0
      }
    });

    return res.status(201).json({
      message: 'Product created successfully',
      product: {
        ...product,
        priceInr: product.pricePaise / 100,
        costInr: product.costPaise / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/products/:id/inventory
 */
router.patch('/:id/inventory', requireMerchantAuth, async (req, res) => {
  try {
    const { inventory, inStock } = req.body;
    const updateData = {};

    if (inventory !== undefined) {
      updateData.inventory = Number(inventory);
      updateData.inStock = Number(inventory) > 0;
    }
    if (inStock !== undefined) {
      updateData.inStock = Boolean(inStock);
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData
    });

    return res.json({
      message: 'Product inventory updated',
      product: {
        ...product,
        priceInr: product.pricePaise / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
