"use client";

import { useState } from 'react';
import { Search, Inbox, Star, RefreshCw, MessageSquare, Check, Sparkles, Filter } from 'lucide-react';

export interface InboxThreadItem {
  id: string;
  user_id: string;
  campaign_id?: string;
  lead_id?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  from_email: string;
  to_email: string;
  subject: string;
  snippet: string;
  body_preview: string;
  is_read: boolean;
  is_inbound: boolean;
  category: 'unread' | 'interested' | 'not_interested' | 'followup_needed' | 'closed' | 'archive' | string;
  received_at: string;
  thread_message_count?: number;
  starred?: boolean;
  crm_leads?: {
    creator_name: string;
    channel_name: string;
  } | null;
}

interface InboxSidebarProps {
  threads: InboxThreadItem[];
  selectedThreadId: string | null;
  activeTab: string;
  counts: {
    all: number;
    unread: number;
    interested: number;
    not_interested: number;
    followup_needed: number;
    closed: number;
    archive: number;
  };
  searchQuery: string;
  loading: boolean;
  onSelectThread: (thread: InboxThreadItem) => void;
  onTabChange: (tabId: string) => void;
  onSearchChange: (query: string) => void;
  onSync: () => void;
  onToggleStar: (threadId: string, e: React.MouseEvent) => void;
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'interested', label: 'Interested', emoji: '🔥' },
  { id: 'not_interested', label: 'Not Interested', emoji: '👎' },
  { id: 'followup_needed', label: 'Follow-up', emoji: '⚡' },
  { id: 'closed', label: 'Closed', emoji: '📁' },
  { id: 'archive', label: 'Archive', emoji: '📦' },
];

export function InboxSidebar({
  threads,
  selectedThreadId,
  activeTab,
  counts,
  searchQuery,
  loading,
  onSelectThread,
  onTabChange,
  onSearchChange,
  onSync,
  onToggleStar,
}: InboxSidebarProps) {
  // Helper to format timestamps nicely
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const isThisYear = date.getFullYear() === now.getFullYear();
      if (isThisYear) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Helper for category badges
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'interested':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Interested 🔥</span>;
      case 'not_interested':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">Not Interested 👎</span>;
      case 'followup_needed':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">Follow-up ⚡</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wider">Closed</span>;
      case 'archive':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">Archive</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">Unread</span>;
    }
  };

  // Helper for avatar initials
  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return 'U';
    const parts = nameOrEmail.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameOrEmail.substring(0, 2).toUpperCase();
  };

  // Deterministic avatar gradient
  const getAvatarGradient = (str: string) => {
    const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'from-emerald-600 to-teal-800',
      'from-indigo-600 to-purple-800',
      'from-amber-600 to-orange-800',
      'from-sky-600 to-blue-800',
      'from-rose-600 to-pink-800',
    ];
    return colors[hash % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d11] border-r border-white/[0.06] select-none">
      
      {/* Top Search & Refresh Bar */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-black text-zinc-100 uppercase tracking-wider">Inbox Threads</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-900 text-zinc-400 font-bold border border-white/[0.04]">
              {threads.length}
            </span>
          </div>

          <button
            onClick={onSync}
            disabled={loading}
            title="Sync Gmail Replies"
            className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] text-emerald-400 hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sender, subject, content..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950/80 border border-white/[0.08] rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs Horizontal Scroll */}
      <div className="px-3 py-2 border-b border-white/[0.04] bg-zinc-950/40 overflow-x-auto flex gap-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id as keyof typeof counts] ?? 0;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.emoji && <span className="text-[10px]">{tab.emoji}</span>}
              {count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                  isActive ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
        {loading && threads.length === 0 ? (
          // Loading skeletons
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="animate-pulse space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-3 w-24 bg-zinc-800 rounded"></div>
                  <div className="h-2 w-12 bg-zinc-800 rounded"></div>
                </div>
                <div className="h-3 w-40 bg-zinc-800/60 rounded"></div>
                <div className="h-2 w-full bg-zinc-800/40 rounded"></div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
            <Inbox className="h-8 w-8 text-zinc-700 mb-3" />
            <p className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">No replies found</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px]">
              {searchQuery ? 'No results match your search query.' : 'Replies will automatically appear here when prospects respond.'}
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const isSelected = selectedThreadId === thread.id || (thread.gmail_thread_id && selectedThreadId === thread.gmail_thread_id);
            const displayName = thread.crm_leads?.creator_name || thread.from_email.split('@')[0];
            const initials = getInitials(displayName);
            const timeStr = formatTime(thread.received_at);

            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={`p-3.5 cursor-pointer transition-all relative group flex gap-3 items-start ${
                  isSelected
                    ? 'bg-zinc-800/40 border-l-2 border-emerald-400 shadow-inner'
                    : 'hover:bg-white/[0.02] border-l-2 border-transparent'
                } ${!thread.is_read ? 'bg-emerald-950/10' : ''}`}
              >
                {/* Avatar */}
                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${getAvatarGradient(displayName)} flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md border border-white/10 mt-0.5`}>
                  {initials}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`text-xs font-bold truncate ${!thread.is_read ? 'text-zinc-100 font-extrabold' : 'text-zinc-300'}`}>
                      {displayName}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-medium shrink-0 ml-2">
                      {timeStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <h4 className="text-[11px] font-bold text-zinc-300 truncate flex-1">
                      {thread.subject || '(No Subject)'}
                    </h4>
                    {thread.thread_message_count && thread.thread_message_count > 1 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 shrink-0">
                        {thread.thread_message_count}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">
                    {thread.snippet || thread.body_preview || ''}
                  </p>

                  {/* Badges & Actions footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {getCategoryBadge(thread.category)}
                      {!thread.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      )}
                    </div>

                    <button
                      onClick={(e) => onToggleStar(thread.id, e)}
                      title={thread.starred ? 'Starred' : 'Star message'}
                      className={`p-1 rounded hover:bg-zinc-800 transition-colors ${
                        thread.starred ? 'text-amber-400' : 'text-zinc-600 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
