import React, { useState, useEffect } from 'react';
import { BarChart3, Coins, Zap, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient.ts';

type UsageLog = {
  id: string;
  modelId: string;
  taskType: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: 'success' | 'failed' | 'fallback';
  createdAt: string;
};

type UsageSummary = {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  successfulRequests: number;
  failedRequests: number;
  estimatedCostUsd: number | null;
  recentLogs: UsageLog[];
};

const EMPTY_USAGE: UsageSummary = {
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  successfulRequests: 0,
  failedRequests: 0,
  estimatedCostUsd: null,
  recentLogs: [],
};

export const UsageMonitor: React.FC = () => {
  const [usage, setUsage] = useState<UsageSummary>(EMPTY_USAGE);
  const [error, setError] = useState('');

  const fetchUsage = async () => {
    try {
      setError('');
      const res = await apiFetch('/api/usage');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Usage request failed (${res.status}).`);
      if (data.usage) setUsage({ ...EMPTY_USAGE, ...data.usage });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch usage metrics.');
    }
  };

  useEffect(() => {
    void fetchUsage();
  }, []);

  const successRate = usage.totalRequests
    ? Math.round((usage.successfulRequests / usage.totalRequests) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">AI Usage Monitor</h2>
            <span className="text-sm font-urdu text-amber-400">(اے آئی استعمال)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Actual Worker request logs and approximate token counts from D1. Billing is verified separately in Cloudflare.
          </p>
        </div>
        <button onClick={fetchUsage} className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all w-fit">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between"><span>TOTAL REQUESTS</span><Zap className="w-3.5 h-3.5 text-amber-400" /></div>
          <div className="text-2xl font-brand font-bold text-white">{usage.totalRequests.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-400">{successRate}% successful ({usage.successfulRequests} passed / {usage.failedRequests} failed)</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between"><span>EST. INPUT TOKENS</span><BarChart3 className="w-3.5 h-3.5 text-blue-400" /></div>
          <div className="text-2xl font-brand font-bold text-white">{usage.totalInputTokens.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Approximation from text length</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between"><span>EST. OUTPUT TOKENS</span><BarChart3 className="w-3.5 h-3.5 text-purple-400" /></div>
          <div className="text-2xl font-brand font-bold text-white">{usage.totalOutputTokens.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Approximation from response length</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between"><span>PROVIDER BILLING</span><Coins className="w-3.5 h-3.5 text-emerald-400" /></div>
          <div className="text-xl font-brand font-bold text-white">Not estimated</div>
          <div className="text-[10px] text-zinc-500">Check Cloudflare Workers AI usage and billing</div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">Recent Provider Requests</h3>
          <span className="text-[10px] text-zinc-500">{usage.recentLogs.length} records (latest 100 max)</span>
        </div>
        {usage.recentLogs.length === 0 ? (
          <p className="text-xs text-zinc-500 py-5 text-center">No provider requests have been recorded yet. Run the Workers AI connection test or send a chat.</p>
        ) : (
          <div className="space-y-2">
            {usage.recentLogs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-[#08080C] border border-white/5 p-3">
                <div className="min-w-0">
                  <div className="text-xs text-white font-medium">{log.taskType} · {log.modelId}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{new Date(log.createdAt).toLocaleString()} · ~{(log.inputTokens + log.outputTokens).toLocaleString()} tokens · {log.latencyMs}ms</div>
                </div>
                <span className={`text-[10px] font-mono flex items-center gap-1 ${log.status === 'success' ? 'text-emerald-400' : log.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {log.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
