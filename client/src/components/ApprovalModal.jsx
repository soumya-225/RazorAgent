import React, { useState } from 'react';
import { X, AlertOctagon, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import api from '../api';

export default function ApprovalModal({ isOpen, onClose, request, onDecisionComplete }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const handleDecision = async (decision) => {
    setLoading(true);
    try {
      await api.post(`/api/safety/approvals/${request.id}/decide`, { decision });
      setLoading(false);
      if (onDecisionComplete) {
        onDecisionComplete(decision);
      }
      onClose();
    } catch (err) {
      setLoading(false);
      alert('Error updating approval request: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-bold text-sm">Human Approval Gate: High-Value Action</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300">
            This automated agent transaction of <strong className="text-white font-bold">₹{request.amountInr?.toLocaleString('en-IN')}</strong> exceeds the merchant's configured threshold and requires your manual sign-off before money moves.
          </div>

          <div className="space-y-2">
            <div><span className="text-slate-500">Agent:</span> <span className="font-semibold text-white">{request.agentName}</span></div>
            <div><span className="text-slate-500">Action:</span> <span className="font-mono text-blue-400">{request.actionType}</span></div>
            <div><span className="text-slate-500">Reasoning:</span> <p className="text-slate-300 mt-0.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">{request.reasoning}</p></div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              onClick={() => handleDecision('REJECTED')}
              disabled={loading}
              className="py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject Action
            </button>
            <button
              onClick={() => handleDecision('APPROVED')}
              disabled={loading}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve & Execute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
