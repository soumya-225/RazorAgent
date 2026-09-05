import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Sparkles, AlertCircle,
  ArrowUpRight, RefreshCw, CheckCircle, Clock, ExternalLink,
  Package, DollarSign, Activity, Target, Zap, ChevronRight, BarChart3
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// High-fidelity 7-Day Revenue Bar Chart
function RevenueChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(d => Number(d.revenueInr) || 0), 500);

  return (
    <div className="space-y-3">
      <div className="h-44 flex items-end justify-between gap-2.5 pt-6 pb-2 px-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
        {data.map((d, i) => {
          const rev = Number(d.revenueInr) || 0;
          const heightPercent = Math.max((rev / maxRevenue) * 100, rev > 0 ? 12 : 3);
          const isToday = i === data.length - 1;

          return (
            <div key={d.date || i} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none transition-all">
                <div className="bg-slate-900 border border-blue-500/30 rounded-xl px-3 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md">
                  <div className="font-mono font-bold text-blue-400 text-xs">₹{rev.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-slate-400">{d.label || d.date} · {d.orderCount || 0} order{d.orderCount === 1 ? '' : 's'}</div>
                </div>
                <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-blue-500/30" />
              </div>

              {/* Amount on top of bar */}
              <div className={`text-[10px] font-mono font-semibold mb-1.5 transition-colors ${
                rev > 0 ? (isToday ? 'text-blue-300 font-bold' : 'text-slate-400') : 'text-slate-600'
              }`}>
                {rev > 0 ? `₹${rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev}` : '₹0'}
              </div>

              {/* Bar column */}
              <div className="w-full max-w-[48px] h-full flex items-end">
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 relative overflow-hidden ${
                    rev > 0
                      ? isToday
                        ? 'bg-gradient-to-t from-blue-600 via-indigo-600 to-sky-400 shadow-lg shadow-blue-500/30'
                        : 'bg-gradient-to-t from-blue-700/60 to-indigo-500/80 group-hover:from-blue-600 group-hover:to-indigo-400'
                      : 'bg-slate-800/40 group-hover:bg-slate-800/80'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                >
                  {isToday && rev > 0 && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/50 rounded-t-lg" />
                  )}
                </div>
              </div>

              {/* Day & Date Labels */}
              <div className="mt-2 text-center">
                <div className={`text-[11px] font-bold ${isToday ? 'text-blue-400 font-extrabold' : 'text-slate-300'}`}>
                  {d.dayName || d.date?.slice(5)}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  {d.date?.slice(5)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
  const { merchant } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueByDay, setRevenueByDay] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI Campaign Revenue Insights
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchCampaignInsights();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, ordersRes] = await Promise.all([
        api.get('/api/orders/metrics/summary'),
        api.get('/api/orders?limit=6')
      ]);

      const data = metricsRes.data || {};
      setMetrics(data);
      setRecentOrders(ordersRes.data?.orders || []);

      if (data.revenueByDay && data.revenueByDay.length > 0) {
        setRevenueByDay(data.revenueByDay);
      } else {
        // Fallback last 7 days array if not present
        const now = new Date();
        const fallbackDays = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          fallbackDays.push({
            date: d.toISOString().slice(0, 10),
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            revenueInr: 0,
            orderCount: 0
          });
        }
        setRevenueByDay(fallbackDays);
      }

      if (data.topProducts) {
        setTopProducts(data.topProducts);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.get('/api/agents/campaign/insights');
      setInsights(res.data);
    } catch (err) {
      console.warn('Failed to load AI campaign insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const totalRevenue = metrics?.totalRevenueInr || 0;
  const conversionRate = metrics?.conversionRate || 0;
  const sevenDayTotal = revenueByDay.reduce((s, d) => s + (Number(d?.revenueInr) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/70 via-indigo-950/40 to-slate-900 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest font-bold text-blue-400">Merchant AI Growth Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-xs text-slate-400">Autonomous Commerce Active</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {merchant?.storeName || 'Merchant Dashboard'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            AI-powered campaign orchestration, smart cart upsells, and autonomous checkout revenue analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('campaigns')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Launch AI Campaign
          </button>
          <button
            onClick={() => { fetchDashboardData(); fetchCampaignInsights(); }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            title="Refresh All"
          >
            <RefreshCw className={`w-4 h-4 ${loading || loadingInsights ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue (Paid)"
          value={`₹${(totalRevenue || 0).toLocaleString('en-IN')}`}
          sub="Captured via Razorpay"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          label="Total Orders"
          value={metrics?.totalOrders || 0}
          sub={`${metrics?.paidOrdersCount || 0} completed orders`}
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          label="Checkout Conversion"
          value={`${conversionRate}%`}
          sub="Created → Paid"
          icon={Activity}
          color="sky"
          trend={conversionRate > 50 ? Math.round(conversionRate - 50) : undefined}
        />
        <StatCard
          label="Active AI Campaigns"
          value={metrics?.activeCampaigns || 0}
          sub="Live revenue drivers"
          icon={Target}
          color="amber"
        />
      </div>

      {/* AI Campaign Revenue Insights Card */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-500/25 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">AI Campaign Revenue Insights</h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                  Live Executive Analysis
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Natural language analysis of promotional lift & inventory monetization</p>
            </div>
          </div>
          <button
            onClick={fetchCampaignInsights}
            disabled={loadingInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            {loadingInsights ? 'Analyzing...' : 'Regenerate Insights'}
          </button>
        </div>

        {/* Highlight Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-500 font-medium">Campaign Revenue</div>
            <div className="text-lg font-extrabold font-mono text-emerald-400 mt-0.5">
              ₹{(insights?.campaignRevenueInr || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {insights?.campaignSharePercent || 0}% of store sales
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-500 font-medium">Campaign Orders</div>
            <div className="text-lg font-extrabold font-mono text-blue-400 mt-0.5">
              {insights?.campaignOrdersCount || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              out of {insights?.totalOrdersCount || 0} paid orders
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-500 font-medium">Discounts Invested</div>
            <div className="text-lg font-extrabold font-mono text-amber-400 mt-0.5">
              ₹{(insights?.campaignDiscountsInr || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Promo incentives given
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-500 font-medium">Active Promos</div>
            <div className="text-lg font-extrabold font-mono text-purple-400 mt-0.5">
              {insights?.activeCampaignsCount || 0} Live
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Driving conversions
            </div>
          </div>
        </div>

        {/* Narrative Box */}
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
          {insights?.headline && (
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {insights.headline}
            </div>
          )}

          {/* Bullet point narrative */}
          {insights?.narrative ? (
            <ul className="space-y-1.5">
              {insights.narrative
                .split(/\n+/)
                .map(s => s.replace(/^[-•*]\s*/, '').trim())
                .filter(Boolean)
                .slice(0, 5)
                .map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: point.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  </li>
                ))
              }
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">Loading AI revenue commentary...</p>
          )}

          {insights?.topCampaignItems && insights.topCampaignItems.length > 0 && (
            <div className="pt-2 border-t border-indigo-500/10 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-slate-400 font-medium">Campaign Top Movers:</span>
              {insights.topCampaignItems.map((item, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Chart + Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Revenue Chart (8 Cols) */}
        <div className="lg:col-span-8 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Revenue — Last 7 Days</h2>
                <p className="text-[11px] text-slate-400">Daily breakdown of captured order revenue</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono font-bold text-blue-400">
                ₹{sevenDayTotal.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500">7-Day Captured Total</div>
            </div>
          </div>

          <RevenueChart data={revenueByDay} />

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
            <div>
              <div className="text-[10px] text-slate-500">Avg Order Value</div>
              <div className="text-sm font-mono font-bold text-white">
                ₹{metrics?.paidOrdersCount > 0
                  ? Math.round((totalRevenue || 0) / metrics.paidOrdersCount).toLocaleString('en-IN')
                  : '0'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Daily Average (7D)</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                ₹{Math.round(sevenDayTotal / 7).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Completed Orders</div>
              <div className="text-sm font-mono font-bold text-white">
                {metrics?.paidOrdersCount || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Top Products (4 Cols) */}
        <div className="lg:col-span-4 glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-white">Top Performing Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Product sales rankings will appear here after orders are placed.
            </div>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p.sku || i} className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    i === 1 ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                              'bg-slate-800 text-slate-500'
                  }`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{p.name || p.sku}</div>
                    <div className="text-[10px] text-slate-400">{p.qty || 0} units sold</div>
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

      {/* Recent Orders */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
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
    </div>
  );
}
