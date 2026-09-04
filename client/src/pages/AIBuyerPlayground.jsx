import React, { useState } from 'react';
import { 
  Bot, Play, CheckCircle2, XCircle, ShieldAlert, Sparkles, RefreshCw, 
  ArrowRight, ShieldCheck, Terminal, DollarSign, Layers, ExternalLink 
} from 'lucide-react';
import api from '../api';

export default function AIBuyerPlayground() {
  const [budget, setBudget] = useState(5000);
  const [objective, setObjective] = useState('Buy the best value audio setup');
  const [testBudgetExceed, setTestBudgetExceed] = useState(true);
  const [running, setRunning] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const handleRunSimulation = async () => {
    setRunning(true);
    setSimulationResult(null);
    try {
      const res = await api.post('/api/agents/buyer/run', {
        budgetInr: Number(budget),
        objective,
        testBudgetExceed
      });
      setSimulationResult(res.data);
    } catch (err) {
      alert('AI Buyer simulation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/40 via-blue-950/30 to-slate-900 border border-sky-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-bold text-sky-400">Autonomous Machine Commerce</span>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span className="text-xs text-slate-400">ACP & x402 Protocol Implementation</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Autonomous AI Buyer Agent Playground
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Simulate external AI buyer agents discovering your merchant card, parsing JSON-LD schemas, negotiating x402 HTTP 402 payment challenges, settling via Razorpay test mode, and experiencing strict spending cap gating.
          </p>
        </div>
        <button
          onClick={handleRunSimulation}
          disabled={running}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 font-bold text-xs text-white shadow-lg shadow-sky-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className="w-4 h-4" />
          {running ? 'Agent Navigating Protocols...' : 'Run Autonomous Buyer Loop'}
        </button>
      </div>

      {/* Simulation Setup Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Simulation Controls */}
        <div className="lg:col-span-4 p-5 rounded-2xl glass-card space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            Agent Mission Configuration
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Allocated Spending Budget (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[3000, 5000, 8000, 12000].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudget(b)}
                    className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 hover:text-white"
                  >
                    ₹{b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Buyer Intent / Objective
              </label>
              <textarea
                rows="2"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testBudgetExceed}
                  onChange={(e) => setTestBudgetExceed(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-slate-200 font-medium">Test Budget Boundary Enforcement</span>
              </label>
              <p className="text-[10px] text-slate-500 pl-5">
                Forces an over-budget attempt to demonstrate the Safety Gate block and the graceful fallback alternative search.
              </p>
            </div>

            {/* Protocol Spec Badges */}
            <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1 text-slate-400">
              <div className="font-semibold text-slate-300">Supported Protocols:</div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">acp/1.0</span>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">x402/1.0</span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">schema.org/ItemList</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Step-by-Step Execution Feed */}
        <div className="lg:col-span-8 p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white">Agent Execution Pipeline Trace</h2>
            </div>
            {simulationResult && (
              <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Mission Completed
              </span>
            )}
          </div>

          {!simulationResult && !running && (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <Bot className="w-8 h-8 mx-auto text-slate-600" />
              <div>Click "Run Autonomous Buyer Loop" to watch the AI buyer transact.</div>
            </div>
          )}

          {running && (
            <div className="py-16 text-center text-xs text-sky-400 space-y-3">
              <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>Autonomous agent reading ACP card and initiating x402 checkout...</div>
            </div>
          )}

          {simulationResult && (
            <div className="space-y-3 animate-in fade-in">
              {/* Summary Stats Header */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500">Initial Budget:</span>
                  <div className="font-mono font-bold text-white">₹{simulationResult.allocatedBudgetInr}</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Spent:</span>
                  <div className="font-mono font-bold text-emerald-400">₹{simulationResult.totalSpentInr}</div>
                </div>
                <div>
                  <span className="text-slate-500">Remaining Budget:</span>
                  <div className="font-mono font-bold text-sky-400">₹{simulationResult.remainingBudgetInr}</div>
                </div>
              </div>

              {/* Step Sequence */}
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {simulationResult.steps?.map((s, idx) => {
                  const isBlocked = s.status === 'BLOCKED';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
                        isBlocked
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isBlocked
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {s.step}
                          </span>
                          <span className="font-bold text-white">{s.title}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold ${
                            isBlocked
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-7 font-mono">{s.details}</p>
                    </div>
                  );
                })}
              </div>

              {/* Graceful Fallback Result Showcase */}
              {simulationResult.budgetCapDemo && (
                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Graceful Budget Boundary & Alternative Discovery
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {simulationResult.budgetCapDemo.fallback?.explanation}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {simulationResult.budgetCapDemo.fallback?.alternatives?.map((alt) => (
                      <div key={alt.sku} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                        <div className="font-semibold text-white truncate">{alt.name}</div>
                        <div className="text-emerald-400 font-mono font-bold mt-0.5">₹{alt.priceInr}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
