import React, { useState } from 'react';
import {
  Code,
  Eye,
  Download,
  Copy,
  Check,
  Play,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  FolderCheck,
  FileCode,
  Video,
} from 'lucide-react';
import {
  MessageArtifact,
  CodeSandboxArtifact,
  ResearchReportArtifact,
  SvgLogoArtifact,
  SlideDeckArtifact,
  VideoScriptArtifact,
  AutomationJobArtifact,
  FileOrganizationArtifact,
} from '../../types/zara.types.ts';

interface ArtifactRendererProps {
  artifact: MessageArtifact;
}

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({ artifact }) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'preview' | 'code'>('preview');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [jobTriggered, setJobTriggered] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = (svgCode: string, filename: string) => {
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.toLowerCase().replace(/\s+/g, '_')}_logo.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  switch (artifact.type) {
    // -------------------------------------------------------------
    // 1. Software Engineering: Code Sandbox & Live Preview
    // -------------------------------------------------------------
    case 'code_sandbox': {
      const data = artifact.data as CodeSandboxArtifact;
      const currentFile = data.files[selectedFileIndex] || data.files[0];

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="px-4 py-2.5 bg-[#14141F] border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                <Code className="w-3.5 h-3.5" />
              </span>
              <span className="font-brand font-bold text-xs text-white tracking-wide">
                {data.title}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5">
                {data.framework}
              </span>
            </div>

            {/* Preview vs Code Tabs */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-[11px] font-mono">
              <button
                onClick={() => setActiveCodeTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeCodeTab === 'preview'
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Live Preview</span>
              </button>
              <button
                onClick={() => setActiveCodeTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  activeCodeTab === 'code'
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>Source Code ({data.files.length})</span>
              </button>
            </div>
          </div>

          {/* View Container */}
          {activeCodeTab === 'preview' ? (
            <div className="relative w-full h-80 bg-[#0A0A0F] border-b border-white/5">
              <iframe
                title={data.title}
                srcDoc={data.previewHtml}
                className="w-full h-full border-none rounded-b-2xl"
                sandbox="allow-scripts allow-modals"
              />
            </div>
          ) : (
            <div className="flex flex-col h-80">
              {/* File Tabs */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-[#111118] border-b border-white/5 overflow-x-auto text-xs font-mono">
                {data.files.map((file, idx) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedFileIndex === idx
                        ? 'bg-[#1E1E2C] text-amber-300 font-bold border border-white/10'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {file.name}
                  </button>
                ))}
              </div>

              {/* Code display */}
              <div className="flex-1 overflow-auto p-4 bg-[#0A0A0F] text-xs font-mono text-zinc-300">
                <pre className="whitespace-pre">{currentFile?.content}</pre>
              </div>

              {/* Action bar */}
              <div className="px-4 py-2 bg-[#14141F] border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Run: {data.runCommand}</span>
                <button
                  onClick={() => handleCopy(currentFile?.content || '')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------
    // 2. Creative: SVG Vector Logo Studio
    // -------------------------------------------------------------
    case 'svg_logo': {
      const data = artifact.data as SvgLogoArtifact;

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h4 className="font-brand font-bold text-xs text-white">{data.companyName} Brand Logo</h4>
              <p className="text-[10px] text-zinc-400">{data.style}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(data.svgCode)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white text-xs"
                title="Copy SVG"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleDownloadSvg(data.svgCode, data.companyName)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download SVG</span>
              </button>
            </div>
          </div>

          {/* Rendered SVG Display */}
          <div
            className="w-full h-44 rounded-xl bg-[#050508] border border-white/5 flex items-center justify-center p-3 overflow-hidden shadow-inner"
            dangerouslySetInnerHTML={{ __html: data.svgCode }}
          />

          {/* Palette Swatches */}
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
            <div className="flex items-center gap-1.5">
              <span>Palette:</span>
              {data.colorPalette.map((col) => (
                <span
                  key={col}
                  className="w-4 h-4 rounded-full border border-white/20 inline-block"
                  style={{ backgroundColor: col }}
                  title={col}
                />
              ))}
            </div>
            <span className="text-[10px] text-zinc-500 italic max-w-xs truncate">{data.rationale}</span>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 3. Research & Analysis Report
    // -------------------------------------------------------------
    case 'research_report': {
      const data = artifact.data as ResearchReportArtifact;

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 sm:p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-base">🔬</span>
              <h4 className="font-brand font-bold text-sm text-white">{data.topic}</h4>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
              VERIFIED SYNTHESIS
            </span>
          </div>

          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-200 leading-relaxed">
            <strong className="text-amber-400 block mb-1 font-mono text-[11px] uppercase tracking-wider">
              Executive Summary:
            </strong>
            {data.executiveSummary}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {data.metrics.map((m) => (
              <div key={m.label} className="p-2.5 rounded-xl bg-[#14141F] border border-white/5">
                <span className="text-[10px] font-mono text-zinc-400 block truncate">{m.label}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-bold text-sm text-white font-mono">{m.value}</span>
                  {m.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                  {m.trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400" />}
                </div>
              </div>
            ))}
          </div>

          {/* Key Findings & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#14141F] border border-white/5 space-y-1.5">
              <span className="font-mono text-[11px] text-zinc-400 font-semibold block uppercase">
                Key Insights:
              </span>
              <ul className="space-y-1 text-zinc-300">
                {data.keyFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">&bull;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-[#14141F] border border-white/5 space-y-1.5">
              <span className="font-mono text-[11px] text-amber-400 font-semibold block uppercase">
                Action Items for Boss:
              </span>
              <ul className="space-y-1 text-zinc-300">
                {data.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 4. Creative: Slide Deck Presentation Viewer
    // -------------------------------------------------------------
    case 'slide_deck': {
      const data = artifact.data as SlideDeckArtifact;
      const slide = data.slides[currentSlideIndex] || data.slides[0];

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 space-y-3 shadow-2xl">
          {/* Deck Header & Slide Nav */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="font-brand font-bold text-xs text-white truncate max-w-xs">{data.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400">
                Slide {currentSlideIndex + 1} of {data.slides.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded bg-zinc-800 disabled:opacity-30 text-white"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentSlideIndex === data.slides.length - 1}
                  onClick={() => setCurrentSlideIndex((prev) => Math.min(data.slides.length - 1, prev + 1))}
                  className="p-1 rounded bg-zinc-800 disabled:opacity-30 text-white"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Current Slide Display Canvas */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#1A1A28] to-[#0A0A0F] border border-white/10 min-h-48 flex flex-col justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold block mb-1">
                ZARA PRESENTATION SUITE
              </span>
              <h3 className="text-base font-brand font-bold text-white mb-3">{slide.title}</h3>
              <ul className="space-y-2">
                {slide.bullets.map((b, i) => (
                  <li key={i} className="text-xs text-zinc-200 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {slide.speakerNotes && (
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-zinc-400 italic">
                Speaker Note: {slide.speakerNotes}
              </div>
            )}
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 5. Creative: Viral Video Script
    // -------------------------------------------------------------
    case 'video_script': {
      const data = artifact.data as VideoScriptArtifact;

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-rose-400" />
              <h4 className="font-brand font-bold text-xs text-white">{data.title}</h4>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30 font-semibold">
              {data.targetPlatform} &bull; {data.durationEst}
            </span>
          </div>

          {/* Viral Hook */}
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
            <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block mb-1">
              0-3s Viral Hook:
            </span>
            <p className="text-white font-medium italic">"{data.hook}"</p>
          </div>

          {/* Scenes */}
          <div className="space-y-2">
            {data.scenes.map((s, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[#14141F] border border-white/5 text-xs">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                  <span className="text-amber-400 font-bold">{s.time}</span>
                  <span>Visual: {s.visual}</span>
                </div>
                <div className="text-zinc-200">
                  <span className="text-zinc-500 font-mono text-[10px] mr-1">Urdu Voice:</span>
                  "{s.audioUrdu}"
                </div>
              </div>
            ))}
          </div>

          {/* Call to action */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>CTA: {data.callToAction}</span>
            <button
              onClick={() => handleCopy(JSON.stringify(data, null, 2))}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px]"
            >
              Copy Script
            </button>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 6. Automation: Scheduled Task
    // -------------------------------------------------------------
    case 'automation_job': {
      const data = artifact.data as AutomationJobArtifact;

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h4 className="font-brand font-bold text-xs text-white">{data.name}</h4>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVE
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#14141F] border border-white/5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-400 font-mono text-[11px]">Schedule:</span>
              <span className="font-semibold text-white">{data.schedule}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-400 font-mono text-[11px]">Next Run:</span>
              <span className="text-amber-400 font-mono">{data.nextRun}</span>
            </div>
            <p className="text-zinc-400 text-[11px] pt-1 border-t border-white/5">{data.actionSummary}</p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-zinc-500">{data.lastRun}</span>
            <button
              onClick={() => {
                setJobTriggered(true);
                setTimeout(() => setJobTriggered(false), 2500);
              }}
              disabled={jobTriggered}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 text-black font-semibold text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <Play className="w-3 h-3" />
              <span>{jobTriggered ? 'Running Now...' : 'Run Instantly'}</span>
            </button>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 7. Automation: File Organization
    // -------------------------------------------------------------
    case 'file_organization': {
      const data = artifact.data as FileOrganizationArtifact;

      return (
        <div className="mt-3 rounded-2xl bg-[#0D0D14] border border-white/10 p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="font-brand font-bold text-xs text-white">
                Folder Sorted: {data.targetFolder}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {data.totalFiles} files organized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {data.categories.map((c) => (
              <div key={c.name} className="p-2.5 rounded-xl bg-[#14141F] border border-white/5">
                <div className="flex items-center justify-between font-semibold text-white mb-1">
                  <span className="truncate">{c.name}</span>
                  <span className="text-amber-400 font-mono text-[11px]">{c.count}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {c.extensions.join(' ')}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Files cleanly categorized with backup safeguards intact.</span>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};
