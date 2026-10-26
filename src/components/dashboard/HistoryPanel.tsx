import React, { useState } from 'react';
import { History, Search, Download, Trash2, Volume2, Sparkles } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { EMOTIONS } from '../../logic/emotionRules.ts';

export const HistoryPanel: React.FC = () => {
  const { messages, clearHistory } = useConversationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'zara'>('all');

  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.emotion && m.emotion.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleExportText = () => {
    const textContent = messages
      .map(
        (m) =>
          `[${new Date(m.createdAt).toLocaleString()}] ${
            m.role === 'zara' ? 'ZARA' : 'BOSS'
          }: ${m.content}`
      )
      .join('\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zara-conversation-export-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              Conversation History
            </h2>
            <span className="text-sm font-urdu text-amber-400">(مکالمات کا ریکارڈ)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Browse, search, and export past dialogues and voice interactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportText}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Text</span>
          </button>
          <button
            onClick={clearHistory}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcripts by words or emotion..."
            className="w-full bg-[#111118] border border-white/10 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'user', 'zara'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-xl text-xs font-mono uppercase transition-all ${
                roleFilter === r
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-[#111118] border border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {r === 'all' ? 'All Roles' : r === 'user' ? 'Boss Only' : 'ZARA Only'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#111118] border border-white/5 text-zinc-500 text-xs">
            Koi pichli baat nahi mili. "Hello ZARA" bol kar shuru karein.
          </div>
        ) : (
          filtered.map((msg) => {
            const isZara = msg.role === 'zara';
            const emotion = msg.emotion ? EMOTIONS[msg.emotion] : null;

            return (
              <div
                key={msg.id}
                className="p-4 rounded-2xl bg-[#111118] border border-white/10 hover:border-white/20 transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${isZara ? 'text-amber-400' : 'text-zinc-300'}`}
                    >
                      {isZara ? 'ZARA' : 'You (Boss)'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                    {emotion && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {emotion.emoji} {emotion.id}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{msg.content}</p>
                </div>

                {isZara && (
                  <button
                    onClick={() => orchestrator.speakReply(msg.content, msg.emotion)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-all shrink-0"
                    title="Play Audio"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
