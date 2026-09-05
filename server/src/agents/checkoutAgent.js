import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import merchantRegistryService from '../services/merchantRegistryService.js';
import { callLLM } from './llmClient.js';
import { getProductActiveCampaign, extractTargetSkus } from '../utils/campaignUtils.js';

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

    const targetedSkus = extractTargetSkus(campaign.targetSkus);
    let eligibleTotalPaise = 0;
    let eligibleItems = [];

    if (items.length > 0) {
      for (const item of items) {
        const itemSku = (item.sku || '').toUpperCase();
        const itemId = (item.productId || item.id || '').toUpperCase();
        const isTargeted = targetedSkus.length === 0 ||
          targetedSkus.includes(itemSku) ||
          targetedSkus.includes(itemId);

        if (isTargeted) {
          const itemPaise = (item.pricePaise || (item.priceInr ? Math.round(item.priceInr * 100) : 0)) * (item.qty || item.quantity || 1);
          eligibleTotalPaise += itemPaise;
          eligibleItems.push(item);
        }
      }
    } else {
      // If items array wasn't provided, apply to cartTotalPaise if targetedSkus is empty
      if (targetedSkus.length === 0) {
        eligibleTotalPaise = cartTotalPaise;
      }
    }

    if (targetedSkus.length > 0 && eligibleItems.length === 0 && items.length > 0) {
      return {
        valid: false,
        discountAmountPaise: 0,
        finalAmountPaise: cartTotalPaise,
        message: `Coupon '${cleanCode}' only applies to targeted campaign items (${targetedSkus.join(', ')}). None are in your cart.`
      };
    }

    const discountPercent = campaign.discountPercent || 10;
    const basePaise = items.length > 0 ? eligibleTotalPaise : cartTotalPaise;
    const discountAmountPaise = Math.round((basePaise * discountPercent) / 100);
    const finalAmountPaise = Math.max(0, cartTotalPaise - discountAmountPaise);

    return {
      valid: true,
      couponCode: cleanCode,
      discountPercent,
      discountAmountPaise,
      discountAmountInr: discountAmountPaise / 100,
      finalAmountPaise,
      finalAmountInr: finalAmountPaise / 100,
      eligibleSkus: targetedSkus,
      targetSkus: campaign.targetSkus,
      message: `Success! Applied ${discountPercent}% discount code (${cleanCode}) to eligible items.`
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
    const resolvedMerchantId = merchantId || orderItems[0]?.merchantId || null;

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
      explanation: `${explanation} (Order ${orderNumber}, Items: ${orderItems.length}, Total: ₹${finalAmountPaise / 100})`,
      payload: { orderNumber, items: orderItems, customer, couponCode, finalAmountPaise },
      executeFn: async () => {
        // Create standard Razorpay Order
        const rzpOrder = await razorpayService.createOrder({
          amount: finalAmountPaise,
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            customerName: customer.name || 'Shopper',
            customerEmail: customer.email || 'shopper@razoragent.demo',
            couponCode: couponCode || 'NONE'
          }
        });

        // Create Razorpay Payment Link so agent can share direct checkout URL
        const rzpLink = await razorpayService.createPaymentLink({
          amount: finalAmountPaise,
          currency: 'INR',
          description: `RazorAgent Order #${orderNumber}`,
          customer: {
            name: customer.name || 'Shopper',
            email: customer.email || 'shopper@razoragent.demo',
            contact: customer.phone || '+919876543210'
          },
          notes: { orderNumber, rzpOrderId: rzpOrder.id }
        });

        // Save order and update inventory
        const savedOrder = await prisma.order.create({
          data: {
            orderNumber,
            merchantId: resolvedMerchantId,
            customerName: customer.name || 'Shopper',
            customerEmail: customer.email || 'shopper@razoragent.demo',
            customerPhone: customer.phone || '+919876543210',
            totalAmountPaise: finalAmountPaise,
            discountAmountPaise: discountPaise,
            currency: 'INR',
            status: 'PENDING',
            razorpayOrderId: rzpOrder.id,
            paymentLinkUrl: rzpLink.short_url,
            items: orderItems.map(i => ({
              productId: i.productId,
              merchantId: i.merchantId,
              sku: i.sku,
              name: i.name,
              quantity: i.qty,
              pricePaise: i.pricePaise,
              couponCode: couponCode || null,
              discountPaise: discountPaise > 0 ? Math.round(discountPaise / orderItems.length) : 0
            }))
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

    if (intercepted.result) {
      return { ...intercepted.result, requiresApproval: false };
    }
    return intercepted;
  }


  /**
   * Process incoming user chat message in conversational checkout
   */
  async processUserMessage({ merchantId, sessionId, userMessage, conversationHistory = [], cart = [] }) {
    const [merchants, products, activeCampaigns] = await Promise.all([
      merchantRegistryService.getAllMerchants(),
      prisma.product.findMany({ where: { inStock: true }, take: 40 }),
      prisma.campaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
    ]);

    const merchantRegistryBrief = merchants.map(m =>
      `- Store: "${m.storeName}" (${m.name}) | Categories: ${m.categories.join(', ')} | Active Promo: ${m.activeCoupon ? `${m.activeCoupon} (${m.discountPercent}% OFF)` : 'None'}`
    ).join('\n');

    // Include full product details and live campaign discount so LLM is 100% aware
    const productCatalogBrief = products.map(p => {
      const discount = getProductActiveCampaign(p, activeCampaigns);
      let line = `• ${p.name} | SKU: ${p.sku} | Price: ₹${p.pricePaise / 100} | Category: ${p.category} | Stock: ${p.inventory}`;
      if (discount) {
        line += ` | 🔥 ACTIVE PROMO: ${discount.discountPercent}% OFF with coupon code "${discount.couponCode}" (Discounted Price: ₹${discount.discountedPriceInr.toLocaleString('en-IN')}, Saves ₹${discount.savingsInr.toLocaleString('en-IN')})`;
      }
      return line;
    }).join('\n');

    const campaignsBrief = activeCampaigns.length > 0
      ? activeCampaigns.map(c => {
          let targeted = [];
          if (Array.isArray(c.targetSkus)) {
            targeted = c.targetSkus.map(t => typeof t === 'string' ? t : (t.name || t.sku));
          } else if (typeof c.targetSkus === 'string') {
            try {
              const parsed = JSON.parse(c.targetSkus);
              targeted = Array.isArray(parsed) ? parsed.map(t => typeof t === 'string' ? t : (t.name || t.sku)) : [c.targetSkus];
            } catch {
              targeted = [c.targetSkus];
            }
          }
          return `• Campaign: "${c.name}" | Coupon Code: "${c.couponCode}" | Discount: ${c.discountPercent}% OFF | Targeted Products: ${targeted.length > 0 ? targeted.join(', ') : 'All store items'}`;
        }).join('\n')
      : 'No active promotional campaigns currently.';

    const systemPrompt = `You are RazorAgent's Conversational Shopping Agent for a marketplace.

=== CRITICAL RULES (NEVER VIOLATE) ===
1. You MUST only recommend products that exist EXACTLY in the catalog below. Never invent, hallucinate, or suggest products not listed.
2. DO NOT write out lists, bullet points of products, or verbose descriptions of product specs/prices in your text response. The frontend automatically renders interactive product cards with direct Add-to-Cart buttons, prices, and discount badges below your message based on the ACTION recommendedSkus.
3. Keep your conversational response brief, concise, and natural (e.g. "Here are our top recommended options for you:" or "I found these great deals running today:").
4. If a user asks for a product type not in catalog, tell them honestly and suggest the closest available alternative from the list.
5. NEVER mention brand names unless they appear verbatim in the catalog below.

=== ACTIVE PROMOTIONS & DISCOUNT CAMPAIGNS ===
${campaignsBrief}

=== CATALOG (with live pricing & active discount codes) ===
${productCatalogBrief}

=== MERCHANT NETWORK ===
${merchantRegistryBrief}

=== DISCOUNT & PROMO AWARENESS (VERY IMPORTANT) ===
- You are fully aware of all active promotional campaigns and discount codes above.
- Whenever a user asks for discounts, deals, offers, promotions, cheap options, or inquires about a product with an active discount:
  1. Briefly mention the discount/savings in a concise sentence. Do NOT write long text lists of all items since cards are displayed.
- For purchases (CHECKOUT intent):
  If the purchased item has an active discount promo OR if the customer asked for a coupon, ALWAYS provide the coupon code in the action JSON:
  ACTION: {"intent": "CHECKOUT", "items": [{"sku": "EXACT_SKU_FROM_CATALOG", "qty": 1}], "coupon": "COUPON_CODE_HERE"}
- For product recommendations or info (INFO intent):
  Always provide the ACTION block so the UI renders product cards with add-to-cart buttons:
  ACTION: {"intent": "INFO", "recommendedSkus": ["SKU1", "SKU2"]}

=== ACTION FORMAT (always append at end of reply) ===
For purchases:
ACTION: {"intent": "CHECKOUT", "items": [{"sku": "EXACT_SKU_FROM_CATALOG", "qty": 1}], "coupon": "COUPON_CODE_OR_NULL"}

For product suggestions/recommendations (always include even for general questions):
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

      // Also strip Markdown code-fenced json action blocks if LLM outputted them
      replyText = replyText.replace(/```(?:json)?\s*\{\s*"intent"[\s\S]*?\}\s*```/g, '').trim();

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

    // Check if user is asking for deals/discounts/offers
    if (lower.includes('discount') || lower.includes('deal') || lower.includes('offer') || lower.includes('promo') || lower.includes('sale') || lower.includes('coupon')) {
      const discountedProducts = products
        .map(p => ({ product: p, discount: getProductActiveCampaign(p, activeCampaigns) }))
        .filter(x => x.discount !== null);

      if (discountedProducts.length > 0) {
        const topDeal = discountedProducts[0];

        return {
          reply: `🎉 Here are our hottest active promotional deals running today. You can add them directly to your cart below:`,
          action: {
            intent: 'INFO',
            recommendedSkus: discountedProducts.slice(0, 3).map(d => d.product.sku),
            coupon: topDeal.discount.couponCode
          },
          sessionId
        };
      }
    }

    if (lower.includes('buy') || lower.includes('order') || lower.includes('checkout') || lower.includes('purchase')) {
      const targetProduct = matchedProduct || products[0];
      const discount = targetProduct ? getProductActiveCampaign(targetProduct, activeCampaigns) : null;
      const finalInr = discount ? discount.discountedPriceInr.toLocaleString('en-IN') : (targetProduct.pricePaise / 100).toLocaleString('en-IN');

      return {
        reply: `I'd be delighted to help you checkout ${targetProduct.name} for ₹${finalInr}. You can complete the order below:`,
        action: {
          intent: 'CHECKOUT',
          items: [{ sku: targetProduct.sku, qty: 1 }],
          coupon: discount?.couponCode || null
        },
        sessionId
      };
    }

    if (matchedProduct) {
      const discount = getProductActiveCampaign(matchedProduct, activeCampaigns);
      return {
        reply: `Here is **${matchedProduct.name}**! You can add it directly to your cart below:`,
        action: {
          intent: 'INFO',
          recommendedSkus: [matchedProduct.sku],
          coupon: discount?.couponCode || null
        },
        sessionId
      };
    }

    // Default greeting with highlighted deal
    const discountedProducts = products
      .map(p => ({ product: p, discount: getProductActiveCampaign(p, activeCampaigns) }))
      .filter(x => x.discount !== null);

    return {
      reply: `Welcome to our store! Here are some of our top products:`,
      action: {
        intent: 'INFO',
        recommendedSkus: products.slice(0, 3).map(p => p.sku)
      },
      sessionId
    };
  }
}

export const checkoutAgent = new CheckoutAgent();
export default checkoutAgent;
