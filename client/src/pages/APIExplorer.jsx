import React, { useState } from 'react';
import { 
  Code2, Copy, Check, Eye, EyeOff, ExternalLink, Zap, 
  Lock, Globe, ShoppingCart, Bot, BarChart3, ChevronDown, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = typeof window !== 'undefined'
  ? window.location.origin.replace('5173', '5000').replace('3000', '5000')
  : 'http://localhost:5000';

const ENDPOINTS = [
  {
    group: 'Marketplace Discovery',
    color: 'emerald',
    items: [
      {
        method: 'GET', path: '/api/marketplace/info', auth: false,
        icon: Globe,
        description: 'Platform info, capabilities, and all available endpoints. Perfect for agent discovery.',
        response: `{ "platform": "RazorAgent Marketplace", "capabilities": [...], "endpoints": {...} }`,
        curl: `curl ${API_BASE}/api/marketplace/info`
      },
      {
        method: 'GET', path: '/api/marketplace/catalog', auth: false,
        icon: ShoppingCart,
        description: 'Full product catalog with pricing, badges (bestseller, low-stock), and merchant info.',
        response: `{ "catalog": [{ "sku": "SKU001", "name": "...", "priceInr": 2499, "badges": ["bestseller"] }] }`,
        curl: `curl "${API_BASE}/api/marketplace/catalog?category=Electronics&limit=20"`
      },
      {
        method: 'GET', path: '/api/marketplace/analytics', auth: true,
        icon: BarChart3,
        description: 'Revenue summary, daily breakdown, top products. Requires your merchant API key.',
        response: `{ "summary": { "totalRevenueInr": 12450, "paidOrders": 8, "conversionRate": 72 }, "revenueByDay": [...] }`,
        curl: `curl -H "X-API-Key: YOUR_API_KEY" ${API_BASE}/api/marketplace/analytics`
      },
    ]
  },
  {
    group: 'AI Shopping Agents',
    color: 'violet',
    items: [
      {
        method: 'POST', path: '/api/agents/chat', auth: false,
        icon: Bot,
        description: 'Conversational shopping agent. Send a message and get product recommendations or checkout intent.',
        response: `{ "reply": "I found the perfect headphones for you! Here's what I recommend...", "action": { "intent": "PRODUCT_SUGGEST" } }`,
        curl: `curl -X POST ${API_BASE}/api/agents/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Show me wireless headphones under ₹5000", "cart": []}'`
      },
      {
        method: 'POST', path: '/api/agents/checkout', auth: false,
        icon: ShoppingCart,
        description: 'Create a Razorpay order and get a payment link. Safety-gated against merchant thresholds.',
        response: `{ "result": { "orderNumber": "RA-1234", "totalAmountInr": 4999, "paymentLinkUrl": "https://rzp.io/..." } }`,
        curl: `curl -X POST ${API_BASE}/api/agents/checkout \\
  -H "Content-Type: application/json" \\
  -d '{"items": [{"productId": "...", "sku": "SKU001", "qty": 1}], "customer": {"name": "Alice", "email": "alice@example.com", "phone": "+919876543210"}}'`
      },
      {
        method: 'POST', path: '/api/agents/upsell', auth: false,
        icon: Zap,
        description: 'Get AI-powered upsell and cross-sell bundle recommendations based on current cart.',
        response: `{ "bundleOffer": { "recommendation": { "name": "Bluetooth Speaker" }, "savingsInr": 500, "explanation": "..." } }`,
        curl: `curl -X POST ${API_BASE}/api/agents/upsell \\
  -H "Content-Type: application/json" \\
  -d '{"cartItems": [{"sku": "SKU001"}]}'`
      },
    ]
  },
  {
    group: 'Agent Discovery (ACP)',
    color: 'sky',
    items: [
      {
        method: 'GET', path: '/.well-known/agent.json', auth: false,
        icon: Globe,
        description: 'ACP-compliant agent card for autonomous AI buyer discovery and capability negotiation.',
        response: `{ "agent": "RazorAgent", "capabilities": ["checkout", "upsell", "campaigns"], "endpoints": {...} }`,
        curl: `curl ${API_BASE}/.well-known/agent.json`
      },
      {
        method: 'GET', path: '/api/catalog', auth: false,
        icon: Code2,
        description: 'JSON-LD structured product catalog for machine-readable consumption by LLM agents.',
        response: `{ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": [...] }`,
        curl: `curl ${API_BASE}/api/catalog`
      },
    ]
  }
];

const METHOD_COLOR = {
  GET:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};
const GROUP_BORDER = {
  emerald: 'border-emerald-500/20',
  violet:  'border-violet-500/20',
  sky:     'border-sky-500/20',
};
const GROUP_BADGE = {
  emerald: 'bg-emerald-500/10 text-emerald-400',
  violet:  'bg-violet-500/10 text-violet-400',
  sky:     'bg-sky-500/10 text-sky-400',
};

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} className={`p-1.5 rounded-lg transition-all ${copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'} ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EndpointCard({ item }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('razoragent_token') : '';

  const curlWithKey = item.auth
    ? item.curl.replace('YOUR_API_KEY', '(your API key)')
    : item.curl;

  return (
    <div className={`rounded-2xl border glass-card overflow-hidden transition-all`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${METHOD_COLOR[item.method]}`}>
              {item.method}
            </span>
            <code className="text-xs text-slate-200 font-mono">{item.path}</code>
            {item.auth && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 rounded font-semibold">
                <Lock className="w-2.5 h-2.5" /> API Key
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={item.method === 'GET' ? `${API_BASE}${item.path}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={e => { if (item.method !== 'GET') e.preventDefault(); }}
            className={`text-slate-600 hover:text-blue-400 transition-colors ${item.method !== 'GET' ? 'opacity-0 pointer-events-none' : ''}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800/60 p-4 space-y-4 animate-fade-in">
          {/* Description */}
          <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>

          {/* cURL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">cURL Example</span>
              <CopyButton text={curlWithKey} />
            </div>
            <div className="code-block p-4 whitespace-pre text-[11px] leading-relaxed">
              {curlWithKey}
            </div>
          </div>

          {/* Response */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sample Response</span>
              <CopyButton text={item.response} />
            </div>
            <div className="code-block p-4 text-emerald-400 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
              {item.response}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function APIExplorer() {
  const { merchant } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const apiKey = merchant?.apiKey || 'Not available — please log in';

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey).then(() => {
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-950 border border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-white">API Explorer</h1>
            <p className="text-xs text-slate-400">Exposed endpoints for external agents & developers</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
          All public APIs are accessible without authentication. The analytics endpoint requires your <strong className="text-white">Merchant API Key</strong>. 
          These endpoints are designed for LLM agents, autonomous buyers, and developer integrations.
        </p>
      </div>

      {/* API Key Card */}
      <div className="p-5 rounded-2xl glass-card border border-amber-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-sm text-white">Your Merchant API Key</h2>
          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Private</span>
        </div>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm text-slate-200 truncate select-all">
            {showApiKey ? apiKey : apiKey.replace(/./g, '•').slice(0, 36) + '...'}
          </code>
          <button
            onClick={() => setShowApiKey(v => !v)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={copyApiKey}
            className={`p-2.5 rounded-xl transition-all ${apiKeyCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            {apiKeyCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2.5">
          Pass as <code className="text-amber-400 font-mono">X-API-Key: {'{your-key}'}</code> header or <code className="text-amber-400 font-mono">?api_key=</code> query param for authenticated endpoints.
        </p>
      </div>

      {/* Endpoint Groups */}
      {ENDPOINTS.map(group => (
        <div key={group.group} className={`rounded-2xl border ${GROUP_BORDER[group.color]} p-5 space-y-3`} style={{ background: 'rgba(15,23,42,0.5)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${GROUP_BADGE[group.color]}`}>
              {group.group}
            </span>
            <span className="text-[10px] text-slate-600">{group.items.length} endpoints</span>
          </div>
          {group.items.map(item => (
            <EndpointCard key={item.path} item={item} />
          ))}
        </div>
      ))}

      {/* Base URL */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-1">API Base URL</div>
          <code className="text-sm font-mono text-sky-400">{API_BASE}</code>
        </div>
        <CopyButton text={API_BASE} className="!p-2" />
      </div>
    </div>
  );
}
