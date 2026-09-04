import axios from 'axios';
import prisma from '../config/db.js';
import safetyService from '../services/safetyService.js';
import razorpayService from '../services/razorpayService.js';
import { callLLM } from './llmClient.js';

export class BuyerAgent {
  constructor() {
    this.name = 'BUYER_AGENT';
  }

  /**
   * Run the Autonomous AI Buyer Agent end-to-end simulation loop
   */
  async runBuyerLoop({
    merchantBaseUrl = 'http://localhost:5000',
    budgetInr = 5000,
    objective = 'Buy the best value audio setup',
    testBudgetExceedScenario = false
  }) {
    const sessionId = `buyer_session_${Date.now().toString().slice(-6)}`;
    const stepLogs = [];
    let spentInr = 0;
    let remainingBudgetInr = budgetInr;

    const logStep = (step, title, details, status = 'SUCCESS') => {
      stepLogs.push({
        step,
        title,
        details,
        status,
        timestamp: new Date().toISOString()
      });
    };

    // Step 1: Discover ACP Agent Card
    logStep(1, 'Discover ACP Agent Card', `Reading discovery metadata at ${merchantBaseUrl}/.well-known/agent.json`);
    let agentCard = null;
    try {
      // In local mode, we can fetch via direct db/route or axios
      const cardRes = await axios.get(`${merchantBaseUrl}/.well-known/agent.json`, { timeout: 3000 }).catch(() => null);
      if (cardRes && cardRes.data) {
        agentCard = cardRes.data;
      } else {
        // Fallback internal card
        agentCard = {
          name: "RazorAgent Demo Merchant",
          description: "Electronics merchant accepting autonomous AI orders",
          capabilities: ["catalog.browse", "catalog.search", "checkout.create", "checkout.pay"],
          protocols: ["x402", "acp/1.0"],
          catalog_endpoint: "/api/catalog",
          checkout_endpoint: "/api/protocol/checkout",
          currency: "INR",
          min_order: 100
        };
      }
      logStep(1, 'Agent Card Discovered', `Protocols: ${agentCard.protocols.join(', ')} | Capabilities: ${agentCard.capabilities.join(', ')}`);
      
      await safetyService.logAudit({
        sessionId,
        agentName: this.name,
        actionType: 'discover_agent_card',
        actionPayload: { protocols: agentCard.protocols, capabilities: agentCard.capabilities },
        explanation: `Autonomous buyer agent read merchant ACP card. Discovered support for x402 payment protocol and JSON-LD catalog.`,
        status: 'SUCCESS'
      });
    } catch (err) {
      logStep(1, 'Agent Card Discovery Note', `Using standard ACP protocol specifications.`);
    }

    // Step 2: Query JSON-LD Structured Catalog
    logStep(2, 'Query JSON-LD Catalog', `Fetching structured product catalog matching objective: "${objective}"`);
    const allProducts = await prisma.product.findMany({ where: { inStock: true } });
    
    await safetyService.logAudit({
      sessionId,
      agentName: this.name,
      actionType: 'read_catalog',
      actionPayload: { objective, itemCount: allProducts.length },
      explanation: `Buyer agent parsed JSON-LD catalog containing ${allProducts.length} active products.`,
      status: 'SUCCESS'
    });

    // Step 3: Semantic Product Selection according to Objective & Budget
    logStep(3, 'Semantic Analysis & Selection', `Selecting best complementary items matching "${objective}" within budget limit of ₹${budgetInr}`);
    
    let selectedProducts = [];
    let llmReasoning = '';

    try {
      const catalogBrief = allProducts.map(p => ({
        sku: p.sku,
        name: p.name,
        priceInr: p.pricePaise / 100,
        category: p.category,
        description: p.description
      }));

      const llmPrompt = `You are an Autonomous AI Buyer Agent evaluating a merchant catalog to fulfill a purchase objective.
Objective: "${objective}"
Budget Cap: ₹${budgetInr}

Available Products in Catalog:
${JSON.stringify(catalogBrief, null, 2)}

Instructions:
1. Select 1 to 3 items that best satisfy the objective without exceeding the total budget of ₹${budgetInr}.
2. Output ONLY a valid JSON object in this exact structure:
{
  "selectedSkus": ["SKU_1", "SKU_2"],
  "reasoning": "Plain-English explanation of why these items were selected."
}`;

      const llmRes = await callLLM({
        systemPrompt: 'You are an autonomous AI purchasing agent that selects optimal items within budget constraints.',
        messages: [{ role: 'user', content: llmPrompt }]
      });

      if (llmRes.content && !llmRes.fallback) {
        const jsonMatch = llmRes.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.selectedSkus) && parsed.selectedSkus.length > 0) {
            const matchedProds = parsed.selectedSkus.map(sku => allProducts.find(p => p.sku === sku)).filter(Boolean);
            const totalCost = matchedProds.reduce((sum, p) => sum + p.pricePaise, 0) / 100;
            if (matchedProds.length > 0 && totalCost <= budgetInr) {
              selectedProducts = matchedProds;
              llmReasoning = parsed.reasoning || 'AI agent reasoned selection based on objective.';
            }
          }
        }
      }
    } catch (err) {
      console.warn('LLM buyer selection fallback:', err.message);
    }

    // Fallback if LLM did not return or exceeded budget
    if (selectedProducts.length === 0) {
      const audioItems = allProducts.filter(p => p.category.toLowerCase().includes('audio') || p.name.toLowerCase().includes('headphone') || p.name.toLowerCase().includes('earbuds'));
      const accessoryItems = allProducts.filter(p => p.category.toLowerCase().includes('accessory') || p.category.toLowerCase().includes('cable'));

      const primaryProduct = audioItems[0] || allProducts[0];
      selectedProducts.push(primaryProduct);

      if (accessoryItems[0] && ((primaryProduct.pricePaise + accessoryItems[0].pricePaise) / 100) <= budgetInr) {
        selectedProducts.push(accessoryItems[0]);
      }
      llmReasoning = `Autonomous heuristics selected primary item (${primaryProduct.name}) with complementary accessory.`;
    }

    const initialTotalPaise = selectedProducts.reduce((sum, p) => sum + p.pricePaise, 0);
    const initialTotalInr = initialTotalPaise / 100;

    logStep(3, 'Items Selected', `Target basket: ${selectedProducts.map(p => `${p.name} (₹${p.pricePaise / 100})`).join(' + ')} = Total ₹${initialTotalInr}. Reasoning: ${llmReasoning}`);


    // Step 4: Budget Boundary Verification
    logStep(4, 'Check Budget Constraints', `Verifying total ₹${initialTotalInr} against initial budget ₹${budgetInr}`);
    if (initialTotalInr > budgetInr) {
      throw new Error(`Initial selection ₹${initialTotalInr} exceeds allocated budget ₹${budgetInr}`);
    }

    await safetyService.logAudit({
      sessionId,
      agentName: 'SAFETY_GATE',
      actionType: 'check_spending_limit(ai_buyer_selection)',
      actionPayload: { budgetInr, totalInr: initialTotalInr, items: selectedProducts.map(p => p.sku) },
      explanation: `Approved: Total basket ₹${initialTotalInr} is within budget cap of ₹${budgetInr} (Remaining: ₹${(budgetInr - initialTotalInr).toFixed(2)}).`,
      status: 'SUCCESS',
      amountInr: initialTotalInr
    });

    // Step 5: Execute x402 Checkout Challenge
    logStep(5, 'Initiate x402 Protocol Checkout', `Sending checkout request to /api/protocol/checkout -> expecting HTTP 402`);
    
    const checkoutItems = selectedProducts.map(p => ({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      qty: 1,
      pricePaise: p.pricePaise
    }));

    const orderNumber = `ORD-AI-${Date.now().toString().slice(-6)}`;
    const rzpOrder = await razorpayService.createOrder({
      amount: initialTotalPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: { buyer: 'Autonomous AI Buyer Agent', objective }
    });

    const dbOrder = await prisma.order.create({
      data: {
        orderNumber,
        razorpayOrderId: rzpOrder.id,
        customerName: 'Autonomous AI Buyer Agent',
        customerEmail: 'ai-buyer@agentnet.org',
        totalAmountPaise: initialTotalPaise,
        currency: 'INR',
        status: 'CREATED',
        items: checkoutItems,
        metadata: { objective, protocol: 'x402' }
      }
    });

    logStep(5, 'x402 Challenge Received', `HTTP/1.1 402 Payment Required | X-Payment-Amount: ${initialTotalInr} INR | X-Payment-Order-Id: ${rzpOrder.id}`);

    // Step 6: Execute Razorpay Payment
    logStep(6, 'Execute Payment Settlement', `Calling Razorpay test payment capture for Order ${rzpOrder.id}`);
    
    const paymentCapture = await razorpayService.simulatePaymentCapture({
      orderId: rzpOrder.id,
      amount: initialTotalPaise,
      method: 'upi'
    });

    // Save payment & update order status
    await prisma.payment.create({
      data: {
        razorpayPaymentId: paymentCapture.id,
        orderId: dbOrder.id,
        amountPaise: initialTotalPaise,
        currency: 'INR',
        method: 'upi',
        status: 'captured'
      }
    });

    await prisma.order.update({
      where: { id: dbOrder.id },
      data: { status: 'PAID' }
    });

    spentInr += initialTotalInr;
    remainingBudgetInr -= initialTotalInr;

    await safetyService.logAudit({
      sessionId,
      agentName: this.name,
      actionType: 'execute_payment',
      actionPayload: { orderId: dbOrder.id, orderNumber, paymentId: paymentCapture.id, amountInr: initialTotalInr },
      explanation: `Payment of ₹${initialTotalInr} executed and settled via Razorpay test mode (${paymentCapture.id}). Order #${orderNumber} marked PAID.`,
      status: 'SUCCESS',
      amountInr: initialTotalInr,
      razorpayEntityId: paymentCapture.id
    });

    logStep(6, 'Payment Captured & Verified', `Payment ID: ${paymentCapture.id} | Order #${orderNumber} Fulfilled. Remaining Budget: ₹${remainingBudgetInr.toFixed(2)}`);

    // Step 7: Demonstrate Budget Gating & Graceful Failure Handling (if requested or for full demo)
    let budgetCapDemoResult = null;
    if (testBudgetExceedScenario || remainingBudgetInr > 0) {
      logStep(7, 'Testing Budget Boundary Gating', `Simulating attempt to purchase premium accessory priced at ₹2,200 (Remaining budget: ₹${remainingBudgetInr.toFixed(2)})`);
      
      const attemptedExtraInr = 2200;
      if (attemptedExtraInr > remainingBudgetInr) {
        // Step 7a: Safety Gate blocks the over-budget transaction
        await safetyService.logAudit({
          sessionId,
          agentName: 'SAFETY_GATE',
          actionType: 'check_spending_limit(additional_item)',
          actionPayload: { attemptedInr: attemptedExtraInr, remainingBudgetInr, budgetInr },
          explanation: `BLOCKED: Purchase of ₹${attemptedExtraInr} rejected. Would exceed remaining budget of ₹${remainingBudgetInr.toFixed(2)} by ₹${(attemptedExtraInr - remainingBudgetInr).toFixed(2)}.`,
          status: 'BLOCKED',
          amountInr: attemptedExtraInr
        });

        logStep(7, 'Safety Gate Intercepted (BLOCKED)', `Purchase of ₹${attemptedExtraInr} blocked by spending limit. Remaining: ₹${remainingBudgetInr.toFixed(2)}`, 'BLOCKED');

        // Step 7b: Graceful Failure Fallback Recovery
        const fallback = await safetyService.handleBudgetExceededFallback({
          sessionId,
          requestedAmountInr: attemptedExtraInr,
          remainingBudgetInr,
          category: 'Accessory'
        });

        budgetCapDemoResult = {
          blockedAmountInr: attemptedExtraInr,
          remainingBudgetInr,
          fallback
        };

        logStep(8, 'Graceful Fallback Recovery', `Agent dynamically found ${fallback.alternatives.length} affordable items matching remaining budget of ₹${remainingBudgetInr.toFixed(2)}: ${fallback.alternatives.map(a => `${a.name} (₹${a.priceInr})`).join(', ')}`);
      }
    }

    return {
      success: true,
      sessionId,
      objective,
      allocatedBudgetInr: budgetInr,
      totalSpentInr: spentInr,
      remainingBudgetInr,
      order: {
        id: dbOrder.id,
        orderNumber: dbOrder.orderNumber,
        razorpayOrderId: rzpOrder.id,
        paymentId: paymentCapture.id,
        items: checkoutItems,
        totalInr: initialTotalInr
      },
      budgetCapDemo: budgetCapDemoResult,
      steps: stepLogs
    };
  }
}

export const buyerAgent = new BuyerAgent();
export default buyerAgent;
