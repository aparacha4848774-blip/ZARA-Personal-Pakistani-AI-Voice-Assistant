import React, { useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { speechRecognitionEngine } from '../../engines/SpeechRecognitionEngine.ts';
import { apiFetch } from '../../utils/apiClient.ts';

interface DiagnosticItem {
  id: string;
  name: string;
  urduName: string;
  status: 'VERIFIED' | 'FAILED' | 'PENDING';
  detail: string;
}

const INITIAL_DIAGNOSTICS: DiagnosticItem[] = [
  { id: 'mic', name: 'Browser Speech Recognition Support', urduName: 'مائیکروفون و اسپیچ', status: 'PENDING', detail: 'Run the check to detect whether this browser exposes the Web Speech recognition API. Microphone permission is requested when listening starts.' },
  { id: 'network', name: 'Cloudflare Worker & D1 Health', urduName: 'سرور اور ڈیٹابیس', status: 'PENDING', detail: 'Not checked yet.' },
  { id: 'ai', name: 'Cloudflare Workers AI Inference', urduName: 'اے آئی ماڈل', status: 'PENDING', detail: 'Not checked yet.' },
  { id: 'tts', name: 'Browser Speech Synthesis Support', urduName: 'صوتی آؤٹ پٹ', status: 'PENDING', detail: 'Not checked yet.' },
  { id: 'wakeword', name: 'Local Wake Word Matcher', urduName: 'ویک ورڈ انجن', status: 'PENDING', detail: 'Local phrase matching is bundled with the app.' },
];

export const DiagnosticsPanel: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>(INITIAL_DIAGNOSTICS);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const runAllDiagnostics = async () => {
    setIsRunningAll(true);
    const micAvailable = speechRecognitionEngine.isAvailable();
    const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    let serverOk = false;
    let serverDetail = 'Could not connect to /api/health.';
    let aiOk = false;
    let aiDetail = 'Workers AI test did not complete.';
    try {
      const response = await apiFetch('/api/health');
      const data = await response.json();
      serverOk = response.ok && data.status === 'ok' && data.dependencies?.d1 === true;
      serverDetail = serverOk
        ? 'Cloudflare Worker responded and D1 is reachable.'
        : data.error || 'Worker or D1 health check failed.';
    } catch (error) {
      serverDetail = error instanceof Error ? error.message : serverDetail;
    }
    try {
      const response = await apiFetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: '@cf/google/gemma-4-26b-a4b-it' }),
      });
      const data = await response.json();
      aiOk = response.ok && data.status === 'success';
      aiDetail = aiOk
        ? `Live inference succeeded with ${data.modelId} in ${data.latencyMs}ms.`
        : data.error || 'Workers AI inference failed or quota is unavailable.';
    } catch (error) {
      aiDetail = error instanceof Error ? error.message : aiDetail;
    }

    setDiagnostics([
      {
        id: 'mic',
        name: 'Browser Speech Recognition Support',
        urduName: 'مائیکروفون و اسپیچ',
        status: micAvailable ? 'VERIFIED' : 'FAILED',
        detail: micAvailable
          ? 'Browser exposes SpeechRecognition. Actual microphone permission and Urdu recognition quality must be checked during voice testing.'
          : 'SpeechRecognition is unavailable in this browser. Try current Chrome or Edge over HTTPS.',
      },
      {
        id: 'network',
        name: 'Cloudflare Worker & D1 Health',
        urduName: 'سرور اور ڈیٹابیس',
        status: serverOk ? 'VERIFIED' : 'FAILED',
        detail: serverDetail,
      },
      {
        id: 'ai',
        name: 'Cloudflare Workers AI Inference',
        urduName: 'اے آئی ماڈل',
        status: aiOk ? 'VERIFIED' : 'FAILED',
        detail: aiDetail,
      },
      {
        id: 'tts',
        name: 'Browser Speech Synthesis Support',
        urduName: 'صوتی آؤٹ پٹ',
        status: ttsAvailable ? 'VERIFIED' : 'FAILED',
        detail: ttsAvailable
          ? 'Browser speech synthesis is available. Actual Urdu voice availability and pronunciation vary by device.'
          : 'Browser speech synthesis is unavailable.',
      },
      {
        id: 'wakeword',
        name: 'Local Wake Word Matcher',
        urduName: 'ویک ورڈ انجن',
        status: 'VERIFIED',
        detail: 'Wake phrase matching code is loaded locally; wake-word accuracy still needs a real microphone test.',
      },
    ]);
    setIsRunningAll(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">System Diagnostics</h2>
            <span className="text-sm font-urdu text-amber-400">(تشخیصی رپورٹ)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Live checks for browser speech support, Cloudflare Worker health, D1 and actual Workers AI inference.
          </p>
        </div>
        <button
          onClick={runAllDiagnostics}
          disabled={isRunningAll}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-2 transition-all shadow-md w-fit disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
          <span>{isRunningAll ? 'Checking...' : 'Run System Self-Check'}</span>
        </button>
      </div>
      <div className="space-y-3">
        {diagnostics.map((diag) => (
          <div key={diag.id} className="p-5 rounded-2xl bg-[#111118] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h4 className="font-semibold text-sm text-white">{diag.name}</h4>
                <span className="text-xs font-urdu text-zinc-400">({diag.urduName})</span>
              </div>
              <p className="text-xs text-zinc-400">{diag.detail}</p>
            </div>
            <div className="shrink-0">
              {diag.status === 'VERIFIED' ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                </span>
              ) : diag.status === 'FAILED' ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> FAILED
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">PENDING</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
