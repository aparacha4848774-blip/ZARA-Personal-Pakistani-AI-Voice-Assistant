import React, { useState } from 'react';
import {
  Mic,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Languages,
  Globe,
} from 'lucide-react';
import { ZaraAvatar } from '../avatar/ZaraAvatar.tsx';
import { VoiceWaveform } from '../avatar/VoiceWaveform.tsx';
import { EmotionHUD } from '../emotion/EmotionHUD.tsx';
import { WebcamEmotionDetector } from '../camera/WebcamEmotionDetector.tsx';
import { ConversationPanel } from '../conversation/ConversationPanel.tsx';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';

export const HomePanel: React.FC = () => {
  const { state } = useZaraStore();
  const { currentEmotion, intensity, camera } = useEmotionStore();
  const { settings } = useSettingsStore();
  const [showStudioInspector, setShowStudioInspector] = useState(false);

  const preferredLanguage = settings.preferredLanguage || 'roman_urdu';
  const activeEmotionInfo = EMOTIONS[currentEmotion] || EMOTIONS.Confident;

  const handleLanguageToggle = (lang: 'roman_urdu' | 'english' | 'urdu') => {
    if (lang === preferredLanguage) return;
    orchestrator.setLanguage(lang);
  };

  const getStatusDescription = () => {
    if (preferredLanguage === 'urdu') {
      switch (state) {
        case 'LISTENING':
          return 'فرمائیے باس، زارا سن رہی ہے...';
        case 'SPEAKING':
          return 'زارا جواب دے رہی ہے...';
        case 'PROCESSING':
          return 'زارا تجزیہ اور کام کر رہی ہے...';
        case 'WAKE_WORD_DETECTED':
          return 'ویک ورڈ موصول ہوا! فرمائیے...';
        case 'MUTED':
          return 'زارا میوٹ ہے۔ ان میوٹ کریں یا "زارا" کہیں۔';
        case 'STANDBY':
        default:
          return 'اواتار پر کلک کریں یا "ہیلو زارا" کہیں';
      }
    }
    if (preferredLanguage === 'english') {
      switch (state) {
        case 'LISTENING':
          return 'Speak Boss, ZARA is listening...';
        case 'SPEAKING':
          return 'ZARA is replying...';
        case 'PROCESSING':
          return 'ZARA is thinking and analyzing...';
        case 'WAKE_WORD_DETECTED':
          return 'Wake word detected! Go ahead, speak...';
        case 'MUTED':
          return 'ZARA is muted. Click unmute or say "Hello ZARA".';
        case 'STANDBY':
        default:
          return 'Click avatar or say "Hello ZARA"';
      }
    }
    switch (state) {
      case 'LISTENING':
        return 'Boliye Boss, ZARA sun rahi hai...';
      case 'SPEAKING':
        return 'ZARA jawab de rahi hai...';
      case 'PROCESSING':
        return 'ZARA analyze aur build kar rahi hai...';
      case 'WAKE_WORD_DETECTED':
        return 'Wake word detected! Bolna shuru karein...';
      case 'MUTED':
        return 'ZARA muted hai. Unmute karein ya "Hello ZARA" kahein.';
      case 'STANDBY':
      default:
        return 'Avatar par click karein ya "Hello ZARA" kahein';
    }
  };


  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-6">
      {/* 1. Minimal Ambient Header: Focused ZARA Presence */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#14141F] to-[#0B0B12] border border-white/10 p-4 sm:p-5 overflow-hidden shadow-xl">
        {/* Ambient background glow synced to emotion */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
          style={{ backgroundColor: activeEmotionInfo.color }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Avatar + Live Waveform */}
          <div className="flex items-center gap-4">
            <ZaraAvatar
              size="medium"
              onClick={() => {
                if (state === 'LISTENING') orchestrator.stopListening();
                else orchestrator.startListening();
              }}
            />

            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <span className="font-brand font-bold text-lg text-white tracking-wider">ZARA</span>
                <span className="text-xs text-amber-400 font-urdu">(زارا)</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono border"
                  style={{
                    backgroundColor: `${activeEmotionInfo.color}15`,
                    borderColor: `${activeEmotionInfo.color}40`,
                    color: activeEmotionInfo.color,
                  }}
                >
                  {activeEmotionInfo.emoji} {activeEmotionInfo.id} {intensity}%
                </span>
                {/* Voice Interaction Mode Badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    preferredLanguage === 'urdu'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : preferredLanguage === 'english'
                      ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                      : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {preferredLanguage === 'urdu'
                    ? '🇵🇰 اردو (Urdu Mode)'
                    : preferredLanguage === 'english'
                    ? '🌐 English Mode'
                    : '🇵🇰 Roman Urdu Mode'}
                </span>
                {camera.isActive && camera.detectedEmotion && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                    📷 {camera.detectedEmotion}
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 font-medium">{getStatusDescription()}</p>

              {/* Minimal Waveform */}
              <div className="w-36 pt-1">
                <VoiceWaveform />
              </div>
            </div>
          </div>

          {/* Right: Language Toggle, Quick Action Controls & Inspector Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
            {/* Voice Interaction Mode Toggle Setting */}
            <div
              className="flex items-center bg-zinc-950/90 p-1 rounded-xl border border-white/10 shadow-inner"
              role="group"
              aria-label="Voice interaction language toggle"
            >
              <button
                type="button"
                onClick={() => handleLanguageToggle('urdu')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  preferredLanguage === 'urdu'
                    ? 'bg-emerald-500 text-black font-bold shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                }`}
                title="Switch voice interaction to Pakistani Urdu script"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>اردو (Urdu)</span>
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('roman_urdu')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  preferredLanguage === 'roman_urdu'
                    ? 'bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                }`}
                title="Switch voice interaction to Pakistani Roman Urdu"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>Roman Urdu</span>
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('english')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  preferredLanguage === 'english'
                    ? 'bg-sky-500 text-black font-bold shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                }`}
                title="Switch voice interaction to English"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>English</span>
              </button>
            </div>


            {/* Mic Talk Button */}
            <button
              onClick={() => {
                if (state === 'LISTENING') orchestrator.stopListening();
                else orchestrator.startListening();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                state === 'LISTENING'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse'
                  : 'bg-zinc-900/90 text-zinc-300 border-white/10 hover:border-amber-500/50 hover:text-amber-400'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{state === 'LISTENING' ? 'LISTENING' : 'TALK TO ZARA'}</span>
            </button>

            {/* Studio Inspector Drawer Toggle */}
            <button
              onClick={() => setShowStudioInspector(!showStudioInspector)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                showStudioInspector
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Toggle Emotion HUD & Camera Panel"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Perception</span>
              {showStudioInspector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Perception Inspector (Emotion HUD + Camera Feed) */}
        {showStudioInspector && (
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
            <EmotionHUD />
            <WebcamEmotionDetector compact={true} />
          </div>
        )}
      </div>

      {/* 2. Full-Screen Focus: Live Conversation & Rich Studio Artifacts Stream */}
      <ConversationPanel />
    </div>
  );
};
