import React, { useState, useEffect } from 'react';
import { X, Zap, CreditCard, CheckCircle, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../api';

/**
 * SBMDSetupModal — One-time Razorpay Checkout to save a payment token
 * for frictionless SBMD conversational checkout.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   onSuccess {({ customerId, tokenId, isSandbox }) => void}
 */
export default function SBMDSetupModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('idle'); // idle | loading | ready | fetching_token | done | error
  const [setupData, setSetupData] = useState(null); // { customerId, orderId, keyId, isSandbox }
  const [errorMsg, setErrorMsg] = useState('');

  // Load Razorpay SDK once
  useEffect(() => {
    if (!window.Razorpay && !document.getElementById('rzp-checkout-js')) {
      const s = document.createElement('script');
      s.id = 'rzp-checkout-js';
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  if (!isOpen) return null;

  const handleCreateCustomer = async () => {
    setStep('loading');
    setErrorMsg('');
    try {
      const res = await api.post('/api/agents/sbmd/create-customer', {
        name: 'Demo Shopper',
        email: 'shopper@razoragent.demo',
        contact: '+919876543210'
      });
      setSetupData(res.data);
      setStep('ready');

      // If sandbox (no real Razorpay keys) — skip the modal and simulate
      if (res.data.isSandbox || !res.data.keyId || res.data.orderId?.startsWith('order_test_')) {
        onSuccess({ customerId: res.data.customerId, tokenId: `token_sandbox_${Date.now()}`, isSandbox: true });
        onClose();
        return;
      }

      // Short delay then open Razorpay Checkout
      setTimeout(() => openRazorpayCheckout(res.data), 300);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
      setStep('error');
    }
  };

  const openRazorpayCheckout = (data) => {
    if (!window.Razorpay) {
      setErrorMsg('Razorpay SDK not loaded yet. Please try again.');
      setStep('error');
      return;
    }

    const options = {
      key: data.keyId,
      order_id: data.orderId,
      customer_id: data.customerId,
      recurring: 1,              // ← enables token/mandate creation
      amount: data.amount || 100,
      currency: 'INR',
      name: 'RazorAgent',
      description: 'One-time setup to enable frictionless checkout (₹1)',
      prefill: {
        name: 'Demo Shopper',
        email: 'shopper@razoragent.demo',
        contact: '+919876543210'
      },
      theme: { color: '#10b981' },
      handler: async (response) => {
        setStep('fetching_token');
        try {
          const tokenRes = await api.post('/api/agents/sbmd/fetch-token', {
            customerId: data.customerId,
            paymentId: response.razorpay_payment_id
          });
          setStep('done');
          setTimeout(() => {
            onSuccess({
              customerId: data.customerId,
              tokenId: tokenRes.data.tokenId,
              method: tokenRes.data.method
            });
            onClose();
          }, 1200);
        } catch {
          // Token fetch failed but payment went through — use payment ID as fallback token
          setStep('done');
          setTimeout(() => {
            onSuccess({
              customerId: data.customerId,
              tokenId: response.razorpay_payment_id,
              isFallback: true
            });
            onClose();
          }, 1200);
        }
      },
      modal: {
        ondismiss: () => setStep('idle')
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (r) => {
        setErrorMsg(r.error?.description || 'Payment failed. Please try again.');
        setStep('error');
      });
      rzp.open();
    } catch (err) {
      setErrorMsg('Failed to open Razorpay: ' + err.message);
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/20 rounded-2xl shadow-2xl shadow-emerald-900/20 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Enable Frictionless Pay</div>
              <div className="text-[10px] text-emerald-400">SBMD One-time Setup</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Success state */}
          {step === 'done' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <div className="text-base font-bold text-white">All Set!</div>
                <div className="text-xs text-slate-400 mt-1">Frictionless checkout is now active.</div>
              </div>
            </div>
          )}

          {/* Fetching token state */}
          {step === 'fetching_token' && (
            <div className="text-center py-4 space-y-3">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <div className="text-sm text-slate-300">Saving your payment method...</div>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{errorMsg}</p>
              </div>
              <button onClick={() => setStep('idle')} className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
                ← Try again
              </button>
            </div>
          )}

          {/* Idle / Ready states — main content */}
          {(step === 'idle' || step === 'loading' || step === 'ready') && (
            <>
              {/* Explanation */}
              <div className="space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Save your payment method once, and every future conversational purchase
                  will be <span className="text-emerald-400 font-semibold">captured instantly</span> from
                  your SBMD reserve — no popups, no PIN required.
                </p>
                <div className="flex flex-col gap-1.5">
                  {['No checkout page on future orders', 'Payment visible on Razorpay Dashboard', 'Respects your spending limit automatically'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-[11px] text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test card info */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  <CreditCard className="w-3 h-3" />
                  Test Card Credentials
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[9px] text-slate-500 mb-0.5">Card Number</div>
                    <div className="text-[10px] font-mono text-slate-200 font-semibold">4111 1111 1111 1111</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 mb-0.5">Expiry</div>
                    <div className="text-[10px] font-mono text-slate-200 font-semibold">12/28</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 mb-0.5">CVV</div>
                    <div className="text-[10px] font-mono text-slate-200 font-semibold">123</div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-center">Mock bank page → click "Success" to complete</div>
              </div>

              {/* Security note */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                <span>₹1 authorization charge. No real money deducted in test mode.</span>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleCreateCustomer}
                disabled={step === 'loading' || step === 'ready'}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
              >
                {step === 'loading' || step === 'ready' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Setup Now (₹1 auth)</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
