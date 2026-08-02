"use client";

import { useState } from 'react';
import { 
  Mail, MailOpen, Star, Archive, Trash2, ExternalLink, Copy, Check, Sparkles, FolderDown, Tag 
} from 'lucide-react';

interface InboxActionsBarProps {
  category: string;
  isRead: boolean;
  starred: boolean;
  senderEmail: string;
  gmailThreadId?: string;
  onCategoryChange: (newCategory: string) => void;
  onMarkReadToggle: () => void;
  onStarToggle: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleAiPanel: () => void;
  isAiPanelOpen: boolean;
}

export function InboxActionsBar({
  category,
  isRead,
  starred,
  senderEmail,
  gmailThreadId,
  onCategoryChange,
  onMarkReadToggle,
  onStarToggle,
  onArchive,
  onDelete,
  onToggleAiPanel,
  isAiPanelOpen,
}: InboxActionsBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    if (!senderEmail) return;
    navigator.clipboard.writeText(senderEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInGmail = () => {
    if (gmailThreadId) {
      window.open(`https://mail.google.com/mail/u/0/#inbox/${gmailThreadId}`, '_blank');
    } else {
      window.open(`https://mail.google.com/mail/u/0/#inbox`, '_blank');
    }
  };

  return (
    <div className="px-6 py-3 border-b border-white/[0.06] bg-[#0f0f14] flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
      
      {/* Category Dropdown Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Tag className="h-3 w-3 text-zinc-500" /> Category
        </span>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer hover:bg-zinc-900"
        >
          <option value="unread">Unread / Open</option>
          <option value="interested">Interested 🔥</option>
          <option value="not_interested">Not Interested 👎</option>
          <option value="followup_needed">Follow-up Needed ⚡</option>
          <option value="closed">Closed 📁</option>
          <option value="archive">Archive 📦</option>
        </select>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex items-center gap-1.5">
        
        {/* Toggle Read/Unread */}
        <button
          onClick={onMarkReadToggle}
          title={isRead ? 'Mark as Unread' : 'Mark as Read'}
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-1 text-xs font-semibold"
        >
          {isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5 text-emerald-400" />}
          <span className="hidden sm:inline">{isRead ? 'Unread' : 'Read'}</span>
        </button>

        {/* Star / Unstar */}
        <button
          onClick={onStarToggle}
          title={starred ? 'Starred' : 'Star message'}
          className={`p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] transition-all flex items-center gap-1 text-xs font-semibold ${
            starred ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${starred ? 'fill-amber-400' : ''}`} />
          <span className="hidden sm:inline">{starred ? 'Starred' : 'Star'}</span>
        </button>

        {/* Copy Email */}
        <button
          onClick={handleCopyEmail}
          title="Copy sender email address"
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-1 text-xs font-semibold"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Email'}</span>
        </button>

        {/* Archive */}
        <button
          onClick={onArchive}
          title="Archive conversation"
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-1 text-xs font-semibold"
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Archive</span>
        </button>

        {/* Open in Gmail */}
        <button
          onClick={openInGmail}
          title="Open thread in Gmail"
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center gap-1 text-xs font-semibold"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Gmail</span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          title="Delete message"
          className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1 text-xs font-semibold ml-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* AI Assistant Toggle Button */}
        <button
          onClick={onToggleAiPanel}
          className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 border shadow-sm ${
            isAiPanelOpen
              ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
              : 'bg-zinc-900 text-emerald-400 border-white/[0.08] hover:bg-zinc-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Assistant</span>
        </button>

      </div>

    </div>
  );
}
