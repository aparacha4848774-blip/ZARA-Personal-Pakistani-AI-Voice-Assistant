/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { CloudflareAuthGate } from './components/auth/CloudflareAuthGate.tsx';
import { TopBar } from './components/layout/TopBar.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { HomePanel } from './components/dashboard/HomePanel.tsx';
import { VoiceCenter } from './components/dashboard/VoiceCenter.tsx';
import { EmotionPanel } from './components/dashboard/EmotionPanel.tsx';
import { ModelsPanel } from './components/dashboard/ModelsPanel.tsx';
import { WhatsAppCenter } from './components/dashboard/WhatsAppCenter.tsx';
import { MemoryPanel } from './components/dashboard/MemoryPanel.tsx';
import { HistoryPanel } from './components/dashboard/HistoryPanel.tsx';
import { WindowsCompanion } from './components/dashboard/WindowsCompanion.tsx';
import { APIPanel } from './components/dashboard/APIPanel.tsx';
import { PrivacyPanel } from './components/dashboard/PrivacyPanel.tsx';
import { DiagnosticsPanel } from './components/dashboard/DiagnosticsPanel.tsx';
import { UsageMonitor } from './components/dashboard/UsageMonitor.tsx';
import { useZaraStore } from './store/zaraStore.ts';
import { orchestrator } from './engines/ConversationOrchestrator.ts';
import { ActionConfirmationModal } from './components/laptop/ActionConfirmationModal.tsx';

function ZaraAppShell() {
  const { activeRoute, toggleMute, triggerWakeWord } = useZaraStore();

  useEffect(() => {
    // Initialize voice and speech engines
    orchestrator.initialize();
    void useConversationStore.getState().loadInitialMessages();

    // Global keyboard shortcuts (Ctrl+Shift+Z to wake, Ctrl+Shift+M to mute)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
        e.preventDefault();
        triggerWakeWord('Keyboard Shortcut');
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerWakeWord, toggleMute]);

  const renderActivePanel = () => {
    switch (activeRoute) {
      case 'voice':
        return <VoiceCenter />;
      case 'emotion':
        return <EmotionPanel />;
      case 'models':
        return <ModelsPanel />;
      case 'whatsapp':
        return <WhatsAppCenter />;
      case 'memory':
        return <MemoryPanel />;
      case 'history':
        return <HistoryPanel />;
      case 'windows':
        return <WindowsCompanion />;
      case 'api':
        return <APIPanel />;
      case 'privacy':
        return <PrivacyPanel />;
      case 'diagnostics':
        return <DiagnosticsPanel />;
      case 'usage':
        return <UsageMonitor />;
      case 'home':
      default:
        return <HomePanel />;
    }
  };

  return (
    <div className="h-screen bg-[#0A0A0F] text-[#F9FAFB] flex flex-col font-sans selection:bg-[#F59E0B]/30 selection:text-[#FCD34D] overflow-hidden">
      {/* Top Header Bar */}
      <TopBar />

      {/* Main Body Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Content Panel View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderActivePanel()}
        </main>
      </div>

      {/* Laptop & Desktop Action Confirmation Modal */}
      <ActionConfirmationModal />
    </div>
  );
}

export default function App() {
  return <CloudflareAuthGate><ZaraAppShell /></CloudflareAuthGate>;
}
