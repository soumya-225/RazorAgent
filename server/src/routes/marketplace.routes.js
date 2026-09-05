import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import config from '../config/env.js';

const router = express.Router();

/**
 * Helper: optionally resolve merchant by API key header
 */
async function resolveMerchantByApiKey(req) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return null;
  return prisma.merchant.findUnique({ where: { apiKey } });
}

/**
 * GET /api/marketplace/info
 * Public store / platform info for external agent discovery
 */
router.get('/info', async (req, res) => {
  try {
    const merchantCount = await prisma.merchant.count();
    const productCount = await prisma.product.count({ where: { inStock: true } });

    return res.json({
      platform: 'RazorAgent Marketplace',
      version: '2.0',
      description: 'Agentic commerce platform powering conversational checkout, AI-driven upsell, and autonomous revenue campaigns.',
      capabilities: [
        'conversational_checkout',
        'upsell_cross_sell',
        'revenue_campaigns',
        'autonomous_payment',
        'safety_gating',
        'x402_protocol',
        'acp_agent_card'
      ],
      endpoints: {
        catalog:       { method: 'GET',  path: '/api/marketplace/catalog',    auth: 'none',    description: 'Full product catalog with pricing and metadata' },
        chat:          { method: 'POST', path: '/api/agents/chat',            auth: 'none',    description: 'Conversational checkout agent — send a message, get shopping help' },
        checkout:      { method: 'POST', path: '/api/agents/checkout',        auth: 'none',    description: 'Create a checkout order and receive a Razorpay payment link' },
        upsell:        { method: 'POST', path: '/api/agents/upsell',          auth: 'none',    description: 'Get upsell / cross-sell bundle recommendations for a cart' },
        analytics:     { method: 'GET',  path: '/api/marketplace/analytics',  auth: 'api_key', description: 'Revenue, orders, campaigns analytics (requires merchant API key)' },
        agentCard:     { method: 'GET',  path: '/.well-known/agent.json',     auth: 'none',    description: 'ACP-compliant agent card for autonomous buyer discovery' },
        jsonLdCatalog: { method: 'GET',  path: '/api/catalog',               auth: 'none',    description: 'JSON-LD structured catalog for machine consumption' }
      },
      stats: {
        activeMerchants: merchantCount,
        productsInStock: productCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketplace/catalog
 * Rich public product listing for external agents
 */
router.get('/catalog', async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    const where = { inStock: true };

    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take: Math.min(Number(limit), 100),
      orderBy: { salesCount30Days: 'desc' },
      include: { merchant: { select: { storeName: true } } }
    });

    const enriched = products.map(p => {
      const marginPercent = p.pricePaise > 0
        ? Math.round(((p.pricePaise - p.costPaise) / p.pricePaise) * 100)
        : 0;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        priceInr: p.pricePaise / 100,
        pricePaise: p.pricePaise,
        inventory: p.inventory,
        inStock: p.inStock,
        salesCount30Days: p.salesCount30Days,
        marginPercent,
        imageUrl: p.imageUrl || null,
        merchant: p.merchant?.storeName || 'RazorAgent Store',
        badges: [
          ...(p.salesCount30Days > 20 ? ['bestseller'] : []),
          ...(marginPercent >= 40 ? ['high-margin'] : []),
          ...(p.inventory < 10 ? ['low-stock'] : [])
        ]
      };
    });

    return res.json({
      catalog: enriched,
      count: enriched.length,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketplace/analytics
 * Merchant analytics — requires x-api-key header
 */
router.get('/analytics', async (req, res) => {
  try {
    const merchant = await resolveMerchantByApiKey(req);
    if (!merchant) {
      return res.status(401).json({
        error: 'API key required. Pass your merchant API key via X-API-Key header or ?api_key= query param.'
      });
    }

    const [orders, campaigns, products] = await Promise.all([
      prisma.order.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.campaign.findMany({
        where: { merchantId: merchant.id }
      }),
      prisma.product.findMany({
        where: { merchantId: merchant.id }
      })
    ]);

    const paidOrders = orders.filter(o => o.status === 'PAID');
    const totalRevenuePaise = paidOrders.reduce((s, o) => s + o.totalAmountPaise, 0);
    const avgOrderValueInr = paidOrders.length > 0
      ? (totalRevenuePaise / paidOrders.length / 100)
      : 0;

    // Revenue by day (last 7 days)
    const now = new Date();
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const dayStr = day.toISOString().slice(0, 10);
      const dayOrders = paidOrders.filter(o =>
        o.createdAt.toISOString().slice(0, 10) === dayStr
      );
      revenueByDay.push({
        date: dayStr,
        revenueInr: dayOrders.reduce((s, o) => s + o.totalAmountPaise / 100, 0),
        orderCount: dayOrders.length
      });
    }

    // Top products by revenue
    const productRevenue = {};
    paidOrders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach(item => {
        if (!productRevenue[item.sku]) {
          productRevenue[item.sku] = { sku: item.sku, name: item.name, revenueInr: 0, qty: 0 };
        }
        productRevenue[item.sku].revenueInr += (item.pricePaise * item.qty) / 100;
        productRevenue[item.sku].qty += item.qty;
      });
    });
    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenueInr - a.revenueInr)
      .slice(0, 5);

    return res.json({
      merchant: { id: merchant.id, storeName: merchant.storeName },
      summary: {
        totalRevenueInr: totalRevenuePaise / 100,
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        conversionRate: orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0,
        avgOrderValueInr: Math.round(avgOrderValueInr * 100) / 100,
        activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        totalProducts: products.length,
        inStockProducts: products.filter(p => p.inStock).length
      },
      revenueByDay,
      topProducts,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
