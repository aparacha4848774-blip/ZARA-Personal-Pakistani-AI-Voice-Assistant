import React from 'react';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';

interface ZaraAvatarProps {
  size?: 'hero' | 'medium' | 'mini';
  onClick?: () => void;
}

export const ZaraAvatar: React.FC<ZaraAvatarProps> = ({ size = 'hero', onClick }) => {
  const { state, isMuted } = useZaraStore();
  const { currentEmotion, intensity, camera } = useEmotionStore();

  const emotionInfo = EMOTIONS[currentEmotion] || EMOTIONS.Confident;
  const emotionColor = emotionInfo.color;

  const sizeClasses = {
    hero: 'w-44 h-44 sm:w-48 sm:h-48 text-5xl',
    medium: 'w-28 h-28 text-3xl',
    mini: 'w-14 h-14 text-xl',
  }[size];

  // State-specific classes
  const getStateEffects = () => {
    if (isMuted || state === 'MUTED') {
      return {
        ring: 'border-zinc-700/60 opacity-60',
        glow: 'shadow-none',
        spin: false,
        pulse: false,
      };
    }

    switch (state) {
      case 'LISTENING':
        return {
          ring: 'border-[#10B981] shadow-[0_0_35px_rgba(16,185,129,0.55)]',
          glow: 'bg-emerald-950/40',
          spin: false,
          pulse: true,
        };
      case 'WAKE_WORD_DETECTED':
        return {
          ring: 'border-[#F59E0B] scale-105 shadow-[0_0_55px_rgba(245,158,11,0.9)]',
          glow: 'bg-amber-950/60',
          spin: false,
          pulse: true,
        };
      case 'PROCESSING':
        return {
          ring: 'border-[#3B82F6] border-dashed animate-spin shadow-[0_0_30px_rgba(59,130,246,0.5)]',
          glow: 'bg-blue-950/40',
          spin: true,
          pulse: false,
        };
      case 'SPEAKING':
        return {
          ring: 'border-[#8B5CF6] shadow-[0_0_45px_rgba(139,92,246,0.6)]',
          glow: 'bg-purple-950/50',
          spin: false,
          pulse: true,
        };
      case 'ERROR':
        return {
          ring: 'border-[#EF4444] shadow-[0_0_30px_rgba(239,68,68,0.7)]',
          glow: 'bg-red-950/50',
          spin: false,
          pulse: true,
        };
      case 'STANDBY':
      default:
        return {
          ring: 'border-[#F59E0B]/50 hover:border-[#F59E0B] shadow-[0_0_25px_rgba(245,158,11,0.25)]',
          glow: 'bg-[#151520]',
          spin: false,
          pulse: false,
        };
    }
  };

  const effects = getStateEffects();

  return (
    <div className="relative flex items-center justify-center cursor-pointer select-none" onClick={onClick}>
      {/* Outer audio wave ripple rings for SPEAKING */}
      {state === 'SPEAKING' && (
        <>
          <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-wave-ring scale-110 pointer-events-none" />
          <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-wave-ring scale-125 delay-300 pointer-events-none" />
        </>
      )}

      {/* Listening pulse wave */}
      {state === 'LISTENING' && (
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-ping opacity-30 pointer-events-none" />
      )}

      {/* Main Avatar Container */}
      <div
        className={`relative ${sizeClasses} rounded-full p-1.5 transition-all duration-300 flex items-center justify-center`}
      >
        {/* Outer Rotating Glowing Ring */}
        <div
          className={`absolute inset-0 rounded-full border-2 ${effects.ring} transition-all duration-500 ${
            state === 'STANDBY' ? 'animate-pulse-glow' : ''
          }`}
          style={{
            borderColor: state === 'STANDBY' ? emotionColor : undefined,
          }}
        />

        {/* Inner Radial Body */}
        <div
          className={`w-full h-full rounded-full flex flex-col items-center justify-center overflow-hidden transition-all duration-500 relative border border-white/5 ${effects.glow}`}
          style={{
            background: `radial-gradient(circle at 50% 40%, #1A1A28 0%, #0D0D14 70%, #06060A 100%)`,
            boxShadow: `inset 0 0 35px ${emotionColor}25`,
          }}
        >
          {/* Subtle Ambient Particle/Grid Texture */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:12px_12px]" />

          {/* Core Monogram "Z" */}
          <div className="relative z-10 flex flex-col items-center">
            <span
              className="font-brand font-bold tracking-tighter text-transparent bg-clip-text transition-all duration-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
              style={{
                backgroundImage: `linear-gradient(135deg, #FFFDF8 0%, ${emotionColor} 50%, #B45309 100%)`,
              }}
            >
              Z
            </span>

            {/* Small emotion emoji & label overlay in Hero view */}
            {size === 'hero' && (
              <div className="flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
                <span className="text-xs">{emotionInfo.emoji}</span>
                <span className="text-[10px] font-mono tracking-wider text-zinc-300 uppercase">
                  {emotionInfo.id} {intensity}%
                </span>
                {camera.isActive && camera.detectedEmotion && (
                  <span className="text-[10px] text-amber-400 font-mono pl-1 border-l border-white/15">
                    📷 {camera.detectedEmotion}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
