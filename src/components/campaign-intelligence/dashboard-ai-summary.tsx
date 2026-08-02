"use client";

import React from 'react';
import { Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  aiSummary?: {
    summaryText: string;
    suggestedActions: string;
  };
}

export default function DashboardAiSummary({ aiSummary }: Props) {
  const router = useRouter();

  const summary = aiSummary || {
    summaryText: "Today's Summary: Sequence engines running smoothly. Activity monitored in real-time.",
    suggestedActions: "Review lead engagement metrics in CRM & Unified Inbox."
  };

  return (
    <div className="p-5 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-zinc-900/40 to-zinc-900/10 shadow-2xl relative overflow-hidden mb-8 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
            Campaign Intelligence AI Summary
          </h4>
        </div>
        <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          AI Copilot Active
        </span>
      </div>

      <p className="text-xs text-zinc-200 font-medium leading-relaxed">
        {summary.summaryText}
      </p>

      <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/[0.04] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{summary.suggestedActions}</span>
        </div>

        <button
          onClick={() => router.push('/inbox')}
          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-extrabold uppercase tracking-wider transition-all shadow-md flex items-center gap-1 shrink-0"
        >
          Take Action <ArrowRight className="h-3 w-3 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
