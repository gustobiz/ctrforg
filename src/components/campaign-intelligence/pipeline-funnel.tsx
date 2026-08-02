"use client";

import React from 'react';
import { Filter, ChevronDown, Sparkles } from 'lucide-react';
import { FunnelData } from '@/hooks/use-campaign-intelligence';

interface Props {
  data?: FunnelData;
}

export default function PipelineFunnel({ data }: Props) {
  const funnel = data || {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    interested: 0,
    closed: 0,
  };

  const steps = [
    { label: 'Sent', count: funnel.sent, color: 'from-zinc-700 to-zinc-800', textColor: 'text-zinc-200', width: 'w-full' },
    { label: 'Delivered', count: funnel.delivered, color: 'from-emerald-700 to-emerald-800', textColor: 'text-emerald-300', width: 'w-[92%]' },
    { label: 'Opened', count: funnel.opened, color: 'from-teal-600 to-emerald-600', textColor: 'text-emerald-400', width: 'w-[84%]' },
    { label: 'Clicked', count: funnel.clicked, color: 'from-blue-600 to-cyan-600', textColor: 'text-blue-400', width: 'w-[75%]' },
    { label: 'Replied', count: funnel.replied, color: 'from-purple-600 to-indigo-600', textColor: 'text-purple-400', width: 'w-[65%]' },
    { label: 'Interested', count: funnel.interested, color: 'from-fuchsia-600 to-pink-600', textColor: 'text-pink-400', width: 'w-[55%]' },
    { label: 'Closed Won', count: funnel.closed, color: 'from-emerald-500 to-green-500', textColor: 'text-emerald-300', width: 'w-[45%]' },
  ];

  return (
    <div className="p-5 rounded-3xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <Filter className="h-4 w-4 text-emerald-400" />
          Pipeline Funnel Conversion
        </h4>
        <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
          Live Tracking
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        {steps.map((step, idx) => (
          <div
            key={step.label}
            className={`${step.width} transition-all duration-500 ease-out group relative`}
          >
            <div className={`p-2.5 rounded-xl bg-gradient-to-r ${step.color} border border-white/10 shadow-lg flex items-center justify-between px-4 hover:scale-[1.01] transition-transform`}>
              <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-[9px] font-black opacity-60">#{idx + 1}</span> {step.label}
              </span>
              <span className={`text-xs font-black tracking-tight ${step.textColor}`}>
                {step.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
