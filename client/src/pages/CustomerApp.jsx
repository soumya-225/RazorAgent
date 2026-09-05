import React from 'react';
import { ShoppingBag, LogOut, Zap } from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import CustomerStorefront from './CustomerStorefront';

export default function CustomerApp({ onSwitchRole }) {
  const { customer, customerLogout } = useCustomerAuth();

  const handleLogout = () => {
    customerLogout();
    onSwitchRole('landing');
  };

  const paymentLabel = {
    card:       '💳 Card',
    upi:        '📱 UPI',
    netbanking: '🏦 Net Banking',
    wallet:     '👛 Wallet',
  }[customer?.preferredPayment] || '💳 Card';

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 flex flex-col">
      {/* Customer Header */}
      <header className="sticky top-0 z-40 border-b border-violet-900/30 bg-[#07060f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-700 to-purple-500 flex items-center justify-center shadow-md shadow-violet-600/20">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white">RazorAgent</span>
              <span className="ml-1.5 text-[10px] text-violet-400 font-medium">Storefront</span>
            </div>
          </div>

          {/* Customer profile pill */}
          {customer && (
            <div className="flex items-center gap-3">
              {/* Autopay badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
                <Zap className="w-3 h-3" />
                Auto-pay &lt;₹{Number(customer.autopayThresholdInr).toLocaleString('en-IN')}
              </div>

              {/* Payment method */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-medium">
                {paymentLabel}
              </div>

              {/* Profile + Logout */}
              <div className="flex items-center gap-2 bg-violet-900/20 border border-violet-900/40 rounded-xl px-3 py-1.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                  {customer.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-white truncate max-w-[100px]">
                  {customer.name}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Storefront */}
      <main className="flex-1">
        <CustomerStorefront />
      </main>
    </div>
  );
}
