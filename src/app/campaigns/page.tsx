"use client";

import { 
  ArrowRight, BarChart3, Mail, Target, PlayCircle, Clock, Zap, Plus, 
  ArrowUpRight, CheckCircle2, Settings, User, LogOut, CreditCard, 
  PauseCircle, Play, XCircle, Copy as CopyIcon, Archive, RefreshCw, MoreVertical,
  Layers, MessageSquare, AlertCircle, Percent, ExternalLink, Tag, Sparkles, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import WarmupWidget from "@/components/warmup-widget";

// Campaign Intelligence Imports
import { useCampaignIntelligence } from "@/hooks/use-campaign-intelligence";
import CampaignHealthRow from "@/components/campaign-intelligence/campaign-health-row";
import CampaignFiltersBar from "@/components/campaign-intelligence/campaign-filters-bar";
import NotificationCenter from "@/components/campaign-intelligence/notification-center";

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  send_rate: number;
  total_leads: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  gmail_label_id?: string;
  gmail_label_name?: string;
  email_templates?: {
    name: string;
    subject: string;
  };
}

export default function CampaignsDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Campaign Intelligence Hook
  const { intelligence, refreshIntelligence, filter, setFilter } = useCampaignIntelligence();

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
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

    fetchCampaigns();

    // Close dropdowns on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // Background polling to execute sending queue, follow-ups, and reply syncing in real-time
    const processInterval = setInterval(async () => {
      try {
        await fetch('/api/campaigns/process-all', { method: 'POST' });
        // Refresh campaign metrics in real-time
        fetchCampaigns();
        refreshIntelligence();
      } catch (err) {
        console.warn('Failed background process-all fetch:', err);
      }
    }, 15000);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearInterval(processInterval);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleAction = async (campaignId: string, action: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCampaigns();
        refreshIntelligence();
      } else {
        alert(data.error || `Failed to ${action} campaign`);
      }
    } catch (err) {
      console.error(`Error executing action ${action}:`, err);
    } finally {
      setActionMenuOpen(null);
    }
  };

  const handleExecuteBatch = async (campaignId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`Batch execution finished! Sent: ${data.sent}, Remaining: ${data.remaining}`);
        fetchCampaigns();
        refreshIntelligence();
      } else {
        alert(data.error || 'Failed to execute next batch');
      }
    } catch (err) {
      console.error('Error executing batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        refreshIntelligence();
      } else {
        alert(data.error || 'Failed to delete campaign');
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
    } finally {
      setActionMenuOpen(null);
    }
  };

  // Compute aggregate stats
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + (c.opened_count || 0), 0);
  const totalClicked = campaigns.reduce((acc, c) => acc + (c.clicked_count || 0), 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + (c.replied_count || 0), 0);
  const totalBounced = campaigns.reduce((acc, c) => acc + (c.bounced_count || 0), 0);

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
  const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';
  const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0';

  const getStatusBadgeClass = (status: Campaign['status']) => {
    switch (status) {
      case 'running': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
      case 'paused': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      case 'completed': return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
      case 'cancelled': return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';
      default: return 'text-zinc-400 border-zinc-700 bg-zinc-800/50';
    }
  };

  // Filter campaigns based on selected filter tab
  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'running') return c.status === 'running';
    if (filter === 'paused') return c.status === 'paused';
    if (filter === 'completed') return c.status === 'completed';
    if (filter === 'needs_followup') return c.replied_count > 0 || (c.sent_count > 0 && c.replied_count === 0);
    if (filter === 'high_performing') return (c.opened_count / Math.max(1, c.sent_count)) >= 0.3;
    if (filter === 'low_performing') return (c.opened_count / Math.max(1, c.sent_count)) < 0.3 && c.sent_count > 0;
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header Bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-100 hover:text-emerald-400 transition-colors mr-6">
            <Target className="h-5 w-5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-sm uppercase">CTRForge OS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-200 transition-colors">Overview</Link>
            <Link href="/discovery" className="hover:text-zinc-200 transition-colors">Research Workspace</Link>
            <Link href="/thumbnails" className="hover:text-zinc-200 transition-colors">Thumbnail Studio</Link>
            <Link href="/crm" className="hover:text-zinc-200 transition-colors">CRM Pipelines</Link>
            <Link href="/campaigns" className="text-zinc-100 font-bold border-b border-white pb-1.5 pt-1">Campaigns</Link>
            <Link href="/templates" className="hover:text-zinc-200 transition-colors">Templates</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <NotificationCenter notifications={intelligence?.notifications} />

          <Link href="/settings" className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-zinc-900 border border-white/[0.04] text-zinc-300 hover:bg-zinc-800 transition-colors">
            <Settings className="h-3.5 w-3.5 text-zinc-500" />
            Settings
          </Link>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors font-black text-xs text-zinc-300"
            >
              <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}</span>
            </div>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-56 rounded-xl border border-white/[0.06] bg-zinc-950 p-1.5 shadow-2xl animate-in fade-in-80 duration-150 z-50">
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
                    <LogOut className="mr-2 h-4 w-4 animate-pulse" /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container max-w-[1350px] py-10 mx-auto px-6 md:px-8">
        
        {/* Title Heading */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              Campaign Hub
            </h1>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Design, launch, and monitor your email sequences.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => { fetchCampaigns(); refreshIntelligence(); }} 
              className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center justify-center"
              title="Refresh All Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/campaigns/new" className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center shadow-md shadow-emerald-500/10">
              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" />
              New Outreach Campaign
            </Link>
          </div>
        </div>

        {/* Aggregate Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Sent Emails", value: totalSent, sub: "All time sends", icon: Mail, color: "text-zinc-400" },
            { label: "Open Rate", value: `${openRate}%`, sub: `${totalOpened} opens`, icon: Percent, color: "text-emerald-400" },
            { label: "Click Rate", value: `${clickRate}%`, sub: `${totalClicked} clicks`, icon: Percent, color: "text-blue-400" },
            { label: "Reply Rate", value: `${replyRate}%`, sub: `${totalReplied} replies`, icon: MessageSquare, color: "text-purple-400" },
            { label: "Bounce Rate", value: `${bounceRate}%`, sub: `${totalBounced} bounces`, icon: AlertCircle, color: "text-rose-400" },
            { label: "Active Campaigns", value: campaigns.filter(c => c.status === 'running').length, sub: "Active sending", icon: PlayCircle, color: "text-emerald-500" },
          ].map((stat, i) => (
            <div key={i} className="p-5 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-xl relative overflow-hidden group hover:border-white/[0.08] smooth-transition">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <h3 className="text-2xl font-black text-zinc-200 tracking-tight">{stat.value}</h3>
              <p className="text-[9px] text-zinc-500 font-medium mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Primary Layout Split Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Left Column (8/12): Campaign Pipeline Card with Sticky Filters & Internal Scroll Area */}
          <div className="lg:col-span-8 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl space-y-4 relative">
            
            {/* Sticky Card Header */}
            <div className="sticky top-0 bg-[#09090b]/95 backdrop-blur z-20 pb-3 pt-1 border-b border-white/[0.04]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center">
                  <Layers className="h-4.5 w-4.5 mr-2 text-emerald-400" />
                  Campaign Pipeline
                </h3>
                <span className="text-[10px] bg-zinc-900 border border-white/[0.06] text-zinc-400 font-bold px-2.5 py-1 rounded-full uppercase self-start sm:self-auto">
                  Showing {filteredCampaigns.length} of {campaigns.length} Campaigns
                </span>
              </div>

              {/* Sticky Filter Tabs */}
              <CampaignFiltersBar 
                activeFilter={filter} 
                onFilterChange={setFilter} 
              />
            </div>

            {/* Internal Scroll Area for Campaigns */}
            <div className="max-h-[580px] overflow-y-auto space-y-3 pr-1.5 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]">
              {loading && campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                  <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                  <p className="text-sm font-semibold uppercase tracking-wider">Loading campaigns...</p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.04] rounded-2xl bg-zinc-950/20">
                  <Mail className="h-10 w-10 text-zinc-600 mb-4" />
                  <h4 className="text-zinc-300 font-bold text-sm mb-1 uppercase tracking-wider">No Matching Campaigns</h4>
                  <p className="text-zinc-500 text-xs mb-6">No campaigns found for the selected filter criteria.</p>
                  <button 
                    onClick={() => setFilter('all')}
                    className="h-8 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold uppercase transition-all border border-white/[0.06]"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                filteredCampaigns.map((c) => (
                  <CampaignHealthRow 
                    key={c.id} 
                    campaign={c} 
                    insightInfo={intelligence?.campaignInsightsMap?.[c.id]}
                    onAction={handleAction}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>

          </div>

          {/* Right Column (4/12): Email Warmup Shield Card & Campaign Intelligence Collapsed Card */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Email Warmup Shield */}
            <WarmupWidget />

            {/* Collapsed Campaign Intelligence Card (Directly below Warmup Shield) */}
            <div className="p-6 rounded-3xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-zinc-100">Campaign Intelligence</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Monitor pipeline health, follow-ups, AI insights, and campaign performance.
              </p>
              <div>
                <Link
                  href="/campaigns/intelligence"
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-bold text-zinc-200 hover:text-white transition-all inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  View Intelligence Dashboard <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}


