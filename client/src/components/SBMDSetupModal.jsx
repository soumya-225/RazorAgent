import React, { useState, useEffect } from 'react';
import { Zap, X, CreditCard, CheckCircle, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../api';

/**
 * SBMDSetupModal
 * One-time frictionless checkout setup via Razorpay saved token (recurring: 1).
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   onSuccess {({ customerId, tokenId, isSandbox }) => void}
 */
export default function SBMDSetupModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');
  const [setupData, setSetupData] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setError('');
      setSetupData(null);
    }
  }, [isOpen]);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleSetup = async () => {
    setStep('loading');
    setError('');

    try {
      // Step 1: Create Razorpay customer + ₹1 setup order
      const customerRes = await api.post('/api/agents/sbmd/create-customer', {
        name: 'Demo Shopper',
        email: 'shopper@razoragent.demo',
        contact: '+919876543210'
      });

      const { customerId, orderId, keyId, amount, isSandbox } = customerRes.data;
      setSetupData({ customerId, orderId, keyId, amount, isSandbox });

      // Sandbox shortcut: Razorpay test keys (rzp_test_*) do not support recurring token
      // creation — always simulate a token so frictionless Local Cap mode activates.
      const isTestKey = !keyId || keyId.startsWith('rzp_test_') || keyId === 'rzp_test_sandbox';
      if (isSandbox || orderId?.startsWith('order_test_') || isTestKey) {
        // Simulate a short delay so the UX feels like something happened
        await new Promise(r => setTimeout(r, 800));
        onSuccess({ customerId: customerId || 'cust_test_demo', tokenId: 'token_test_demo', isSandbox: true });
        return;
      }

      // Step 3: Load Razorpay Checkout SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay Checkout SDK.');

      setStep('idle'); // Allow button state to settle before SDK opens

      // Step 4: Open Razorpay Checkout with recurring: 1
      const rzp = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        customer_id: customerId,
        recurring: 1,
        amount,
        currency: 'INR',
        name: 'RazorAgent — Setup Frictionless Pay',
        description: 'One-time setup to enable frictionless checkout. ₹1 authorization.',
        prefill: {
          name: 'Demo Shopper',
          email: 'shopper@razoragent.demo',
          contact: '+919876543210'
        },
        theme: { color: '#10b981' },
        modal: {
          ondismiss: () => {
            setStep('idle');
          }
        },
        handler: async (response) => {
          try {
            setStep('loading');
            const cid = response.razorpay_customer_id || customerId;
            const tokenRes = await api.post('/api/agents/sbmd/fetch-token', { customerId: cid });
            onSuccess({
              customerId: cid,
              tokenId: tokenRes.data.tokenId,
              isSandbox: false
            });
          } catch (e) {
            setError('Token setup succeeded but token fetch failed: ' + e.message);
            setStep('error');
          }
        }
      });

      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment failed. Please try again.');
        setStep('error');
      });

      rzp.open();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Setup failed. Please try again.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-emerald-900/30 p-6 space-y-5">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Enable Frictionless Checkout</h2>
            <p className="text-[11px] text-emerald-400">One-click setup · No card entry needed in test mode</p>
          </div>
        </div>

        {/* Test mode notice */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Razorpay Test Mode — Instant Simulation</p>
            <p className="text-[11px] text-amber-200/70 mt-0.5">
              Recurring card tokenisation requires production setup. In test mode, clicking the button instantly activates frictionless checkout using the Local Cap simulator — no card entry, no Razorpay popup.
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Once activated, every purchase you make via chat will be <strong className="text-emerald-400">captured instantly</strong> against your spending reserve — no checkout page, no OTP, no human intervention.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {['Zero-click payments', 'Local cap safeguard', 'Cancel anytime'].map(f => (
            <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" /> {f}
            </span>
          ))}
        </div>

        {/* Error state */}
        {step === 'error' && error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Privacy note */}
        <div className="flex items-start gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
          <span>In test mode this activates the Local Cap simulator. In production, your card is tokenised by Razorpay and never stored on our servers.</span>
        </div>

        {/* CTA */}
        <button
          onClick={handleSetup}
          disabled={step === 'loading'}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {step === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Activating frictionless pay…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Activate Frictionless Checkout
            </>
          )}
        </button>
      </div>
    </div>
  );
}
