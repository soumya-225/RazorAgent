import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, ShieldCheck, Sparkles, Bot, AlertCircle, 
  ArrowUpRight, RefreshCw, CheckCircle, Clock, ExternalLink, Settings, Save
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Overview({ setActiveTab }) {
  const { merchant, updateSettings } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings State
  const [spendingCap, setSpendingCap] = useState(merchant?.spendingCapInr || 10000);
  const [approvalThreshold, setApprovalThreshold] = useState(merchant?.approvalThresholdInr || 5000);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (merchant) {
      setSpendingCap(merchant.spendingCapInr || 10000);
      setApprovalThreshold(merchant.approvalThresholdInr || 5000);
    }
  }, [merchant]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, ordersRes] = await Promise.all([
        api.get('/api/orders/metrics/summary'),
        api.get('/api/orders?limit=6')
      ]);
      setMetrics(metricsRes.data);
      setRecentOrders(ordersRes.data?.orders || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSafetySettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateSettings({
        spendingCapInr: Number(spendingCap),
        approvalThresholdInr: Number(approvalThreshold)
      });
      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 2500);
    } catch (err) {
      alert('Error updating settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-slate-900 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-bold text-blue-400">Agentic Commerce Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span className="text-xs text-slate-400">Autonomous Protocol Ready</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            {merchant?.storeName || 'RazorAgent Merchant Hub'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Active revenue agents boosting conversions, inventory clearance orchestrator, and ACP/x402 endpoints enabling autonomous AI buyers with strict safety guardrails.
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('campaigns')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Run AI Campaign
          </button>
          <button
            onClick={() => setActiveTab('buyer')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-sky-400" />
            Simulate AI Buyer
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-card glass-card-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Paid Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{metrics ? metrics.totalRevenueInr.toLocaleString('en-IN') : '0.00'}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle className="w-3 h-3" /> Razorpay Test Captured
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card glass-card-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Processed Orders</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.totalOrders || 0} <span className="text-xs text-slate-500 font-normal">({metrics?.paidOrdersCount || 0} Paid)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Conversion rate: <span className="text-white font-semibold">{metrics?.conversionRate || 0}%</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card glass-card-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active AI Campaigns</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.activeCampaigns || 0}
          </div>
          <div className="text-[11px] text-amber-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Generating dynamic links
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card glass-card-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Safety Audit Events</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.auditEventsCount || 0}
          </div>
          <div className="text-[11px] text-purple-300">
            {metrics?.pendingApprovals > 0 ? (
              <span className="text-amber-400 font-semibold">{metrics.pendingApprovals} pending human approval</span>
            ) : (
              '100% money actions bounded'
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Orders & Safety Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Orders Stream */}
        <div className="lg:col-span-2 p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Recent Agent & Shopper Transactions</h2>
              <p className="text-[11px] text-slate-400">Real-time incoming orders via Storefront and x402 AI buyers</p>
            </div>
            <button
              onClick={fetchDashboardData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="pb-2.5">Order #</th>
                  <th className="pb-2.5">Customer / Agent</th>
                  <th className="pb-2.5">Amount</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-500">
                      No orders recorded yet. Launch the AI Buyer or open Storefront to generate orders.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const isPaid = order.status === 'PAID';
                    const isTimedOut = order.status === 'TIMED_OUT';
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-mono text-white font-medium">
                          #{order.orderNumber}
                        </td>
                        <td className="py-3 text-slate-300">
                          {order.customerName || 'Shopper'}
                          {order.metadata?.protocol === 'x402' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300 font-mono">
                              x402 AI
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono font-semibold text-white">
                          ₹{order.totalAmountInr.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isPaid
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isTimedOut
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-500 font-mono text-[11px]">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Safety Guardrails Configuration */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Safety Gating Kernel</h2>
              <p className="text-[11px] text-slate-400">Configure boundaries & human gates</p>
            </div>
          </div>

          <form onSubmit={handleSaveSafetySettings} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Session Spending Cap (₹)
              </label>
              <input
                type="number"
                value={spendingCap}
                onChange={(e) => setSpendingCap(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Hard block when total agent transaction exceeds this budget.
              </span>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                High-Value Approval Gate (₹)
              </label>
              <input
                type="number"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Transactions above this amount require human operator sign-off.
              </span>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSettings ? 'Saving...' : 'Update Safety Boundaries'}
            </button>

            {settingsSavedMsg && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center text-[11px] font-medium animate-in fade-in">
                ✓ Safety limits updated and live!
              </div>
            )}
          </form>

          {/* Protocol Endpoint Discovery card */}
          <div className="pt-3 border-t border-slate-800 text-[11px] space-y-1.5">
            <div className="font-semibold text-slate-300">Live Machine-Readable Endpoints:</div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-slate-400">
              <span>/.well-known/agent.json</span>
              <a href="/.well-known/agent.json" target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">
                ACP <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-slate-400">
              <span>/api/catalog</span>
              <a href="/api/catalog" target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">
                JSON-LD <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
