import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import { callLLM } from './llmClient.js';

export class UpsellAgent {
  constructor() {
    this.name = 'UPSELL_AGENT';
  }

  /**
   * Analyze items in cart and find high-conversion complementary items
   */
  async recommendUpsell({ merchantId, sessionId = 'session_upsell', cartItems = [] }) {
    if (!cartItems || cartItems.length === 0) {
      return { recommendations: [], bundleOffer: null };
    }

    // Resolve cart items
    const productSkus = cartItems.map(i => i.sku || i.productId);
    const cartProducts = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: productSkus } },
          { id: { in: productSkus } }
        ]
      }
    });

    const cartTotalPaise = cartProducts.reduce((sum, p) => sum + p.pricePaise, 0);
    const cartCategories = [...new Set(cartProducts.map(p => p.category))];
    const excludedIds = cartProducts.map(p => p.id);

    // Find complementary candidates in stock
    const candidates = await prisma.product.findMany({
      where: {
        id: { notIn: excludedIds },
        inStock: true,
        inventory: { gt: 0 }
      },
      orderBy: [
        { salesCount30Days: 'desc' },
        { inventory: 'desc' }
      ],
      take: 6
    });

    // Score and pick complementary items
    const recommendations = candidates.slice(0, 2).map(c => {
      let reasoning = `Complements your ${cartProducts[0]?.name || 'purchase'} perfectly for an enhanced experience.`;
      if (c.category.includes('Audio') && cartCategories.some(cat => cat.includes('Audio'))) {
        reasoning = `Pair with ${c.name} for superior studio acoustic fidelity and protection.`;
      } else if (c.category.includes('Cable') || c.category.includes('Accessory')) {
        reasoning = `Essential companion accessory with fast-charging durability.`;
      }

      return {
        id: c.id,
        sku: c.sku,
        name: c.name,
        category: c.category,
        pricePaise: c.pricePaise,
        priceInr: c.pricePaise / 100,
        reasoning
      };
    });

    // Calculate bundle discount (12% off total bundle)
    let bundleOffer = null;
    if (recommendations.length > 0) {
      const topComplement = recommendations[0];
      const combinedOriginalPaise = cartTotalPaise + topComplement.pricePaise;
      
      // Keep bundle total under 1.5x original cart
      if (combinedOriginalPaise <= cartTotalPaise * 1.6 || cartTotalPaise === 0) {
        const bundleDiscountPercent = 12;
        const discountAmountPaise = Math.round((combinedOriginalPaise * bundleDiscountPercent) / 100);
        const bundleFinalAmountPaise = combinedOriginalPaise - discountAmountPaise;

        const bundleExplanation = `Recommended ${topComplement.name} (₹${topComplement.priceInr}) as complementary upsell for ${cartProducts[0]?.name || 'cart'} with ${bundleDiscountPercent}% bundle discount (saving ₹${(discountAmountPaise / 100).toFixed(2)}).`;

        // Log safety audit for upsell evaluation
        await safetyService.logAudit({
          sessionId,
          agentName: this.name,
          actionType: `calculate_bundle_upsell(${topComplement.sku})`,
          actionPayload: {
            cartSkus: cartProducts.map(p => p.sku),
            recommendedSku: topComplement.sku,
            originalTotalInr: combinedOriginalPaise / 100,
            bundleTotalInr: bundleFinalAmountPaise / 100,
            savingsInr: discountAmountPaise / 100
          },
          explanation: bundleExplanation,
          status: 'SUCCESS',
          amountInr: bundleFinalAmountPaise / 100
        });

        bundleOffer = {
          items: [
            ...cartProducts.map(p => ({ sku: p.sku, name: p.name, priceInr: p.pricePaise / 100 })),
            { sku: topComplement.sku, name: topComplement.name, priceInr: topComplement.priceInr }
          ],
          originalTotalInr: combinedOriginalPaise / 100,
          bundleDiscountPercent,
          savingsInr: discountAmountPaise / 100,
          bundleTotalInr: bundleFinalAmountPaise / 100,
          bundleTotalPaise: bundleFinalAmountPaise,
          recommendation: topComplement,
          explanation: bundleExplanation
        };
      }
    }

    return {
      recommendations,
      bundleOffer
    };
  }

  /**
   * Create an instant discounted Razorpay payment link for a bundle offer
   */
  async createBundleCheckoutLink({ merchantId, sessionId = 'session_upsell', bundleOffer }) {
    if (!bundleOffer || !bundleOffer.bundleTotalPaise) {
      throw new Error('Invalid bundle offer specification');
    }

    const intercepted = await safetyService.interceptAction({
      merchantId,
      sessionId,
      agentName: this.name,
      actionType: 'create_bundle_payment_link',
      amountPaise: bundleOffer.bundleTotalPaise,
      explanation: `Generated 30-minute instant payment link for discounted bundle offer saving ₹${bundleOffer.savingsInr}.`,
      payload: bundleOffer,
      executeFn: async () => {
        const link = await razorpayService.createPaymentLink({
          amount: bundleOffer.bundleTotalPaise,
          currency: 'INR',
          description: `RazorAgent Special Bundle Deal (${bundleOffer.bundleDiscountPercent}% OFF)`,
          expireBy: Math.floor(Date.now() / 1000) + 1800 // 30 mins
        });
        return {
          paymentLinkId: link.id,
          paymentLinkUrl: link.short_url,
          amountInr: bundleOffer.bundleTotalInr,
          expiresInMinutes: 30,
          isSandbox: link.isSandbox
        };
      }
    });

    return intercepted;
  }
}

export const upsellAgent = new UpsellAgent();
export default upsellAgent;
