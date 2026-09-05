import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import { callLLM } from './llmClient.js';

export class UpsellAgent {
  constructor() {
    this.name = 'UPSELL_AGENT';
  }

  /**
   * LLM-powered upsell + cross-sell recommendation engine.
   *
   * Upsell  = same category, higher price ("For ₹X more you get the Pro version…")
   * Cross-sell = complementary category, adds basket value ("People also pick up…")
   *
   * Strategy:
   * 1. Resolve cart items from DB (source of truth for names/prices)
   * 2. Build TWO candidate pools: upsell (same-category, pricier) + cross-sell (other category, in-stock)
   * 3. Send both pools + cart context to GPT-4o with an honest recommendation prompt
   * 4. Parse structured JSON from LLM → return typed bundle offer
   */
  async recommendUpsell({ merchantId, sessionId = 'session_upsell', cartItems = [] }) {
    if (!cartItems || cartItems.length === 0) {
      return { recommendations: [], bundleOffer: null };
    }

    // ── 1. Resolve cart products from DB ────────────────────────────────────────
    const productSkus = cartItems.map(i => i.sku || i.productId).filter(Boolean);
    const cartProducts = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: productSkus } },
          { id: { in: productSkus } }
        ]
      }
    });

    if (cartProducts.length === 0) {
      return { recommendations: [], bundleOffer: null };
    }

    const cartTotalPaise = cartProducts.reduce((sum, p) => sum + p.pricePaise, 0);
    const cartCategories = [...new Set(cartProducts.map(p => p.category))];
    const excludedIds = cartProducts.map(p => p.id);
    const avgCartPricePaise = cartTotalPaise / cartProducts.length;

    // ── 2a. Upsell candidates: same category, higher price, not in cart ──────────
    const upsellCandidates = await prisma.product.findMany({
      where: {
        id: { notIn: excludedIds },
        inStock: true,
        inventory: { gt: 0 },
        category: { in: cartCategories },
        pricePaise: { gt: avgCartPricePaise } // strictly pricier
      },
      orderBy: { salesCount30Days: 'desc' },
      take: 4
    });

    // ── 2b. Cross-sell candidates: different category, top sellers, in stock ─────
    const crossSellCandidates = await prisma.product.findMany({
      where: {
        id: { notIn: excludedIds },
        inStock: true,
        inventory: { gt: 0 },
        category: { notIn: cartCategories }
      },
      orderBy: [
        { salesCount30Days: 'desc' },
        { pricePaise: 'asc' } // prefer affordable add-ons
      ],
      take: 6
    });

    // ── 3. Build LLM prompt ───────────────────────────────────────────────────────
    const cartSummary = cartProducts.map(p =>
      `• ${p.name} | SKU: ${p.sku} | ₹${p.pricePaise / 100} | Category: ${p.category}`
    ).join('\n');

    const upsellSummary = upsellCandidates.length > 0
      ? upsellCandidates.map(p =>
          `• ${p.name} | SKU: ${p.sku} | ₹${p.pricePaise / 100} | Sales/30d: ${p.salesCount30Days}`
        ).join('\n')
      : '(none available)';

    const crossSellSummary = crossSellCandidates.length > 0
      ? crossSellCandidates.map(p =>
          `• ${p.name} | SKU: ${p.sku} | ₹${p.pricePaise / 100} | Category: ${p.category} | Sales/30d: ${p.salesCount30Days}`
        ).join('\n')
      : '(none available)';

    const systemPrompt = `You are an expert AI shopping assistant for RazorAgent Marketplace.
Your job is to generate honest, concise upsell and cross-sell recommendations based on the customer's cart.

Definitions:
- UPSELL: Same category, higher value item. Nudge the customer toward a better version of what they want.
  Example: "For ₹1,000 more you get the Pro version with noise cancellation — most buyers chose this."
- CROSS_SELL: Complementary product from a different category that pairs naturally with the cart.
  Example: "People who buy headphones also grab a Bluetooth Speaker and a charging hub."

RULES:
1. Only recommend products from the lists provided below — NEVER invent products.
2. Be honest. If the cart already has the best item in its category, say "no upsell needed" in the explanation.
3. Keep language conversational and trust-building, NOT pushy or spammy.
4. Recommend at most 1 UPSELL and 2 CROSS_SELL items.
5. For the bundle discount, calculate 8–15% off the combined price of cart + recommended item(s). Only suggest a bundle if it genuinely adds value.
6. Output ONLY valid JSON — no prose, no markdown, no code fences.

Output format (strict JSON):
{
  "upsell": null | {
    "sku": "SKU_CODE",
    "name": "Product Name",
    "priceInr": 0000,
    "pitch": "Short honest pitch why this is worth the extra spend (1-2 sentences, conversational)"
  },
  "crossSell": [
    {
      "sku": "SKU_CODE",
      "name": "Product Name",
      "priceInr": 0000,
      "pitch": "Why this pairs well (1 sentence)"
    }
  ],
  "bundleRecommendation": null | {
    "targetSku": "SKU_CODE of the primary recommended item (upsell or best cross-sell)",
    "discountPercent": 10,
    "savingsInr": 250,
    "bundleTotalInr": 4500,
    "explanation": "Bundle pitch shown to the customer (2 sentences max, cite actual savings)"
  },
  "noRecommendation": false | true,
  "noRecommendationReason": "Only if noRecommendation=true: explain why (e.g. cart is already optimal)"
}`;

    const userPrompt = `Customer's Cart:
${cartSummary}
Cart Total: ₹${cartTotalPaise / 100}

UPSELL candidates (same category, higher price):
${upsellSummary}

CROSS-SELL candidates (complementary categories):
${crossSellSummary}

Generate your recommendation now.`;

    // ── 4. Call LLM ───────────────────────────────────────────────────────────────
    let llmResult = null;
    try {
      const llmRes = await callLLM({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.4  // low temp for consistent structured output
      });

      if (llmRes.content && !llmRes.fallback) {
        // Strip any accidental markdown fences
        const cleaned = llmRes.content
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        llmResult = JSON.parse(cleaned);
      }
    } catch (err) {
      console.error('[UpsellAgent] LLM parse error:', err.message);
    }

    // ── 5. Deterministic fallback if LLM fails ────────────────────────────────────
    if (!llmResult) {
      llmResult = this._deterministicFallback(cartProducts, upsellCandidates, crossSellCandidates);
    }

    // ── 6. Build typed response ───────────────────────────────────────────────────
    const recommendations = [];

    // Resolve upsell product
    const upsellProduct = llmResult.upsell
      ? (upsellCandidates.find(p => p.sku === llmResult.upsell.sku) || null)
      : null;

    if (upsellProduct) {
      recommendations.push({
        type: 'UPSELL',
        id: upsellProduct.id,
        sku: upsellProduct.sku,
        name: upsellProduct.name,
        category: upsellProduct.category,
        priceInr: upsellProduct.pricePaise / 100,
        pricePaise: upsellProduct.pricePaise,
        pitch: llmResult.upsell.pitch,
        reasoning: llmResult.upsell.pitch
      });
    }

    // Resolve cross-sell products
    for (const cs of (llmResult.crossSell || [])) {
      const crossProduct = crossSellCandidates.find(p => p.sku === cs.sku);
      if (crossProduct) {
        recommendations.push({
          type: 'CROSS_SELL',
          id: crossProduct.id,
          sku: crossProduct.sku,
          name: crossProduct.name,
          category: crossProduct.category,
          priceInr: crossProduct.pricePaise / 100,
          pricePaise: crossProduct.pricePaise,
          pitch: cs.pitch,
          reasoning: cs.pitch
        });
      }
    }

    // ── 7. Build bundle offer ─────────────────────────────────────────────────────
    let bundleOffer = null;
    const bundleRec = llmResult.bundleRecommendation;

    // Find the target product for the bundle (upsell takes priority, else first cross-sell)
    const bundleTargetProduct = bundleRec
      ? (upsellProduct?.sku === bundleRec.targetSku
          ? upsellProduct
          : crossSellCandidates.find(p => p.sku === bundleRec.targetSku))
      : (upsellProduct || (crossSellCandidates.length > 0 ? crossSellCandidates[0] : null));

    if (bundleTargetProduct) {
      const combined = cartTotalPaise + bundleTargetProduct.pricePaise;
      const discountPct = bundleRec?.discountPercent || 10;
      const savingsPaise = Math.round((combined * discountPct) / 100);
      const bundleTotalPaise = combined - savingsPaise;
      const explanation = bundleRec?.explanation
        || `Add ${bundleTargetProduct.name} to your cart and save ₹${(savingsPaise / 100).toFixed(0)} with our bundle deal (${discountPct}% off combined).`;

      await safetyService.logAudit({
        sessionId,
        agentName: this.name,
        actionType: `llm_bundle_recommendation(${bundleTargetProduct.sku})`,
        actionPayload: {
          cartSkus: cartProducts.map(p => p.sku),
          recommendedSku: bundleTargetProduct.sku,
          originalTotalInr: combined / 100,
          bundleTotalInr: bundleTotalPaise / 100,
          savingsInr: savingsPaise / 100,
          llmGenerated: !llmResult._fallback
        },
        explanation,
        status: 'SUCCESS',
        amountInr: bundleTotalPaise / 100
      });

      bundleOffer = {
        items: [
          ...cartProducts.map(p => ({ sku: p.sku, name: p.name, priceInr: p.pricePaise / 100 })),
          { sku: bundleTargetProduct.sku, name: bundleTargetProduct.name, priceInr: bundleTargetProduct.pricePaise / 100 }
        ],
        originalTotalInr: combined / 100,
        bundleDiscountPercent: discountPct,
        savingsInr: savingsPaise / 100,
        bundleTotalInr: bundleTotalPaise / 100,
        bundleTotalPaise,
        recommendation: {
          id: bundleTargetProduct.id,
          sku: bundleTargetProduct.sku,
          name: bundleTargetProduct.name,
          priceInr: bundleTargetProduct.pricePaise / 100,
          category: bundleTargetProduct.category
        },
        explanation,
        llmGenerated: !llmResult._fallback
      };
    }

    return { recommendations, bundleOffer };
  }

  /**
   * Deterministic fallback when LLM is unavailable or returns malformed JSON.
   * Keeps the old rule-based behavior so the UI never breaks.
   */
  _deterministicFallback(cartProducts, upsellCandidates, crossSellCandidates) {
    const upsell = upsellCandidates[0]
      ? {
          sku: upsellCandidates[0].sku,
          name: upsellCandidates[0].name,
          priceInr: upsellCandidates[0].pricePaise / 100,
          pitch: `Upgrade to ${upsellCandidates[0].name} for a premium experience — top-rated in this category.`
        }
      : null;

    const crossSell = crossSellCandidates.slice(0, 2).map(p => ({
      sku: p.sku,
      name: p.name,
      priceInr: p.pricePaise / 100,
      pitch: `Pairs perfectly with your purchase — customers frequently buy these together.`
    }));

    const target = upsellCandidates[0] || crossSellCandidates[0];
    const bundleRecommendation = target
      ? {
          targetSku: target.sku,
          discountPercent: 10,
          savingsInr: Math.round((target.pricePaise * 0.1) / 100),
          bundleTotalInr: (cartProducts.reduce((s, p) => s + p.pricePaise, 0) + target.pricePaise * 0.9) / 100,
          explanation: `Bundle with ${target.name} and save 10% on the combined order.`
        }
      : null;

    return { upsell, crossSell, bundleRecommendation, _fallback: true };
  }

  /**
   * Create an instant discounted Razorpay payment link for a bundle offer.
   * Always uses isCustomerCheckout=true since this is triggered by the human shopper.
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
      isCustomerCheckout: true, // bundle checkout is always customer-initiated
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
