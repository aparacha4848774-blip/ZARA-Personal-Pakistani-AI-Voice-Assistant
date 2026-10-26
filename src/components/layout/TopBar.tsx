import React from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BrainCircuit,
  Sparkles,
  Radio,
  Camera,
} from 'lucide-react';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = () => {
  const {
    state,
    isMuted,
    toggleMute,
    isWakeWordEnabled,
    toggleWakeWord,
    highThinkingEnabled,
    toggleHighThinking,
    setActiveRoute,
  } = useZaraStore();

  const handleMicClick = () => {
    if (state === 'LISTENING') {
      orchestrator.stopListening();
    } else {
      orchestrator.startListening();
    }
  };

  return (
    <header className="h-16 border-b border-white/10 bg-[#0D0D14]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Monogram (Click to Home) */}
      <div
        onClick={() => setActiveRoute('home')}
        title="Return to ZARA Conversation View"
        className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center font-brand font-bold text-black text-base sm:text-lg shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
          Z
        </div>
        <div className="flex flex-col shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-brand font-bold text-sm sm:text-lg tracking-wider text-white whitespace-nowrap">
              Z A R A
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 hidden sm:inline whitespace-nowrap">
              Pakistani AI
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 hidden md:inline whitespace-nowrap">
            Personal Voice Companion &bull; Urdu / English
          </span>
        </div>
      </div>

      {/* Middle State Badge */}
      <div className="flex items-center gap-3">
        <StatusBadge state={state} />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* High Thinking Toggle */}
        <button
          onClick={toggleHighThinking}
          title="Toggle High Thinking Mode (Gemini 4 Argon)"
          aria-label="High Thinking Mode Toggle"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
            highThinkingEnabled
              ? 'bg-purple-950/60 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">High Thinking</span>
        </button>

        {/* Wake Word Engine Toggle */}
        <button
          onClick={toggleWakeWord}
          title={isWakeWordEnabled ? 'Wake Word Active ("Hello ZARA")' : 'Wake Word Paused'}
          aria-label="Toggle Wake Word Detection"
          className={`p-2 rounded-lg border transition-all ${
            isWakeWordEnabled
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          <Radio className="w-4 h-4" />
        </button>

        {/* Mic Action Button */}
        <button
          onClick={handleMicClick}
          aria-label={state === 'LISTENING' ? 'Stop Listening' : 'Start Listening'}
          className={`p-2 rounded-lg border transition-all ${
            state === 'LISTENING'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-amber-500/50 hover:text-amber-400'
          }`}
        >
          {state === 'LISTENING' ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        {/* Emergency Mute */}
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute ZARA' : 'Mute ZARA'}
          className={`p-2 rounded-lg border transition-all ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500 text-rose-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Camera Emotion Detection Toggle */}
        <button
          onClick={() => {
            const current = useEmotionStore.getState().camera.isActive;
            useEmotionStore.getState().setCameraActive(!current);
          }}
          title={
            useEmotionStore.getState().camera.isActive
              ? 'Webcam Emotion Detection Active (100% In-Browser)'
              : 'Turn On Webcam Emotion Detection'
          }
          aria-label="Toggle Camera Emotion Detection"
          className={`p-2 rounded-lg border transition-all ${
            useEmotionStore((s) => s.camera.isActive)
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
