import prisma from '../config/db.js';
import { callLLM } from '../agents/llmClient.js';

export class MerchantRegistryService {
  /**
   * Get all registered merchants in the network with catalog stats & active campaigns
   */
  async getAllMerchants() {
    const merchants = await prisma.merchant.findMany({
      include: {
        products: {
          where: { inStock: true },
          select: {
            id: true,
            sku: true,
            name: true,
            pricePaise: true,
            category: true,
            inventory: true,
            inStock: true
          }
        },
        campaigns: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            couponCode: true,
            discountPercent: true,
            type: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return merchants.map(m => {
      const activeCoupon = m.campaigns[0]?.couponCode || null;
      const discountPercent = m.campaigns[0]?.discountPercent || 0;
      const categories = [...new Set(m.products.map(p => p.category.split('>')[0].trim()))];

      return {
        id: m.id,
        name: m.name,
        storeName: m.storeName,
        email: m.email,
        currency: m.currency,
        productCount: m.products.length,
        categories,
        activeCoupon,
        discountPercent,
        spendingCapInr: m.spendingCapPaise / 100,
        approvalThresholdInr: m.approvalThresholdPaise / 100,
        products: m.products.map(p => ({
          ...p,
          priceInr: p.pricePaise / 100,
          effectivePriceInr: Math.round((p.pricePaise * (100 - discountPercent)) / 100) / 100
        })),
        campaigns: m.campaigns
      };
    });
  }

  /**
   * Scan registry across all merchants and compare to find the best deal matching a query/objective
   */
  async findBestDeals({ query = '', category = '', maxBudgetInr = null }) {
    const merchants = await this.getAllMerchants();
    const cleanQuery = query.toLowerCase().trim();
    const cleanCat = category.toLowerCase().trim();

    let candidates = [];

    for (const merchant of merchants) {
      for (const product of merchant.products) {
        const nameMatch = cleanQuery ? product.name.toLowerCase().includes(cleanQuery) : true;
        const descMatch = cleanQuery ? (product.description || '').toLowerCase().includes(cleanQuery) : false;
        const catMatch = cleanCat ? product.category.toLowerCase().includes(cleanCat) : (cleanQuery ? product.category.toLowerCase().includes(cleanQuery) : true);
        const budgetMatch = maxBudgetInr ? product.effectivePriceInr <= maxBudgetInr : true;

        if ((nameMatch || descMatch || catMatch) && budgetMatch) {
          const discountValInr = product.priceInr - product.effectivePriceInr;
          candidates.push({
            merchantId: merchant.id,
            storeName: merchant.storeName,
            merchantName: merchant.name,
            couponCode: merchant.activeCoupon,
            discountPercent: merchant.discountPercent,
            product: {
              id: product.id,
              sku: product.sku,
              name: product.name,
              category: product.category,
              originalPriceInr: product.priceInr,
              effectivePriceInr: product.effectivePriceInr,
              discountValInr,
              inventory: product.inventory
            }
          });
        }
      }
    }

    // Sort by best price & highest discount value
    candidates.sort((a, b) => a.product.effectivePriceInr - b.product.effectivePriceInr);

    const bestDeal = candidates[0] || null;

    // Call LLM for agentic deal summary and explainability
    let aiComparisonSummary = '';
    if (candidates.length > 0) {
      try {
        const prompt = `Compare these merchant offers for query "${query || category || 'electronics'}":
${JSON.stringify(candidates.slice(0, 5), null, 2)}

Provide a concise, professional 2-sentence summary comparing merchants and explaining why the winning deal offers the best value.`;

        const llmRes = await callLLM({
          systemPrompt: 'You are an AI Merchant Registry Advisor that compares store prices and deals objectively.',
          messages: [{ role: 'user', content: prompt }]
        });
        if (llmRes?.content && !llmRes.fallback) {
          aiComparisonSummary = llmRes.content;
        }
      } catch (err) {
        console.warn('Deal comparison LLM note:', err.message);
      }
    }

    if (!aiComparisonSummary && bestDeal) {
      aiComparisonSummary = `Best deal found at **${bestDeal.storeName}**: ${bestDeal.product.name} at ₹${bestDeal.product.effectivePriceInr} (Original ₹${bestDeal.product.originalPriceInr}${bestDeal.couponCode ? ` with coupon ${bestDeal.couponCode}` : ''}).`;
    }

    return {
      query,
      candidateCount: candidates.length,
      bestDeal,
      allDeals: candidates,
      aiComparisonSummary
    };
  }
}

export const merchantRegistryService = new MerchantRegistryService();
export default merchantRegistryService;
