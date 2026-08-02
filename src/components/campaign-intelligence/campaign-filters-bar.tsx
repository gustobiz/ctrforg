"use client";

import React from 'react';
import { Filter, PlayCircle, PauseCircle, CheckCircle2, AlertCircle, Zap, TrendingDown } from 'lucide-react';

interface Props {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function CampaignFiltersBar({ activeFilter, onFilterChange }: Props) {
  const filters = [
    { id: 'all', label: 'All Campaigns', icon: Filter },
    { id: 'running', label: 'Running', icon: PlayCircle, color: 'text-emerald-400' },
    { id: 'paused', label: 'Paused', icon: PauseCircle, color: 'text-amber-400' },
    { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-blue-400' },
    { id: 'needs_followup', label: 'Needs Follow-up', icon: AlertCircle, color: 'text-rose-400' },
    { id: 'high_performing', label: 'High Performing', icon: Zap, color: 'text-purple-400' },
    { id: 'low_performing', label: 'Low Performing', icon: TrendingDown, color: 'text-zinc-400' },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {filters.map((f) => {
        const Icon = f.icon;
        const isActive = activeFilter === f.id;

        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
              isActive
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-zinc-900/40 border-white/[0.04] text-zinc-400 hover:text-white hover:border-white/[0.08]'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-black' : f.color || 'text-zinc-400'}`} />
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
