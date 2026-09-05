import React, { useState } from 'react';
import { Bot, Lock, Mail, Store, User, ArrowRight, Sparkles, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login({ setActiveTab, onBack }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('merchant@razoragent.demo');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Rajesh Kumar');
  const [storeName, setStoreName] = useState('AeroTech Gadgets India');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await register({ email, password, name, storeName });
      } else {
        await login(email, password);
      }
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-blue-800/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-800/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Marketplace
          </button>
        )}

        <div className="glass-card rounded-3xl p-8 space-y-6 shadow-2xl border border-blue-500/20">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30 text-2xl font-black">
              ⚡
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {isRegister ? 'Create Merchant Account' : 'Merchant Portal'}
            </h2>
            <p className="text-xs text-slate-400">
              Manage revenue agents, monitor AI buyers, and enforce safety boundaries.
            </p>
          </div>

          {/* 1-Click Demo Login Banner */}
          {!isRegister && (
            <div
              onClick={() => { setEmail('merchant@razoragent.demo'); setPassword('password123'); setIsRegister(false); }}
              className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center justify-between cursor-pointer hover:bg-blue-500/20 transition-all"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>1-Click Seeded Demo Merchant</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded">Auto-Fill</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {isRegister && (
              <>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your Name" className={inputClass} />
                </div>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input type="text" required value={storeName} onChange={e => setStoreName(e.target.value)}
                    placeholder="Store Name" className={inputClass} />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="merchant@razoragent.demo" className={`${inputClass} font-mono`} />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className={`${inputClass} pr-9 font-mono`} />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? 'Authenticating...' : isRegister ? 'Create Merchant Store' : 'Sign In to Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-800">
            {isRegister ? (
              <span>Already have an account?{' '}
                <button type="button" onClick={() => setIsRegister(false)} className="text-blue-400 hover:underline font-semibold">Sign In</button>
              </span>
            ) : (
              <span>Need a new merchant store?{' '}
                <button type="button" onClick={() => setIsRegister(true)} className="text-blue-400 hover:underline font-semibold">Sign Up</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
