import React, { useState, useEffect } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, Link, Copy, Check, Plus,
  BarChart3, RefreshCw, Zap, Tag, ExternalLink, Package, CheckSquare, Square
} from 'lucide-react';
import api from '../api';

export default function CampaignManager() {
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [runningCampaign, setRunningCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [campaignType, setCampaignType] = useState('INVENTORY_CLEARANCE');
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [activeTab, setActiveTab] = useState('slow'); // 'slow' | 'margin'

  useEffect(() => { fetchAnalysis(); }, []);

  const fetchAnalysis = async () => {
    setLoadingAnalysis(true);
    setSelectedSkus(new Set());
    try {
      const res = await api.post('/api/agents/campaign/analyze');
      setAnalysis(res.data);
      // Auto-select all slow-moving products by default
      if (res.data?.slowMoving?.length > 0) {
        setSelectedSkus(new Set(res.data.slowMoving.map(p => p.sku)));
        setActiveTab('slow');
      } else if (res.data?.highMargin?.length > 0) {
        setSelectedSkus(new Set(res.data.highMargin.map(p => p.sku)));
        setActiveTab('margin');
      }
    } catch (err) {
      console.error('Failed to load campaign analysis:', err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const toggleSku = (sku) => {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const toggleAll = (products) => {
    const allSelected = products.every(p => selectedSkus.has(p.sku));
    setSelectedSkus(prev => {
      const next = new Set(prev);
      if (allSelected) {
        products.forEach(p => next.delete(p.sku));
      } else {
        products.forEach(p => next.add(p.sku));
      }
      return next;
    });
  };

  const handleRunCampaign = async () => {
    if (selectedSkus.size === 0) {
      alert('Please select at least one product for the campaign.');
      return;
    }
    setRunningCampaign(true);
    setCampaignResult(null);
    try {
      const res = await api.post('/api/agents/campaign/run', {
        campaignType,
        discountPercent: Number(discountPercent),
        selectedSkus: Array.from(selectedSkus)
      });
      setCampaignResult(res.data?.result || res.data);
      fetchAnalysis();
    } catch (err) {
      alert('Failed to run AI campaign: ' + (err.response?.data?.error || err.message));
    } finally {
      setRunningCampaign(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const slowMoving = analysis?.slowMoving || [];
  const highMargin = analysis?.highMargin || [];
  const visibleProducts = activeTab === 'slow' ? slowMoving : highMargin;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-bold text-amber-400">Autonomous Revenue Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="text-xs text-slate-400">Inventory Velocity Optimization</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">AI Campaign Orchestrator</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Autonomous growth agent that scans your catalog for trapped working capital and slow-moving SKUs, then generates targeted coupon codes and instant Razorpay payment links.
          </p>
        </div>
        <button
          onClick={handleRunCampaign}
          disabled={runningCampaign || selectedSkus.size === 0}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 font-bold text-xs text-slate-950 shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {runningCampaign
            ? 'Analyzing & Orchestrating...'
            : selectedSkus.size > 0
              ? `Launch Campaign for ${selectedSkus.size} SKU${selectedSkus.size > 1 ? 's' : ''}`
              : 'Select Products to Launch'}
        </button>
      </div>

      {/* Campaign Strategy Controls & Inventory Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Opportunity Radar — product list with checkboxes */}
        <div className="lg:col-span-7 p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Inventory Opportunity Radar</h2>
            </div>
            <button
              onClick={fetchAnalysis}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalysis ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* AI Recommendation box */}
          {analysis && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300">
              <strong className="text-white block mb-1">AI Recommendation:</strong>
              {analysis.recommendation}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-slate-900 rounded-xl">
            <button
              onClick={() => setActiveTab('slow')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'slow'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Slow-Moving ({slowMoving.length})
            </button>
            <button
              onClick={() => setActiveTab('margin')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'margin'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              High-Margin ({highMargin.length})
            </button>
          </div>

          {/* Products list with checkboxes */}
          {loadingAnalysis ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin" /> Scanning inventory...
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              {activeTab === 'slow'
                ? '✅ No slow-moving products — inventory velocity is healthy!'
                : '📊 No high-margin products detected yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all row */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => toggleAll(visibleProducts)}
              >
                {visibleProducts.every(p => selectedSkus.has(p.sku))
                  ? <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  : <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                }
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {visibleProducts.every(p => selectedSkus.has(p.sku)) ? 'Deselect All' : 'Select All'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {visibleProducts.map((p) => {
                  const isSelected = selectedSkus.has(p.sku);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSku(p.sku)}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-xs ${
                        isSelected
                          ? activeTab === 'slow'
                            ? 'bg-amber-950/30 border-amber-500/40'
                            : 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="shrink-0">
                        {isSelected
                          ? <CheckSquare className={`w-4 h-4 ${activeTab === 'slow' ? 'text-amber-400' : 'text-emerald-400'}`} />
                          : <Square className="w-4 h-4 text-slate-600" />
                        }
                      </div>

                      {/* Product icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? activeTab === 'slow' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                          : 'bg-slate-800'
                      }`}>
                        <Package className={`w-4 h-4 ${isSelected ? (activeTab === 'slow' ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500'}`} />
                      </div>

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          SKU: <span className="font-mono text-blue-400">{p.sku}</span>
                          {activeTab === 'slow' && (
                            <> · <span className="text-amber-400 font-semibold">{p.inventory} units trapped</span></>
                          )}
                          {activeTab === 'margin' && (
                            <> · <span className="text-emerald-400 font-semibold">{p.marginPercent}% margin</span></>
                          )}
                        </div>
                      </div>

                      {/* Price + badge */}
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-white">₹{(p.pricePaise / 100).toLocaleString('en-IN')}</div>
                        {activeTab === 'slow'
                          ? <div className="text-[10px] text-slate-500">{p.salesCount30Days} sales/30d</div>
                          : <div className="text-[10px] text-slate-500">₹{(p.costPaise / 100).toLocaleString('en-IN')} cost</div>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary */}
              {selectedSkus.size > 0 && (
                <div className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg ${
                  activeTab === 'slow' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {selectedSkus.size} product{selectedSkus.size > 1 ? 's' : ''} selected for campaign
                </div>
              )}
            </div>
          )}
        </div>

        {/* Campaign Parameters */}
        <div className="lg:col-span-5 p-5 rounded-2xl glass-card space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            Campaign Parameters
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Campaign Objective</label>
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="INVENTORY_CLEARANCE">Clear Trapped Inventory (&lt;5 sales/mo)</option>
                <option value="HIGH_MARGIN_BOOST">High Margin Velocity Boost (&gt;40% margin)</option>
                <option value="FLASH_SALE">Weekend Flash Sale</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Discount Rate (%)</label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 20, 25].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setDiscountPercent(rate)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      discountPercent === rate
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30'
                        : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>

            {/* Preview discount values */}
            {selectedSkus.size > 0 && analysis && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-1.5 text-[11px]">
                <div className="text-amber-400 font-semibold mb-2">Campaign Preview:</div>
                {[...selectedSkus].slice(0, 3).map(sku => {
                  const all = [...slowMoving, ...highMargin];
                  const p = all.find(x => x.sku === sku);
                  if (!p) return null;
                  const discounted = p.pricePaise * (1 - discountPercent / 100) / 100;
                  return (
                    <div key={sku} className="flex items-center justify-between">
                      <span className="text-slate-400 truncate max-w-[140px]">{p.name}</span>
                      <span className="text-white font-mono">
                        <span className="line-through text-slate-600">₹{(p.pricePaise / 100).toLocaleString('en-IN')}</span>
                        {' → '}
                        <span className="text-emerald-400 font-bold">₹{discounted.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </span>
                    </div>
                  );
                })}
                {selectedSkus.size > 3 && (
                  <div className="text-slate-500">+{selectedSkus.size - 3} more products...</div>
                )}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-300 font-semibold">What happens upon launch:</div>
              <div>• Generates unique coupon code (e.g. BOOST20_...)</div>
              <div>• Calls Razorpay Payment Link API with 48h expiration</div>
              <div>• Logs full explainability rationale to the Audit Trail</div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Campaign Result Card */}
      {campaignResult && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Campaign Successfully Generated & Live!</h3>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div><span className="text-slate-500">Campaign Name:</span> <span className="font-semibold text-white ml-1">{campaignResult.name}</span></div>
              <div>
                <span className="text-slate-500">Coupon Code:</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded ml-1 border border-amber-500/20">
                  {campaignResult.couponCode}
                </span>
              </div>
              <div><span className="text-slate-500">Discount:</span> <span className="font-bold text-emerald-400 ml-1">{campaignResult.discountPercent}% OFF</span></div>
              {campaignResult.targetProducts?.length > 0 && (
                <div>
                  <span className="text-slate-500">Products:</span>
                  <div className="mt-1 space-y-1">
                    {campaignResult.targetProducts.map(p => (
                      <div key={p.sku} className="flex justify-between text-[10px]">
                        <span className="text-slate-300">{p.name}</span>
                        <span className="font-mono">
                          <span className="line-through text-slate-600">₹{p.originalPriceInr?.toLocaleString('en-IN')}</span>
                          {' → '}
                          <span className="text-emerald-400">₹{p.discountedPriceInr?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block">Generated Razorpay Payment Link:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={campaignResult.paymentLinkUrl}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-blue-400"
                />
                <button
                  onClick={() => handleCopy(campaignResult.paymentLinkUrl)}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500">Shareable in email, SMS or in-app promotions</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
            <strong className="text-slate-400 block mb-1">AI Reasoning (Audit Trail):</strong>
            {campaignResult.reasoning}
          </div>
        </div>
      )}
    </div>
  );
}
