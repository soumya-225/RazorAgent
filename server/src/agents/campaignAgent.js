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

    return intercepted;
  }
}

export const campaignAgent = new CampaignAgent();
export default campaignAgent;
