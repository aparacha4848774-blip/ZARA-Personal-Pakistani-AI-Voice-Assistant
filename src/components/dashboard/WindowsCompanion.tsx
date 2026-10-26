import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Folder,
  Search,
  FileText,
  Trash2,
  Edit3,
  ExternalLink,
  Volume2,
  VolumeX,
  Volume1,
  Camera,
  MessageCircle,
  Play,
  Square,
  Globe,
  Youtube,
  Bookmark,
  Keyboard,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useZaraStore } from '../../store/zaraStore.ts';
import { useLaptopControlStore } from '../../store/laptopControlStore.ts';
import { orchestrator } from '../../engines/ConversationOrchestrator.ts';
import { FileItem } from '../../types/laptopControl.types.ts';

export const WindowsCompanion: React.FC = () => {
  const { state, isMuted: zaraMuted } = useZaraStore();
  const {
    currentDirectory,
    filesInCurrentDir,
    searchResults,
    isSearching,
    systemVolume,
    isMuted: sysMuted,
    appsList,
    recentScreenshots,
    setSystemVolume,
    changeSystemVolume,
    browseDirectory,
    searchFiles,
    takeScreenshot,
    launchApp,
    closeApp,
    openUrl,
    setPendingAction,
  } = useLaptopControlStore();

  const [activeTab, setActiveTab] = useState<'files' | 'browser' | 'apps' | 'whatsapp' | 'system'>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [ytQuery, setYtQuery] = useState('lofi chill beats');
  const [googleQuery, setGoogleQuery] = useState('Karachi weather today');
  const [waContact, setWaContact] = useState('Hamza');
  const [waMessage, setWaMessage] = useState('Main 10 minute mein pohanch raha hoon');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  useEffect(() => {
    browseDirectory('Downloads');
  }, [browseDirectory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchFiles(searchQuery);
  };

  const triggerVoiceActionPrompt = (actionType: any, title: string, target: string, prompt: string, double = false, payload: any = {}) => {
    setPendingAction({
      id: `act-${Date.now()}`,
      type: actionType,
      title,
      target,
      payload,
      descriptionRomanUrdu: title,
      requiresDoubleConfirm: double,
      confirmPrompt: prompt,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    orchestrator.speakReply(prompt, double ? 'Focused' : 'Curious', 85);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              Laptop & Desktop Control Console
            </h2>
            <span className="text-sm font-urdu text-amber-400">(لیپ ٹاپ کنٹرول)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Voice-controlled file system, default browser, system apps, volume, screenshots & WhatsApp automation.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-mono">Electron Bridge: Ready</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-medium">
            Ctrl+Shift+Z Hotkey Active
          </div>
        </div>
      </div>

      {/* Control Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#111118] border border-white/5 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'files'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>1. File System</span>
        </button>

        <button
          onClick={() => setActiveTab('browser')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'browser'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>2. Browser Control</span>
        </button>

        <button
          onClick={() => setActiveTab('apps')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'apps'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>3. System Apps & Volume</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>4. WhatsApp Desktop</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'system'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>5. Electron & Hotkeys</span>
        </button>
      </div>

      {/* TAB 1: FILE SYSTEM ACCESS */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Quick Voice Hints */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-300">Aawaz se boliye:</span>
                <p className="text-xs text-zinc-300 mt-0.5">
                  &ldquo;ZARA, Downloads folder kholo&rdquo; • &ldquo;ZARA, resume.pdf dhundo&rdquo; • &ldquo;file delete karo report.docx&rdquo;
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 bg-black/40 px-3 py-1 rounded-lg border border-white/5">
              Confirmations & Double-Confirm Enforced
            </span>
          </div>

          {/* Directory Selectors & Search */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Current Directory:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-xs text-amber-400 font-mono">
                  {currentDirectory}
                </span>
              </div>

              {/* Quick Folder Switchers */}
              <div className="flex items-center gap-2 flex-wrap">
                {['Downloads', 'Documents', 'Desktop'].map((dir) => (
                  <button
                    key={dir}
                    onClick={() => {
                      triggerVoiceActionPrompt(
                        'folder_open',
                        `Open ${dir} Folder`,
                        dir,
                        `Boss, kya main ${dir} folder khol doon?`,
                        false,
                        { folderName: dir }
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      currentDirectory.toLowerCase() === dir.toLowerCase()
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-[#0A0A0F] border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    📂 {dir}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="File search karein... (e.g. resume.pdf, project_notes.txt)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all cursor-pointer"
              >
                Dhundo (Search)
              </button>
            </form>
          </div>

          {/* Search Results (if searching) */}
          {searchQuery && (
            <div className="p-5 rounded-2xl bg-[#111118] border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>Search Results for &ldquo;{searchQuery}&rdquo;:</span>
                <span className="text-zinc-500">{searchResults.length} items found</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#0A0A0F] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-medium text-white">{file.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{file.path}</div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          'file_open',
                          `Open ${file.name}`,
                          file.name,
                          `Boss, kya main "${file.name}" file open kar doon?`,
                          false,
                          { fileName: file.name }
                        )
                      }
                      className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-xs font-medium text-zinc-200 transition-all cursor-pointer"
                    >
                      Kholo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Directory Files Grid */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
              Files in {currentDirectory}
            </h4>

            <div className="divide-y divide-white/5">
              {filesInCurrentDir.map((file: FileItem, idx: number) => (
                <div
                  key={idx}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-amber-400">
                      {file.isDirectory ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{file.name}</span>
                        {file.sizeBytes && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            ({Math.round(file.sizeBytes / 1024)} KB)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        Path: {file.path} • Modified: {file.modifiedAt}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          file.isDirectory ? 'folder_open' : 'file_open',
                          `Open ${file.name}`,
                          file.name,
                          `Boss, kya main "${file.name}" ${file.isDirectory ? 'folder' : 'file'} open kar doon?`,
                          false,
                          { fileName: file.name, folderName: file.name }
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 border border-white/5 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kholo</span>
                    </button>

                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          'file_rename',
                          `Rename ${file.name}`,
                          file.name,
                          `Boss, kya main "${file.name}" ka naam badal kar "final_${file.name}" kar doon?`,
                          false,
                          { oldName: file.name, newName: `final_${file.name}` }
                        )
                      }
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer border border-white/5"
                      title="Rename"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          'file_delete',
                          `Delete ${file.name}`,
                          file.name,
                          `Boss, kya aap sach mein "${file.name}" delete karna chahte hain? Yeh file hamesha ke liye chali jayegi!`,
                          true,
                          { fileName: file.name }
                        )
                      }
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                      title="Delete (Double Confirm)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BROWSER CONTROL */}
      {activeTab === 'browser' && (
        <div className="space-y-6">
          {/* Quick Voice Hints */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-300">Aawaz se boliye:</span>
              <p className="text-xs text-zinc-300 mt-0.5">
                &ldquo;ZARA, YouTube par lofi music search karo&rdquo; • &ldquo;Google par Karachi weather search karo&rdquo; • &ldquo;tab close karo&rdquo;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* YouTube Search Box */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Youtube className="w-4 h-4 text-rose-500" />
                <span>YouTube Voice & Direct Search</span>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  placeholder="e.g. lofi chill beats, coke studio"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={() =>
                    triggerVoiceActionPrompt(
                      'browser_search',
                      `YouTube: ${ytQuery}`,
                      ytQuery,
                      `Boss, kya YouTube par "${ytQuery}" search kar ke chala doon?`,
                      false,
                      { query: ytQuery, engine: 'youtube' }
                    )
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>YouTube Par Chalao</span>
                </button>
              </div>
            </div>

            {/* Google Search Box */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Google Search</span>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  placeholder="e.g. Pakistan cricket match, dollar rate"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={() =>
                    triggerVoiceActionPrompt(
                      'browser_search',
                      `Google: ${googleQuery}`,
                      googleQuery,
                      `Boss, kya Google par "${googleQuery}" dhoond kar open kar doon?`,
                      false,
                      { query: googleQuery, engine: 'google' }
                    )
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Google Par Search Karo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Direct URL & Tab Operations */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
              URL Launcher & Tab Shortcuts
            </h4>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://github.com ya google.com"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  if (!customUrl) return;
                  const full = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
                  triggerVoiceActionPrompt(
                    'browser_open_url',
                    `Open ${full}`,
                    full,
                    `Boss, kya default browser mein "${full}" open kar doon?`,
                    false,
                    { url: full }
                  );
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all cursor-pointer"
              >
                URL Open Karo
              </button>
            </div>

            {/* Browser Control Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'browser_tab_open',
                    'Open New Tab',
                    'new_tab',
                    'Boss, kya browser mein naya tab khol doon?',
                    false,
                    { shortcut: 'Ctrl+T' }
                  )
                }
                className="p-3 rounded-xl bg-[#0A0A0F] border border-white/5 hover:border-amber-500/30 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-semibold text-white">Naya Tab (Ctrl+T)</div>
                <div className="text-[10px] text-zinc-500">Open blank new tab</div>
              </button>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'browser_tab_close',
                    'Close Current Tab',
                    'current_tab',
                    'Boss, kya current browser tab band kar doon?',
                    false,
                    { shortcut: 'Ctrl+W' }
                  )
                }
                className="p-3 rounded-xl bg-[#0A0A0F] border border-white/5 hover:border-rose-500/30 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-semibold text-rose-300">Tab Close (Ctrl+W)</div>
                <div className="text-[10px] text-zinc-500">Close active browser tab</div>
              </button>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'browser_bookmark',
                    'Open Bookmarks',
                    'bookmarks',
                    'Boss, kya bookmarks manager khol doon?',
                    false,
                    { shortcut: 'Ctrl+Shift+O' }
                  )
                }
                className="p-3 rounded-xl bg-[#0A0A0F] border border-white/5 hover:border-amber-500/30 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-semibold text-white">Bookmarks Manager</div>
                <div className="text-[10px] text-zinc-500">Ctrl+Shift+O shortcut</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM APPS & VOLUME */}
      {activeTab === 'apps' && (
        <div className="space-y-6">
          {/* Volume Control Card */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sysMuted || systemVolume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : systemVolume < 40 ? (
                  <Volume1 className="w-5 h-5 text-amber-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-emerald-400" />
                )}
                <span className="text-sm font-semibold text-white">System Volume Control</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                {sysMuted ? 'MUTED' : `${systemVolume}%`}
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={sysMuted ? 0 : systemVolume}
                onChange={(e) => setSystemVolume(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>0% (Silent)</span>
                <span>50%</span>
                <span>100% (Max)</span>
              </div>
            </div>

            {/* Quick Volume Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'volume_change',
                    'Volume Kam (-15%)',
                    'system_volume',
                    'Boss, kya volume thoda kam kar doon?',
                    false,
                    { delta: -15 }
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-white/5 cursor-pointer"
              >
                🔉 Volume Kam Karo (-15%)
              </button>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'volume_change',
                    'Volume Barhao (+15%)',
                    'system_volume',
                    'Boss, kya aawaz thodi barha doon?',
                    false,
                    { delta: 15 }
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-white/5 cursor-pointer"
              >
                🔊 Volume Barhao (+15%)
              </button>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'volume_set',
                    'Mute Audio',
                    'system_volume',
                    'Boss, kya sound bilkul mute kar doon?',
                    false,
                    { volume: 0 }
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 cursor-pointer"
              >
                🔇 Mute Kar Do
              </button>
            </div>
          </div>

          {/* Screenshot Tool Card */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-semibold text-white">Desktop Screenshot Capture</span>
              </div>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'screenshot_take',
                    'Take Screenshot',
                    'desktop_screen',
                    'Boss, kya abhi screen ka screenshot capture karoon?',
                    false
                    )
                }
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>Screenshot Lo (&ldquo;ZARA, screenshot lo&rdquo;)</span>
              </button>
            </div>

            {/* Recent Screenshots Gallery */}
            {recentScreenshots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {recentScreenshots.map((scr) => (
                  <div
                    key={scr.id}
                    onClick={() => setSelectedScreenshot(scr.dataUrl)}
                    className="group relative rounded-xl overflow-hidden border border-white/10 bg-black cursor-pointer hover:border-amber-500/50 transition-all shadow-md"
                  >
                    <img src={scr.dataUrl} alt={scr.title} className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                      <span className="text-[11px] font-mono text-zinc-300">{scr.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#0A0A0F] border border-dashed border-white/10 text-center text-xs text-zinc-500">
                Abhi tak koi screenshot nahi liya gaya. Voice command &ldquo;ZARA, screenshot lo&rdquo; boliye ya upar wala button dabaiye!
              </div>
            )}
          </div>

          {/* System Apps Manager */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                System Applications
              </h4>
              <span className="text-[11px] text-zinc-500 font-mono">
                Voice command: &ldquo;ZARA, Notepad kholo&rdquo;, &ldquo;Calculator kholo&rdquo;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {appsList.map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-xl bg-[#0A0A0F] border border-white/5 flex items-center justify-between hover:border-white/15 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-amber-400 font-bold text-xs font-mono">
                      {app.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{app.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">cmd: {app.command}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          'app_launch',
                          `Launch ${app.name}`,
                          app.name,
                          `Boss, kya main ${app.name} open kar doon?`,
                          false,
                          { appName: app.name }
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 text-xs font-medium transition-all cursor-pointer"
                    >
                      Kholo
                    </button>

                    <button
                      onClick={() =>
                        triggerVoiceActionPrompt(
                          'app_close',
                          `Close ${app.name}`,
                          app.name,
                          `Boss, kya aap sach mein ${app.name} ko band karna chahte hain? Unsaved data zaya ho sakta hai!`,
                          true,
                          { appName: app.name }
                        )
                      }
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                      title="Band Karo (Double Confirm)"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WHATSAPP DESKTOP CONTROL */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Quick Voice Hints */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-300">Aawaz se boliye:</span>
              <p className="text-xs text-zinc-300 mt-0.5">
                &ldquo;ZARA, WhatsApp kholo&rdquo; • &ldquo;Hamza ki WhatsApp chat kholo&rdquo; • &ldquo;WhatsApp par Hamza ko message bhejo: Kal milte hain&rdquo;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct WhatsApp Desktop Launcher */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <span>WhatsApp Desktop App</span>
              </div>

              <p className="text-xs text-zinc-400">
                ZARA WhatsApp protocol (`whatsapp://`) aur Windows desktop app ke sath connect hokar direct chat khol sakti hai.
              </p>

              <button
                onClick={() =>
                  triggerVoiceActionPrompt(
                    'whatsapp_launch',
                    'Open WhatsApp Desktop',
                    'whatsapp_app',
                    'Boss, kya WhatsApp Desktop open kar doon?',
                    false
                  )
                }
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                <span>WhatsApp Desktop Kholo</span>
              </button>
            </div>

            {/* Quick Chat Opener */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Search className="w-4 h-4 text-amber-400" />
                <span>Contact Chat Kholna</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {['Hamza', 'Ali Dev', 'Usman', 'Saad'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setWaContact(c)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                        waContact === c
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0A0A0F] border-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() =>
                    triggerVoiceActionPrompt(
                      'whatsapp_chat_open',
                      `Open Chat: ${waContact}`,
                      waContact,
                      `Boss, kya WhatsApp par "${waContact}" ki chat khol doon?`,
                      false,
                      { contactName: waContact }
                    )
                  }
                  className="w-full mt-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5"
                >
                  <span>&ldquo;{waContact}&rdquo; Ki Chat Kholo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Voice Message Compose & Double Confirm */}
          <div className="p-5 rounded-2xl bg-[#111118] border border-amber-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Voice Message Draft & Double Confirmation</span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                Sensitive Action
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Recipient Contact</label>
                <input
                  type="text"
                  value={waContact}
                  onChange={(e) => setWaContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-zinc-400 block mb-1">Message Text (Clipboard Copy)</label>
                <input
                  type="text"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0F] border border-white/10 text-xs text-white"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              💡 ZARA yeh message system clipboard mein copy karegi aur WhatsApp chat open karegi. Yeh sensitive kaam hai is liye ZARA do martaba confirm karwayegi.
            </div>

            <button
              onClick={() =>
                triggerVoiceActionPrompt(
                  'whatsapp_draft_send',
                  `Send WhatsApp to ${waContact}`,
                  waContact,
                  `Boss, kya pakka WhatsApp par ${waContact} ko yeh message bhej doon: "${waMessage}"? Double confirm karein.`,
                  true,
                  { contactName: waContact, messageText: waMessage }
                )
              }
              className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Confirm Karwa Ke WhatsApp Message Bhejo</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: ELECTRON & HOTKEYS */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Global Keyboard Shortcuts */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Keyboard className="w-4 h-4 text-amber-400" />
                <span>Global System Shortcuts</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0A0F] border border-white/5 text-xs">
                  <div>
                    <div className="text-zinc-200 font-medium">Activate ZARA & Listen</div>
                    <div className="text-[10px] text-zinc-500">Wake up anywhere in Windows</div>
                  </div>
                  <kbd className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-mono text-xs border border-zinc-700 font-bold">
                    Ctrl + Shift + Z
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0A0F] border border-white/5 text-xs">
                  <div>
                    <div className="text-zinc-200 font-medium">Emergency Mute / Unmute</div>
                    <div className="text-[10px] text-zinc-500">Instantly silence ZARA</div>
                  </div>
                  <kbd className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-mono text-xs border border-zinc-700 font-bold">
                    Ctrl + Shift + M
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0A0F] border border-white/5 text-xs">
                  <div>
                    <div className="text-zinc-200 font-medium">Confirm Pending Action</div>
                    <div className="text-[10px] text-zinc-500">Voice ya keyboard se confirm</div>
                  </div>
                  <kbd className="px-2.5 py-1 rounded bg-zinc-800 text-emerald-400 font-mono text-xs border border-zinc-700 font-bold">
                    Enter
                  </kbd>
                </div>
              </div>
            </div>

            {/* Electron IPC APIs */}
            <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Electron Native APIs Verified</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#0A0A0F] border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400">shell.openPath()</span>
                  <span className="text-emerald-400 font-semibold">Native Files & Folders</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0A0A0F] border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400">shell.openExternal()</span>
                  <span className="text-emerald-400 font-semibold">Browser & WhatsApp URLs</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0A0A0F] border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400">child_process.spawn()</span>
                  <span className="text-emerald-400 font-semibold">Notepad, Calc, Apps</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0A0A0F] border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400">clipboard.writeText()</span>
                  <span className="text-emerald-400 font-semibold">Clipboard Paste Send</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Screenshot Preview Modal */}
      {selectedScreenshot && (
        <div
          onClick={() => setSelectedScreenshot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-4xl w-full bg-[#111118] border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <img src={selectedScreenshot} alt="Full screenshot" className="w-full h-auto" />
            <div className="p-3 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
              <span>Captured by ZARA Desktop Engine</span>
              <span>Click anywhere to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
