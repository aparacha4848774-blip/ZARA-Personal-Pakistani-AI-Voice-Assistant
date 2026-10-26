import React from 'react';
import { ZaraState } from '../../types/zara.types.ts';

interface StatusBadgeProps {
  state: ZaraState;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, className = '' }) => {
  const getStatusConfig = (st: ZaraState) => {
    switch (st) {
      case 'LISTENING':
        return {
          label: 'LISTENING',
          urdu: 'سن رہی ہوں',
          dotColor: 'bg-[#10B981]',
          borderColor: 'border-[#10B981]/40',
          textColor: 'text-[#10B981]',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
          pulse: true,
        };
      case 'WAKE_WORD_DETECTED':
        return {
          label: 'WAKE WORD DETECTED',
          urdu: 'بیدار ہو گئی',
          dotColor: 'bg-[#F59E0B]',
          borderColor: 'border-[#F59E0B]',
          textColor: 'text-[#FCD34D]',
          glow: 'shadow-[0_0_16px_rgba(245,158,11,0.8)]',
          pulse: true,
        };
      case 'PROCESSING':
        return {
          label: 'PROCESSING...',
          urdu: 'سوچ رہی ہوں...',
          dotColor: 'bg-[#3B82F6]',
          borderColor: 'border-[#3B82F6]/50',
          textColor: 'text-[#60A5FA]',
          glow: 'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
          pulse: true,
        };
      case 'SPEAKING':
        return {
          label: 'SPEAKING',
          urdu: 'بول رہی ہوں',
          dotColor: 'bg-[#8B5CF6]',
          borderColor: 'border-[#8B5CF6]/50',
          textColor: 'text-[#A78BFA]',
          glow: 'shadow-[0_0_12px_rgba(139,92,246,0.5)]',
          pulse: true,
        };
      case 'INTERRUPTED':
        return {
          label: 'INTERRUPTED',
          urdu: 'روک دیا گیا',
          dotColor: 'bg-[#F97316]',
          borderColor: 'border-[#F97316]/50',
          textColor: 'text-[#FB923C]',
          glow: 'shadow-[0_0_10px_rgba(249,115,22,0.4)]',
          pulse: false,
        };
      case 'STANDBY':
        return {
          label: 'STANDBY',
          urdu: 'تیار',
          dotColor: 'bg-[#F59E0B]',
          borderColor: 'border-[#F59E0B]/30',
          textColor: 'text-[#F59E0B]',
          glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]',
          pulse: false,
        };
      case 'MUTED':
        return {
          label: 'MUTED',
          urdu: 'خاموش',
          dotColor: 'bg-[#6B7280]',
          borderColor: 'border-[#4B5563]',
          textColor: 'text-[#9CA3AF]',
          glow: '',
          pulse: false,
        };
      case 'RECONNECTING':
        return {
          label: 'RECONNECTING',
          urdu: 'دوبارہ رابطہ',
          dotColor: 'bg-[#F59E0B]',
          borderColor: 'border-[#F59E0B]/50',
          textColor: 'text-[#F59E0B]',
          glow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]',
          pulse: true,
        };
      case 'ERROR':
        return {
          label: 'ERROR',
          urdu: 'خرابی',
          dotColor: 'bg-[#EF4444]',
          borderColor: 'border-[#EF4444]/60',
          textColor: 'text-[#F87171]',
          glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
          pulse: true,
        };
      case 'INITIALIZING':
      default:
        return {
          label: 'INITIALIZING',
          urdu: 'شروعات',
          dotColor: 'bg-zinc-400',
          borderColor: 'border-zinc-700',
          textColor: 'text-zinc-300',
          glow: '',
          pulse: true,
        };
    }
  };

  const config = getStatusConfig(state);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111118]/90 border ${config.borderColor} ${config.glow} transition-all duration-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`}
          ></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`}></span>
      </span>
      <span className={`font-mono text-[11px] font-semibold tracking-wider ${config.textColor}`}>
        {config.label}
      </span>
      <span className="text-[10px] text-zinc-500 font-urdu hidden sm:inline">
        ({config.urdu})
      </span>
    </div>
  );
};
