import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Server, Zap } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient.ts';

export const APIPanel: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'Connected' | 'Error';
    latencyMs?: number;
    message?: string;
    modelId?: string;
  } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: '@cf/google/gemma-4-26b-a4b-it' }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Workers AI connection test failed.');
      }
      setTestResult({
        status: 'Connected',
        latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : undefined,
        message: data.message || 'Workers AI returned a response.',
        modelId: data.modelId,
      });
    } catch (error) {
      setTestResult({
        status: 'Error',
        message: error instanceof Error ? error.message : 'Connection failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-brand font-bold text-white tracking-wide">AI Provider & Security</h2>
          <span className="text-sm font-urdu text-amber-400">(اے آئی رابطہ)</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Cloudflare Workers AI is called server-side through the Worker AI binding. No provider key is exposed in the browser.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-[#111118] border border-emerald-500/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">Server-side AI Binding</h3>
            <p className="text-xs text-zinc-400">The browser calls /api/chat; the Worker invokes env.AI.run().</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#08080C] border border-white/5 space-y-2 text-xs font-mono text-zinc-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Provider</span>
            <span className="text-emerald-400">Cloudflare Workers AI</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Chat model</span>
            <span className="text-amber-400">@cf/google/gemma-4-26b-a4b-it</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Browser key exposure</span>
            <span className="text-emerald-400 font-bold">None</span>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Live Workers AI Inference Test</h4>
          </div>
          <button
            onClick={runTest}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{testing ? 'Testing...' : 'Test Workers AI'}</span>
          </button>
        </div>
        {testResult && (
          <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${testResult.status === 'Connected' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'}`}>
            <div className="flex items-start gap-2 text-xs min-w-0">
              {testResult.status === 'Connected' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <div className="min-w-0">
                <strong>{testResult.status}</strong>
                {testResult.modelId && <div className="mt-1 break-all">{testResult.modelId}</div>}
                {testResult.message && <p className="mt-1 opacity-80 break-words">{testResult.message}</p>}
              </div>
            </div>
            {typeof testResult.latencyMs === 'number' && <span className="font-mono text-xs font-bold shrink-0">{testResult.latencyMs} ms</span>}
          </div>
        )}
      </div>
    </div>
  );
};
