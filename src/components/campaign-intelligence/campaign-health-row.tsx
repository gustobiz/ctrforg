"use client";

import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Activity, Inbox, Mail, MousePointer, 
  MessageSquare, Star, Clock, AlertTriangle, CheckCircle, Archive, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CampaignInsightInfo } from '@/hooks/use-campaign-intelligence';
import CampaignQuickActions from './campaign-quick-actions';

interface Props {
  campaign: any;
  insightInfo?: CampaignInsightInfo;
  onAction?: (id: string, action: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export default function CampaignHealthRow({ campaign, insightInfo, onAction, onDelete, onArchive }: Props) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const totalLeads = campaign.total_leads || 0;
  const sentCount = campaign.sent_count || 0;
  const progressPercent = totalLeads > 0 
    ? Math.min(100, Math.round((sentCount / totalLeads) * 100)) 
    : 0;

  const breakdown = insightInfo?.breakdown || {
    recipients: totalLeads,
    delivered: Math.max(0, sentCount - (campaign.bounced_count || 0)),
    opened: campaign.opened_count || 0,
    clicked: campaign.clicked_count || 0,
    replies: campaign.replied_count || 0,
    interested: Math.round((campaign.replied_count || 0) * 0.5),
    waitingReply: Math.max(0, sentCount - (campaign.replied_count || 0)),
    todayFollowups: 0,
    overdue: 0,
    won: 0,
    lost: 0,
  };

  const healthScore = insightInfo?.healthScore ?? 80;
  const insights = insightInfo?.insights ?? ['Healthy sequence execution'];

  const getScoreColor = (s: number) => {
    if (s >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (s >= 70) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'running': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
      case 'paused': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      case 'completed': return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
      case 'cancelled': return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';
      default: return 'text-zinc-400 border-zinc-700 bg-zinc-800/50';
    }
  };

  const handleDeleteCampaign = (id: string) => {
    if (onDelete) onDelete(id);
    else if (onArchive) onArchive(id);
  };

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/20 overflow-hidden transition-all duration-200 hover:border-white/[0.08]">
      {/* Header Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer select-none gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button 
            type="button" 
            className="p-1 rounded-lg bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2 truncate">
              <span className="truncate">{campaign.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${getStatusBadgeClass(campaign.status)}`}>
                {campaign.status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${getScoreColor(healthScore)}`}>
                Score: {healthScore}%
              </span>
            </h4>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate">
              Template: {campaign.email_templates?.name || 'Custom Subject'} &bull; Created {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs shrink-0">
          {/* Progress Bar (Collapsed Header View) */}
          <div className="hidden md:flex flex-col w-36 lg:w-44">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] text-zinc-400 font-semibold">{sentCount} / {totalLeads} sent</span>
              <span className="text-[10px] text-emerald-400 font-extrabold">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-3 text-zinc-400 font-medium">
            <span><strong className="text-emerald-400">{breakdown.opened}</strong> Opens</span>
            <span><strong className="text-purple-400">{breakdown.replies}</strong> Replies</span>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => router.push('/inbox')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-[11px] font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1"
            >
              <Inbox className="h-3 w-3 text-emerald-400" /> Inbox
            </button>

            {/* Three-dot action menu right next to Inbox */}
            <CampaignQuickActions 
              campaign={campaign}
              onAction={onAction}
              onDelete={handleDeleteCampaign}
            />
          </div>
        </div>
      </div>

      {/* Expanded Details Panel */}
      {expanded && (
        <div className="p-5 border-t border-white/[0.04] bg-zinc-950/40 space-y-5 animate-in fade-in-50 duration-150">
          
          {/* Live Progress Bar Banner */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-zinc-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Campaign Execution Progress</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase ${getStatusBadgeClass(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>
              <span className="text-xs font-black text-emerald-400">
                {sentCount} / {totalLeads} Sent ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Detailed Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Recipients</span>
              <span className="text-base font-black text-white">{breakdown.recipients}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Delivered</span>
              <span className="text-base font-black text-emerald-400">{breakdown.delivered}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Opened</span>
              <span className="text-base font-black text-emerald-300">{breakdown.opened}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Clicked</span>
              <span className="text-base font-black text-blue-400">{breakdown.clicked}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Replies</span>
              <span className="text-base font-black text-purple-400">{breakdown.replies}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Interested</span>
              <span className="text-base font-black text-purple-300">{breakdown.interested}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Waiting Reply</span>
              <span className="text-base font-black text-amber-400">{breakdown.waitingReply}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Today's Follow-ups</span>
              <span className="text-base font-black text-amber-300">{breakdown.todayFollowups}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Overdue</span>
              <span className={`text-base font-black ${breakdown.overdue > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>{breakdown.overdue}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Won</span>
              <span className="text-base font-black text-emerald-400">{breakdown.won}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Lost</span>
              <span className="text-base font-black text-zinc-500">{breakdown.lost}</span>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.04] bg-zinc-900/30 flex items-center justify-center">
              {(onDelete || onArchive) && (
                <button
                  type="button"
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1 transition-all"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
            </div>
          </div>

          {/* AI Insights Bullets */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-1.5">
            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Campaign Insights & Recommendations
            </h5>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
              {insights.map((ins, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/[0.06] text-[11px] font-semibold text-zinc-300">
                  ⚡ {ins}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
