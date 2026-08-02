"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowLeft, Target, RefreshCw, Settings, User, LogOut, CreditCard, Sparkles 
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Intelligence imports
import { useCampaignIntelligence } from "@/hooks/use-campaign-intelligence";
import PipelineHealthCards from "@/components/campaign-intelligence/pipeline-health-cards";
import TodaysTasksWidget from "@/components/campaign-intelligence/todays-tasks-widget";
import FollowupTimeline from "@/components/campaign-intelligence/followup-timeline";
import PipelineFunnel from "@/components/campaign-intelligence/pipeline-funnel";
import UpcomingFollowupsPanel from "@/components/campaign-intelligence/upcoming-followups-panel";
import DashboardAiSummary from "@/components/campaign-intelligence/dashboard-ai-summary";
import NotificationCenter from "@/components/campaign-intelligence/notification-center";

export default function CampaignIntelligencePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const { intelligence, refreshIntelligence, filter, setFilter } = useCampaignIntelligence();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

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

      {/* Main Content */}
      <main className="flex-1 container max-w-[1350px] py-10 mx-auto px-6 md:px-8 space-y-8">
        
        {/* Navigation & Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/campaigns" 
              className="inline-flex items-center text-xs font-bold text-emerald-400 hover:text-emerald-300 mb-2 transition-colors gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-emerald-400" /> Campaign Intelligence
            </h1>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Monitor pipeline health, follow-up tasks, AI recommendations, and funnel conversion.
            </p>
          </div>

          <button 
            onClick={refreshIntelligence}
            className="h-9 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="h-4 w-4 text-emerald-400" /> Refresh Intelligence
          </button>
        </div>

        {/* Campaign Intelligence AI Summary */}
        <DashboardAiSummary aiSummary={intelligence?.aiSummary} />

        {/* Pipeline Health Overview */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
            Pipeline Health & Segment Breakdown
          </h3>
          <PipelineHealthCards 
            data={intelligence?.pipelineHealth} 
            activeFilter={filter}
            onSelectFilter={setFilter}
          />
        </div>

        {/* Detailed Analytics Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <TodaysTasksWidget tasks={intelligence?.todayTasks} />
          <FollowupTimeline data={intelligence?.timeline} />
          <PipelineFunnel data={intelligence?.funnel} />
          <UpcomingFollowupsPanel upcoming={intelligence?.upcomingFollowups} />
        </div>

      </main>
    </div>
  );
}
