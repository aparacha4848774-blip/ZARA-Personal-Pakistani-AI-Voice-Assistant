import React, { useState, useEffect } from 'react';
import {
  MessageSquareShare,
  Send,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  X,
  Radio,
} from 'lucide-react';
import { WhatsAppMessage } from '../../types/zara.types.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { apiFetch } from '../../utils/apiClient.ts';

const SAMPLE_CONTACTS = [
  { name: 'Hamza', phone: '+92 300 1234567', relation: 'Best Friend' },
  { name: 'Ali Dev', phone: '+92 321 9876543', relation: 'Colleague' },
  { name: 'Bilal', phone: '+92 333 4567890', relation: 'Project Lead' },
  { name: 'Ammi', phone: '+92 301 7654321', relation: 'Family' },
];

export const WhatsAppCenter: React.FC = () => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState('Hamza');
  const [messageBody, setMessageBody] = useState('Main 5 minute mein aa raha hoon');
  const [activeModalMessage, setActiveModalMessage] = useState<WhatsAppMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      const res = await apiFetch('/api/whatsapp/messages');
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
      }
    } catch (e) {
      console.warn('Could not fetch WhatsApp messages:', e);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;

    try {
      const contactObj = SAMPLE_CONTACTS.find((c) => c.name === selectedContact);
      const res = await apiFetch('/api/whatsapp/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: selectedContact,
          contactIdentifier: contactObj?.phone || '+92 300 0000000',
          messageText: messageBody.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveModalMessage(data.draft);
        fetchMessages();
      }
    } catch (err) {
      console.error('Draft creation error:', err);
    }
  };

  const handleConfirmSend = async (id: string, confirmed: boolean) => {
    setIsSending(true);
    setStatusNotice('Bhejne ki koshish kar rahi hoon...');

    setTimeout(async () => {
      try {
        const res = await apiFetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, confirmed }),
        });

        if (res.ok) {
          const data = await res.json();
          setStatusNotice(data.notice);
          setActiveModalMessage(null);
          fetchMessages();

          if (confirmed) {
            orchestrator.speakReply(
              `Theek hai Boss, message simulated bhej diya gaya hai!`,
              'Happy',
              85
            );
          } else {
            orchestrator.speakReply(`Theek hai Boss, message cancel kar diya.`, 'Calm', 70);
          }
        }
      } catch (e) {
        console.warn('Dispatch failed:', e);
      } finally {
        setIsSending(false);
      }
    }, 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              WhatsApp Center (Phase 1 Simulated)
            </h2>
            <span className="text-sm font-urdu text-emerald-400">(واٹس ایپ مرسل)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Voice-command messaging flow with double confirmation and dispatch logging.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>UI Flow Ready &bull; Simulated Delivery</span>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">Phase 1 Rule: </strong>
          Real WhatsApp Business API connects in Phase 2. Currently, voice intents trigger a
          realistic read-back, confirmation modal, and simulated message dispatch audit.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Message Drafter Form */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquareShare className="w-4 h-4 text-emerald-400" />
            <span>Draft New WhatsApp Message</span>
          </h3>

          <form onSubmit={handleCreateDraft} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                SELECT CONTACT
              </label>
              <select
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              >
                {SAMPLE_CONTACTS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.relation} - {c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                MESSAGE TEXT (URDU / ENGLISH)
              </label>
              <textarea
                rows={3}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="e.g. Main 5 minute mein aa raha hoon..."
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Review & Confirm Dispatch</span>
            </button>
          </form>

          {/* Quick Voice Command Guide */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Voice Trigger Example:</span>
            <div className="p-2.5 rounded-xl bg-[#0A0A0F] text-xs font-mono text-amber-300 border border-white/5">
              "ZARA, Hamza ko message bhejo ke main meeting mein hoon"
            </div>
          </div>
        </div>

        {/* Right: Message History Table */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Message Audit Log</span>
              </h3>
              <span className="text-xs font-mono text-zinc-500">{messages.length} items</span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500">
                  Koi pichla message nahi mila.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-xl bg-[#0A0A0F] border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400">{msg.contactName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          msg.status === 'simulated'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : msg.status === 'pending'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {msg.status}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300">"{msg.messageText}"</p>

                    <div className="text-[10px] text-zinc-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {statusNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
              {statusNotice}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {activeModalMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#151520] border border-[#F59E0B] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-brand font-bold text-base text-white flex items-center gap-2">
                <span>⚠️</span> Confirm Action
              </h3>
              <button
                onClick={() => setActiveModalMessage(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <p>
                ZARA will dispatch this message to{' '}
                <strong className="text-amber-400">{activeModalMessage.contactName}</strong>:
              </p>
              <div className="p-3 rounded-xl bg-[#0A0A0F] border border-white/10 font-mono text-sm text-white">
                "{activeModalMessage.messageText}"
              </div>
            </div>

            {isSending ? (
              <div className="p-3 text-center text-xs text-amber-300 font-mono animate-pulse">
                Bhejne ki koshish kar rahi hoon... (Simulating Dispatch)
              </div>
            ) : (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmSend(activeModalMessage.id, false)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-zinc-800 text-xs text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSend(activeModalMessage.id, true)}
                  className="px-5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#FCD34D] text-black font-semibold text-xs shadow-lg"
                >
                  ✓ Haan, Bhej Do
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
