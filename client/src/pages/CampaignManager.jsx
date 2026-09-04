import React, { useState, useEffect } from 'react';
import { 
  Sparkles, TrendingUp, AlertTriangle, Link, Copy, Check, Plus, 
  BarChart3, RefreshCw, Zap, Tag, ExternalLink 
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

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const res = await api.post('/api/agents/campaign/analyze');
      setAnalysis(res.data);
    } catch (err) {
      console.error('Failed to load campaign analysis:', err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleRunCampaign = async () => {
    setRunningCampaign(true);
    setCampaignResult(null);
    try {
      const res = await api.post('/api/agents/campaign/run', {
        campaignType,
        discountPercent: Number(discountPercent)
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
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            AI Campaign Orchestrator
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Autonomous growth agent that scans your catalog for trapped working capital and slow-moving SKUs, then generates targeted coupon codes and instant Razorpay payment links.
          </p>
        </div>
        <button
          onClick={handleRunCampaign}
          disabled={runningCampaign}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 font-bold text-xs text-slate-950 shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {runningCampaign ? 'Analyzing & Orchestrating...' : 'Launch AI Campaign Now'}
        </button>
      </div>

      {/* Campaign Strategy Controls & Inventory Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Opportunity Radar */}
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

          {analysis && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300">
              <strong className="text-white block mb-1">AI Recommendation:</strong>
              {analysis.recommendation}
            </div>
          )}

          {/* Slow-Moving Products Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Identified Clearance Candidates (&lt;5 sales/30d):</span>
              <span className="text-[10px] text-slate-500 font-mono">{analysis?.slowMoving?.length || 0} Target SKUs</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {analysis?.slowMoving?.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-[10px] text-slate-400">
                      SKU: <span className="font-mono text-blue-400">{p.sku}</span> | Trapped Stock: <span className="text-amber-400 font-semibold">{p.inventory} units</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-white">₹{(p.pricePaise / 100).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-slate-500">{p.salesCount30Days} sales in 30d</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                <span className="text-slate-500">Generated Coupon Code:</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded ml-1 border border-amber-500/20">
                  {campaignResult.couponCode}
                </span>
              </div>
              <div><span className="text-slate-500">Discount:</span> <span className="font-bold text-emerald-400 ml-1">{campaignResult.discountPercent}% OFF</span></div>
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
