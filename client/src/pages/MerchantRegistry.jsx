import React, { useState, useEffect } from 'react';
import { Store, Tag, Sparkles, Search, ShieldCheck, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import api from '../api';

export default function MerchantRegistry() {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dealResult, setDealResult] = useState(null);
  const [loadingDeal, setLoadingDeal] = useState(false);

  useEffect(() => {
    fetchRegistry();
  }, []);

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/merchants');
      setMerchants(res.data?.merchants || []);
    } catch (err) {
      console.error('Failed to load merchant registry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareDeals = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setLoadingDeal(true);
    try {
      const res = await api.post('/api/merchants/find-best-deal', {
        query: searchQuery
      });
      setDealResult(res.data);
    } catch (err) {
      console.error('Deal comparison error:', err);
    } finally {
      setLoadingDeal(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-mono text-xs mb-1">
            <Store className="w-4 h-4" />
            ACP Network Protocol v1.0
          </div>
          <h1 className="text-xl font-bold text-white">Merchant Registry & Deal Comparison</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Autonomous AI agents scan this registry to discover registered merchants, evaluate active campaign coupons, and compare pricing across catalogs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-right">
            <div className="text-[10px] text-slate-400">Registered Merchants</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">{merchants.length} Active Stores</div>
          </div>
        </div>
      </div>

      {/* Agent Cross-Merchant Deal Comparator Tool */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">AI Deal Comparator & Scanner</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Cross-Merchant Scan</span>
        </div>

        <form onSubmit={handleCompareDeals} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search product (e.g. 'Power Bank', 'Headphones', 'Keyboard', 'Light Bar')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loadingDeal || !searchQuery.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/30"
          >
            {loadingDeal ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Scanning...
              </>
            ) : (
              <>
                Scan Network
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {dealResult && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-500/30 space-y-3 animate-in fade-in">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed font-medium">
              🤖 <strong>Agent Summary:</strong> {dealResult.aiComparisonSummary}
            </div>

            {dealResult.bestDeal && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400">Winning Store Offer</div>
                  <div className="font-bold text-white text-sm mt-0.5">{dealResult.bestDeal.product.name}</div>
                  <div className="text-slate-400 text-[11px]">Store: <span className="text-white font-semibold">{dealResult.bestDeal.storeName}</span> ({dealResult.bestDeal.merchantName})</div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    ₹{dealResult.bestDeal.product.effectivePriceInr}
                    {dealResult.bestDeal.product.discountValInr > 0 && (
                      <span className="text-[10px] text-slate-400 line-through ml-1.5">
                        ₹{dealResult.bestDeal.product.originalPriceInr}
                      </span>
                    )}
                  </div>
                  {dealResult.bestDeal.couponCode && (
                    <div className="text-[10px] font-mono text-amber-400">
                      Promo Code: {dealResult.bestDeal.couponCode} ({dealResult.bestDeal.discountPercent}% OFF)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid of Registered Merchants */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading Merchant Network Registry...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {merchants.map((merchant) => (
            <div
              key={merchant.id}
              className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{merchant.storeName}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Verified ACP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Owner: {merchant.name} ({merchant.email})</p>
                </div>
              </div>

              {/* Promo Banner */}
              {merchant.activeCoupon && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    Active Promo: <strong>{merchant.activeCoupon}</strong>
                  </span>
                  <span className="text-amber-400 font-bold">{merchant.discountPercent}% OFF</span>
                </div>
              )}

              {/* Product Catalog Snippet */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Merchant Catalog ({merchant.productCount} SKUs)</span>
                  <span className="text-[10px] font-mono text-slate-500">Cap: ₹{merchant.spendingCapInr?.toLocaleString('en-IN')}</span>
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {merchant.products.map((p) => (
                    <div key={p.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-white truncate text-[11px]">{p.name}</div>
                        <div className="text-[9px] text-slate-500">{p.sku} • {p.category}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-semibold text-blue-400">₹{p.priceInr}</div>
                        {p.effectivePriceInr < p.priceInr && (
                          <div className="text-[9px] font-mono text-emerald-400">Net: ₹{p.effectivePriceInr}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
