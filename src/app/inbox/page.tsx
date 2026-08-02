"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Target, Settings, User, LogOut, CreditCard, Inbox as InboxIcon, ArrowLeft, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InboxSidebar, InboxThreadItem } from './components/inbox-sidebar';
import { ConversationView } from './components/conversation-view';
import { AiAssistantPanel } from './components/ai-assistant-panel';

export default function InboxDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  // Data state
  const [threads, setThreads] = useState<InboxThreadItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    interested: 0,
    not_interested: 0,
    followup_needed: 0,
    closed: 0,
    archive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<InboxThreadItem | null>(null);
  
  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState('unread');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // AI Assistant Panel State
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiSuggestedReply, setAiSuggestedReply] = useState('');

  // Mobile Drilldown state
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const fetchInbox = async (sync = false) => {
    setLoading(true);
    console.log(`[INBOX UI] fetchInbox called — sync: ${sync}`);
    try {
      const url = `/api/inbox?sync=${sync ? 'true' : 'false'}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setThreads(data.messages || []);
        if (data.counts) {
          setCounts(data.counts);
        }

        // Retain current thread selection if possible
        if (selectedThread) {
          const updated = data.messages.find((m: InboxThreadItem) => m.id === selectedThread.id || (m.gmail_thread_id && m.gmail_thread_id === selectedThread.gmail_thread_id));
          if (updated) {
            setSelectedThread(updated);
          }
        }
      } else {
        console.error('[INBOX UI] API error:', data.error);
      }
    } catch (err) {
      console.error('[INBOX UI] Failed to load inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
      }
    });

    fetchInbox();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Live Category Change without refresh
  const handleCategoryChange = async (msgId: string, newCategory: string) => {
    // Optimistic UI update
    setThreads(prev => prev.map(m => m.id === msgId ? { ...m, category: newCategory } : m));
    if (selectedThread?.id === msgId) {
      setSelectedThread(prev => prev ? { ...prev, category: newCategory } : null);
    }

    try {
      const res = await fetch('/api/inbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, category: newCategory }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh counts
        fetchInbox(false);
      }
    } catch (err) {
      console.error('Failed to change category:', err);
    }
  };

  // Live Read/Unread Status Toggle
  const handleMarkReadToggle = async (msgId: string, currentIsRead: boolean) => {
    const nextIsRead = !currentIsRead;
    setThreads(prev => prev.map(m => m.id === msgId ? { ...m, is_read: nextIsRead } : m));
    if (selectedThread?.id === msgId) {
      setSelectedThread(prev => prev ? { ...prev, is_read: nextIsRead } : null);
    }

    try {
      await fetch('/api/inbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, isRead: nextIsRead }),
      });
      fetchInbox(false);
    } catch (err) {
      console.error('Failed to toggle read status:', err);
    }
  };

  // Toggle Starred state
  const handleToggleStar = (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setThreads(prev => prev.map(m => m.id === msgId ? { ...m, starred: !m.starred } : m));
    if (selectedThread?.id === msgId) {
      setSelectedThread(prev => prev ? { ...prev, starred: !prev.starred } : null);
    }
  };

  // Archive handler
  const handleArchive = async (msgId: string) => {
    handleCategoryChange(msgId, 'archive');
  };

  // Delete message handler
  const handleDelete = async (msgId: string) => {
    setThreads(prev => prev.filter(m => m.id !== msgId));
    if (selectedThread?.id === msgId) {
      setSelectedThread(null);
      setMobileView('list');
    }

    try {
      await fetch(`/api/inbox?id=${msgId}`, { method: 'DELETE' });
      fetchInbox(false);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleSelectThread = (thread: InboxThreadItem) => {
    setSelectedThread(thread);
    setMobileView('detail');
    if (!thread.is_read) {
      handleMarkReadToggle(thread.id, false);
    }
  };

  // Filter threads by active tab & search query
  const filteredThreads = threads.filter(thread => {
    // 1. Tab filter
    if (activeTab === 'unread' && thread.is_read) return false;
    if (activeTab !== 'all' && activeTab !== 'unread' && thread.category !== activeTab) return false;

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (thread.crm_leads?.creator_name || '').toLowerCase().includes(q);
      const emailMatch = thread.from_email.toLowerCase().includes(q) || thread.to_email.toLowerCase().includes(q);
      const subjectMatch = thread.subject.toLowerCase().includes(q);
      const snippetMatch = thread.snippet.toLowerCase().includes(q);
      const catMatch = thread.category.toLowerCase().includes(q);

      return nameMatch || emailMatch || subjectMatch || snippetMatch || catMatch;
    }

    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#08080b] text-[#f4f4f5] antialiased">
      
      {/* Top Header Bar */}
      <header className="px-6 h-14 flex items-center justify-between border-b border-white/[0.06] sticky top-0 z-50 bg-[#08080b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-100 hover:text-emerald-400 transition-colors mr-6">
            <Target className="h-5 w-5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase">CTRForge OS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-200 transition-colors">Overview</Link>
            <Link href="/discovery" className="hover:text-zinc-200 transition-colors">Research Workspace</Link>
            <Link href="/thumbnails" className="hover:text-zinc-200 transition-colors">Thumbnail Studio</Link>
            <Link href="/crm" className="hover:text-zinc-200 transition-colors">CRM Pipelines</Link>
            <Link href="/campaigns" className="hover:text-zinc-200 transition-colors">Campaigns</Link>
            <Link href="/templates" className="hover:text-zinc-200 transition-colors">Templates</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings" className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-zinc-900 border border-white/[0.06] text-zinc-300 hover:bg-zinc-800 transition-colors">
            <Settings className="h-3.5 w-3.5 text-zinc-500" />
            Settings
          </Link>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-white/[0.08] flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors font-black text-xs text-zinc-300"
            >
              <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}</span>
            </div>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-56 rounded-xl border border-white/[0.06] bg-zinc-950 p-1.5 shadow-2xl z-50">
                <div className="px-3 py-2 text-xs font-bold text-zinc-400 truncate border-b border-white/[0.04] pb-2 mb-1.5">
                  {userEmail || 'Guest Account'}
                </div>
                <div className="space-y-0.5">
                  <Link href="/profile" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <User className="mr-2 h-4 w-4 text-zinc-500" /> My Profile
                  </Link>
                  <Link href="/billing" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <CreditCard className="mr-2 h-4 w-4 text-zinc-500" /> Billing Details
                  </Link>
                  <Link href="/settings" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <Settings className="mr-2 h-4 w-4 text-zinc-500" /> Settings
                  </Link>
                  <div className="h-px bg-white/[0.04] my-1"></div>
                  <button onClick={handleLogout} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/5 transition-colors">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive CRM 3-Column Split View */}
      <main className="flex-1 flex overflow-hidden h-[calc(100vh-3.5rem)]">
        
        {/* Left Sidebar Pane (Column 1) */}
        <div className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${mobileView === 'detail' ? 'hidden md:block' : 'block'}`}>
          <InboxSidebar
            threads={filteredThreads}
            selectedThreadId={selectedThread?.id || null}
            activeTab={activeTab}
            counts={counts}
            searchQuery={searchQuery}
            loading={loading}
            onSelectThread={handleSelectThread}
            onTabChange={setActiveTab}
            onSearchChange={setSearchQuery}
            onSync={() => fetchInbox(true)}
            onToggleStar={handleToggleStar}
          />
        </div>

        {/* Center Conversation View Pane (Column 2) */}
        <div className={`flex-1 h-full min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-col`}>
          
          {/* Mobile Back Button Bar */}
          <div className="md:hidden p-3 bg-zinc-950 border-b border-white/[0.06] flex items-center">
            <button
              onClick={() => setMobileView('list')}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Threads
            </button>
          </div>

          {selectedThread ? (
            <ConversationView
              threadId={selectedThread.gmail_thread_id || selectedThread.id}
              initialMessage={selectedThread}
              category={selectedThread.category}
              isRead={selectedThread.is_read}
              starred={!!selectedThread.starred}
              onCategoryChange={(cat) => handleCategoryChange(selectedThread.id, cat)}
              onMarkReadToggle={() => handleMarkReadToggle(selectedThread.id, selectedThread.is_read)}
              onStarToggle={() => handleToggleStar(selectedThread.id)}
              onArchive={() => handleArchive(selectedThread.id)}
              onDelete={() => handleDelete(selectedThread.id)}
              onToggleAiPanel={() => setIsAiPanelOpen(!isAiPanelOpen)}
              isAiPanelOpen={isAiPanelOpen}
              aiSuggestedReply={aiSuggestedReply}
              onRefreshSidebar={() => fetchInbox(false)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 bg-[#09090d]">
              <InboxIcon className="h-12 w-12 text-zinc-700 mb-4 animate-bounce" />
              <h3 className="text-sm font-extrabold text-zinc-300 uppercase tracking-wider mb-1">No Conversation Selected</h3>
              <p className="text-xs text-zinc-500 max-w-sm text-center">
                Select a message thread from the left sidebar to view complete email context, timeline history, and reply directly.
              </p>
            </div>
          )}
        </div>

        {/* Right AI Copilot Panel Drawer (Column 3) */}
        {isAiPanelOpen && selectedThread && (
          <div className="shrink-0 h-full hidden lg:block">
            <AiAssistantPanel
              snippet={selectedThread.snippet || selectedThread.body_preview || ''}
              leadName={selectedThread.crm_leads?.creator_name || selectedThread.from_email.split('@')[0]}
              onApplyReply={(text) => {
                setAiSuggestedReply(text);
              }}
              onClose={() => setIsAiPanelOpen(false)}
            />
          </div>
        )}

      </main>
    </div>
  );
}
