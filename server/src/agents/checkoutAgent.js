import prisma from '../config/db.js';
import razorpayService from '../services/razorpayService.js';
import safetyService from '../services/safetyService.js';
import merchantRegistryService from '../services/merchantRegistryService.js';
import sbmdService from '../services/sbmdService.js';
import config from '../config/env.js';
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

    // Resolve items from DB to verify stock & prices
    let computedTotalPaise = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: {
          OR: [{ id: item.productId || '' }, { sku: item.sku || '' }, { name: { contains: item.name || '', mode: 'insensitive' } }]
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId || item.sku || item.name}`);
      }

      if (product.inventory < (item.qty || 1)) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.inventory}`);
      }

      const qty = item.qty || 1;
      const linePaise = product.pricePaise * qty;
      computedTotalPaise += linePaise;

      orderItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty,
        pricePaise: product.pricePaise,
        priceInr: product.pricePaise / 100
      });
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

    // Safety Interceptor handles spending caps and audit trails
    const intercepted = await safetyService.interceptAction({
      merchantId,
      sessionId,
      agentName: this.name,
      actionType: 'create_order',
      amountPaise: finalAmountPaise,
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

        // 3. Persist Order in DB
        const savedOrder = await prisma.order.create({
          data: {
            orderNumber,
            razorpayOrderId: rzpOrder.id,
            merchantId,
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

        // 4. Attempt automatic SBMD capture when enabled and merchant has sufficient allocated funds
        try {
          const sbmdEnabledGlobally = (config && config.sbmdEnabled) || (process.env.SBMD_ENABLED === 'true');
          const merchantRecord = merchantId ? await prisma.merchant.findUnique({ where: { id: merchantId } }) : null;

          if (sbmdEnabledGlobally && merchantRecord) {
            const eligible = await sbmdService.isEligible(merchantId, finalAmountPaise);
            if (eligible) {
              try {
                const sbmdPayment = await sbmdService.executePayment({
                  merchantId,
                  orderId: savedOrder.id,
                  amountPaise: finalAmountPaise,
                  orderNumber,
                  sessionId
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
                  status: 'PAID',
                  payment: sbmdPayment,
                  isSandbox: rzpOrder.isSandbox,
                  paidWith: 'SBMD'
                };
              } catch (err) {
                console.warn('SBMD automatic capture failed:', err.message);
                // fall-through to return created order (CREATED)
              }
            }
          }
        } catch (err) {
          console.warn('SBMD eligibility check failed:', err.message);
        }

        // Default: return created order info (payment to be completed via payment link / checkout)
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
    const products = await prisma.product.findMany({ where: { inStock: true }, take: 15 });

    const merchantRegistryBrief = merchants.map(m =>
      `- Store: "${m.storeName}" (${m.name}) | Categories: ${m.categories.join(', ')} | Active Promo: ${m.activeCoupon ? `${m.activeCoupon} (${m.discountPercent}% OFF)` : 'None'}`
    ).join('\n');

    const productCatalogBrief = products.map(p =>
      `${p.name} (SKU: ${p.sku}, Price: ₹${p.pricePaise / 100}, Category: ${p.category})`
    ).join('\n');

    const systemPrompt = `You are RazorAgent's Conversational Checkout & Network Registry Agent.
Merchant Network Registry (4 Active Merchants):
${merchantRegistryBrief}

Active Product Catalog:
${productCatalogBrief}

Your role:
1. Help users discover products across all registered merchants in the network.
2. If the user asks about merchants, store deals, or price comparisons, guide them using the Merchant Registry info.
3. If the user wants to buy or order items, confirm the items and specify their details.
4. If the user asks for a discount or enters a coupon code (e.g., WELCOME10, VOLT20, NEXUS15, DESK10), acknowledge it.
5. Keep replies friendly, concise, and helpful.

If the user clearly intends to purchase items, output a JSON action block at the very end formatted as:
ACTION: {"intent": "CHECKOUT", "items": [{"sku": "SKU_CODE", "qty": 1}], "coupon": "OPTIONAL_CODE"}
If user is searching or inquiring:
ACTION: {"intent": "INFO", "recommendedSkus": ["SKU_1"]}
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
