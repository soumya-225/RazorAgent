import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import CatalogManager from './pages/CatalogManager';
import StorefrontChat from './pages/StorefrontChat';
import CampaignManager from './pages/CampaignManager';
import AIBuyerPlayground from './pages/AIBuyerPlayground';
import AuditTrail from './pages/AuditTrail';
import FailureLab from './pages/FailureLab';
import Login from './pages/Login';

function MainApp() {
  const [activeTab, setActiveTab] = useState('overview');
  const { merchant, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono">Initializing RazorAgent Kernel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && <Overview setActiveTab={setActiveTab} />}
        {activeTab === 'catalog' && <CatalogManager />}
        {activeTab === 'storefront' && <StorefrontChat />}
        {activeTab === 'campaigns' && <CampaignManager />}
        {activeTab === 'buyer' && <AIBuyerPlayground />}
        {activeTab === 'audit' && <AuditTrail />}
        {activeTab === 'failure-lab' && <FailureLab />}
        {activeTab === 'login' && <Login setActiveTab={setActiveTab} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px]">
          <div>
            RazorAgent Platform • Powered by <span className="text-slate-300">OpenAI GPT-4o</span> & <span className="text-blue-400">Razorpay</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400">● ACP v1.0</span>
            <span className="text-sky-400">● x402 Protocol</span>
            <span className="text-purple-400">● 100% Gated Audit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
