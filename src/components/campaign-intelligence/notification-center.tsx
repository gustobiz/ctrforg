"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { NotificationItem } from '@/hooks/use-campaign-intelligence';

interface Props {
  notifications?: NotificationItem[];
}

export default function NotificationCenter({ notifications }: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const defaultNotifs: NotificationItem[] = [
    { id: '1', message: 'Campaign #832 active and dispatching', timestamp: '5m ago', type: 'info' },
    { id: '2', message: 'Google Warmup Shield active and protecting sender score', timestamp: '1h ago', type: 'success' },
  ];

  const list = notifications && notifications.length > 0 ? notifications : defaultNotifs;
  const unreadCount = list.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
      case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center justify-center relative"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 text-black text-[9px] font-black flex items-center justify-center border border-zinc-950">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-white/[0.08] bg-zinc-950 p-4 shadow-2xl z-50 space-y-3 animate-in fade-in-80 duration-150">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h5 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-emerald-400" /> Notifications
            </h5>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {list.map((n) => (
              <div key={n.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.04] flex items-start gap-2.5 text-xs">
                {getIcon(n.type)}
                <div className="space-y-0.5 flex-1 min-w-0">
                  <p className="font-semibold text-zinc-200 leading-snug">{n.message}</p>
                  <span className="text-[9px] text-zinc-500 font-bold block">{n.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
