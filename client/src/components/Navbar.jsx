import React from 'react';
import { Bot, ShieldCheck, Zap, LogOut, User, Store, Sparkles, AlertTriangle, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ activeTab, setActiveTab }) {
  const { merchant, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Layers },
    { id: 'registry', label: 'Merchant Registry', icon: Store },
    { id: 'storefront', label: 'Store & Checkout AI', icon: Store },
    { id: 'campaigns', label: 'Revenue Campaigns', icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">RazorAgent</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  x402 + ACP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Agentic Commerce & AI Growth</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Status & Profile Controls */}
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Razorpay Test Mode
            </div>

            {merchant ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 pl-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">{merchant.storeName || merchant.name}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Live Merchant</div>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-all shadow-md shadow-blue-500/20"
              >
                <User className="w-3.5 h-3.5" />
                Merchant Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
