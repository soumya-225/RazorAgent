import React, { useState } from 'react';
import {
  CreditCard, Lock, Mail, User, Phone, MapPin, Zap, ShoppingBag,
  ArrowRight, ChevronLeft, Sparkles, Bot, Eye, EyeOff
} from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const PAYMENT_METHODS = [
  { value: 'card',       label: '💳 Credit / Debit Card' },
  { value: 'upi',        label: '📱 UPI (GPay, PhonePe, Paytm)' },
  { value: 'netbanking', label: '🏦 Net Banking' },
  { value: 'wallet',     label: '👛 Wallet (Paytm, MobiKwik)' },
];

export default function CustomerLogin({ onBack, onSuccess }) {
  const { customerLogin, customerRegister } = useCustomerAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1); // registration is 2-step
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('upi');
  const [autopayThresholdInr, setAutopayThresholdInr] = useState(3000);
  const [address, setAddress] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await customerLogin(email, password);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStep1 = (e) => {
    e.preventDefault();
    if (!name || !email || !password) { setError('Name, email, and password are required.'); return; }
    setError('');
    setStep(2);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await customerRegister({ email, password, name, phone, preferredPayment, autopayThresholdInr, address });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-violet-900/40 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-600";

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-violet-800/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-800/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Marketplace
        </button>

        <div className="glass-card-customer rounded-3xl p-8 space-y-6 shadow-2xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-700 to-purple-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-violet-600/30">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {isRegister
                ? step === 1 ? 'Create Account' : 'Complete Your Profile'
                : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-500">
              {isRegister
                ? step === 1 ? 'Set up your shopping identity' : 'Help the agent know your preferences'
                : 'Sign in to your customer account'}
            </p>
          </div>

          {/* Step indicator for registration */}
          {isRegister && (
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 1 ? 'bg-violet-500' : 'bg-slate-800'}`} />
              <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 2 ? 'bg-violet-500' : 'bg-slate-800'}`} />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* ---- LOGIN FORM ---- */}
          {!isRegister && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} pr-9`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 hover:from-violet-600 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer">
                {loading ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ---- REGISTER STEP 1 ---- */}
          {isRegister && step === 1 && (
            <form onSubmit={handleRegisterStep1} className="space-y-4">
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full Name" className={inputClass} />
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" className={inputClass} />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Create password" className={`${inputClass} pr-9`} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 hover:from-violet-600 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ---- REGISTER STEP 2 ---- */}
          {isRegister && step === 2 && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Phone */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide block mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 9876543210" className={inputClass} />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide block mb-1.5">Delivery Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="123, Street, City, Pincode" className={inputClass} />
                </div>
              </div>

              {/* Preferred Payment */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-violet-400" />
                  Preferred Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.value} type="button"
                      onClick={() => setPreferredPayment(pm.value)}
                      className={`p-2.5 rounded-xl text-xs font-medium text-left transition-all border ${
                        preferredPayment === pm.value
                          ? 'bg-violet-600/20 border-violet-500/60 text-violet-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-pay Threshold */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide block mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Agent Auto-Pay Threshold (₹)
                </label>
                <p className="text-[10px] text-slate-600 mb-2">
                  Agent auto-completes checkout without asking you when cart total is below this amount.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                  <input
                    type="number" min="0" max="50000" value={autopayThresholdInr}
                    onChange={e => setAutopayThresholdInr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-violet-900/40 text-white text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-0.5">
                  <span>₹0 (always ask)</span>
                  <span>₹50,000 (always auto-pay)</span>
                </div>
              </div>

              {/* AI Agent Note */}
              <div className="p-3 rounded-xl bg-violet-900/20 border border-violet-500/20 flex items-start gap-2.5">
                <Bot className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-300 leading-relaxed">
                  The shopping agent will use your saved phone, address, and payment preference to complete checkout automatically — no copy-pasting required.
                </p>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-all cursor-pointer">
                  ← Back
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 hover:from-violet-600 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer">
                  {loading ? 'Creating Account...' : 'Create Account'} <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Toggle */}
          <div className="text-center text-xs text-slate-500 pt-1 border-t border-violet-900/30">
            {isRegister ? (
              <span>Already have an account?{' '}
                <button onClick={() => { setIsRegister(false); setStep(1); setError(''); }}
                  className="text-violet-400 hover:text-violet-300 font-semibold">Sign In</button>
              </span>
            ) : (
              <span>New customer?{' '}
                <button onClick={() => { setIsRegister(true); setStep(1); setError(''); }}
                  className="text-violet-400 hover:text-violet-300 font-semibold">Create Account</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
