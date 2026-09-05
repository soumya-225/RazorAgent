import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import merchantRegistryService from '../services/merchantRegistryService.js';
import { callLLM } from './llmClient.js';

export class CheckoutAgent {
  constructor() {
    this.name = 'CHECKOUT_AGENT';
  }

  async searchProducts({ query = '', category = '', maxPricePaise = null }) {
    const where = { inStock: true };
    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } }
      ];
    }
    if (maxPricePaise) {
      where.pricePaise = { lte: maxPricePaise };
    }

    const products = await prisma.product.findMany({ where, take: 10 });
    return products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      priceInr: p.pricePaise / 100,
      pricePaise: p.pricePaise,
      category: p.category,
      inventory: p.inventory,
      description: p.description
    }));
  }

  async applyDiscountCode({ code, items = [], cartTotalPaise = 0 }) {
    if (!code) return { valid: false, discountAmountPaise: 0, finalAmountPaise: cartTotalPaise, message: 'No code provided' };

    const cleanCode = code.toUpperCase().trim();
    const campaign = await prisma.campaign.findUnique({
      where: { couponCode: cleanCode }
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      return {
        valid: false,
        discountAmountPaise: 0,
        finalAmountPaise: cartTotalPaise,
        message: `Coupon code '${cleanCode}' is invalid or expired.`
      };
    }

    const discountPercent = campaign.discountPercent || 10;
    const discountAmountPaise = Math.round((cartTotalPaise * discountPercent) / 100);
    const finalAmountPaise = Math.max(0, cartTotalPaise - discountAmountPaise);

    return {
      valid: true,
      couponCode: cleanCode,
      discountPercent,
      discountAmountPaise,
      discountAmountInr: discountAmountPaise / 100,
      finalAmountPaise,
      finalAmountInr: finalAmountPaise / 100,
      message: `Success! Applied ${discountPercent}% discount code (${cleanCode}).`
    };
  }

  async createOrder({
    merchantId,
    sessionId = 'session_checkout',
    items = [],
    customer = {},
    couponCode = null,
    explanation = 'Customer initiated checkout'
  }) {
    if (!items || items.length === 0) {
      throw new Error('Cannot create order with an empty cart');
    }

    // Resolve items from DB — always use DB price, never trust client-supplied price
    let computedTotalPaise = 0;
    const orderItems = [];

    for (const item of items) {
      // Build OR conditions only from non-empty values.
      // IMPORTANT: { name: { contains: '' } } matches EVERY row in Prisma/SQLite,
      // which is why we must never include it when name is absent.
      const orConditions = [];
      if (item.productId) orConditions.push({ id: item.productId });
      if (item.sku)       orConditions.push({ sku: item.sku });
      if (item.name)      orConditions.push({ name: { contains: item.name, mode: 'insensitive' } });

      if (orConditions.length === 0) {
        throw new Error('Each item must have at least a productId, sku, or name.');
      }

      const product = await prisma.product.findFirst({ where: { OR: orConditions } });

      if (!product) {
        throw new Error(`Product not found: ${item.productId || item.sku || item.name}`);
      }

      if (product.inventory < (item.qty || 1)) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.inventory}`);
      }

      const qty = item.qty || 1;
      const linePaise = product.pricePaise * qty;
      computedTotalPaise += linePaise;

      orderItems.push({
        productId: product.id,
        merchantId: product.merchantId,  // track per-item merchant for multi-tenant attribution
        sku: product.sku,
        name: product.name,
        qty,
        pricePaise: product.pricePaise,
        priceInr: product.pricePaise / 100
      });
    }

    // Auto-assign merchantId from the first product when this is a customer checkout
    // (no merchant JWT present). This ensures orders always appear in the correct
    // merchant's dashboard rather than being lost as null-merchant orphans.
    let resolvedMerchantId = merchantId;
    if (!resolvedMerchantId && orderItems.length > 0) {
      resolvedMerchantId = orderItems[0].merchantId || null;
    }

    // Apply coupon if provided
    let discountPaise = 0;
    if (couponCode) {
      const discountRes = await this.applyDiscountCode({
        code: couponCode,
        items: orderItems,
        cartTotalPaise: computedTotalPaise
      });
      if (discountRes.valid) {
        discountPaise = discountRes.discountAmountPaise;
      }
    }

    const finalAmountPaise = Math.max(100, computedTotalPaise - discountPaise); // Minimum ₹1
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    // Safety Interceptor handles spending caps and audit trails.
    // isCustomerCheckout = true bypasses the AI-agent spending cap and approval gate —
    // those guards are designed for autonomous buyers, not human shoppers.
    const isCustomerCheckout = !merchantId; // original merchantId was null → came from customer storefront
    const intercepted = await safetyService.interceptAction({
      merchantId: resolvedMerchantId,
      sessionId,
      agentName: this.name,
      actionType: 'create_order',
      amountPaise: finalAmountPaise,
      isCustomerCheckout,
      explanation: `${explanation}. Order #${orderNumber} with ${orderItems.length} items totaling ₹${(finalAmountPaise / 100).toFixed(2)}.`,
      payload: { orderNumber, items: orderItems, customer, couponCode, finalAmountPaise },

      executeFn: async () => {
        // 1. Create Razorpay order
        const rzpOrder = await razorpayService.createOrder({
          amount: finalAmountPaise,
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            orderNumber,
            customerName: customer.name || 'Shopper',
            itemCount: orderItems.length
          }
        });

        // 2. Create Razorpay payment link for convenient direct payment
        const rzpLink = await razorpayService.createPaymentLink({
          amount: finalAmountPaise,
          currency: 'INR',
          description: `RazorAgent Order #${orderNumber}`,
          customer,
          notes: { orderNumber, rzpOrderId: rzpOrder.id }
        });

        // 3. Persist Order in DB with resolved merchantId
        const savedOrder = await prisma.order.create({
          data: {
            orderNumber,
            razorpayOrderId: rzpOrder.id,
            merchantId: resolvedMerchantId,   // ← always attributed to correct merchant
            customerName: customer.name || 'Shopper',
            customerEmail: customer.email || 'customer@example.com',
            customerPhone: customer.phone || '+919876543210',
            totalAmountPaise: finalAmountPaise,
            discountAmountPaise: discountPaise,
            currency: 'INR',
            status: 'CREATED',
            items: orderItems,
            paymentLinkUrl: rzpLink.short_url,
            razorpayPaymentLinkId: rzpLink.id,
            metadata: {
              subtotalPaise: computedTotalPaise,
              couponCode: couponCode || null,
              isSandbox: rzpOrder.isSandbox
            }
          }
        });

        return {
          orderId: savedOrder.id,
          orderNumber: savedOrder.orderNumber,
          razorpayOrderId: rzpOrder.id,
          totalAmountInr: finalAmountPaise / 100,
          totalAmountPaise: finalAmountPaise,
          discountAmountInr: discountPaise / 100,
          paymentLinkUrl: rzpLink.short_url,
          paymentLinkId: rzpLink.id,
          items: orderItems,
          status: savedOrder.status,
          isSandbox: rzpOrder.isSandbox
        };
      }
    });

    return intercepted;
  }


  /**
   * Process incoming user chat message in conversational checkout
   */
  async processUserMessage({ merchantId, sessionId, userMessage, conversationHistory = [], cart = [] }) {
    const merchants = await merchantRegistryService.getAllMerchants();
    const products = await prisma.product.findMany({ where: { inStock: true }, take: 20 });

    const merchantRegistryBrief = merchants.map(m =>
      `- Store: "${m.storeName}" (${m.name}) | Categories: ${m.categories.join(', ')} | Active Promo: ${m.activeCoupon ? `${m.activeCoupon} (${m.discountPercent}% OFF)` : 'None'}`
    ).join('\n');

    // Include full product details so the LLM never has to guess prices/names
    const productCatalogBrief = products.map(p =>
      `• ${p.name} | SKU: ${p.sku} | Price: ₹${p.pricePaise / 100} | Category: ${p.category} | Stock: ${p.inventory}`
    ).join('\n');

    const systemPrompt = `You are RazorAgent's Conversational Shopping Agent for a marketplace.

=== CRITICAL RULES (NEVER VIOLATE) ===
1. You MUST only recommend products that exist EXACTLY in the catalog below. Never invent, hallucinate, or suggest products not listed.
2. When recommending products, always use the EXACT name, SKU, and price from the catalog. Never state a different price.
3. If a user asks for a product type not in catalog, tell them honestly and suggest the closest available alternative from the list.
4. NEVER mention brand names like "Dell", "Apple", "Sony" etc. unless they appear verbatim in the catalog below.

=== CATALOG (Only recommend from this list) ===
${productCatalogBrief}

=== MERCHANT NETWORK ===
${merchantRegistryBrief}

=== YOUR BEHAVIOR ===
- Be friendly, concise, and helpful.
- When a user asks to see products or recommendations, mention them briefly in text and always include the ACTION block so the UI renders product cards.
- For budget queries (e.g. "under ₹X"), filter from the catalog above and only show products whose Price is ≤ the requested amount.
- If the user wants to buy, confirm with exact catalog price and proceed to CHECKOUT action.
- For coupon codes (WELCOME10, VOLT20, NEXUS15, DESK10), acknowledge and include in checkout action.

=== ACTION FORMAT (always append at end of reply) ===
For purchases:
ACTION: {"intent": "CHECKOUT", "items": [{"sku": "EXACT_SKU_FROM_CATALOG", "qty": 1}], "coupon": null}

For product suggestions/recommendations (always include even for INFO):
ACTION: {"intent": "INFO", "recommendedSkus": ["SKU1", "SKU2"]}
`;

    const llmRes = await callLLM({
      systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ]
    });

    if (llmRes.content && !llmRes.fallback) {
      // Parse action block if present
      let action = null;
      let replyText = llmRes.content;

      // Strip ACTION: {...} blocks (our explicit delimiter)
      const actionMatch = replyText.match(/ACTION:\s*(\{[\s\S]*?\})\s*$/m);
      if (actionMatch) {
        try {
          action = JSON.parse(actionMatch[1]);
        } catch { }
        replyText = replyText.replace(/ACTION:\s*\{[\s\S]*?\}\s*$/m, '').trim();
      }

      // Strip any stray markdown code fences (```json ... ``` or ``` ... ```)
      replyText = replyText
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`{3,}/g, '')  // any remaining backtick runs
        .trim();

      return {
        reply: replyText,
        action,
        sessionId
      };
    }

    // Deterministic Rule-Based Fallback
    const lower = userMessage.toLowerCase();
    let matchedProduct = products.find(p => lower.includes(p.name.toLowerCase()) || lower.includes(p.sku.toLowerCase()) || lower.includes(p.category.toLowerCase()));

    if (lower.includes('buy') || lower.includes('order') || lower.includes('checkout') || lower.includes('purchase')) {
      const targetProduct = matchedProduct || products[0];
      return {
        reply: `I'd be delighted to help you checkout **${targetProduct.name}** for **₹${(targetProduct.pricePaise / 100).toFixed(2)}**. Would you like to complete the order now?`,
        action: {
          intent: 'CHECKOUT',
          items: [{ sku: targetProduct.sku, qty: 1 }],
          coupon: null
        },
        sessionId
      };
    }

    if (matchedProduct) {
      return {
        reply: `**${matchedProduct.name}** (₹${(matchedProduct.pricePaise / 100).toFixed(2)}) is in stock! ${matchedProduct.description}. Would you like me to add it to your order?`,
        action: {
          intent: 'INFO',
          recommendedSkus: [matchedProduct.sku]
        },
        sessionId
      };
    }

    return {
      reply: `Welcome to our store! We have high-performance audio, gaming accessories, and smart devices in stock. For instance, our popular **${products[0]?.name || 'Wireless Headphones'}** (₹${((products[0]?.pricePaise || 249900) / 100).toFixed(2)}) is available. How can I help you today?`,
      action: {
        intent: 'INFO',
        recommendedSkus: products.slice(0, 2).map(p => p.sku)
      },
      sessionId
    };
  }
}

export const checkoutAgent = new CheckoutAgent();
export default checkoutAgent;
