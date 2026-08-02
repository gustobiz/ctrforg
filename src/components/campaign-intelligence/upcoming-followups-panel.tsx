"use client";

import React, { useState } from 'react';
import { Calendar, Clock, ExternalLink, Inbox, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FollowupItem } from '@/hooks/use-campaign-intelligence';

interface Props {
  upcoming?: {
    today: FollowupItem[];
    tomorrow: FollowupItem[];
    next7Days: FollowupItem[];
  };
}

export default function UpcomingFollowupsPanel({ upcoming }: Props) {
  const [tab, setTab] = useState<'today' | 'tomorrow' | 'next7Days'>('today');
  const router = useRouter();

  const items = upcoming ? upcoming[tab] || [] : [];

  return (
    <div className="p-5 rounded-3xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.04] pb-3 gap-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-400" />
          Upcoming Follow-ups
        </h4>

        {/* Tab switch */}
        <div className="flex p-0.5 rounded-xl bg-zinc-950 border border-white/[0.06] text-[10px] font-bold">
          <button
            onClick={() => setTab('today')}
            className={`px-2.5 py-1 rounded-lg transition-all ${tab === 'today' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'}`}
          >
            Today ({upcoming?.today.length || 0})
          </button>
          <button
            onClick={() => setTab('tomorrow')}
            className={`px-2.5 py-1 rounded-lg transition-all ${tab === 'tomorrow' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'}`}
          >
            Tomorrow ({upcoming?.tomorrow.length || 0})
          </button>
          <button
            onClick={() => setTab('next7Days')}
            className={`px-2.5 py-1 rounded-lg transition-all ${tab === 'next7Days' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'}`}
          >
            Next 7 Days ({upcoming?.next7Days.length || 0})
          </button>
        </div>
      </div>

      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 italic rounded-2xl border border-dashed border-white/[0.04]">
            No scheduled follow-ups for this period.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push('/inbox')}
              className="p-3 rounded-2xl border border-white/[0.04] bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-white/[0.08] transition-all cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <h5 className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors truncate">
                  {item.leadName}
                </h5>
                <p className="text-[10px] text-zinc-500 font-medium truncate">
                  {item.campaignName} &bull; {item.scheduledTime}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {item.status}
                </span>
                <Inbox className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
