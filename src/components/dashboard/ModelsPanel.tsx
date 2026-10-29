import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, RefreshCw, Zap, BrainCircuit, Activity } from 'lucide-react';
import { GeminiModelConfig } from '../../types/zara.types.ts';
import { DEFAULT_GEMINI_MODELS } from '../../config/models.config.ts';
import { apiFetch } from '../../utils/apiClient.ts';

export const ModelsPanel: React.FC = () => {
  const [models, setModels] = useState<GeminiModelConfig[]>(DEFAULT_GEMINI_MODELS);
  const [testingModel, setTestingModel] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      const res = await apiFetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data.models) setModels(data.models);
      }
    } catch (e) {
      console.warn('Could not fetch models:', e);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleTestConnection = async (modelId: string) => {
    setTestingModel(modelId);
    try {
      const res = await apiFetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();

      const isSuccess = data.status === 'Connected' || data.status === 'success' || data.status === 'mock_success';
      const isQuota = data.status === 'Quota Exceeded' || data.quotaExhausted;
      const computedStatus: 'success' | 'failed' | 'quota' = isSuccess ? 'success' : isQuota ? 'quota' : 'failed';

      setModels((prev) =>
        prev.map((m) =>
          m.modelId === modelId
            ? {
                ...m,
                lastTestedAt: new Date().toISOString(),
                lastTestStatus: computedStatus,
                latencyMs: data.latencyMs || 150,
              }
            : m
        )
      );
    } catch (e) {
      setModels((prev) =>
        prev.map((m) =>
          m.modelId === modelId
            ? {
                ...m,
                lastTestedAt: new Date().toISOString(),
                lastTestStatus: 'failed',
                latencyMs: 999,
              }
            : m
        )
      );
    } finally {
      setTestingModel(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              Gemini Model Manager
            </h2>
            <span className="text-sm font-urdu text-amber-400">(ماڈل منیجر)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configured Gemini models registry with automatic fallback and latency diagnostics.
          </p>
        </div>

        <button
          onClick={fetchModels}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Registry</span>
        </button>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const isTesting = testingModel === model.modelId;

          return (
            <div
              key={model.modelId}
              className="p-5 rounded-2xl bg-[#111118] border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      {model.taskType === 'thinking' ? (
                        <BrainCircuit className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Cpu className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-white">{model.displayName}</h4>
                      <code className="text-[11px] font-mono text-zinc-400">{model.modelId}</code>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col items-end gap-1">
                    {model.isPrimary && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        PRIMARY
                      </span>
                    )}
                    {model.taskType === 'thinking' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        HIGH THINKING
                      </span>
                    )}
                    {model.isFallback && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        FALLBACK
                      </span>
                    )}
                  </div>
                </div>

                {/* Capabilities Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {model.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/5 text-[10px] font-mono text-zinc-400"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status & Test Action */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {model.lastTestStatus === 'success' ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {model.latencyMs ? `${model.latencyMs}ms` : 'Ready'}
                    </span>
                  ) : model.lastTestStatus === 'quota' ? (
                    <span
                      className="flex items-center gap-1 text-amber-400 font-mono text-[11px]"
                      title="Gemini Free Tier daily quota reached. Offline dostana engine is active."
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Quota (Offline Active)
                    </span>
                  ) : model.lastTestStatus === 'failed' ? (
                    <span className="flex items-center gap-1 text-rose-400 font-mono text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  ) : (
                    <span className="text-zinc-500 font-mono text-[11px]">Not Tested</span>
                  )}
                </div>

                <button
                  onClick={() => handleTestConnection(model.modelId)}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 text-xs font-mono font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      <span>Ping Test</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
