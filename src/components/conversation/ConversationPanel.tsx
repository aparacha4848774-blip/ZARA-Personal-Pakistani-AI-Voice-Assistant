import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  Volume2,
  Sparkles,
  BrainCircuit,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  Code2,
  LineChart,
  Palette,
  Layers,
  CalendarCheck,
  FolderSync,
} from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore.ts';
import { useZaraStore } from '../../store/zaraStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';
import { ArtifactRenderer } from '../artifacts/ArtifactRenderer.tsx';
import { MessageAttachment } from '../../types/zara.types.ts';

export const ConversationPanel: React.FC = () => {
  const { messages, transcriptDraft } = useConversationStore();
  const { state } = useZaraStore();
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, transcriptDraft, state]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && attachments.length === 0) return;

    const text = inputText.trim() || (attachments.length > 0 ? `Boss ne ${attachments[0].name} bheji hai, yeh analyze karo` : '');
    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);

    orchestrator.handleUserQuery(text, currentAttachments);
  };

  const handleQuickPrompt = (prompt: string) => {
    orchestrator.handleUserQuery(prompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const newAtt: MessageAttachment = {
        id: 'att-' + Date.now(),
        name: file.name,
        type: isImg ? 'image' : 'document',
        dataUrl,
        sizeBytes: file.size,
      };
      setAttachments([newAtt]);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-[560px] bg-[#111118] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-[#151520]/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <h3 className="font-brand font-bold text-sm text-white tracking-wide">
            Live AI Conversation & Studio Stream
          </h3>
          <span className="text-xs text-amber-400 font-urdu">(براہ راست گفتگو)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-zinc-300">
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => {
          const isZara = msg.role === 'zara';
          const emotionInfo = msg.emotion ? EMOTIONS[msg.emotion] : null;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isZara ? 'items-start' : 'items-end'} transition-all`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 sm:px-5 py-3.5 border transition-all ${
                  isZara
                    ? 'bg-[#181824] border-white/10 text-[#F9FAFB] shadow-xl'
                    : 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#FCD34D] shadow-[0_0_20px_rgba(245,158,11,0.08)]'
                }`}
              >
                {/* Sender Name & Emotion Tag */}
                <div className="flex items-center justify-between gap-3 mb-2 text-[11px] font-mono">
                  <span className={`font-bold ${isZara ? 'text-amber-400 font-brand' : 'text-zinc-200'}`}>
                    {isZara ? 'ZARA' : 'You (Boss)'}
                  </span>

                  {isZara && emotionInfo && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 shadow-sm"
                      style={{
                        backgroundColor: `${emotionInfo.color}15`,
                        borderColor: `${emotionInfo.color}40`,
                        color: emotionInfo.color,
                      }}
                    >
                      <span>{emotionInfo.emoji}</span>
                      <span>{emotionInfo.id}</span>
                    </span>
                  )}
                </div>

                {/* Optional Attached Documents / Images */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 max-w-sm"
                      >
                        {att.type === 'image' && att.dataUrl ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-mono text-zinc-300 truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {/* Rich Interactive Artifact (Code Preview, Vector Logo, Slide Deck, Research, Automation) */}
                {msg.artifact && <ArtifactRenderer artifact={msg.artifact} />}

                {/* Optional High Thinking tag */}
                {msg.isThinking && (
                  <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex items-center gap-1.5 text-[11px] text-purple-300 font-mono">
                    <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                    <span>Gemini 4 Argon &bull; Deep Reasoning Verified</span>
                  </div>
                )}

                {/* Footer timestamp & replay button */}
                <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-white/5 text-[10px] text-zinc-500">
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isZara && (
                    <button
                      onClick={() => orchestrator.speakReply(msg.content, msg.emotion)}
                      className="hover:text-amber-400 transition-colors p-1"
                      title="Replay Voice"
                      aria-label="Replay Voice Message"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Live speech interim draft bubble */}
        {transcriptDraft && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm italic animate-pulse">
              <span className="text-[10px] block font-mono text-emerald-400 uppercase mb-0.5">
                Listening...
              </span>
              "{transcriptDraft}"
            </div>
          </div>
        )}

        {/* Processing State Indicator */}
        {state === 'PROCESSING' && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1A24] border border-blue-500/30 text-blue-400 text-xs w-fit shadow-md">
            <span className="flex space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span className="font-mono text-[11px] font-medium">ZARA kaam kar rahi hai...</span>
          </div>
        )}
      </div>

      {/* Advanced Quick-Command Mode Bar */}
      <div className="px-4 py-2 border-t border-white/5 bg-[#0D0D14] flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[10px] font-mono text-amber-400 uppercase shrink-0 font-bold">Modes:</span>
        <button
          onClick={() => handleQuickPrompt('ZARA, e-commerce site banao')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 border border-white/5 hover:border-amber-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <Code2 className="w-3 h-3 text-amber-400" />
          <span>E-Commerce Site</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('ZARA, AI trends research karo')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <LineChart className="w-3 h-3 text-cyan-400" />
          <span>AI Research Report</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('ZARA, logo banao meri company ka')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-purple-500/20 text-zinc-300 hover:text-purple-300 border border-white/5 hover:border-purple-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <Palette className="w-3 h-3 text-purple-400" />
          <span>Vector Logo</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('ZARA, presentation banao')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-pink-500/20 text-zinc-300 hover:text-pink-300 border border-white/5 hover:border-pink-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <Layers className="w-3 h-3 text-pink-400" />
          <span>Presentation</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('ZARA, daily report banao')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <CalendarCheck className="w-3 h-3 text-emerald-400" />
          <span>Daily Automation</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('Downloads folder organize karo')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-blue-500/20 text-zinc-300 hover:text-blue-300 border border-white/5 hover:border-blue-500/40 text-xs transition-all flex items-center gap-1.5"
        >
          <FolderSync className="w-3 h-3 text-blue-400" />
          <span>Organize Files</span>
        </button>
        <button
          onClick={() => handleQuickPrompt('ZARA, yeh error fix karo: TypeError: Cannot read properties of undefined (reading map)')}
          className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/5 hover:border-rose-500/40 text-xs transition-all"
        >
          🛠️ Fix Error
        </button>
      </div>

      {/* Attachment Preview Chip */}
      {attachments.length > 0 && (
        <div className="px-4 py-1.5 bg-[#14141F] border-t border-white/5 flex items-center gap-2 text-xs">
          <span className="text-amber-400 font-mono text-[10px]">Attached:</span>
          <span className="text-zinc-200 truncate max-w-xs">{attachments[0].name}</span>
          <button
            onClick={() => setAttachments([])}
            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Text Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-[#151520] border-t border-white/10 flex items-center gap-2"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,.pdf,.txt,.doc,.docx,.json"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload screenshot or document for ZARA analysis"
          className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition-all shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="اردو, Roman Urdu ya English mein bolein ya likhein... ('ویب سائٹ بناؤ', 'e-commerce site banao')"
          aria-label="Message Input"
          className="flex-1 bg-[#0A0A0F] border border-white/10 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all"
        />


        <button
          type="button"
          onClick={() => {
            if (state === 'LISTENING') orchestrator.stopListening();
            else orchestrator.startListening();
          }}
          aria-label="Toggle Microphone"
          className={`p-2.5 rounded-xl border transition-all ${
            state === 'LISTENING'
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-amber-500 hover:text-amber-400'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={!inputText.trim() && attachments.length === 0}
          aria-label="Send Message"
          className="px-4 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#FCD34D] disabled:opacity-40 text-black font-semibold text-sm transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
