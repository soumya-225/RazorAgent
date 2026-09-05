import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, ShieldCheck, Sparkles, Bot, AlertCircle,
  ArrowUpRight, RefreshCw, CheckCircle, Clock, ExternalLink, Settings, Save,
  Package, DollarSign, Activity, Target
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// Mini sparkline bar chart (CSS only)
function RevenueChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => Number(d.revenueInr) || 0), 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => {
        const height = Math.max(((Number(d.revenueInr) || 0) / max) * 100, 2);
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className={`w-full rounded-t-sm transition-all duration-500 chart-bar ${
                isToday ? 'bg-blue-500' : 'bg-blue-500/30 group-hover:bg-blue-500/60'
              }`}
              style={{ height: `${height}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-xl">
                <div className="font-mono font-bold text-blue-400">₹{(Number(d.revenueInr) || 0).toLocaleString('en-IN')}</div>
                <div className="text-slate-400 text-[9px]">{d.date?.slice(5)} · {d.orderCount || 0} orders</div>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-800 rotate-45 -mt-0.5 border-r border-b border-slate-700" />
            </div>
            <div className="text-[9px] text-slate-600">{d.date?.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-500/10',   icon: 'text-blue-400',   val: 'text-white' },
    emerald:{ bg: 'bg-emerald-500/10',icon: 'text-emerald-400', val: 'text-white' },
    amber:  { bg: 'bg-amber-500/10',  icon: 'text-amber-400',  val: 'text-white' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', val: 'text-white' },
    sky:    { bg: 'bg-sky-500/10',    icon: 'text-sky-400',    val: 'text-white' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="stat-card group cursor-default glass-card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] text-slate-400 font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <div className={`text-2xl font-extrabold font-mono ${c.val} mb-1`}>{value}</div>
      <div className="flex items-center gap-1.5">
        {trend !== undefined && trend > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold">
            <ArrowUpRight className="w-3 h-3" />+{trend}%
          </span>
        )}
        <span className="text-[10px] text-slate-500">{sub}</span>
      </div>
    </div>
  );
}

export default function Overview({ setActiveTab }) {
  const { merchant, updateSettings } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueByDay, setRevenueByDay] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [spendingCap, setSpendingCap] = useState(merchant?.spendingCapInr || 10000);
  const [approvalThreshold, setApprovalThreshold] = useState(merchant?.approvalThresholdInr || 5000);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds so new customer orders appear without manual refresh
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
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

      // Try to get marketplace analytics for chart data
      try {
        const apiKey = merchant?.apiKey;
        if (apiKey) {
          const analyticsRes = await api.get('/api/marketplace/analytics', {
            headers: { 'X-API-Key': apiKey }
          });
          setRevenueByDay(analyticsRes.data?.revenueByDay || []);
          setTopProducts(analyticsRes.data?.topProducts || []);
        }
      } catch { /* analytics may not be available */ }
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

  const totalRevenue = metrics?.totalRevenueInr || 0;
  const conversionRate = metrics?.conversionRate || 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-slate-900 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest font-bold text-blue-400">Agentic Commerce Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-xs text-slate-400">Autonomous Protocol Ready</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {merchant?.storeName || 'Merchant Dashboard'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            Revenue agents boosting conversions, AI-powered campaign orchestration, and safety-gated autonomous buyers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('campaigns')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Run AI Campaign
          </button>
          <button
            onClick={() => setActiveTab('buyer')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-sky-400" /> AI Buyer Sim
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue (Paid)"
          value={`₹${(totalRevenue || 0).toLocaleString('en-IN')}`}
          sub="Razorpay captured"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          label="Total Orders"
          value={metrics?.totalOrders || 0}
          sub={`${metrics?.paidOrdersCount || 0} paid orders`}
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          sub="Created → Paid"
          icon={Activity}
          color="sky"
          trend={conversionRate > 50 ? Math.round(conversionRate - 50) : undefined}
        />
        <StatCard
          label="Active Campaigns"
          value={metrics?.activeCampaigns || 0}
          sub="Revenue campaigns live"
          icon={Target}
          color="amber"
        />
      </div>

      {/* Revenue Chart + Safety Settings row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Revenue — Last 7 Days</h2>
              <p className="text-[11px] text-slate-400">Daily revenue from paid orders</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-blue-400">
                ₹{(revenueByDay.reduce((s, d) => s + (Number(d?.revenueInr) || 0), 0)).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500">7-day total</div>
            </div>
          </div>

          {revenueByDay.length > 0 ? (
            <RevenueChart data={revenueByDay} />
          ) : (
            <div className="h-16 flex items-center justify-center">
              <div className="flex items-end gap-1 h-14 opacity-25">
                {[30, 60, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-500/40 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="absolute text-xs text-slate-500">No revenue data yet — start making sales!</p>
            </div>
          )}

          {/* Avg Order Value metric */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
            <div>
              <div className="text-[10px] text-slate-500">Avg Order Value</div>
              <div className="text-sm font-mono font-bold text-white">
                ₹{metrics?.paidOrdersCount > 0
                  ? Math.round((totalRevenue || 0) / metrics.paidOrdersCount).toLocaleString('en-IN')
                  : '0'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Audit Events</div>
              <div className="text-sm font-mono font-bold text-white">{metrics?.auditEventsCount || 0}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Pending Approvals</div>
              <div className={`text-sm font-mono font-bold ${metrics?.pendingApprovals > 0 ? 'text-amber-400' : 'text-white'}`}>
                {metrics?.pendingApprovals || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Safety Guardrails */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Safety Gating Kernel</h2>
              <p className="text-[11px] text-slate-400">Configure boundaries & human gates</p>
            </div>
          </div>

          <form onSubmit={handleSaveSafetySettings} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">Session Spending Cap (₹)</label>
              <input
                type="number" value={spendingCap} onChange={e => setSpendingCap(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Hard block when agent spending exceeds this.</span>
            </div>
            <div>
              <label className="text-slate-300 font-medium block mb-1">High-Value Approval Gate (₹)</label>
              <input
                type="number" value={approvalThreshold} onChange={e => setApprovalThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Requires human sign-off above this amount.</span>
            </div>
            <button type="submit" disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              {savingSettings ? 'Saving...' : 'Update Safety Limits'}
            </button>
            {settingsSavedMsg && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center text-[11px] font-medium animate-fade-in">
                ✓ Safety limits updated and live!
              </div>
            )}
          </form>

          {/* Live Endpoints */}
          <div className="pt-3 border-t border-slate-800 text-[11px] space-y-1.5">
            <div className="font-semibold text-slate-300">Machine-Readable Endpoints:</div>
            {[
              { path: '/.well-known/agent.json', label: 'ACP Card' },
              { path: '/api/catalog',            label: 'JSON-LD' },
              { path: '/api/marketplace/info',   label: 'Marketplace API' },
            ].map(ep => (
              <div key={ep.path} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-slate-400">
                <span className="truncate">{ep.path}</span>
                <a href={ep.path} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 ml-2">
                  {ep.label} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders and Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Recent Orders */}
        <div className="lg:col-span-8 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Recent Agent Orders</h2>
            </div>
            <button
              onClick={fetchDashboardData}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No orders placed yet. Launch a customer storefront session to test autonomous order flow!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-left">
                    <th className="pb-2 font-medium">Order #</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Items</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {recentOrders.map(order => {
                    const items = Array.isArray(order.items)
                      ? order.items
                      : typeof order.items === 'string'
                        ? JSON.parse(order.items || '[]')
                        : [];
                    const itemCount = items.reduce((s, i) => s + (i.quantity || i.qty || 1), 0);
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 font-mono text-slate-300 font-semibold">{order.orderNumber}</td>
                        <td className="py-3 text-white">
                          <div>{order.customerName || 'Shopper'}</div>
                          <div className="text-[10px] text-slate-500">{order.customerEmail}</div>
                        </td>
                        <td className="py-3 text-slate-400">{itemCount} items</td>
                        <td className="py-3 font-mono font-bold text-white">
                          ₹{((order.totalAmountInr ?? ((order.totalAmountPaise || 0) / 100)) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            order.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {order.status === 'PAID' ? <CheckCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {order.paymentLinkUrl && (
                            <a
                              href={order.paymentLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                            >
                              <ExternalLink className="w-3 h-3" /> Pay Link
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="lg:col-span-4 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-white">Top Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Revenue data will appear here after your first paid orders.
            </div>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p.sku || i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-500/20 text-amber-400' :
                    i === 1 ? 'bg-slate-500/20 text-slate-300' :
                              'bg-slate-800 text-slate-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{p.name || p.sku}</div>
                    <div className="text-[10px] text-slate-500">{p.qty || 0} units sold</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                    ₹{(Number(p?.revenueInr) || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
