"use client";

import React from 'react';
import { 
  Clock, 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PipelineHealthData } from '@/hooks/use-campaign-intelligence';

interface Props {
  data?: PipelineHealthData;
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export default function PipelineHealthCards({ data, activeFilter, onSelectFilter }: Props) {
  const router = useRouter();

  const cards = [
    {
      id: 'waiting_reply',
      label: 'Waiting For Reply',
      count: data?.waitingReply ?? 0,
      icon: Clock,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40',
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
      trend: '+4% active',
      target: '/inbox?category=all',
    },
    {
      id: 'followup_today',
      label: 'Follow-up Today',
      count: data?.followupToday ?? 0,
      icon: Calendar,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40',
      badgeColor: 'bg-amber-500/20 text-amber-300',
      trend: 'Due today',
      target: '/inbox?filter=followup_needed',
    },
    {
      id: 'overdue_followup',
      label: 'Overdue Follow-ups',
      count: data?.overdueFollowup ?? 0,
      icon: AlertCircle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40',
      badgeColor: 'bg-rose-500/20 text-rose-300',
      trend: data?.overdueFollowup ? 'Requires Action' : 'All Clear',
      target: '/crm',
    },
    {
      id: 'interested',
      label: 'Interested Leads',
      count: data?.interested ?? 0,
      icon: Sparkles,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
      badgeColor: 'bg-purple-500/20 text-purple-300',
      trend: 'High Intent',
      target: '/inbox?category=interested',
    },
    {
      id: 'closed_won',
      label: 'Closed Won',
      count: data?.closedWon ?? 0,
      icon: CheckCircle2,
      color: 'text-zinc-200',
      bgColor: 'bg-zinc-100/10 border-zinc-100/20 hover:border-zinc-100/40',
      badgeColor: 'bg-white/20 text-white',
      trend: 'Converted',
      target: '/crm',
    },
    {
      id: 'not_interested',
      label: 'Not Interested',
      count: data?.notInterested ?? 0,
      icon: XCircle,
      color: 'text-zinc-500',
      bgColor: 'bg-zinc-800/40 border-zinc-700/40 hover:border-zinc-600',
      badgeColor: 'bg-zinc-800 text-zinc-400',
      trend: 'Archived',
      target: '/inbox?category=not_interested',
    },
  ];

  const handleCardClick = (card: typeof cards[0]) => {
    onSelectFilter(card.id);
    if (card.target && card.target !== '/campaigns') {
      router.push(card.target);
    }
  };

  return (
    <div className="space-y-3 mb-10">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Pipeline Health Overview
        </h3>
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
          Click metric to filter inbox & CRM
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 group relative overflow-hidden ${card.bgColor} ${
                isSelected ? 'ring-2 ring-emerald-500 scale-[1.02]' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                  {card.label}
                </span>
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <h4 className="text-2xl font-black tracking-tight text-white">{card.count}</h4>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${card.badgeColor}`}>
                  {card.trend}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-end text-[10px] font-semibold text-zinc-400 group-hover:text-white transition-colors">
                <span>View</span>
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
