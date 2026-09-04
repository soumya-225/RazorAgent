import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Filter, RefreshCw, ChevronDown, ChevronRight, 
  CheckCircle2, XCircle, Clock, AlertTriangle, FileCode, Layers, Search 
} from 'lucide-react';
import api from '../api';

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [selectedAgent, selectedStatus]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedAgent) params.agent = selectedAgent;
      if (selectedStatus) params.status = selectedStatus;
      const res = await api.get('/api/safety/audit-logs', { params });
      setLogs(res.data?.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const agents = ['SAFETY_GATE', 'CHECKOUT_AGENT', 'UPSELL_AGENT', 'CAMPAIGN_AGENT', 'BUYER_AGENT', 'RAZORPAY_WEBHOOK'];
  const statuses = ['SUCCESS', 'BLOCKED', 'WAITING_APPROVAL', 'PENDING', 'FAILED'];

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      l.actionType?.toLowerCase().includes(term) ||
      l.explanation?.toLowerCase().includes(term) ||
      l.razorpayEntityId?.toLowerCase().includes(term) ||
      l.agentName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold text-white">Immutable Safety & Audit Trail</h1>
          </div>
          <p className="text-xs text-slate-400">
            Append-only verification log: Every money action is explainable, bounded, and gated.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log Feed
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl glass-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search actions, explanations, entity IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Filter Agent */}
          <div>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">All Agent Kernels</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Feed */}
      <div className="rounded-2xl glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Agent Kernel</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Razorpay Entity ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-500">
                    No audit records matching the filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const isSuccess = log.status === 'SUCCESS';
                  const isBlocked = log.status === 'BLOCKED';
                  const isWaiting = log.status === 'WAITING_APPROVAL';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                          {log.agentName}
                        </td>
                        <td className="py-3 px-4 text-blue-400 font-semibold truncate max-w-[200px]">
                          {log.actionType}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isBlocked
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : isWaiting
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">
                          {log.amountInr > 0 ? `₹${log.amountInr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[150px]">
                          {log.razorpayEntityId || '—'}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 font-sans text-xs">
                          <td colSpan="7" className="p-4 pl-12 space-y-3 border-y border-purple-500/20">
                            <div>
                              <span className="text-slate-500 font-semibold block text-[11px]">
                                Plain-English Reasoning (AI Justification):
                              </span>
                              <p className="text-slate-200 mt-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                                {log.explanation}
                              </p>
                            </div>

                            {log.actionPayload && (
                              <div>
                                <span className="text-slate-500 font-semibold block text-[11px] font-mono">
                                  Raw Action Payload:
                                </span>
                                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-purple-300 overflow-x-auto max-h-[160px] mt-1">
                                  {JSON.stringify(log.actionPayload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
