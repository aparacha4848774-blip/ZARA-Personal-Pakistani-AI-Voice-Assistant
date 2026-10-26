import React from 'react';
import {
  Home,
  Mic,
  Smile,
  Cpu,
  Key,
  MessageSquareShare,
  Brain,
  History,
  Laptop,
  Shield,
  Activity,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { useZaraStore } from '../../store/zaraStore.ts';

export interface NavItem {
  id: string;
  label: string;
  urduLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home Dashboard', urduLabel: 'ہوم', icon: Home },
  { id: 'voice', label: 'Voice Center', urduLabel: 'آواز', icon: Mic },
  { id: 'emotion', label: 'Emotion HUD', urduLabel: 'جذبات', icon: Smile },
  { id: 'models', label: 'AI Models', urduLabel: 'ماڈلز', icon: Cpu },
  { id: 'whatsapp', label: 'WhatsApp Center', urduLabel: 'واٹس ایپ', icon: MessageSquareShare },
  { id: 'memory', label: 'Memory Center', urduLabel: 'یادداشت', icon: Brain },
  { id: 'history', label: 'Conversation History', urduLabel: 'تاریخچہ', icon: History },
  { id: 'windows', label: 'Windows Companion', urduLabel: 'ڈیسک ٹاپ', icon: Laptop },
  { id: 'api', label: 'API Settings', urduLabel: 'اے پی آئی', icon: Key },
  { id: 'privacy', label: 'Privacy & Security', urduLabel: 'رازداری', icon: Shield },
  { id: 'diagnostics', label: 'Diagnostics', urduLabel: 'تشخیص', icon: Activity },
  { id: 'usage', label: 'Usage Monitor', urduLabel: 'استعمال', icon: BarChart3 },
];

export const Sidebar: React.FC = () => {
  const { activeRoute, setActiveRoute } = useZaraStore();

  return (
    <aside
      className="w-16 md:w-64 bg-[#0A0A0F] border-r border-white/10 flex flex-col justify-between py-4 transition-all duration-300 shrink-0 select-none overflow-y-auto"
      aria-label="Navigation Sidebar"
    >
      <div className="space-y-1 px-2">
        <div className="px-3 py-2 text-[11px] font-mono font-semibold tracking-wider text-zinc-500 uppercase hidden md:block">
          System Control
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveRoute(item.id)}
              aria-label={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-[#1A1A24] text-white shadow-sm border-l-4 border-[#F59E0B]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? 'text-[#F59E0B]' : 'text-zinc-400 group-hover:text-amber-400'
                }`}
              />

              <div className="flex-1 text-left hidden md:flex items-center justify-between min-w-0">
                <span className="truncate">{item.label}</span>
                <span className="text-[11px] font-urdu text-zinc-500 group-hover:text-amber-400/80">
                  {item.urduLabel}
                </span>
              </div>

              {isActive && (
                <ChevronRight className="w-4 h-4 text-amber-500 hidden md:block shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Status */}
      <div className="px-3 pt-4 border-t border-white/5 hidden md:block">
        <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>CORE STATUS</span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
          <div className="text-[10px] text-zinc-500">
            Gemini 3.8 + 4 Thinking &bull; v1.0.0
          </div>
        </div>
      </div>
    </aside>
  );
};
