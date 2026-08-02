"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, Inbox, Users, MessageSquare, PauseCircle, 
  Play, Copy, Trash2, ExternalLink 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  campaign: any;
  onAction?: (id: string, action: string) => void;
  onDelete?: (id: string) => void;
}

export default function CampaignQuickActions({ campaign, onAction, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteClick = () => {
    setOpen(false);
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"? This action cannot be undone.`)) {
      onDelete?.(campaign.id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-zinc-400 hover:text-white transition-all flex items-center justify-center"
        title="Campaign Actions"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-white/[0.08] bg-zinc-950 p-1 shadow-2xl z-50 animate-in fade-in-80 duration-150 space-y-0.5">
          {/* ▶ Run / Resume Campaign */}
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button
              type="button"
              onClick={() => { setOpen(false); onAction?.(campaign.id, campaign.status === 'draft' ? 'start' : 'resume'); }}
              className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Play className="mr-2 h-3.5 w-3.5 fill-emerald-400" /> ▶ Run Campaign
            </button>
          )}

          {/* ⏸ Pause Campaign */}
          {campaign.status === 'running' && (
            <button
              type="button"
              onClick={() => { setOpen(false); onAction?.(campaign.id, 'pause'); }}
              className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <PauseCircle className="mr-2 h-3.5 w-3.5" /> ⏸ Pause Campaign
            </button>
          )}

          <div className="h-px bg-white/[0.04] my-1" />

          <button
            type="button"
            onClick={() => { setOpen(false); router.push('/inbox'); }}
            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <Inbox className="mr-2 h-3.5 w-3.5 text-emerald-400" /> View Inbox
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); router.push('/crm'); }}
            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <Users className="mr-2 h-3.5 w-3.5 text-blue-400" /> View CRM
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); onAction?.(campaign.id, 'duplicate'); }}
            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <Copy className="mr-2 h-3.5 w-3.5 text-zinc-500" /> Duplicate
          </button>

          <div className="h-px bg-white/[0.04] my-1" />

          {/* 🗑 Delete Campaign */}
          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5 text-rose-500" /> 🗑 Delete Campaign
          </button>
        </div>
      )}
    </div>
  );
}
