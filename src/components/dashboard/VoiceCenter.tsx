import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Sliders, Settings2, Play, Radio, Headphones } from 'lucide-react';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { VoiceWaveform } from '../avatar/VoiceWaveform.tsx';

export const VoiceCenter: React.FC = () => {
  const { state, isAudioPlaying } = useZaraStore();
  const { settings, updateSetting } = useSettingsStore();
  const [testPhrase, setTestPhrase] = useState('Assalam-o-Alaikum Boss! Main ZARA hoon, aapki dost.');

  const handleToggleMic = () => {
    if (state === 'LISTENING') {
      orchestrator.stopListening();
    } else {
      orchestrator.startListening();
    }
  };

  const handleTestTTS = () => {
    orchestrator.speakReply(testPhrase, 'Happy', 85);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              Voice Center
            </h2>
            <span className="text-sm font-urdu text-amber-400">(صوتی کنٹرول)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Pakistani Urdu speech recognition, voice activity detection, and Gemini TTS synthesis.
          </p>
        </div>

        <button
          onClick={handleToggleMic}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-lg ${
            state === 'LISTENING'
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
              : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20'
          }`}
        >
          {state === 'LISTENING' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{state === 'LISTENING' ? 'Stop Listening' : 'Start Microphone'}</span>
        </button>
      </div>

      {/* Real-time Visualizer Panel */}
      <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 text-center space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-400" />
            LIVE SPEECH SPECTRUM
          </span>
          <span className="text-amber-400 font-bold uppercase">{state}</span>
        </div>

        <div className="py-4">
          <VoiceWaveform barsCount={15} />
        </div>

        <div className="text-xs text-zinc-400 max-w-md mx-auto">
          {state === 'LISTENING'
            ? 'Mic active. Speak naturally in Pakistani Urdu (اردو), Roman Urdu, or English.'
            : state === 'SPEAKING'
            ? 'Voice playback active. You can interrupt ZARA at any time (Barge-in).'
            : 'Idle. Click "Start Microphone" or say "Hello ZARA" to begin.'}
        </div>

      </div>

      {/* Voice Configuration Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Speed & Volume */}
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Voice Acoustics</span>
          </div>

          <div className="space-y-4">
            {/* Speed Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1.5">
                <span>SPEECH SPEED</span>
                <span className="text-amber-400 font-bold">{settings.voiceSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.voiceSpeed}
                onChange={(e) => updateSetting('voiceSpeed', parseFloat(e.target.value))}
                className="w-full accent-[#F59E0B] bg-zinc-800"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>0.5x (Slow)</span>
                <span>1.0x (Normal)</span>
                <span>2.0x (Fast)</span>
              </div>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1.5">
                <span>OUTPUT VOLUME</span>
                <span className="text-amber-400 font-bold">
                  {Math.round(settings.voiceVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={settings.voiceVolume}
                onChange={(e) => updateSetting('voiceVolume', parseFloat(e.target.value))}
                className="w-full accent-[#F59E0B] bg-zinc-800"
              />
            </div>

            {/* Silence Timeout Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1.5">
                <span>SILENCE VAD TIMEOUT</span>
                <span className="text-amber-400 font-bold">{settings.silenceTimeoutMs} ms</span>
              </div>
              <input
                type="range"
                min="800"
                max="3000"
                step="100"
                value={settings.silenceTimeoutMs}
                onChange={(e) => updateSetting('silenceTimeoutMs', parseInt(e.target.value, 10))}
                className="w-full accent-[#F59E0B] bg-zinc-800"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Pausing speech for this duration automatically dispatches query to Gemini.
              </p>
            </div>
          </div>
        </div>

        {/* Audio Hardware & TTS Provider */}
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Headphones className="w-4 h-4 text-amber-400" />
            <span>Audio Devices & Engine</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                INPUT MICROPHONE
              </label>
              <select
                value={settings.selectedMicDevice}
                onChange={(e) => updateSetting('selectedMicDevice', e.target.value)}
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              >
                <option value="default">Default System Microphone (Auto-Selected)</option>
                <option value="builtin">Internal Array Mic</option>
                <option value="headset">USB / Bluetooth Headset</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                OUTPUT SPEAKER
              </label>
              <select
                value={settings.selectedSpeakerDevice}
                onChange={(e) => updateSetting('selectedSpeakerDevice', e.target.value)}
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              >
                <option value="default">Default System Audio Output</option>
                <option value="speakers">Built-in Stereo Speakers</option>
                <option value="headphones">Headphones / External Monitor</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">TTS Engine</span>
                <span className="text-amber-400 font-mono font-semibold">gemini-2.5-flash-preview-tts</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Speech Recognition</span>
                <span className="text-emerald-400 font-mono">Web Speech API (ur-PK)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Barge-in Interruption</span>
                <span className="text-emerald-400 font-mono">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TTS Test Playground */}
      <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-3">
        <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
          Test ZARA Voice Output
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={testPhrase}
            onChange={(e) => setTestPhrase(e.target.value)}
            className="flex-1 bg-[#0A0A0F] border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-amber-500"
            placeholder="Type a test phrase in Roman Urdu..."
          />
          <button
            onClick={handleTestTTS}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Play</span>
          </button>
        </div>
      </div>
    </div>
  );
};
