"use client";

import { 
  ArrowRight, BarChart3, Mail, Target, PlayCircle, Clock, Zap, Plus, 
  ArrowUpRight, CheckCircle2, Settings, User, LogOut, CreditCard, Layers, Compass
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [hasProAccess, setHasProAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        if (data.subscription && data.subscription.status === 'active') {
          setHasProAccess(true);
        }
        if (data.email) {
          setUserEmail(data.email);
        }
        if (data.email === 'gustobiz01@gmail.com') {
          setIsAdmin(true);
        }
      })
      .catch(console.error);

    // Close dropdown on click outside
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

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header Bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/" className="flex items-center text-zinc-100 hover:text-emerald-400 transition-colors mr-6">
            <Target className="h-5 w-5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-sm uppercase">CTRForge OS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Link href="/dashboard" className="text-zinc-100 font-bold border-b border-white pb-1.5 pt-1">Overview</Link>
            <Link href="/discovery" className="hover:text-zinc-200 transition-colors">Research Workspace</Link>
            <Link href="/thumbnails" className="hover:text-zinc-200 transition-colors">Thumbnail Studio</Link>
            <Link href="/crm" className="hover:text-zinc-200 transition-colors">CRM Pipelines</Link>
            <Link href="/campaigns" className="hover:text-zinc-200 transition-colors">Campaigns</Link>
            <Link href="/templates" className="hover:text-zinc-200 transition-colors">Templates</Link>
            <Link href="/inbox" className="hover:text-zinc-200 transition-colors">Inbox</Link>
            <Link href="/team" className="hover:text-zinc-200 transition-colors text-emerald-400 font-black">Team</Link>
            {isAdmin && <Link href="/admin" className="hover:text-emerald-400 transition-colors text-emerald-500 font-extrabold">Admin</Link>}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/billing" className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-zinc-900 border border-white/[0.04] text-zinc-300 hover:bg-zinc-800 transition-colors">
            {hasProAccess ? (
              <>
                <Zap className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Pro Active</span>
              </>
            ) : (
              <>
                <Zap className="h-3 w-3 text-zinc-500" />
                Upgrade Plan
              </>
            )}
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
                  <div className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 cursor-not-allowed">
                    <Settings className="mr-2 h-4 w-4" /> Global Settings
                  </div>
                  {isAdmin && (
                    <Link href="/admin" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/5 transition-colors">
                      <Zap className="mr-2 h-4 w-4" /> Administrative Panel
                    </Link>
                  )}
                  <div className="h-px bg-white/[0.04] my-1"></div>
                  {userEmail && userEmail !== 'mock@example.com' ? (
                    <button onClick={handleLogout} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/5 transition-colors">
                      <LogOut className="mr-2 h-4 w-4" /> Log out
                    </button>
                  ) : (
                    <>
                      <Link href="/login" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                        Sign In
                      </Link>
                      <Link href="/signup" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                        Create Account
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 container max-w-[1350px] py-12 mx-auto px-6 md:px-8">
        
        {/* Spacious Heading */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">Command Center</h1>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">YouTube packaging intelligence overview.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/discovery" className="h-9 px-4 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-350 hover:text-white text-xs font-bold transition-all flex items-center">
              <Plus className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
              Find creator Leads
            </Link>
            <Link href="/analyze" className="h-9 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center shadow-md">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              New Video Dissection
            </Link>
          </div>
        </div>

        {/* Premium Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[
            { label: "Analyzed Videos", value: "142", trend: "+12%", icon: PlayCircle },
            { label: "Active Pipelines", value: "48", trend: "+5", icon: Target },
            { label: "Outreach Sent", value: "86", trend: "+24%", icon: Mail },
            { label: "Conversion Rate", value: "14.2%", trend: "+2.1%", icon: BarChart3 },
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl relative overflow-hidden group smooth-transition hover:border-white/[0.08]">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <stat.icon className="h-4.5 w-4.5 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-zinc-200 tracking-tight">{stat.value}</h3>
                <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{stat.trend}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Main activity list (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Pipelines overview */}
            <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center">
                  <Target className="h-4.5 w-4.5 mr-2 text-zinc-500" />
                  Recent Pipeline Activity
                </h3>
                <Link href="/crm" className="text-[10px] font-extrabold uppercase text-zinc-500 hover:text-white flex items-center transition-colors">
                  Open CRM <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {[
                  { name: "Ali Abdaal", niche: "Productivity", status: "Replied", date: "2h ago", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
                  { name: "MKBHD", niche: "Tech Reviews", status: "Sent", date: "5h ago", color: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
                  { name: "MrWhoseTheBoss", niche: "Smartphone Audits", status: "Analyzing", date: "1d ago", color: "text-blue-400 border-blue-500/20 bg-blue-500/10" },
                  { name: "Iman Gadzhi", niche: "Business Agency", status: "Sent", date: "2d ago", color: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/[0.06] flex items-center justify-center font-bold text-xs">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-zinc-200">{item.name}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">{item.niche}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${item.color}`}>
                        {item.status}
                      </span>
                      <span className="text-[10px] text-zinc-550 flex items-center">
                        <Clock className="h-3 w-3 mr-1" /> {item.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Redesigned Conceptual Thumbnail Vault */}
            <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center">
                  <Layers className="h-4.5 w-4.5 mr-2 text-zinc-500" />
                  Recent Conceptual Thumbnails
                </h3>
                <Link href="/thumbnails" className="text-[10px] font-extrabold uppercase text-zinc-500 hover:text-white flex items-center transition-colors">
                  Open Studio <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { title: "Peak Exhaustion Split", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop" },
                  { title: "Cyber Setup Audit", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop" },
                  { title: "Golden Silhouette Concept", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=300&auto=format&fit=crop" }
                ].map((item, idx) => (
                  <Link href="/thumbnails" key={idx} className="group relative rounded-xl overflow-hidden border border-white/[0.04] bg-zinc-950 cursor-pointer block smooth-transition hover:border-white/[0.08]">
                    <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                      <img 
                        src={item.img} 
                        alt={item.title} 
                        className="w-full h-full object-cover opacity-60 group-hover:scale-103 group-hover:opacity-90 transition-all duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors" />
                    </div>
                    <div className="p-3 bg-zinc-950/60 border-t border-white/[0.02]">
                      <p className="text-[10px] font-bold text-zinc-300 truncate">{item.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* Quick actions sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Actions List */}
            <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-550 border-b border-white/[0.04] pb-2">Quick Navigation</h3>
              
              <div className="space-y-2">
                <Link href="/discovery" className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 transition-all group">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">Discover Competitors</span>
                  <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                </Link>
                <Link href="/inspiration" className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 transition-all group">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">Inspiration Lab</span>
                  <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                </Link>
                <Link href="/analyze" className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 transition-all group">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">Analyze Video URL</span>
                  <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                </Link>
                <Link href="/outreach" className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 transition-all group">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">Generate Outreach pitch</span>
                  <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                </Link>
              </div>
            </div>

            {/* Dynamic Update Alert */}
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.02] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 text-emerald-500/5">
                <Target className="h-32 w-32" />
              </div>
              
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-emerald-400 mb-2 relative">Intelligence Update</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5 relative">Our algorithms detected 12 new creators in the technology review space currently running suboptimal thumbnail contrast packaging structures.</p>
              
              <Link href="/discovery" className="inline-flex h-8.5 items-center justify-center rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all px-4 relative active:scale-[0.98]">
                Audit Matches
              </Link>
            </div>

          </div>
        </div>
      </main>

      {/* Fallback Clean Debug Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.04] p-2 text-[9px] font-mono flex items-center justify-between z-50 px-6">
        <div className="flex gap-4 items-center">
          <span className="text-zinc-500 font-bold uppercase tracking-wider">Hydration Auth:</span>
          <span className="text-emerald-400">{userEmail || 'Sandbox hydrated user'}</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-zinc-500 font-bold uppercase tracking-wider">Active Tier:</span>
          <span className={isAdmin ? 'text-amber-400 font-black' : 'text-zinc-300'}>{isAdmin ? 'DEVELOPER ADMIN' : (hasProAccess ? 'PRO USER' : 'TIER ZERO FREE')}</span>
        </div>
      </div>
    </div>
  );
}
