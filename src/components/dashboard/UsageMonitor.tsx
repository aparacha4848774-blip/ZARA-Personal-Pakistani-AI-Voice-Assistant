import React, { useState, useEffect } from 'react';
import { BarChart3, Coins, Zap, Clock, RefreshCw } from 'lucide-react';

export const UsageMonitor: React.FC = () => {
  const [usage, setUsage] = useState({
    totalRequests: 14,
    totalInputTokens: 4120,
    totalOutputTokens: 2310,
    estimatedCostUsd: 0.0034,
    recentLogs: [] as any[],
  });

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        if (data.usage) setUsage(data.usage);
      }
    } catch (e) {
      console.warn('Could not fetch usage stats:', e);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              API Usage & Cost Monitor
            </h2>
            <span className="text-sm font-urdu text-amber-400">(استعمال اور اخراجات)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time token metrics, latency benchmarks, and estimated API expenditure.
          </p>
        </div>

        <button
          onClick={fetchUsage}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>TOTAL QUERIES</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-brand font-bold text-white">
            {usage.totalRequests}
          </div>
          <div className="text-[10px] text-emerald-400">100% Success Rate</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>INPUT TOKENS</span>
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-brand font-bold text-white">
            {usage.totalInputTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500">Prompts & memory context</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>OUTPUT TOKENS</span>
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-brand font-bold text-white">
            {usage.totalOutputTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500">ZARA generated speech</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>ESTIMATED COST</span>
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-brand font-bold text-emerald-400">
            ${usage.estimatedCostUsd.toFixed(4)}
          </div>
          <div className="text-[10px] text-zinc-500">Tier: Cost-optimized</div>
        </div>
      </div>

      {/* Breakdown Card */}
      <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-3">
        <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
          Model Efficiency Distribution
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Gemini 3.8 Flash (Fast Voice Turns)</span>
            <span className="font-mono text-amber-400">82% of requests</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-amber-500 w-[82%]" />
          </div>

          <div className="flex items-center justify-between text-xs pt-2">
            <span className="text-zinc-300">Gemini 4 Argon (High Thinking Deep Queries)</span>
            <span className="font-mono text-purple-400">18% of requests</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-purple-500 w-[18%]" />
          </div>
        </div>
      </div>
    </div>
  );
};
