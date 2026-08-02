"use client";

import { useState } from 'react';
import { Sparkles, MessageSquare, Zap, Check, X, FileText, RefreshCw, Wand2 } from 'lucide-react';

interface AiAssistantPanelProps {
  snippet: string;
  leadName?: string;
  onApplyReply: (generatedText: string) => void;
  onClose: () => void;
}

export function AiAssistantPanel({
  snippet,
  leadName,
  onApplyReply,
  onClose,
}: AiAssistantPanelProps) {
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState('');
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState('');

  const generateReply = async (mode: 'short' | 'professional' | 'friendly' | 'cta' | 'summarize' | 'rewrite') => {
    setLoadingMode(mode);
    setActiveMode(mode);

    try {
      const res = await fetch('/api/inbox/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          snippet,
          leadName,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        if (mode === 'summarize') {
          setSummaryText(data.text);
        } else {
          setGeneratedText(data.text);
        }
      }
    } catch (err) {
      console.error('AI Generation error:', err);
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="w-80 bg-[#0b0b0f] border-l border-white/[0.06] flex flex-col h-full select-none">
      
      {/* Panel Header */}
      <div className="p-4 border-b border-white/[0.06] flex justify-between items-center bg-zinc-950/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-black text-zinc-100 uppercase tracking-wider">AI Inbox Copilot</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Preset Reply Actions */}
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
            <Wand2 className="h-3 w-3 text-emerald-400" /> Quick Smart Replies
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => generateReply('short')}
              disabled={loadingMode !== null}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                activeMode === 'short'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/60 border-white/[0.04] text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <div className="text-[11px] font-extrabold text-emerald-400 mb-0.5">Short</div>
              <div className="text-[9px] text-zinc-500 font-normal">Quick acknowledgment</div>
            </button>

            <button
              onClick={() => generateReply('professional')}
              disabled={loadingMode !== null}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                activeMode === 'professional'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/60 border-white/[0.04] text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <div className="text-[11px] font-extrabold text-sky-400 mb-0.5">Professional</div>
              <div className="text-[9px] text-zinc-500 font-normal">Corporate tone</div>
            </button>

            <button
              onClick={() => generateReply('friendly')}
              disabled={loadingMode !== null}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                activeMode === 'friendly'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/60 border-white/[0.04] text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <div className="text-[11px] font-extrabold text-amber-400 mb-0.5">Friendly</div>
              <div className="text-[9px] text-zinc-500 font-normal">Warm & engaging</div>
            </button>

            <button
              onClick={() => generateReply('cta')}
              disabled={loadingMode !== null}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                activeMode === 'cta'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/60 border-white/[0.04] text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <div className="text-[11px] font-extrabold text-purple-400 mb-0.5">Call / Pitch</div>
              <div className="text-[9px] text-zinc-500 font-normal">Book meeting CTA</div>
            </button>
          </div>
        </div>

        {/* Thread Summarizer Trigger */}
        <div className="pt-2 border-t border-white/[0.04]">
          <button
            onClick={() => generateReply('summarize')}
            disabled={loadingMode !== null}
            className="w-full py-2 px-3 rounded-xl bg-zinc-900 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-400" />
            <span>Summarize Thread Key Points</span>
          </button>
        </div>

        {/* Loading Spinner Indicator */}
        {loadingMode && (
          <div className="p-4 rounded-xl bg-zinc-950 border border-white/[0.06] flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold animate-pulse">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Generating AI Response...</span>
          </div>
        )}

        {/* Summary Result box */}
        {summaryText && (
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Thread Summary</span>
            <div className="p-3 rounded-xl bg-zinc-950 border border-white/[0.06] text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {summaryText}
            </div>
          </div>
        )}

        {/* Generated Reply Preview box */}
        {generatedText && (
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Check className="h-3 w-3" /> Generated Draft
            </span>

            <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-500/20 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
              {generatedText}
            </div>

            <button
              onClick={() => onApplyReply(generatedText)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              <span>Insert into Composer</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
