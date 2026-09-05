import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import { callLLM } from './llmClient.js';

export class CampaignAgent {
  constructor() {
    this.name = 'CAMPAIGN_AGENT';
  }

  /**
   * Scans inventory for slow-moving & high-margin SKUs
   */
  async analyzeOpportunities(merchantId) {
    const products = await prisma.product.findMany({
      where: merchantId ? { merchantId } : {}
    });

    // Compute margins: ((price - cost) / price) * 100
    const scoredProducts = products.map(p => {
      const marginPercent = p.pricePaise > 0 ? Math.round(((p.pricePaise - p.costPaise) / p.pricePaise) * 100) : 0;
      const isSlowMoving = p.salesCount30Days < 5 && p.inventory > 5;
      const isHighMargin = marginPercent >= 40;
      return {
        ...p,
        marginPercent,
        isSlowMoving,
        isHighMargin
      };
    });

    const slowMoving = scoredProducts.filter(p => p.isSlowMoving);
    const highMargin = scoredProducts.filter(p => p.isHighMargin);

    return {
      totalProducts: products.length,
      slowMoving,
      highMargin,
      recommendation: slowMoving.length > 0
        ? `Found ${slowMoving.length} slow-moving SKUs (<5 monthly sales). Launching a 15-20% clearance campaign can unlock trapped working capital.`
        : `Inventory turnover is healthy. A bundle flash promo on high-margin items (${highMargin.length} SKUs) is recommended.`
    };
  }

