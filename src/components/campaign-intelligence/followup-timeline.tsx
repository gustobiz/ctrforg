"use client";

import React from 'react';
import { History, Eye, MousePointer, MessageSquare, Calendar, Sparkles } from 'lucide-react';
import { TimelineData } from '@/hooks/use-campaign-intelligence';

interface Props {
  data?: TimelineData;
}

export default function FollowupTimeline({ data }: Props) {
  const today = data?.today || { opens: 0, clicks: 0, replies: 0, followupsDue: 0 };
  const yesterday = data?.yesterday || { opens: 0, replies: 0, interested: 0 };

  return (
    <div className="p-5 rounded-3xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-400" />
          Follow-up Timeline
        </h4>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Activity Log</span>
      </div>

      <div className="space-y-4">
        {/* TODAY SECTION */}
        <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> TODAY
            </span>
            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">Real-time</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Opens</span>
              <span className="text-sm font-black text-emerald-400">{today.opens}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Clicks</span>
              <span className="text-sm font-black text-blue-400">{today.clicks}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Replies</span>
              <span className="text-sm font-black text-purple-400">{today.replies}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Due</span>
              <span className="text-sm font-black text-amber-400">{today.followupsDue}</span>
            </div>
          </div>
        </div>

        {/* YESTERDAY SECTION */}
        <div className="p-3.5 rounded-2xl border border-white/[0.04] bg-zinc-950/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> YESTERDAY
            </span>
            <span className="text-[9px] font-bold text-zinc-500">Historical Log</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Opens</span>
              <span className="text-sm font-bold text-zinc-200">{yesterday.opens}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Replies</span>
              <span className="text-sm font-bold text-purple-300">{yesterday.replies}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/40 border border-white/[0.04]">
              <span className="text-[9px] text-zinc-500 font-bold block uppercase">Interested</span>
              <span className="text-sm font-bold text-emerald-300">{yesterday.interested}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
