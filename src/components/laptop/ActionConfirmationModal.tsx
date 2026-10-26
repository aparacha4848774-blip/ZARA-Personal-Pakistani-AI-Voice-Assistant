import React, { useEffect } from 'react';
import { AlertTriangle, Check, X, ShieldAlert, Sparkles, Laptop } from 'lucide-react';
import { useLaptopControlStore } from '../../store/laptopControlStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';

export const ActionConfirmationModal: React.FC = () => {
  const {
    pendingAction,
    confirmationStep,
    confirmPendingAction,
    cancelPendingAction,
    isExecuting,
  } = useLaptopControlStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingAction) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmPendingAction();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPendingAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction, confirmPendingAction, cancelPendingAction]);

  if (!pendingAction) return null;

  const isDouble = pendingAction.requiresDoubleConfirm;
  const isAwaitingSecondStep = confirmationStep === 'awaiting_double';

  const handleConfirm = async () => {
    if (isDouble && !isAwaitingSecondStep) {
      // First confirm step done, trigger voice prompt for 2nd confirmation
      await confirmPendingAction();
      orchestrator.speakReply(
        `Boss, pakka na? Yeh sensitive kaam hai: ${pendingAction.title}. Sach mein kar doon?`,
        'Focused',
        85
      );
    } else {
      // Final execution
      await confirmPendingAction();
      orchestrator.speakReply(
        `Ho gaya Boss! ${pendingAction.descriptionRomanUrdu} kar diya hai.`,
        'Happy',
        85
      );
    }
  };

  const handleCancel = () => {
    cancelPendingAction('Boss ne cancel kar diya');
    orchestrator.speakReply('Theek hai Boss, cancel kar diya!', 'Calm', 70);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0F0F16] border border-amber-500/30 p-6 sm:p-7 shadow-[0_20px_60px_rgba(245,158,11,0.15)] overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Header Icon + Title */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-center shrink-0 ${
              isAwaitingSecondStep
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                : isDouble
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
            }`}
          >
            {isAwaitingSecondStep ? (
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            ) : isDouble ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <Laptop className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider">
                {isAwaitingSecondStep
                  ? 'Step 2 / 2 • FINAL DOUBLE CONFIRMATION'
                  : isDouble
                  ? 'Step 1 / 2 • SENSITIVE ACTION'
                  : 'Laptop Action Confirmation'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mt-1.5 font-brand">
              {pendingAction.title}
            </h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Target: <span className="text-amber-300 font-medium">{pendingAction.target}</span>
            </p>
          </div>
        </div>

        {/* ZARA Dostana Prompt Card */}
        <div
          className={`mt-5 p-4 rounded-2xl border ${
            isAwaitingSecondStep
              ? 'bg-rose-950/20 border-rose-500/30'
              : 'bg-[#151520] border-white/5'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ZARA poochh rahi hai:</span>
          </div>

          <p className="text-sm font-medium text-white/95 leading-relaxed">
            {isAwaitingSecondStep
              ? `Boss, kya aap 100% pakka "${pendingAction.title}" execute karna chahte hain? Yeh irreversible hai!`
              : pendingAction.confirmPrompt}
          </p>

          {isDouble && (
            <div className="mt-3 text-[11px] text-rose-300/80 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                Yeh action sensitive hai (files delete ya WhatsApp message bhejna). ZARA do martaba confirm karwayegi.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={handleCancel}
            disabled={isExecuting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5"
          >
            <X className="w-4 h-4" />
            <span>Nahi, Ruko (Cancel) [Esc]</span>
          </button>

          <button
            onClick={handleConfirm}
            disabled={isExecuting}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
              isAwaitingSecondStep
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 font-bold'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 font-bold'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isExecuting
                ? 'Chala rahi hoon...'
                : isAwaitingSecondStep
                ? 'Haan, Pakka Kar Do (Confirm 2/2)'
                : isDouble
                ? 'Aage Barho (Step 1 Confirm)'
                : 'Haan, Kar Do (Confirm) [Enter]'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