  /**
   * Automatically generate and launch a targeted revenue campaign
   */
  async runCampaign({
    merchantId,
    sessionId = 'session_campaign',
    campaignType = 'INVENTORY_CLEARANCE',
    discountPercent = 20,
    customName = null,
    selectedSkus = []   // optional: merchant-selected product SKUs from the UI
  }) {
    const analysis = await this.analyzeOpportunities(merchantId);

    // If merchant explicitly selected SKUs, use those; otherwise fall back to AI-picked targets
    let targetProducts;
    if (selectedSkus && selectedSkus.length > 0) {
      const allCandidates = [...analysis.slowMoving, ...analysis.highMargin];
      targetProducts = allCandidates.filter(p => selectedSkus.includes(p.sku));
      // Fall back to all scored products if none of the selected SKUs matched scored pools
      if (targetProducts.length === 0) {
        targetProducts = await prisma.product.findMany({
          where: { merchantId, sku: { in: selectedSkus } }
        });
      }
    } else {
      targetProducts = analysis.slowMoving.length > 0
        ? analysis.slowMoving.slice(0, 3)
        : analysis.highMargin.slice(0, 3);
    }

    if (targetProducts.length === 0) {
      throw new Error('No qualifying products found for campaign generation.');
    }

    let campaignCode = `BOOST${discountPercent}_${Math.floor(Math.random() * 900 + 100)}`;
    let campaignName = customName || (campaignType === 'INVENTORY_CLEARANCE'
      ? `Clearance Booster (${discountPercent}% OFF)`
      : `High Margin Flash Sale (${discountPercent}% OFF)`);

    const primaryProduct = targetProducts[0];
    const discountedPricePaise = Math.round(primaryProduct.pricePaise * (1 - discountPercent / 100));

    let reasoning = `AI Campaign Agent identified ${targetProducts.length} target SKUs (${targetProducts.map(p => p.sku).join(', ')}) with low 30-day velocity. Created ${discountPercent}% promo code '${campaignCode}' and generated promotional payment link to stimulate purchase conversion.`;

    try {
      const llmRes = await callLLM({
        systemPrompt: 'You are an autonomous AI Revenue & Growth Campaign Agent for an e-commerce platform.',
        messages: [{
          role: 'user',
          content: `Generate a growth campaign strategy for:
Campaign Type: ${campaignType}
Discount: ${discountPercent}%
Target Products: ${targetProducts.map(p => `${p.name} (SKU: ${p.sku}, Price: ₹${p.pricePaise / 100}, Margin: ${p.marginPercent}%, Monthly Sales: ${p.salesCount30Days})`).join(', ')}

Output JSON:
{
  "campaignName": "Catchy short campaign title",
  "couponCode": "UPPERCASE_CODE",
  "reasoning": "2-3 sentences explaining the economic rationale and target conversion lift."
}`
        }]
      });

      if (llmRes.content && !llmRes.fallback) {
        const match = llmRes.content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.campaignName && !customName) campaignName = parsed.campaignName;
          if (parsed.couponCode) campaignCode = parsed.couponCode.toUpperCase().replace(/[^A-Z0-9_]/g, '');
          if (parsed.reasoning) reasoning = parsed.reasoning;
        }
      }
    } catch (err) {
      console.warn('Campaign LLM error:', err.message);
    }

    // Ensure couponCode is globally unique in DB to prevent unique constraint failures
    const ensureUniqueCode = async (baseCode) => {
      let clean = (baseCode || `PROMO${discountPercent}`).toUpperCase().replace(/[^A-Z0-9_]/g, '');
      let candidate = clean;
      let existing = await prisma.campaign.findUnique({ where: { couponCode: candidate } });
      if (!existing) return candidate;

      for (let i = 0; i < 15; i++) {
        const suffix = Math.floor(Math.random() * 9000 + 1000);
        candidate = `${clean}_${suffix}`;
        existing = await prisma.campaign.findUnique({ where: { couponCode: candidate } });
        if (!existing) return candidate;
      }
      return `${clean}_${Date.now().toString().slice(-6)}`;
    };

    campaignCode = await ensureUniqueCode(campaignCode);

    const intercepted = await safetyService.interceptAction({
      merchantId,
      sessionId,
      agentName: this.name,
      actionType: 'create_growth_campaign',
      amountPaise: discountedPricePaise,
      // A campaign creates a payment link that CUSTOMERS pay — it is revenue for the merchant,
      // not an expense. The spending cap gate must not block campaign creation.
      isCustomerCheckout: true,
      explanation: reasoning,
      payload: {
        campaignName,
        campaignCode,
        discountPercent,
        targetSkus: targetProducts.map(p => p.sku),
        leadProduct: primaryProduct.sku
      },
      executeFn: async () => {
        // Double check uniqueness right before DB insertion
        campaignCode = await ensureUniqueCode(campaignCode);

        // 1. Create Razorpay Payment Link for the campaign's lead item
        const link = await razorpayService.createPaymentLink({
          amount: discountedPricePaise,
          currency: 'INR',
          description: `${campaignName} - ${primaryProduct.name}`,
          expireBy: Math.floor(Date.now() / 1000) + (48 * 3600), // 48 hours validity
          notes: {
            campaignCode,
            productSku: primaryProduct.sku,
            discountPercent
          }
        });

        // 2. Persist Campaign in DB
        const savedCampaign = await prisma.campaign.create({
          data: {
            merchantId,
            name: campaignName,
            type: campaignType,
            discountPercent,
            couponCode: campaignCode,
            targetSkus: targetProducts.map(p => ({
              sku: p.sku,
              name: p.name,
              originalPriceInr: p.pricePaise / 100,
              discountedPriceInr: (p.pricePaise * (1 - discountPercent / 100)) / 100
            })),
            paymentLinkUrl: link.short_url,
            razorpayPaymentLinkId: link.id,
            reasoning,
            status: 'ACTIVE'
          }
        });

        return {
          campaignId: savedCampaign.id,
          name: savedCampaign.name,
          couponCode: savedCampaign.couponCode,
          discountPercent: savedCampaign.discountPercent,
          paymentLinkUrl: savedCampaign.paymentLinkUrl,
          paymentLinkId: link.id,
          targetProducts: targetProducts.map(p => ({
            sku: p.sku,
            name: p.name,
            originalPriceInr: p.pricePaise / 100,
            discountedPriceInr: (p.pricePaise * (1 - discountPercent / 100)) / 100
          })),
          reasoning,
          isSandbox: link.isSandbox
        };
      }
    });

    if (intercepted.result) {
      return { ...intercepted.result, requiresApproval: false };
    }
    return intercepted;
  }

  /**
   * Generates AI-driven narrative insights on campaign revenue performance
   */
  async generateCampaignInsights(merchantId) {
    const merchantFilter = merchantId ? { merchantId } : {};

    const [orders, campaigns, merchant] = await Promise.all([
      prisma.order.findMany({
        where: merchantFilter,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.campaign.findMany({
        where: merchantFilter,
        orderBy: { createdAt: 'desc' }
      }),
      merchantId ? prisma.merchant.findUnique({ where: { id: merchantId } }) : null
    ]);

    const paidOrders = orders.filter(o => o.status === 'PAID');
    const totalRevenuePaise = paidOrders.reduce((s, o) => s + (o.totalAmountPaise || 0), 0);
    const totalRevenueInr = Math.round(totalRevenuePaise / 100);

    // Filter orders influenced by campaigns
    const campaignOrders = paidOrders.filter(o => {
      if (o.discountAmountPaise && o.discountAmountPaise > 0) return true;
      const items = Array.isArray(o.items)
        ? o.items
        : typeof o.items === 'string'
          ? JSON.parse(o.items || '[]')
          : [];
      return items.some(i => i.couponCode || (i.discountPaise && i.discountPaise > 0));
    });

    const campaignRevenuePaise = campaignOrders.reduce((s, o) => s + (o.totalAmountPaise || 0), 0);
    const campaignRevenueInr = Math.round(campaignRevenuePaise / 100);
    const campaignDiscountsPaise = campaignOrders.reduce((s, o) => s + (o.discountAmountPaise || 0), 0);
    const campaignDiscountsInr = Math.round(campaignDiscountsPaise / 100);
    const campaignSharePercent = totalRevenueInr > 0 ? Math.round((campaignRevenueInr / totalRevenueInr) * 100) : 0;
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');

    // Aggregate sold items under campaigns
    const campaignItemCounts = {};
    campaignOrders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : typeof o.items === 'string' ? JSON.parse(o.items || '[]') : [];
      items.forEach(i => {
        const key = i.name || i.sku || 'Item';
        campaignItemCounts[key] = (campaignItemCounts[key] || 0) + (i.quantity || i.qty || 1);
      });
    });

    const topCampaignItems = Object.entries(campaignItemCounts)
      .map(([name, count]) => `${name} (${count} units)`)
      .slice(0, 5);

    // Default intelligent rule-based narrative
    let narrative = '';
    let headline = '';

    if (campaignRevenueInr > 0) {
      headline = `AI Campaigns drove ₹${campaignRevenueInr.toLocaleString('en-IN')} (${campaignSharePercent}% of total store revenue)`;
      narrative = `AI-powered revenue campaigns have significantly accelerated sales momentum. Promotional discounts totaling ₹${campaignDiscountsInr.toLocaleString('en-IN')} directly triggered ${campaignOrders.length} customer purchases, generating ₹${campaignRevenueInr.toLocaleString('en-IN')} in net captured revenue. Targeted campaigns on high-margin and slow-moving SKUs successfully cleared trapped working capital while increasing basket conversion velocity.`;
    } else if (activeCampaigns.length > 0) {
      const leadCampaign = activeCampaigns[0];
      headline = `Active campaign '${leadCampaign.name}' is live with promo code '${leadCampaign.couponCode}'`;
      narrative = `Your autonomous AI campaign is currently active and broadcasted across storefront chatbots. Customers are actively presented with ${leadCampaign.discountPercent}% promo offers on target SKUs. Revenue lift metrics will update in real-time as shoppers complete checkout with this promotion.`;
    } else {
      headline = `Launch an AI Campaign to unlock additional trapped revenue`;
      narrative = `No active growth campaigns are currently running. Launching an AI inventory clearance or high-margin bundle promo can boost conversion by up to 28% and monetize stagnant catalog inventory with automated Razorpay checkout links.`;
    }

    // Try calling LLM for customized executive narrative
    try {
      const llmRes = await callLLM({
        systemPrompt: 'You are an elite E-commerce AI Revenue Strategist. Provide crisp, data-driven executive insights as bullet points.',
        messages: [{
          role: 'user',
          content: `Merchant Store: ${merchant?.storeName || 'Merchant Store'}
Total Store Revenue: ₹${totalRevenueInr} (${paidOrders.length} paid orders)
Campaign-Driven Revenue: ₹${campaignRevenueInr} (${campaignSharePercent}% of total revenue, ${campaignOrders.length} orders)
Total Campaign Discounts Granted: ₹${campaignDiscountsInr}
Active Campaigns (${activeCampaigns.length}): ${activeCampaigns.map(c => `${c.name} (Code: ${c.couponCode}, -${c.discountPercent}%)`).join('; ') || 'None'}
Top Items Sold via Promos: ${topCampaignItems.join(', ') || 'None yet'}

Generate exactly 4-5 crisp bullet points covering:
1. Revenue impact and percentage lift from AI campaigns.
2. How promotions are affecting inventory turnover or basket size.
3. Customer engagement signals from campaign-driven orders.
4. Discount ROI — is the promo investment paying off?
5. One key recommendation for the next promotion.

Respond in JSON format:
{
  "headline": "Catchy 1-sentence headline with revenue numbers",
  "narrative": "- First bullet point insight\\n- Second bullet point insight\\n- Third bullet point insight\\n- Fourth bullet point insight\\n- Fifth bullet point insight"
}`
        }]
      });

      if (llmRes.content && !llmRes.fallback) {
        const match = llmRes.content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.headline) headline = parsed.headline;
          if (parsed.narrative) narrative = parsed.narrative;
        }
      }
    } catch (err) {
      console.warn('AI Campaign Insights LLM error, using intelligent fallback:', err.message);
    }

    return {
      totalRevenueInr,
      campaignRevenueInr,
      campaignSharePercent,
      campaignDiscountsInr,
      campaignOrdersCount: campaignOrders.length,
      totalOrdersCount: paidOrders.length,
      activeCampaignsCount: activeCampaigns.length,
      headline,
      narrative,
      topCampaignItems,
      generatedAt: new Date().toISOString()
    };
  }
}

export const campaignAgent = new CampaignAgent();
export default campaignAgent;

