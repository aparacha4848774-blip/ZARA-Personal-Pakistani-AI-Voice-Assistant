import React from 'react';
import { Sparkles, Sliders, Heart, History } from 'lucide-react';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { EMOTIONS, EmotionType } from '../../logic/emotionRules.ts';
import { WebcamEmotionDetector } from '../camera/WebcamEmotionDetector.tsx';

export const EmotionPanel: React.FC = () => {
  const {
    currentEmotion,
    intensity,
    confidenceLevel,
    empathyLevel,
    history,
    setEmotion,
    updateIntensity,
    setEmpathyLevel,
  } = useEmotionStore();

  const emotionList = Object.values(EMOTIONS);
  const activeEmotion = EMOTIONS[currentEmotion] || EMOTIONS.Confident;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-brand font-bold text-white tracking-wide">
            Emotion HUD & Personality Engine
          </h2>
          <span className="text-sm font-urdu text-amber-400">(جذبات و احساسات)</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          ZARA's 9 distinct emotional states, real-time camera face emotion sync, and dostana empathy calibration.
        </p>
      </div>

      {/* Real-Time Camera-Based Emotion Detection (100% In-Browser & Zero-Persistence) */}
      <WebcamEmotionDetector />

      {/* Hero Current Emotion Banner */}
      <div
        className="p-6 rounded-3xl border transition-all duration-500 relative overflow-hidden"
        style={{
          backgroundColor: `${activeEmotion.color}10`,
          borderColor: `${activeEmotion.color}40`,
          boxShadow: `0 0 35px ${activeEmotion.color}15`,
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl border transition-all"
              style={{
                backgroundColor: `${activeEmotion.color}20`,
                borderColor: `${activeEmotion.color}60`,
              }}
            >
              {activeEmotion.emoji}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-2xl font-brand font-bold text-white tracking-wide">
                  {activeEmotion.id}
                </h3>
                <span className="text-sm font-urdu text-amber-400">
                  {activeEmotion.urduName}
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Tone style: <span className="font-semibold text-white">{activeEmotion.defaultStyle}</span>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/40 text-amber-300 border border-amber-500/30">
                  INTENSITY: {intensity}%
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/40 text-emerald-300 border border-emerald-500/30 uppercase">
                  CONFIDENCE: {confidenceLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Intensity & Empathy Control Sliders */}
          <div className="w-full md:w-72 space-y-3 bg-black/40 p-4 rounded-2xl border border-white/10">
            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                <span>INTENSITY</span>
                <span className="text-amber-400 font-bold">{intensity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={intensity}
                onChange={(e) => updateIntensity(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 bg-zinc-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                <span>EMPATHY LEVEL</span>
                <span className="text-pink-400 font-bold">{empathyLevel}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={empathyLevel}
                onChange={(e) => setEmpathyLevel(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500 bg-zinc-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 9 Emotions Interactive Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
          Emotion State Matrix (Click to Test Trigger)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {emotionList.map((emo) => {
            const isSelected = emo.id === currentEmotion;

            return (
              <button
                key={emo.id}
                onClick={() => setEmotion(emo.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-[#1A1A24] shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                    : 'border-white/5 bg-[#111118] hover:border-white/20 hover:bg-[#151520]'
                }`}
              >
                <div className="text-2xl mb-1.5">{emo.emoji}</div>
                <div className="font-semibold text-xs text-white">{emo.id}</div>
                <div className="text-[11px] font-urdu text-zinc-400 mt-0.5">{emo.urduName}</div>
                <div className="text-[10px] text-zinc-500 truncate mt-1">{emo.defaultStyle}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Emotion History Feed */}
      <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase text-zinc-400 tracking-wider">
          <History className="w-4 h-4 text-amber-400" />
          <span>Recent Emotion Transitions</span>
        </div>

        <div className="space-y-2">
          {history.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-white/5 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span>{EMOTIONS[item.emotion]?.emoji}</span>
                <span className="font-medium text-white">{item.emotion}</span>
                <span className="text-zinc-500 font-mono">({item.intensity}%)</span>
              </div>
              <div className="text-zinc-500 font-mono text-[10px]">
                {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
