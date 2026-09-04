import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Send, ShoppingCart, Sparkles, ArrowRight, Check, Trash2, Tag,
  ShieldCheck, AlertCircle, Plus, Zap, RefreshCw, MessageSquare, ShieldAlert
} from 'lucide-react';
import api from '../api';
import RazorpayModal from '../components/RazorpayModal';
import ApprovalModal from '../components/ApprovalModal';

export default function StorefrontChat() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I am the **RazorAgent Conversational Checkout Assistant**. Browse our electronics catalog, ask any questions, or tell me what you want to buy and I will prepare your order with dynamic bundle discounts!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [upsellData, setUpsellData] = useState(null);
  const [loadingUpsell, setLoadingUpsell] = useState(false);

  // Razorpay Checkout & Approval Modals
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (cart.length > 0) {
      fetchUpsellRecommendations();
    } else {
      setUpsellData(null);
    }
  }, [cart]);

  const fetchCatalog = async () => {
    try {
      const res = await api.get('/api/products?inStock=true');
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error('Failed to load storefront products:', err);
    }
  };

  const fetchUpsellRecommendations = async () => {
    setLoadingUpsell(true);
    try {
      const res = await api.post('/api/agents/upsell', {
        cartItems: cart.map(i => ({ sku: i.sku, productId: i.id }))
      });
      setUpsellData(res.data);
    } catch (err) {
      console.error('Upsell fetch error:', err);
    } finally {
      setLoadingUpsell(false);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      setCart(cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(i => i.id !== productId));
  };

  /**
   * Core checkout executor — called by agent auto-checkout AND manual button.
   * itemsToCheckout: array of { productId, sku, qty } — if null, uses current cart.
   * couponToApply: coupon code string or null.
   */
  const executeCheckout = async (itemsToCheckout = null, couponToApply = null) => {
    const targetItems = (itemsToCheckout && itemsToCheckout.length > 0)
      ? itemsToCheckout
      : cart.map(i => ({ productId: i.id, sku: i.sku, qty: i.qty }));

    if (targetItems.length === 0) return;
    setLoadingChat(true);

    const activeCoupon = couponToApply || appliedCoupon?.code || null;

    try {
      const res = await api.post('/api/agents/checkout', {
        items: targetItems,
        customer: {
          name: 'Demo Shopper',
          email: 'shopper@razoragent.demo',
          phone: '+919876543210'
        },
        couponCode: activeCoupon
      });

      if (res.data?.requiresApproval) {
        // High-value order — needs merchant sign-off
        setApprovalRequest({
          id: res.data.approvalRequestId,
          amountInr: res.data.amountInr,
          agentName: 'CHECKOUT_AGENT',
          actionType: 'create_order',
          reasoning: res.data.message
        });
        setIsApprovalModalOpen(true);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `🛡️ **Approval Required**: This order of **₹${res.data.amountInr?.toLocaleString('en-IN')}** exceeds the automated threshold. A merchant approval request has been raised.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        return;
      }

      const orderResult = res.data?.result;
      if (orderResult) {
        setCheckoutOrder(orderResult);
        setIsPayModalOpen(true);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ Order **#${orderResult.orderNumber}** created for **₹${orderResult.totalAmountInr?.toLocaleString('en-IN')}**! Complete your payment in the modal.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Checkout failed: ${err.response?.data?.message || err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || loadingChat) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const newMessages = [
      ...messages,
      {
        role: 'user',
        content: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(newMessages);
    setLoadingChat(true);

    try {
      const res = await api.post('/api/agents/chat', {
        message: userText,
        history: newMessages.slice(-6),
        cart
      });

      const reply = res.data?.reply || "I'm ready to help you assemble your order.";
      const action = res.data?.action;

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: reply,
          action,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // Agent signals checkout intent — resolve items and auto-trigger payment flow
      if (action?.intent === 'CHECKOUT') {
        let checkoutItems = [];

        if (action.items && action.items.length > 0) {
          for (const item of action.items) {
            const matched = products.find(p => p.sku === item.sku);
            if (matched) {
              checkoutItems.push({
                productId: matched.id,
                sku: matched.sku,
                name: matched.name,
                priceInr: matched.priceInr,
                pricePaise: matched.pricePaise,
                qty: item.qty || 1
              });
            }
          }
        }

        // Fall back to current cart if agent didn't specify items
        if (checkoutItems.length === 0 && cart.length > 0) {
          checkoutItems = cart.map(i => ({ productId: i.id, sku: i.sku, name: i.name, priceInr: i.priceInr, pricePaise: i.pricePaise, qty: i.qty }));
        }

        if (checkoutItems.length > 0) {
          // Update cart UI to reflect the agent's chosen items
          setCart(checkoutItems);
          const couponToUse = action.coupon || appliedCoupon?.code || null;
          if (action.coupon && action.coupon !== appliedCoupon?.code) {
            // Validate & store coupon without creating an order
            handleApplyCoupon(action.coupon);
          }
          // Auto-trigger checkout — no manual button needed
          await executeCheckout(checkoutItems, couponToUse);
        }
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ Sorry, I encountered an issue: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;

    try {
      // Use the dedicated coupon validation endpoint — does NOT create any Razorpay order
      const res = await api.get(`/api/products/coupon/${encodeURIComponent(code)}`);
      setAppliedCoupon({
        code: res.data.code,
        discountPercent: res.data.discountPercent
      });
      setCouponCode(res.data.code);
    } catch (err) {
      // Coupon invalid or network error — store optimistically with 10% default
      setAppliedCoupon({ code, discountPercent: 10 });
    }
  };

  // Manual checkout button delegates to the shared executeCheckout function
  const handleInitiateCheckout = () => {
    if (cart.length === 0) return;
    executeCheckout(null, appliedCoupon?.code || null);
  };

  const handleAcceptBundleOffer = () => {
    if (upsellData?.bundleOffer?.recommendation) {
      const rec = upsellData.bundleOffer.recommendation;
      const fullProd = products.find(p => p.sku === rec.sku) || rec;
      addToCart(fullProd);
    }
  };

  const rawCartTotalInr = cart.reduce((sum, i) => sum + i.priceInr * i.qty, 0);
  const discountAmountInr = appliedCoupon ? (rawCartTotalInr * (appliedCoupon.discountPercent / 100)) : 0;
  const finalPayableInr = Math.max(0, rawCartTotalInr - discountAmountInr);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Product Grid */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-2xl glass-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Featured Catalog
              </h2>
              <span className="text-[11px] text-slate-400">{products.length} Items</span>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.category}</div>
                    <div className="font-mono text-xs font-bold text-blue-400 mt-0.5">
                      ₹{p.priceInr.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 transition-all flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column: Interactive Conversational Checkout Chat */}
        <div className="lg:col-span-5 flex flex-col h-[700px] rounded-2xl glass-card overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">RazorAgent Checkout AI</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online • Powered by GPT-4o
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              In-App Checkout
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl ${isAssistant
                        ? 'bg-slate-900 border border-slate-800 text-slate-200'
                        : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <span
                      className={`text-[9px] block mt-1.5 ${isAssistant ? 'text-slate-500' : 'text-blue-200'
                        }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
            {loadingChat && (
              <div className="flex items-center gap-2 text-slate-400 text-xs pl-8">
                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                RazorAgent is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Quick Prompts */}
          <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => {
                setInputMessage('I want to buy the Wireless Headphones');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap"
            >
              "Buy Headphones"
            </button>
            <button
              onClick={() => {
                setInputMessage('Recommend complementary accessories for my cart');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap"
            >
              "Recommend Accessories"
            </button>
            <button
              onClick={() => {
                setInputMessage('Apply coupon code WELCOME10');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap"
            >
              "Apply Coupon"
            </button>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about products, apply discounts, or checkout..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loadingChat || !inputMessage.trim()}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Live Cart & Smart Upsell Recommendations */}
        <div className="lg:col-span-3 space-y-4">

          {/* Cart Card */}
          <div className="p-4 rounded-2xl glass-card space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-xs text-white">Your Cart</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{cart.length} SKUs</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Your cart is empty. Add products from the catalog or type in chat!
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-white truncate max-w-[130px]">{item.name}</div>
                        <div className="text-[10px] text-slate-400">Qty: {item.qty} × ₹{item.priceInr}</div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Coupon input */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Coupon (e.g. WELCOME10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white uppercase font-mono"
                  />
                  <button
                    onClick={() => handleApplyCoupon()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold"
                  >
                    Apply
                  </button>
                </div>

                {appliedCoupon && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-between font-mono">
                    <span>Coupon: {appliedCoupon.code}</span>
                    <span>-{appliedCoupon.discountPercent}%</span>
                  </div>
                )}

                {/* Cart Total Breakdown */}
                <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{rawCartTotalInr.toLocaleString('en-IN')}</span>
                  </div>
                  {discountAmountInr > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span>
                      <span className="font-mono">-₹{discountAmountInr.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-slate-800/60">
                    <span>Total</span>
                    <span className="font-mono text-blue-400">₹{finalPayableInr.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <button
                  onClick={handleInitiateCheckout}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  Proceed to Razorpay Checkout
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Upsell & Cross-Sell Agent Recommendation Card */}
          {upsellData?.bundleOffer && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">AI Upsell Agent Bundle</h4>
              </div>
              <p className="text-[11px] text-indigo-200">
                {upsellData.bundleOffer.explanation}
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/20 text-xs space-y-1">
                <div className="text-slate-400 text-[10px]">Recommended Complement:</div>
                <div className="font-semibold text-white">{upsellData.bundleOffer.recommendation?.name}</div>
                <div className="flex items-center justify-between text-xs pt-1 font-mono">
                  <span className="text-emerald-400 font-bold">Save ₹{upsellData.bundleOffer.savingsInr}</span>
                  <span className="text-slate-300">Bundle: ₹{upsellData.bundleOffer.bundleTotalInr}</span>
                </div>
              </div>
              <button
                onClick={handleAcceptBundleOffer}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Bundle to Cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Razorpay Checkout Modal */}
      <RazorpayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        order={checkoutOrder}
        onSuccess={() => {
          setCart([]);
          setAppliedCoupon(null);
          setCouponCode('');
        }}
      />

      {/* Human Approval Gate Modal (high-value orders) */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        request={approvalRequest}
        onDecisionComplete={(decision) => {
          setIsApprovalModalOpen(false);
          if (decision === 'APPROVED') {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: '✅ Merchant approved the transaction. The payment link has been sent to your email.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: '❌ Transaction rejected by merchant. Please contact support if you believe this is an error.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }
        }}
      />
    </div>
  );
}
