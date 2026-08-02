"use client";

import { useEffect, useRef, useState } from 'react';
import { InboxActionsBar } from './inbox-actions-bar';
import { ReplyComposer } from './reply-composer';
import { User, Mail, Calendar, ArrowDown, ChevronDown, ChevronUp, Sparkles, Building, UserCheck } from 'lucide-react';

export interface TimelineMessage {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body_html: string;
  body_preview: string;
  is_inbound: boolean;
  received_at: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  category?: string;
}

interface ConversationViewProps {
  threadId: string;
  initialMessage: any;
  category: string;
  isRead: boolean;
  starred: boolean;
  onCategoryChange: (newCategory: string) => void;
  onMarkReadToggle: () => void;
  onStarToggle: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleAiPanel: () => void;
  isAiPanelOpen: boolean;
  aiSuggestedReply?: string;
  onRefreshSidebar: () => void;
}

export function ConversationView({
  threadId,
  initialMessage,
  category,
  isRead,
  starred,
  onCategoryChange,
  onMarkReadToggle,
  onStarToggle,
  onArchive,
  onDelete,
  onToggleAiPanel,
  isAiPanelOpen,
  aiSuggestedReply,
  onRefreshSidebar,
}: ConversationViewProps) {
  const [timeline, setTimeline] = useState<TimelineMessage[]>([]);
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThreadTimeline = async () => {
    setLoading(true);
    try {
      const param = initialMessage?.gmail_thread_id 
        ? `threadId=${initialMessage.gmail_thread_id}` 
        : `messageId=${initialMessage?.id}`;
      
      const res = await fetch(`/api/inbox/thread?${param}`);
      const data = await res.json();
      
      if (data.success && data.timeline) {
        setTimeline(data.timeline);
        setLeadInfo(data.leadInfo);
      } else {
        // Fallback to single initial message if thread API returns empty
        setTimeline([{
          id: initialMessage.id,
          from_email: initialMessage.from_email,
          to_email: initialMessage.to_email,
          subject: initialMessage.subject,
          body_html: initialMessage.body_preview || initialMessage.snippet,
          body_preview: initialMessage.snippet,
          is_inbound: initialMessage.is_inbound !== false,
          received_at: initialMessage.received_at,
          gmail_message_id: initialMessage.gmail_message_id,
          gmail_thread_id: initialMessage.gmail_thread_id,
        }]);
      }
    } catch (err) {
      console.error('Failed to fetch thread timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreadTimeline();
  }, [threadId, initialMessage?.id]);

  // Auto scroll to bottom when timeline updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  const senderName = initialMessage.crm_leads?.creator_name || leadInfo?.creator_name || initialMessage.from_email.split('@')[0];
  const senderEmail = initialMessage.from_email;
  const subject = initialMessage.subject || '(No Subject)';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0e] overflow-hidden">
      
      {/* Top Actions Header Bar */}
      <InboxActionsBar
        category={category}
        isRead={isRead}
        starred={starred}
        senderEmail={senderEmail}
        gmailThreadId={initialMessage.gmail_thread_id}
        onCategoryChange={onCategoryChange}
        onMarkReadToggle={onMarkReadToggle}
        onStarToggle={onStarToggle}
        onArchive={onArchive}
        onDelete={onDelete}
        onToggleAiPanel={onToggleAiPanel}
        isAiPanelOpen={isAiPanelOpen}
      />

      {/* Main Subject & Lead Info Header */}
      <div className="px-6 py-4 border-b border-white/[0.04] bg-[#0c0c11] flex justify-between items-center gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-zinc-100 truncate">{subject}</h2>
            {leadInfo && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> CRM Lead
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
            <span>From: <strong className="text-zinc-200">{senderName}</strong> (&lt;{senderEmail}&gt;)</span>
            {leadInfo?.channel_name && (
              <span className="text-zinc-500">• Channel: <strong className="text-zinc-300">{leadInfo.channel_name}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-zinc-900/60 rounded-2xl border border-white/[0.04]"></div>
            <div className="h-32 bg-zinc-900/60 rounded-2xl border border-white/[0.04] ml-12"></div>
          </div>
        ) : (
          timeline.map((msg, index) => {
            const isInbound = msg.is_inbound;
            const msgDate = new Date(msg.received_at);
            const dateStr = msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = msgDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id || index}
                className={`flex gap-4 items-start ${isInbound ? '' : 'flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md border border-white/10 ${
                  isInbound ? 'bg-gradient-to-br from-indigo-600 to-purple-800' : 'bg-gradient-to-br from-emerald-600 to-teal-800'
                }`}>
                  {isInbound ? senderName.substring(0, 2).toUpperCase() : 'YOU'}
                </div>

                {/* Message Box Card */}
                <div className={`flex-1 max-w-[85%] rounded-2xl p-5 border shadow-xl transition-all ${
                  isInbound 
                    ? 'bg-zinc-900/70 border-white/[0.06] text-zinc-200' 
                    : 'bg-emerald-950/20 border-emerald-500/20 text-zinc-100'
                }`}>
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-baseline border-b border-white/[0.04] pb-3 mb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-100">
                          {isInbound ? senderName : 'You'}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                          isInbound ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isInbound ? 'Received' : 'Sent'}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        To: {msg.to_email}
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 font-medium">
                      {dateStr} at {timeStr}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="text-xs font-sans leading-relaxed text-zinc-200 whitespace-pre-wrap">
                    {msg.body_html || msg.body_preview}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Composer at Bottom */}
      <ReplyComposer
        toEmail={senderEmail}
        subject={subject}
        threadId={initialMessage.gmail_thread_id}
        parentMessageId={initialMessage.gmail_message_id}
        campaignId={initialMessage.campaign_id}
        leadId={initialMessage.lead_id}
        onSendSuccess={() => {
          fetchThreadTimeline();
          onRefreshSidebar();
        }}
        aiSuggestedReply={aiSuggestedReply}
      />

    </div>
  );
}
