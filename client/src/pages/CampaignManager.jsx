import React, { useState, useEffect } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, Link, Copy, Check, Plus,
  BarChart3, RefreshCw, Zap, Tag, ExternalLink, Package, CheckSquare, Square,
  PowerOff, Clock, ShieldCheck, CheckCircle2, XCircle
} from 'lucide-react';
import api from '../api';

export default function CampaignManager() {
  const [analysis, setAnalysis] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [runningCampaign, setRunningCampaign] = useState(false);
  const [endingCampaignId, setEndingCampaignId] = useState(null);
  const [campaignResult, setCampaignResult] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [campaignType, setCampaignType] = useState('INVENTORY_CLEARANCE');
  const [copiedLink, setCopiedLink] = useState(null);
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [activeTab, setActiveTab] = useState('slow'); // 'slow' | 'margin'
  const [campaignFilter, setCampaignFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'EXPIRED'
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    fetchAnalysis();
    fetchCampaigns();
  }, []);

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

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await api.get('/api/agents/campaign/list');
      setCampaigns(res.data?.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns list:', err);
    } finally {
      setLoadingCampaigns(false);
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
      setActionNotice({ type: 'success', message: `Campaign "${res.data?.name || 'New Campaign'}" successfully launched!` });
      fetchAnalysis();
      fetchCampaigns();
    } catch (err) {
      alert('Failed to run AI campaign: ' + (err.response?.data?.error || err.message));
    } finally {
      setRunningCampaign(false);
    }
  };

  const handleEndCampaign = async (campaign) => {
    if (!window.confirm(`Are you sure you want to end "${campaign.name}"? This will immediately make coupon "${campaign.couponCode}" invalid.`)) {
      return;
    }

    setEndingCampaignId(campaign.id);
    try {
      const res = await api.post(`/api/agents/campaign/${campaign.id}/end`);
      setActionNotice({
        type: 'info',
        message: res.data?.message || `Campaign "${campaign.name}" ended. Coupon "${campaign.couponCode}" is now invalid.`
      });
      fetchCampaigns();
      fetchAnalysis();
    } catch (err) {
      alert('Failed to end campaign: ' + (err.response?.data?.error || err.message));
    } finally {
      setEndingCampaignId(null);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id || text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const slowMoving = analysis?.slowMoving || [];
  const highMargin = analysis?.highMargin || [];
  const visibleProducts = activeTab === 'slow' ? slowMoving : highMargin;

  const filteredCampaigns = campaigns.filter(c => {
    if (campaignFilter === 'ALL') return true;
    return c.status === campaignFilter;
  });

  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;

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
              : 'Select Products Below'}
        </button>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs animate-fadeIn ${
          actionNotice.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: Catalog Analyzer & Strategy Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left 7 cols: Scored Inventory with Checkbox Selection */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            {/* Header + Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">AI Candidate Products</h3>
                <span className="text-[11px] text-slate-500">({selectedSkus.size} of {visibleProducts.length} selected)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('slow')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeTab === 'slow'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Clearance Candidates ({slowMoving.length})
                </button>
                <button
                  onClick={() => setActiveTab('margin')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeTab === 'margin'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  High Margin ({highMargin.length})
                </button>
              </div>
            </div>

            {/* Select All Toggle */}
            {visibleProducts.length > 0 && (
              <div className="flex items-center justify-between pt-1 pb-1 text-xs border-b border-slate-800">
                <button
                  onClick={() => toggleAll(visibleProducts)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer font-medium"
                >
                  {visibleProducts.every(p => selectedSkus.has(p.sku)) ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {visibleProducts.every(p => selectedSkus.has(p.sku)) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-[11px] text-slate-500">Click a product card to toggle it for the campaign</span>
              </div>
            )}

            {/* Product Checkbox List */}
            {loadingAnalysis ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
                AI Agent scanning inventory velocity...
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No {activeTab === 'slow' ? 'slow-moving' : 'high-margin'} products found.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleProducts.map(p => {
                  const isSelected = selectedSkus.has(p.sku);
                  const priceInr = p.pricePaise / 100;
                  const discountedInr = priceInr * (1 - discountPercent / 100);
                  return (
                    <div
                      key={p.sku}
                      onClick={() => toggleSku(p.sku)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800/60 opacity-60 hover:opacity-90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          isSelected ? 'text-amber-400' : 'text-slate-600'
                        }`}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>SKU: <span className="font-mono text-slate-400">{p.sku}</span></span>
                            <span>Stock: <strong className="text-slate-300">{p.inventory}</strong></span>
                            <span>Sales 30d: <strong className="text-slate-300">{p.salesCount30Days}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-extrabold text-white">
                          ₹{priceInr.toLocaleString('en-IN')}
                        </div>
                        {isSelected && (
                          <div className="text-[10px] font-mono text-emerald-400 font-bold">
                            ₹{discountedInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (-{discountPercent}%)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Campaign Configuration & Launch */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Zap className="w-4 h-4" />
              <h3 className="font-bold text-sm text-white">Campaign Strategy</h3>
            </div>

            {/* AI Recommendation Explanation */}
            {analysis?.recommendation && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                <strong className="text-amber-400 block mb-1">AI Recommendation:</strong>
                {analysis.recommendation}
              </div>
            )}

            {/* Campaign Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Campaign Type</label>
              <select
                value={campaignType}
                onChange={e => setCampaignType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="INVENTORY_CLEARANCE">📦 Inventory Clearance Promo</option>
                <option value="FLASH_SALE">⚡ Flash Promo Sale</option>
                <option value="BUNDLE_PROMO">🎁 High-Margin Bundle Campaign</option>
              </select>
            </div>

            {/* Discount Percent */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Target Discount:</span>
                <span className="font-mono font-bold text-amber-400">{discountPercent}% OFF</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 20, 25].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setDiscountPercent(rate)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      discountPercent === rate
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
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

            <button
              onClick={handleRunCampaign}
              disabled={runningCampaign || selectedSkus.size === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {runningCampaign ? 'Launching AI Campaign...' : `Launch Campaign for ${selectedSkus.size} SKU${selectedSkus.size > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Active & Past Campaigns Section ===== */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-base text-white">Merchant Campaigns & Promotions</h2>
              <p className="text-xs text-slate-400">All active discount coupon codes and payment links. Ending a campaign immediately invalidates its coupon.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCampaignFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                campaignFilter === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setCampaignFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                campaignFilter === 'ALL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({campaigns.length})
            </button>
            <button
              onClick={() => setCampaignFilter('EXPIRED')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                campaignFilter === 'EXPIRED'
                  ? 'bg-slate-700/40 text-slate-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Expired ({campaigns.length - activeCount})
            </button>
          </div>
        </div>

        {loadingCampaigns ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
            Loading campaigns...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-20 text-slate-400" />
            No {campaignFilter === 'ACTIVE' ? 'active' : ''} campaigns found. Launch one above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCampaigns.map(camp => {
              const isActive = camp.status === 'ACTIVE';
              const isEnding = endingCampaignId === camp.id;
              let targetList = [];
              if (Array.isArray(camp.targetSkus)) {
                targetList = camp.targetSkus;
              } else if (typeof camp.targetSkus === 'string') {
                try { targetList = JSON.parse(camp.targetSkus); } catch { targetList = [camp.targetSkus]; }
              }

              return (
                <div
                  key={camp.id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    isActive
                      ? 'bg-slate-950/80 border-slate-800 hover:border-amber-500/40'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{camp.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Created {new Date(camp.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                        {camp.discountPercent}% OFF
                      </span>
                    </div>
                  </div>

                  {/* Coupon Code Pill */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-400 text-[11px]">Coupon Code:</span>
                      <span className={`font-mono font-bold ${isActive ? 'text-amber-300' : 'text-slate-500 line-through'}`}>
                        {camp.couponCode}
                      </span>
                    </div>
                    {isActive && (
                      <button
                        onClick={() => handleCopy(camp.couponCode, `code-${camp.id}`)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedLink === `code-${camp.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedLink === `code-${camp.id}` ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  {/* Targeted Products */}
                  {targetList.length > 0 && (
                    <div className="space-y-1 text-[11px]">
                      <span className="text-slate-500 block text-[10px] font-semibold">Targeted Products ({targetList.length}):</span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {targetList.map((t, idx) => {
                          const name = typeof t === 'string' ? t : (t.name || t.sku);
                          const orig = t.originalPriceInr ? `₹${t.originalPriceInr.toLocaleString('en-IN')}` : null;
                          const disc = t.discountedPriceInr ? `₹${Math.round(t.discountedPriceInr).toLocaleString('en-IN')}` : null;
                          return (
                            <div key={idx} className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-900/40 px-2 py-1 rounded">
                              <span className="truncate max-w-[200px]">{name}</span>
                              {orig && disc && (
                                <span className="font-mono">
                                  <span className="line-through text-slate-500 mr-1">{orig}</span>
                                  <span className="text-emerald-400 font-bold">{disc}</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payment Link if present */}
                  {camp.paymentLinkUrl && isActive && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-500 text-[10px]">Payment Link:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(camp.paymentLinkUrl, `link-${camp.id}`)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLink === `link-${camp.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Link
                        </button>
                        <a
                          href={camp.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* End Campaign Action Button */}
                  {isActive && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                      <button
                        onClick={() => handleEndCampaign(camp)}
                        disabled={isEnding}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <PowerOff className="w-3 h-3" />
                        {isEnding ? 'Ending Campaign...' : 'End Campaign & Invalidate Code'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
