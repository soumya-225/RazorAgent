import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Send, ShoppingCart, Sparkles, ArrowRight, Check, Trash2,
  Plus, Zap, RefreshCw, Star, Tag, Package, X, ShieldCheck, AlertCircle
} from 'lucide-react';
import api from '../api';
import RazorpayModal from '../components/RazorpayModal';
import ApprovalModal from '../components/ApprovalModal';
import { useCustomerAuth } from '../context/CustomerAuthContext';

// ---------- Product Tile ----------
function ProductTile({ product, onAdd, isAdded }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    onAdd(product);
    setTimeout(() => setAdding(false), 600);
  };

  const badgeStyles = {
    bestseller:   'badge-bestseller',
    'high-margin':'badge-high-margin',
    'low-stock':  'badge-low-stock',
    'promo-deal': 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
  };

  // Gradient backgrounds per category
  const catGradients = {
    'Audio':       'from-violet-900/60 to-slate-900',
    'Wearables':   'from-blue-900/60 to-slate-900',
    'Accessories': 'from-emerald-900/40 to-slate-900',
    'Laptops':     'from-indigo-900/60 to-slate-900',
    'Cameras':     'from-amber-900/40 to-slate-900',
  };
  const grad = catGradients[product.category] || 'from-violet-900/40 to-slate-900';

  return (
    <div className="product-tile flex flex-col relative group">
      {/* Image area */}
      <div className={`h-32 bg-gradient-to-br ${grad} flex items-center justify-center relative overflow-hidden`}>
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Package className="w-7 h-7 text-slate-400" />
        </div>

        {/* Promo discount badge */}
        {product.activeCampaign && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg shadow-rose-500/30 flex items-center gap-1 animate-pulse">
              <Zap className="w-2.5 h-2.5 fill-white" />
              {product.activeCampaign.discountPercent}% OFF
            </span>
          </div>
        )}

        {/* Badges */}
        {product.badges?.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.badges.filter(b => b !== 'promo-deal').slice(0, 2).map(b => (
              <span key={b} className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeStyles[b]}`}>
                {b.replace('-', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="text-xs font-bold text-white leading-tight line-clamp-2">{product.name}</div>
          <div className="text-[10px] text-violet-400 font-medium mt-0.5">{product.category}</div>
        </div>

        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className={`w-2.5 h-2.5 ${s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
          ))}
          <span className="text-[10px] text-slate-500 ml-0.5">({product.salesCount30Days || 0})</span>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div>
            {product.activeCampaign ? (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-extrabold font-mono text-emerald-400">
                    ₹{Number(product.activeCampaign.discountedPriceInr || product.priceInr || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs line-through text-slate-500 font-mono">
                    ₹{Number(product.priceInr || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[9px] text-amber-400 font-mono flex items-center gap-0.5 mt-0.5">
                  <Tag className="w-2.5 h-2.5" /> Code: {product.activeCampaign.couponCode}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-base font-extrabold font-mono text-white">
                  ₹{product.priceInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-500">{product.inventory} in stock</div>
              </div>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              adding || isAdded
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/25'
            }`}
          >
            {adding || isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAdded ? 'Added' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Cart Item ----------
function CartItem({ item, onRemove }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-violet-900/10 border border-violet-900/30">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-white truncate">{item.name}</div>
        <div className="text-[10px] text-slate-400">Qty: {item.qty} × ₹{item.priceInr.toLocaleString('en-IN')}</div>
      </div>
      <div className="text-xs font-mono font-bold text-violet-300 shrink-0">
        ₹{(item.priceInr * item.qty).toLocaleString('en-IN')}
      </div>
      <button onClick={() => onRemove(item.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------- Main Component ----------
export default function CustomerStorefront() {
  const { customer } = useCustomerAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [upsellData, setUpsellData] = useState(null);
  const [complementaryProducts, setComplementaryProducts] = useState([]);
  const [loadingUpsell, setLoadingUpsell] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponSuccess, setCouponSuccess] = useState(null);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const customerName = customer?.name || 'Shopper';
  const autopayThreshold = Number(customer?.autopayThresholdInr) || 0;

  // Initialize greeting
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
      setComplementaryProducts([]);
    }
  }, [cart]);

  const fetchCatalog = async () => {
    try {
      const res = await api.get('/api/marketplace/catalog');
      const catalogList = res.data?.catalog || [];
      const activeCamps = res.data?.activeCampaigns || [];
      setProducts(catalogList);

      // Build greeting with active discount awareness
      let greeting = `👋 Hi **${customerName}**! I'm your AI shopping assistant. I know your preferences and can complete checkout automatically for orders under **₹${autopayThreshold.toLocaleString('en-IN')}** — no extra steps!`;
      
      const discountedItems = catalogList.filter(p => p.activeCampaign);
      if (discountedItems.length > 0) {
        greeting += `\n\n🔥 **Active Deals Live Now**: We have special discounts on ${discountedItems.slice(0, 2).map(d => `**${d.name}** (${d.activeCampaign.discountPercent}% OFF with code \`${d.activeCampaign.couponCode}\`)`).join(', ')}!`;
      }
      greeting += `\n\nBrowse the catalog on the left, or ask me for recommendations or deals. 🛍️`;

      setMessages([{
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch {
      try {
        const res = await api.get('/api/products?inStock=true');
        setProducts(res.data?.products || []);
        setMessages([{
          role: 'assistant',
          content: `👋 Hi **${customerName}**! I'm your AI shopping assistant. How can I help you today? 🛍️`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } catch (e) {
        console.error('Failed to load catalog:', e);
      }
    }
  };

  const fetchUpsellRecommendations = async () => {
    setLoadingUpsell(true);
    try {
      const res = await api.post('/api/agents/upsell', {
        cartItems: cart.map(i => ({ sku: i.sku, productId: i.id }))
      });
      setUpsellData(res.data);

      // Derive complementary products from catalog (exclude already-in-cart)
      const cartSkus = new Set(cart.map(i => i.sku));
      const upsellSku = res.data?.bundleOffer?.recommendation?.sku;
      const complement = products
        .filter(p => !cartSkus.has(p.sku) && p.sku !== upsellSku)
        .slice(0, 3);
      setComplementaryProducts(complement);
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
    // If product has an active campaign and no coupon currently applied, auto-fill coupon
    if (product.activeCampaign && !appliedCoupon) {
      handleApplyCoupon(product.activeCampaign.couponCode);
    }
    setCartOpen(true); // auto-open cart panel
  };

  const removeFromCart = (productId) => setCart(cart.filter(i => i.id !== productId));

  const executeCheckout = async (itemsToCheckout = null, couponToApply = null, isAutomatic = false) => {
    const targetItems = (itemsToCheckout && itemsToCheckout.length > 0)
      ? itemsToCheckout
      : cart.map(i => ({ productId: i.id, sku: i.sku, qty: i.qty }));
    if (targetItems.length === 0) return;
    setLoadingChat(true);

    if (isAutomatic) {
      addMessage('assistant', '⚡ **Auto-checkout triggered** — processing your order now...');
    }

    const activeCoupon = couponToApply || appliedCoupon?.code || null;

    try {
      const res = await api.post('/api/agents/checkout', {
        items: targetItems,
        customer: {
          name: customer?.name || 'Shopper',
          email: customer?.email || 'shopper@razoragent.demo',
          phone: customer?.phone || '+919876543210',
        },
        couponCode: activeCoupon
      });

      if (res.data?.requiresApproval) {
        setApprovalRequest({
          id: res.data.approvalRequestId,
          amountInr: res.data.amountInr,
          agentName: 'CHECKOUT_AGENT',
          actionType: 'create_order',
          explanation: res.data.message || 'Order requires merchant approval',
          status: 'PENDING'
        });
        setIsApprovalModalOpen(true);
        addMessage('assistant', `⚠️ Order for **₹${res.data.amountInr.toLocaleString('en-IN')}** exceeded the threshold. A merchant approval request has been created.`);
        return;
      }

      setCheckoutOrder(res.data);
      setIsPayModalOpen(true);

      const discountMsg = res.data.discountAmountInr > 0 ? ` (Discount applied: ₹${res.data.discountAmountInr})` : '';
      addMessage('assistant', `🛒 Order **#${res.data.orderNumber}** created for **₹${res.data.totalAmountInr.toLocaleString('en-IN')}**${discountMsg}. Opening Razorpay payment window...`);
    } catch (err) {
      const isSafetyBlock = err.response?.data?.code === 'SAFETY_BLOCKED';
      const errMsg = err.response?.data?.error || err.message;
      addMessage('assistant', `⚠️ Checkout failed: ${errMsg}`);
    } finally {
      setLoadingChat(false);
    }
  };

  const addMessage = (role, content, action = null) => {
    setMessages(prev => [...prev, {
      role, content, action,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || loadingChat) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const newMessages = [...messages, {
      role: 'user', content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }];
    setMessages(newMessages);
    setLoadingChat(true);

    try {
      const res = await api.post('/api/agents/chat', {
        message: userText,
        history: newMessages.slice(-8),
        cart
      });

      const reply = res.data?.reply || "I'm here to help!";
      const action = res.data?.action;

      setMessages([...newMessages, {
        role: 'assistant', content: reply, action,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      // If chat returned a coupon, automatically apply it
      if (action?.coupon) {
        await handleApplyCoupon(action.coupon);
      }

      if (action?.intent === 'CHECKOUT') {
        let checkoutItems = [];
        if (action.items?.length > 0) {
          for (const item of action.items) {
            const matched = products.find(p => p.sku === item.sku);
            if (matched) checkoutItems.push({ productId: matched.id, sku: matched.sku, qty: item.qty || 1 });
          }
        }
        if (checkoutItems.length === 0 && cart.length > 0) {
          checkoutItems = cart.map(i => ({ productId: i.id, sku: i.sku, qty: i.qty }));
        }
        if (checkoutItems.length > 0) {
          setCart(checkoutItems.map(ci => {
            const p = products.find(p => p.sku === ci.sku);
            return p ? { ...p, qty: ci.qty } : ci;
          }));

          // Autopay logic: if cart total < threshold → auto-checkout
          const cartTotal = checkoutItems.reduce((sum, ci) => {
            const p = products.find(p => p.sku === ci.sku);
            return sum + (p?.priceInr || 0) * ci.qty;
          }, 0);

          const couponToUse = action.coupon || appliedCoupon?.code || null;
          if (couponToUse && couponToUse !== appliedCoupon?.code) {
            await handleApplyCoupon(couponToUse);
          }

          if (autopayThreshold > 0 && cartTotal <= autopayThreshold) {
            // Auto-checkout — no confirmation needed
            await executeCheckout(checkoutItems, couponToUse, true);
          } else {
            // Above threshold — proceed but show modal normally
            await executeCheckout(checkoutItems, couponToUse, false);
          }
        }
      }
    } catch (err) {
      addMessage('assistant', `⚠️ Sorry, I ran into an issue: ${err.message}`);
    } finally {
      setLoadingChat(false);
    }
  };

  const extractSkusList = (targetSkus) => {
    if (!targetSkus) return [];
    if (Array.isArray(targetSkus)) {
      return targetSkus.map(item => {
        if (typeof item === 'string') return item.toUpperCase();
        if (item && typeof item === 'object') return (item.sku || item.id || '').toUpperCase();
        return '';
      }).filter(Boolean);
    }
    if (typeof targetSkus === 'string') {
      try {
        const parsed = JSON.parse(targetSkus);
        return extractSkusList(parsed);
      } catch {
        return [targetSkus.toUpperCase()];
      }
    }
    return [];
  };

  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setCouponSuccess(null);
    try {
      const res = await api.get(`/api/products/coupon/${encodeURIComponent(code)}`);
      const targetSkus = extractSkusList(res.data.targetSkus);
      setAppliedCoupon({
        code: res.data.code,
        discountPercent: res.data.discountPercent,
        targetSkus,
        description: res.data.description
      });
      setCouponCode(res.data.code);
      setCouponSuccess(`Coupon ${res.data.code} applied (${res.data.discountPercent}% OFF)!`);
      return res.data;
    } catch (err) {
      setAppliedCoupon(null);
      const msg = err.response?.data?.error || `Coupon "${code}" is invalid or expired.`;
      setCouponError(msg);
      return null;
    }
  };

  const rawTotal = cart.reduce((s, i) => s + i.priceInr * i.qty, 0);

  // Calculate discount ONLY on eligible items matching the coupon's targetSkus
  let discount = 0;
  let eligibleItemsCount = 0;
  if (appliedCoupon) {
    const targeted = appliedCoupon.targetSkus || [];
    if (targeted.length > 0) {
      const eligibleTotal = cart
        .filter(i => targeted.includes((i.sku || '').toUpperCase()) || targeted.includes((i.id || '').toUpperCase()))
        .reduce((s, i) => {
          eligibleItemsCount++;
          return s + i.priceInr * i.qty;
        }, 0);
      discount = eligibleTotal * (appliedCoupon.discountPercent / 100);
    } else {
      discount = rawTotal * (appliedCoupon.discountPercent / 100);
      eligibleItemsCount = cart.length;
    }
  }
  const finalTotal = Math.max(0, rawTotal - discount);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const isAutopay = autopayThreshold > 0 && finalTotal <= autopayThreshold && finalTotal > 0;

  const QUICK_PROMPTS = [
    'What discounts and deals are running?',
    'Show me wireless headphones',
    'Best gaming accessories under ₹50,000',
    'Recommend accessories for my cart',
    'What are your bestsellers?',
  ];

  // Inline product mini-card for chat recommendations
  const InlineChatProductCard = ({ product }) => {
    const isAdded = cart.some(c => c.sku === product.sku);
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-violet-950/60 border border-violet-800/40 hover:border-violet-500/40 transition-all">
        <div className="w-9 h-9 rounded-lg bg-violet-900/60 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-white truncate flex items-center gap-1.5">
            {product.name}
            {product.activeCampaign && (
              <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded-full font-bold">
                -{product.activeCampaign.discountPercent}%
              </span>
            )}
          </div>
          {product.activeCampaign ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                ₹{Number(product.activeCampaign.discountedPriceInr).toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] line-through text-slate-500 font-mono">
                ₹{Number(product.priceInr).toLocaleString('en-IN')}
              </span>
            </div>
          ) : (
            <div className="text-[10px] text-violet-300 font-mono">
              ₹{Number(product.priceInr).toLocaleString('en-IN')}
            </div>
          )}
          <div className="text-[9px] text-slate-500">{product.category}</div>
        </div>
        <button
          onClick={() => addToCart(product)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            isAdded
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {isAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {isAdded ? 'Added' : 'Add'}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden">

      {/* ===== LEFT: Product Grid ===== */}
      <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-r border-violet-900/20 overflow-hidden">
        <div className="p-4 border-b border-violet-900/20 bg-[#070510]/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Catalog
            </h2>
            <span className="text-[11px] text-slate-500">{products.length} items</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-3">
          {products.map(p => (
            <ProductTile
              key={p.id}
              product={p}
              onAdd={addToCart}
              isAdded={cart.some(c => c.id === p.id)}
            />
          ))}
          {products.length === 0 && (
            <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
              Loading catalog...
            </div>
          )}
        </div>
      </div>

      {/* ===== CENTER: Chat Interface ===== */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
          {messages.map((m, idx) => {
            const isAgent = m.role === 'assistant';
            // Resolve recommended products for INFO actions
            const recommendedProducts = (isAgent && m.action?.intent === 'INFO' && m.action?.recommendedSkus?.length > 0)
              ? m.action.recommendedSkus
                  .map(sku => products.find(p => p.sku === sku))
                  .filter(Boolean)
              : [];

            return (
              <div key={idx} className={`flex items-end gap-2.5 ${isAgent ? 'justify-start' : 'justify-end'} animate-fade-in-up`}>
                {isAgent && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-violet-700 to-purple-500 flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] ${isAgent ? 'space-y-2' : ''}`}>
                  <div className={`px-4 py-3 text-xs leading-relaxed ${
                    isAgent ? 'chat-bubble-agent text-slate-200' : 'chat-bubble-user text-white shadow-lg shadow-violet-700/20'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <span className={`text-[9px] block mt-1.5 ${isAgent ? 'text-slate-600' : 'text-violet-300'}`}>
                      {m.timestamp}
                    </span>
                  </div>
                  {/* Inline product cards for INFO recommendations */}
                  {recommendedProducts.length > 0 && (
                    <div className="space-y-1.5 pl-1">
                      {recommendedProducts.map(product => (
                        <InlineChatProductCard key={product.sku} product={product} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loadingChat && (
            <div className="flex items-center gap-2.5 pl-10">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[11px] text-slate-500">AI agent thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-4 py-2 border-t border-violet-900/20 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => setInputMessage(p)}
              className="px-3 py-1.5 rounded-full bg-violet-900/30 border border-violet-900/40 text-violet-300 text-[11px] whitespace-nowrap hover:bg-violet-800/40 hover:border-violet-500/40 transition-all shrink-0 cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Auto-pay indicator */}
        {isAutopay && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[11px] text-amber-300">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Agent will <strong>auto-checkout</strong> — cart total ₹{finalTotal.toLocaleString('en-IN')} is within your ₹{autopayThreshold.toLocaleString('en-IN')} autopay limit
          </div>
        )}

        {/* Chat input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-violet-900/20 bg-[#07060f]/80 flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder="Ask about products, deals, discounts, or say 'checkout'..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-violet-950/60 border border-violet-900/40 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loadingChat || !inputMessage.trim()}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
          {/* Cart toggle (mobile) */}
          <button
            type="button"
            onClick={() => setCartOpen(o => !o)}
            className="relative p-2.5 rounded-xl bg-violet-900/40 border border-violet-800/40 text-violet-300 lg:hidden"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </form>
      </div>

      {/* ===== RIGHT: Cart + Upsell ===== */}
      <div className={`
        fixed lg:relative inset-y-0 right-0 z-40
        w-80 xl:w-88 shrink-0
        flex flex-col border-l border-violet-900/20
        bg-[#070510]/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none
        transition-transform duration-300
        ${cartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Cart Header */}
        <div className="p-4 border-b border-violet-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-violet-400" />
            <h3 className="font-bold text-sm text-white">Your Cart</h3>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <button onClick={() => setCartOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Cart Items */}
          {cart.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Your cart is empty.<br />Add products from the catalog!
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map(item => (
                  <CartItem key={item.id} item={item} onRemove={removeFromCart} />
                ))}
              </div>

              {/* Coupon input */}
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value); setCouponError(null); }}
                      className="w-full pl-8 pr-2 py-2 rounded-xl bg-violet-950/60 border border-violet-900/40 text-[11px] text-white uppercase font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <button
                    onClick={() => handleApplyCoupon()}
                    className="px-3 rounded-xl bg-violet-800/50 hover:bg-violet-700/60 text-violet-300 text-[11px] font-semibold border border-violet-800/60 transition-all cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                {/* Coupon Feedback Alerts */}
                {couponError && (
                  <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] flex items-center justify-between animate-fadeIn">
                    <span className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 shrink-0" /> {couponError}</span>
                    <button onClick={() => setCouponError(null)} className="text-red-400 hover:text-white">✕</button>
                  </div>
                )}

                {appliedCoupon && (
                  <div className="space-y-1">
                    <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] animate-fadeIn">
                      <span className="text-emerald-400 font-mono flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> {appliedCoupon.code}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">-{appliedCoupon.discountPercent}% OFF</span>
                        <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); setCouponSuccess(null); }} className="text-slate-500 hover:text-red-400 text-[10px]">✕</button>
                      </div>
                    </div>
                    {appliedCoupon.targetSkus?.length > 0 && eligibleItemsCount === 0 && (
                      <div className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 leading-tight">
                        Valid on: {appliedCoupon.targetSkus.join(', ')}. Add eligible items to cart to get this discount.
                      </div>
                    )}
                    {appliedCoupon.targetSkus?.length > 0 && eligibleItemsCount > 0 && eligibleItemsCount < cart.length && (
                      <div className="text-[9px] text-emerald-400/80 px-1">
                        Applied to {eligibleItemsCount} eligible item{eligibleItemsCount > 1 ? 's' : ''} in cart.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="space-y-1.5 pt-2 border-t border-violet-900/30">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{rawTotal.toLocaleString('en-IN')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono">-₹{discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-white pt-1 border-t border-violet-900/30">
                  <span>Total</span>
                  <span className="font-mono text-violet-300">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
                {isAutopay && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <Zap className="w-3 h-3" /> Agent will auto-pay this order
                  </div>
                )}
              </div>

              <button
                onClick={() => executeCheckout(null, appliedCoupon?.code || null, isAutopay)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 hover:from-violet-600 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
              >
                {isAutopay ? <Zap className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                {isAutopay ? 'Auto Checkout' : 'Checkout with Razorpay'}
              </button>
            </>
          )}

          {/* ---- AI Upsell & Cross-sell Agent Panel ---- */}
          {upsellData?.recommendations?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                AI Agent Suggests
                {upsellData.bundleOffer?.llmGenerated && (
                  <span className="ml-auto text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-mono">GPT-4o</span>
                )}
              </div>

              {/* Upsell / Cross-sell Cards */}
              {upsellData.recommendations.map(rec => (
                <div
                  key={rec.sku}
                  className={`p-2.5 rounded-xl border transition-all ${
                    rec.type === 'UPSELL'
                      ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                      : 'bg-violet-950/30 border-violet-800/30 hover:border-violet-600/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        rec.type === 'UPSELL'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-violet-500/20 text-violet-300'
                      }`}>
                        {rec.type === 'UPSELL' ? '⚡ UPSELL' : '✨ CROSS-SELL'}
                      </span>
                      <div className="text-xs font-bold text-white mt-1 leading-tight">{rec.name}</div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                      ₹{rec.priceInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {rec.pitch && (
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2 italic">
                      "{rec.pitch}"
                    </p>
                  )}
                  <button
                    onClick={() => addToCart({ id: rec.id, sku: rec.sku, name: rec.name, priceInr: rec.priceInr, category: rec.category })}
                    className="w-full py-1 rounded-lg bg-violet-600/40 hover:bg-violet-600 text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add to Cart
                  </button>
                </div>
              ))}

              {/* Bundle Offer Card */}
              {upsellData.bundleOffer && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" /> Bundle & Save
                    </span>
                    <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      -{upsellData.bundleOffer.bundleDiscountPercent}% OFF
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {upsellData.bundleOffer.explanation}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-indigo-500/20 text-[11px]">
                    <div>
                      <span className="line-through text-slate-500 font-mono mr-1.5">
                        ₹{upsellData.bundleOffer.originalTotalInr.toLocaleString('en-IN')}
                      </span>
                      <span className="font-extrabold font-mono text-emerald-400">
                        ₹{upsellData.bundleOffer.bundleTotalInr.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-300 font-semibold">
                      Save ₹{upsellData.bundleOffer.savingsInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complementary Products */}
          {complementaryProducts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-violet-900/20">
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Complementary Add-ons
              </div>
              <div className="space-y-1.5">
                {complementaryProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-violet-950/40 border border-violet-900/30">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-white truncate">{p.name}</div>
                      <div className="text-[10px] font-mono text-violet-300">₹{p.priceInr.toLocaleString('en-IN')}</div>
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className="ml-2 p-1.5 rounded-lg bg-violet-600/50 hover:bg-violet-600 text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Razorpay Modal */}
      <RazorpayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        order={checkoutOrder}
        onSuccess={() => { setCart([]); setAppliedCoupon(null); setCouponCode(''); setCouponSuccess(null); }}
      />

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        request={approvalRequest}
        onDecisionComplete={(decision) => {
          setIsApprovalModalOpen(false);
          addMessage('assistant', decision === 'APPROVED'
            ? '✅ Merchant approved the order! Please complete payment via the Razorpay link.'
            : '❌ Order was rejected by the merchant.'
          );
        }}
      />
    </div>
  );
}
