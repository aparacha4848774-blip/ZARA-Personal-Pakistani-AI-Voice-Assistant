import React from 'react';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useEmotionStore } from '../../store/emotionStore.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';

interface VoiceWaveformProps {
  className?: string;
  barsCount?: number;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ className = '', barsCount = 9 }) => {
  const { state, audioAmplitude, isAudioPlaying } = useZaraStore();
  const { currentEmotion } = useEmotionStore();
  const emotionColor = EMOTIONS[currentEmotion]?.color || '#F59E0B';

  const isActive = state === 'SPEAKING' || state === 'LISTENING' || isAudioPlaying;

  // Generate bar heights based on amplitude or state
  const heights = Array.from({ length: barsCount }, (_, i) => {
    if (!isActive) {
      return 12; // resting height
    }
    const ampIndex = i % audioAmplitude.length;
    const baseAmp = audioAmplitude[ampIndex] || 0.2;
    // Map 0-1 amplitude to height between 16px and 64px
    return Math.round(16 + baseAmp * 48);
  });

  const getBarColor = () => {
    if (state === 'LISTENING') return '#10B981';
    if (state === 'SPEAKING') return '#8B5CF6';
    if (state === 'PROCESSING') return '#3B82F6';
    if (state === 'ERROR') return '#EF4444';
    return emotionColor;
  };

  const activeColor = getBarColor();

  return (
    <div className={`flex items-center justify-center gap-1.5 h-16 ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full transition-all duration-150 ease-out"
          style={{
            height: `${h}px`,
            backgroundColor: isActive ? activeColor : 'rgba(255, 255, 255, 0.15)',
            boxShadow: isActive ? `0 0 10px ${activeColor}80` : 'none',
          }}
        />
      ))}
    </div>
  );
};
