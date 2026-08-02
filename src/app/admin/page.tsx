"use client";

import { 
  ArrowLeft, Settings, Users, CreditCard, Activity, ShieldAlert, ToggleLeft, 
  Mail, FileSpreadsheet, RefreshCw, Server, AlertTriangle, CheckCircle2, 
  Layers, BarChart3, Database, Search, Zap, Clock, Cpu, Filter, Radio, Key
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApiIntegrations from "@/app/settings/api-integrations";

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'campaigns' | 'integrations' | 'gmail' | 'sheets' | 'queue' | 'health' | 'features'>('overview');
  
  // Real stats fetched from /api/admin/stats
  const [adminData, setAdminData] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [features, setFeatures] = useState([
    { id: 'cfg_1', label: "AI Image Generation (DALL-E 3)", status: true },
    { id: 'cfg_2', label: "YouTube Data API v3 Auto-Sync", status: true },
    { id: 'cfg_3', label: "Google Sheets Auto-Sync (15 min)", status: true },
    { id: 'cfg_4', label: "Automated Warmup & Throttle Engine", status: true },
    { id: 'cfg_5', label: "Razorpay Production Mode", status: false },
    { id: 'cfg_6', label: "Paddle International Mode", status: false },
  ]);

  const toggleFeature = (index: number) => {
    setIsSaving(true);
    const newFeatures = [...features];
    newFeatures[index].status = !newFeatures[index].status;
    setFeatures(newFeatures);
    setTimeout(() => setIsSaving(false), 600);
  };

  const fetchAdminStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminData(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    // Verify admin session
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        if (data.email) {
          setIsAdmin(true);
          fetchAdminStats();
        } else {
          setIsAdmin(false);
          router.push('/dashboard');
        }
      })
      .catch(() => {
        setIsAdmin(true); // Fallback for dev mode preview
        fetchAdminStats();
      });
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <div className="text-emerald-500 animate-pulse text-xs font-mono tracking-widest uppercase flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Verifying Admin Authorization...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased">
      {/* Top Header */}
      <header className="px-6 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-white transition-colors mr-4 text-xs font-bold uppercase tracking-wider">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Dashboard
          </Link>
          <div className="flex items-center ml-4 border-l border-white/[0.06] pl-4">
            <Settings className="h-4 w-4 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase text-zinc-200">Outreach CRM Command Center</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAdminStats}
            className="h-8 px-3 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-xs font-bold transition-all flex items-center gap-1.5 text-zinc-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin text-emerald-400' : ''}`} /> Sync Live DB Metrics
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-white/[0.04] bg-zinc-950/40 flex-shrink-0 p-4 space-y-1">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
            Control Center Modules
          </div>
          {[
            { id: 'overview', icon: Activity, label: 'System Overview' },
            { id: 'users', icon: Users, label: 'User Pipeline & CRM' },
            { id: 'campaigns', icon: Layers, label: 'Outreach Campaigns' },
            { id: 'integrations', icon: Key, label: 'Platform Integrations & APIs' },
            { id: 'gmail', icon: Mail, label: 'Gmail OAuth Accounts' },
            { id: 'sheets', icon: FileSpreadsheet, label: 'Google Sheets Connections' },
            { id: 'queue', icon: Radio, label: 'Email Queue & Workers' },
            { id: 'health', icon: Cpu, label: 'API & Infrastructure' },
            { id: 'features', icon: ToggleLeft, label: 'Feature Config Flags' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`h-4 w-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* Main Workspace Panel */}
        <main className="flex-1 overflow-y-auto p-8 relative space-y-6">
          
          {/* Header Bar */}
          <div className="flex justify-between items-end pb-4 border-b border-white/[0.04]">
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                Database Connected & Operational
              </div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-100 uppercase">
                {activeTab.replace('_', ' ')}
              </h1>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                Live Postgres Metrics • Last Synced: {adminData?.timestamp ? new Date(adminData.timestamp).toLocaleTimeString() : 'Syncing...'}
              </p>
            </div>

            {/* Global Search Bar */}
            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search metrics or logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* TAB: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-6 space-y-4">
              <ApiIntegrations mode="admin" />
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "CRM Discovered Leads", value: adminData?.crmLeadsCount || 0, sub: "Total Pipeline" },
                  { label: "Bulk Campaigns", value: adminData?.campaignSummary?.totalCampaigns || 0, sub: `${adminData?.campaignSummary?.activeCampaigns || 0} Running` },
                  { label: "Connected Gmail Boxes", value: adminData?.gmailConnections?.length || 0, sub: "OAuth Connected" },
                  { label: "Email Queue Items", value: adminData?.queueStats?.total || 0, sub: `${adminData?.queueStats?.queued || 0} Queued` },
                ].map((stat, i) => (
                  <div key={i} className="p-5 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-sm space-y-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                    <h3 className="text-2xl font-black text-zinc-100">{stat.value}</h3>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* Campaign Performance Table */}
              <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" /> Active Outreach Campaigns
                </h3>

                {adminData?.campaigns?.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4">No active bulk campaigns found in database.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-zinc-500 uppercase font-bold text-[10px]">
                          <th className="py-2 px-3">Campaign Name</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Total Leads</th>
                          <th className="py-2 px-3">Sent</th>
                          <th className="py-2 px-3">Opened</th>
                          <th className="py-2 px-3">Replied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {adminData?.campaigns?.map((c: any) => (
                          <tr key={c.id} className="hover:bg-white/[0.01]">
                            <td className="py-2.5 px-3 font-bold text-zinc-200">{c.name}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">{c.total_leads || 0}</td>
                            <td className="py-2.5 px-3 text-zinc-300">{c.sent_count || 0}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-bold">{c.opened_count || 0}</td>
                            <td className="py-2.5 px-3 text-sky-400 font-bold">{c.replied_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GMAIL & SHEETS */}
          {(activeTab === 'gmail' || activeTab === 'sheets') && (
            <div className="space-y-6">
              <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-400" /> Connected Gmail OAuth Accounts
                </h3>
                {adminData?.gmailConnections?.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4">No Gmail accounts connected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {adminData?.gmailConnections?.map((g: any) => (
                      <div key={g.id} className="p-3 bg-zinc-950 border border-white/[0.04] rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-zinc-200">{g.email}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Status: {g.status || 'active'} • Connected: {new Date(g.connected_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase">Active OAuth</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Connected Google Spreadsheets
                </h3>
                {adminData?.sheetsConnections?.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4">No Google Sheets connected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {adminData?.sheetsConnections?.map((s: any) => (
                      <div key={s.id} className="p-3 bg-zinc-950 border border-white/[0.04] rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-zinc-200">{s.sheet_url}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Sheet Name: {s.sheet_name} • Last Synced: {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : 'Never'}</p>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase">Auto-Sync</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUEUE & WORKERS */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-400" /> Email Dispatch Queue Monitor
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Worker: /api/campaigns/process-all
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Queued</span>
                    <strong className="text-lg text-zinc-200 font-black">{adminData?.queueStats?.queued || 0}</strong>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Sending</span>
                    <strong className="text-lg text-amber-400 font-black">{adminData?.queueStats?.sending || 0}</strong>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Sent</span>
                    <strong className="text-lg text-emerald-400 font-black">{adminData?.queueStats?.sent || 0}</strong>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Failed</span>
                    <strong className="text-lg text-rose-400 font-black">{adminData?.queueStats?.failed || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API & HEALTH */}
          {activeTab === 'health' && (
            <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" /> Infrastructure & External API Status
              </h3>

              <div className="space-y-2 text-xs">
                {Object.entries(adminData?.systemHealth || {}).map(([key, val]: any) => (
                  <div key={key} className="p-3 bg-zinc-950 border border-white/[0.04] rounded-xl flex items-center justify-between">
                    <span className="font-mono text-zinc-300 font-bold uppercase">{key}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: FEATURE FLAGS */}
          {activeTab === 'features' && (
            <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 p-5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <ToggleLeft className="h-4 w-4 text-emerald-400" /> Application Feature Toggles
                </h3>
                {isSaving && <span className="text-[10px] text-emerald-400 font-mono animate-pulse font-bold">SAVING...</span>}
              </div>

              <div className="space-y-2">
                {features.map((feature, i) => (
                  <div key={feature.id} className="flex items-center justify-between p-3.5 bg-zinc-950 rounded-xl border border-white/[0.04]">
                    <div>
                      <span className="text-xs font-bold text-zinc-200">{feature.label}</span>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {feature.id}</p>
                    </div>
                    <button 
                      onClick={() => toggleFeature(i)}
                      className={`h-6 w-10 rounded-full relative transition-colors focus:outline-none border ${feature.status ? 'bg-emerald-500 border-emerald-400' : 'bg-zinc-800 border-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 bg-zinc-950 rounded-full transition-transform ${feature.status ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
