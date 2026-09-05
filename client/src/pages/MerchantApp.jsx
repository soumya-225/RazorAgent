import React, { useState } from 'react';
import {
  LayoutDashboard, Package, Sparkles, Code2, ShieldCheck, ClipboardList,
  ChevronLeft, LogOut, Store, Zap, Bot, AlertTriangle, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Overview from './Overview';
import CatalogManager from './CatalogManager';
import CampaignManager from './CampaignManager';
import APIExplorer from './APIExplorer';
import AuditTrail from './AuditTrail';
import AIBuyerPlayground from './AIBuyerPlayground';
import FailureLab from './FailureLab';

const NAV_ITEMS = [
  { id: 'overview',   label: 'Dashboard',         icon: LayoutDashboard, description: 'Revenue & analytics' },
  { id: 'catalog',    label: 'Products',           icon: Package,         description: 'Manage catalog' },
  { id: 'campaigns',  label: 'Revenue Campaigns',  icon: Sparkles,        description: 'AI-powered campaigns' },
  { id: 'api',        label: 'API Explorer',       icon: Code2,           description: 'External agent API' },
  { id: 'buyer',      label: 'AI Buyer Simulator', icon: Bot,             description: 'Test autonomous buyers' },
  { id: 'audit',      label: 'Audit Trail',        icon: ShieldCheck,     description: 'Safety & logs' },
  { id: 'failure-lab',label: 'Failure Lab',        icon: AlertTriangle,   description: 'Recovery testing' },
];

export default function MerchantApp({ onSwitchRole }) {
  const { merchant, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    onSwitchRole('landing');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          flex flex-col w-64 shrink-0
          bg-slate-950 border-r border-slate-800/80
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              ⚡
            </div>
            <div>
              <div className="font-extrabold text-sm text-white tracking-tight">RazorAgent</div>
              <div className="text-[10px] text-blue-400 font-medium">Merchant Portal</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Merchant info */}
        <div className="px-4 py-4 border-b border-slate-800/60">
          <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                {merchant?.name?.[0]?.toUpperCase() || 'M'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{merchant?.storeName || 'My Store'}</div>
                <div className="text-[10px] text-slate-400 truncate">{merchant?.email}</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Spending Cap</span>
              <span className="font-mono text-blue-400 font-semibold">
                ₹{merchant?.spendingCapInr?.toLocaleString('en-IN') || '10,000'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-2 mb-2">Navigation</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-600 truncate">{item.description}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <button
            onClick={() => onSwitchRole('landing')}
            className="sidebar-item w-full text-slate-500"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span className="text-xs">Back to Marketplace</span>
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="text-xs">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm text-white">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}
              </h1>
              <p className="text-[11px] text-slate-500">
                {NAV_ITEMS.find(n => n.id === activeTab)?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Razorpay Test
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
              <Zap className="w-3 h-3" />
              ACP + x402
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview'    && <Overview setActiveTab={setActiveTab} />}
            {activeTab === 'catalog'     && <CatalogManager />}
            {activeTab === 'campaigns'   && <CampaignManager />}
            {activeTab === 'api'         && <APIExplorer />}
            {activeTab === 'buyer'       && <AIBuyerPlayground />}
            {activeTab === 'audit'       && <AuditTrail />}
            {activeTab === 'failure-lab' && <FailureLab />}
          </div>
        </main>
      </div>
    </div>
  );
}
