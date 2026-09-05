import React, { useEffect, useState } from 'react';
import {
  Store, ShoppingBag, BarChart3, Sparkles, Bot, ShieldCheck,
  ArrowRight, Zap, CreditCard, MessageSquare, Package
} from 'lucide-react';

const MERCHANT_FEATURES = [
  { icon: BarChart3,    text: 'Real-time Revenue Analytics' },
  { icon: Package,      text: 'Product & Catalog Management' },
  { icon: Sparkles,     text: 'AI Revenue Campaigns' },
  { icon: ShieldCheck,  text: 'Safety-Gated Automation' },
  { icon: Zap,          text: 'Exposed REST API for Agents' },
];

const CUSTOMER_FEATURES = [
  { icon: MessageSquare, text: 'AI Conversational Shopping' },
  { icon: ShoppingBag,   text: 'Smart Product Recommendations' },
  { icon: CreditCard,    text: 'Automated Checkout — No Friction' },
  { icon: Bot,           text: 'Upsell & Cross-sell Intelligence' },
  { icon: Zap,           text: 'Agent Auto-Pay below Threshold' },
];

export default function LandingPage({ onSelectRole }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#050810] flex flex-col overflow-hidden relative">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-700/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-violet-700/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-indigo-800/8 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 font-bold text-xl">
            ⚡
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-tight">RazorAgent</span>
            <span className="ml-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Marketplace
            </span>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">Agentic Commerce Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Razorpay Test Mode
          </span>
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
            ACP + x402
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div
          className="text-center mb-16 transition-all duration-700"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-white/10 text-xs text-slate-300 font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Powered by GPT-4o · Razorpay · Autonomous Agent Protocol
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] mb-5">
            The Future of{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Commerce
            </span>
            <br />is Agentic.
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            A dual-mode marketplace where merchants run AI revenue engines and customers shop through intelligent, autonomous agents.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl transition-all duration-700 delay-150"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(32px)' }}
        >
          {/* Merchant Card */}
          <button
            onClick={() => onSelectRole('merchant')}
            className="role-card-merchant group rounded-3xl p-7 text-left flex flex-col gap-5 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-700/30">
                <Store className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                Merchant
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-1.5">Merchant Portal</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Manage products, launch AI revenue campaigns, and watch autonomous agents convert your inventory into revenue.
              </p>
            </div>
            <ul className="space-y-2.5">
              {MERCHANT_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-sm font-bold text-blue-300 mt-auto group-hover:gap-3 transition-all">
              Access Dashboard <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Customer Card */}
          <button
            onClick={() => onSelectRole('customer')}
            className="role-card-customer group rounded-3xl p-7 text-left flex flex-col gap-5 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-700 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-700/30">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
                Customer
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-1.5">Customer Storefront</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Shop with an AI agent that understands you, recommends products, and completes checkout automatically — no friction.
              </p>
            </div>
            <ul className="space-y-2.5">
              {CUSTOMER_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-sm font-bold text-violet-300 mt-auto group-hover:gap-3 transition-all">
              Start Shopping <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Footer info row */}
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-600 transition-all duration-700 delay-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-slate-500" /> Safety-Gated Agents</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span className="flex items-center gap-1.5"><Bot className="w-3 h-3 text-slate-500" /> ACP Agent Protocol</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-slate-500" /> x402 Payment Standard</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span className="flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-slate-500" /> Razorpay Powered</span>
        </div>
      </main>
    </div>
  );
}
