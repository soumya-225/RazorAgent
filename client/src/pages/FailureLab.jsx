import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Clock, RefreshCw, ShieldAlert, CheckCircle2, 
  XCircle, Play, ArrowRight, ShieldCheck, FileText, Check 
} from 'lucide-react';
import api from '../api';
import ApprovalModal from '../components/ApprovalModal';

export default function FailureLab() {
  // Timeout Demo State
  const [runningTimeout, setRunningTimeout] = useState(false);
  const [timeoutResult, setTimeoutResult] = useState(null);

  // Budget Block Demo State
  const [runningBudget, setRunningBudget] = useState(false);
  const [budgetResult, setBudgetResult] = useState(null);

  // Approval Queue State
  const [approvals, setApprovals] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [activeApprovalRequest, setActiveApprovalRequest] = useState(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const res = await api.get('/api/safety/approvals');
      setApprovals(res.data?.requests || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleRunTimeoutDemo = async () => {
    setRunningTimeout(true);
    setTimeoutResult(null);
    try {
      const res = await api.post('/api/safety/demo/timeout-recovery');
      setTimeoutResult(res.data);
    } catch (err) {
      alert('Timeout demo error: ' + err.message);
    } finally {
      setRunningTimeout(false);
    }
  };

  const handleRunBudgetDemo = async () => {
    setRunningBudget(true);
    setBudgetResult(null);
    try {
      const res = await api.post('/api/safety/demo/budget-block', {
        budgetInr: 5000,
        spentInr: 4199,
        attemptedInr: 2200
      });
      setBudgetResult(res.data);
    } catch (err) {
      alert('Budget demo error: ' + err.message);
    } finally {
      setRunningBudget(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-amber-950/30 to-slate-900 border border-red-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-bold text-red-400">Safety & Reliability Lab</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            <span className="text-xs text-slate-400">Bounded, Gated & Gracefully Recovered</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Graceful Failure Handling & Human Approval Lab
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Demonstrating resilience under failure scenarios: Payment session timeouts self-heal with fresh 30-min Razorpay payment links, and over-budget agent requests trigger graceful fallback discovery without crashing.
          </p>
        </div>
      </div>

      {/* Grid: 2 Failure Demos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Failure Scenario 1: Payment Window Timeout Auto-Recovery */}
        <div className="p-5 rounded-2xl glass-card space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                Failure 1: Payment Window Timeout
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Self-Healing Pipeline
              </span>
            </div>

            <p className="text-xs text-slate-300">
              When a customer or AI agent payment link expires (<code className="text-amber-400 font-mono">payment.link.expired</code>), the webhook triggers an auto-recovery pipeline: the order is marked <span className="text-red-400 font-semibold font-mono">TIMED_OUT</span>, and the Checkout Agent automatically provisions a fresh 30-minute Razorpay payment link.
            </p>

            <button
              onClick={handleRunTimeoutDemo}
              disabled={runningTimeout}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {runningTimeout ? 'Simulating Timeout & Recovery...' : 'Simulate Payment Timeout & Recovery'}
            </button>
          </div>

          {/* Result Card */}
          {timeoutResult && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Auto-Recovery Completed!
              </div>
              <p className="text-slate-300 text-[11px]">{timeoutResult.reason}</p>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-blue-400 truncate">
                New Link: {timeoutResult.newPaymentLink}
              </div>
            </div>
          )}
        </div>

        {/* Failure Scenario 2: Budget Boundary Block & Fallback Discovery */}
        <div className="p-5 rounded-2xl glass-card space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                Failure 2: Budget Boundary Cap & Fallback
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                Gated Safety
              </span>
            </div>

            <p className="text-xs text-slate-300">
              When an autonomous AI buyer attempts a transaction (e.g. ₹2,200) that would exceed its remaining budget (e.g. ₹801 remaining of ₹5,000 budget), the Safety Gate halts the execution (<span className="text-red-400 font-semibold font-mono">BLOCKED</span>) and triggers dynamic search for viable alternative items.
            </p>

            <button
              onClick={handleRunBudgetDemo}
              disabled={runningBudget}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {runningBudget ? 'Testing Safety Gate Block...' : 'Simulate Budget Boundary Exceeded'}
            </button>
          </div>

          {/* Result Card */}
          {budgetResult && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Safety Gate Intercepted & Fallback Search Complete
              </div>
              <p className="text-slate-300 text-[11px]">
                {budgetResult.fallback?.explanation}
              </p>
              <div className="text-[10px] text-slate-400 font-mono">
                Found {budgetResult.fallback?.alternatives?.length} alternatives within leftover ₹{budgetResult.remainingInr} budget.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Human-in-the-Loop High-Value Approval Queue */}
      <div className="p-5 rounded-2xl glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Human Approval Gate Queue</h2>
              <p className="text-[11px] text-slate-400">Transactions exceeding approval threshold held for manual verification</p>
            </div>
          </div>
          <button
            onClick={fetchApprovals}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingApprovals ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {approvals.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No high-value transactions currently pending human approval.
          </div>
        ) : (
          <div className="space-y-2.5">
            {approvals.map((req) => {
              const isPending = req.status === 'PENDING';
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">₹{req.amountInr.toLocaleString('en-IN')}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                        {req.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Agent: <span className="text-white font-medium">{req.agentName}</span> | Action: <span className="text-blue-400 font-mono">{req.actionType}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{req.reasoning}</p>
                  </div>

                  {isPending && (
                    <button
                      onClick={() => setActiveApprovalRequest(req)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
                    >
                      Review & Decide
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={Boolean(activeApprovalRequest)}
        request={activeApprovalRequest}
        onClose={() => setActiveApprovalRequest(null)}
        onDecisionComplete={() => fetchApprovals()}
      />
    </div>
  );
}
