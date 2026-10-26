import React, { useState } from 'react';
import { Shield, Lock, Trash2, CheckCircle2, Mic, EyeOff, AlertTriangle } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore.ts';
import { useMemoryStore } from '../../store/memoryStore.ts';

export const PrivacyPanel: React.FC = () => {
  const { clearHistory } = useConversationStore();
  const { memories } = useMemoryStore();
  const [clearedNotice, setClearedNotice] = useState(false);

  const handlePurgeAll = () => {
    if (confirm('Kya aap waqai tamaam local data aur conversation history delete karna chahte hain?')) {
      clearHistory();
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-brand font-bold text-white tracking-wide">
            Privacy & Security Controls
          </h2>
          <span className="text-sm font-urdu text-amber-400">(رازداری و تحفظ)</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Manage hardware permissions, local conversation logs, and biometric privacy.
        </p>
      </div>

      {/* Security Policies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-white">Local-First Processing</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Wake word detection runs on-device using local pattern matching without streaming ambient noise to any cloud.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400">
            <EyeOff className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-white">No Telemetry Profiling</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Conversations are strictly between you and your personal ZARA instance. Zero public analytics or third-party trackers.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400">
            <Mic className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-white">Ephemeral Voice Audio</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Audio buffers are discarded immediately after transcription and never stored on persistent disks.
          </p>
        </div>
      </div>

      {/* Data Controls Card */}
      <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white">Local Data Purge & Reset</h3>
        <p className="text-xs text-zinc-400">
          Wipe current conversation history, pending voice transcripts, and local cache.
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-mono text-zinc-500">
            Active memories: <span className="text-white">{memories.length}</span>
          </div>

          <button
            onClick={handlePurgeAll}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono flex items-center gap-2 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Local Data</span>
          </button>
        </div>

        {clearedNotice && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Tamaam local history saaf kar di gayi hai.</span>
          </div>
        )}
      </div>
    </div>
  );
};
