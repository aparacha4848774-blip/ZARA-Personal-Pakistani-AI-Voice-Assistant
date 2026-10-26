import React from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';
import { USER_EMOTIONS } from '../../logic/cameraEmotionMapper.ts';

interface EmotionHUDProps {
  className?: string;
}

export const EmotionHUD: React.FC<EmotionHUDProps> = ({ className = '' }) => {
  const {
    currentEmotion,
    intensity,
    confidenceLevel,
    styleDescription,
    empathyLevel,
    camera,
    setCameraActive,
  } = useEmotionStore();

  const emotionInfo = EMOTIONS[currentEmotion] || EMOTIONS.Confident;

  const getConfidenceBadge = () => {
    switch (confidenceLevel) {
      case 'high':
        return { label: 'HIGH', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' };
      case 'medium':
        return { label: 'MED', color: 'text-amber-400 bg-amber-950/60 border-amber-500/30' };
      case 'low':
      default:
        return { label: 'LOW', color: 'text-rose-400 bg-rose-950/60 border-rose-500/30' };
    }
  };

  const confBadge = getConfidenceBadge();
  const detectedUserEmotionInfo = camera.detectedEmotion
    ? USER_EMOTIONS[camera.detectedEmotion]
    : null;

  return (
    <div
      className={`bg-[#111118] border border-white/10 hover:border-[#F59E0B]/40 rounded-2xl p-5 shadow-lg transition-all duration-300 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎭</span>
          <span className="font-brand font-semibold text-xs tracking-wider text-zinc-400 uppercase">
            Emotion HUD
          </span>
        </div>
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${confBadge.color}`}
        >
          CONFIDENCE: {confBadge.label}
        </div>
      </div>

      {/* Main ZARA Emotion */}
      <div className="flex items-center gap-4 my-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border transition-all duration-300"
          style={{
            backgroundColor: `${emotionInfo.color}15`,
            borderColor: `${emotionInfo.color}40`,
            boxShadow: `0 0 20px ${emotionInfo.color}25`,
          }}
        >
          {emotionInfo.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h4 className="font-bold text-base text-white tracking-wide">{emotionInfo.id}</h4>
            <span className="text-xs text-amber-400 font-urdu">{emotionInfo.urduName}</span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{styleDescription}</p>
        </div>
      </div>

      {/* Camera Emotion Detection Line (REQUIRED: Camera Detected: [Emotion] (XX%)) */}
      <div className="my-3 p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Camera
            className={`w-3.5 h-3.5 shrink-0 ${
              camera.isActive ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'
            }`}
          />
          <div className="truncate">
            {detectedUserEmotionInfo ? (
              <span className="font-mono text-zinc-300">
                Camera Detected:{' '}
                <strong className="text-amber-400 font-semibold">
                  {detectedUserEmotionInfo.label}
                </strong>{' '}
                <span className="text-zinc-400">({camera.confidence}%)</span>
              </span>
            ) : (
              <span className="text-zinc-500 font-mono text-[11px]">
                Camera Detected: None (Standby)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setCameraActive(!camera.isActive)}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
            camera.isActive
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          {camera.isActive ? 'ACTIVE' : 'ENABLE'}
        </button>
      </div>

      {/* Intensity Bar */}
      <div className="space-y-1.5 mt-2">
        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
          <span>INTENSITY</span>
          <span className="text-amber-400 font-bold">{intensity}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden p-0.5 border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            style={{
              width: `${intensity}%`,
              backgroundColor: emotionInfo.color,
            }}
          />
        </div>
      </div>

      {/* Empathy & Dostana Bar */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span>💖</span> Empathy Level
        </span>
        <span className="font-mono text-zinc-300 font-medium">{empathyLevel}%</span>
      </div>
    </div>
  );
};
