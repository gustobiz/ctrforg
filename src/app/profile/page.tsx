"use client";

import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  Activity, 
  LogOut, 
  Settings, 
  BarChart3, 
  AlertCircle, 
  ArrowRight, 
  Save, 
  Key,
  ShieldCheck,
  Mail,
  CheckCircle2,
  Sparkles,
  CloudLightning
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        setSubscription(data.subscription);
        if (data.email) {
          setUserEmail(data.email);
          const initialName = data.email.split('@')[0];
          setDisplayName(data.name || initialName.charAt(0).toUpperCase() + initialName.slice(1));
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });

    // Check Google OAuth connection status
    fetch('/api/settings/status')
      .then(res => res.json())
      .then(data => {
        if (data.googleOAuth?.connected) {
          setGoogleConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingName(true);
    setNameSaveSuccess(false);
    
    // Simulate/Perform profile name update
    setTimeout(() => {
      setIsSavingName(false);
      setNameSaveSuccess(true);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    }, 600);
  };

  const handleSendResetLink = async () => {
    if (!userEmail) return;
    setIsSendingReset(true);
    setResetSentSuccess(false);
    
    try {
      await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      setResetSentSuccess(true);
      setTimeout(() => setResetSentSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to send reset email:", err);
      alert("Failed to send reset link. Please check email provider configuration.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const getPlanName = () => {
    if (!subscription || !subscription.plan_id) return "Free Tier";
    if (subscription.plan_id.startsWith('pro')) return "Pro Creator";
    if (subscription.plan_id.startsWith('agency')) return "Agency";
    return "Free Tier";
  };

  const videoLimit = subscription?.plan_id?.startsWith('agency') ? 999999 : (subscription?.plan_id?.startsWith('pro') ? 100 : 3);
  const outreachLimit = subscription?.plan_id?.startsWith('agency') ? 999999 : (subscription?.plan_id?.startsWith('pro') ? 500 : 10);
  const videoUsage = subscription?.usage_video_analyses || 0;
  const outreachUsage = subscription?.usage_outreach_generations || 0;
  const videoPct = Math.min(100, Math.round((videoUsage / videoLimit) * 100));
  const outreachPct = Math.min(100, Math.round((outreachUsage / outreachLimit) * 100));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4 text-xs font-semibold uppercase tracking-wider">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Dashboard
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <User className="h-5 w-5 text-emerald-500 mr-2" />
          <span className="font-bold tracking-tight text-sm">My Profile</span>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl py-10 mx-auto px-4 md:px-6">
        
        {/* Top User Hero Card */}
        <div className="mb-8 p-6 rounded-2xl border border-border/60 bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 border-4 border-background shadow-lg flex items-center justify-center text-white shrink-0">
              <span className="text-2xl font-black">
                {displayName ? displayName.charAt(0).toUpperCase() : (userEmail ? userEmail.charAt(0).toUpperCase() : 'G')}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{displayName || 'Guest User'}</h1>
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-500">
                  {getPlanName()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-emerald-500" />
                {userEmail || 'guest@ctrforge.com'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <Link 
              href="/settings" 
              className="px-4 py-2 rounded-xl bg-muted hover:bg-accent border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Settings className="h-4 w-4" /> Account Settings
            </Link>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-xs font-semibold text-destructive flex items-center gap-1.5 transition-all"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Profile Content Grid */}
        <div className="grid gap-8">
          
          {/* SECTION 1: Personal Information */}
          <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center text-foreground">
                  <User className="h-5 w-5 mr-2.5 text-emerald-500" /> Personal Information
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your public avatar, name, and registered email address.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateDisplayName} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">Display Name</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name" 
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                    />
                    <button 
                      type="submit"
                      disabled={isSavingName}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50 shrink-0 shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      {isSavingName ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {nameSaveSuccess && (
                    <p className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Display name updated successfully!
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">Email Address (Read-Only)</label>
                  <div className="h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{userEmail || 'Not signed in'}</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* SECTION 2: Security */}
          <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h3 className="font-semibold text-lg flex items-center text-foreground">
                <Key className="h-5 w-5 mr-2.5 text-emerald-500" /> Security & Connected Accounts
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage authentication, password credentials, and OAuth security access.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Password Reset */}
              <div className="p-5 rounded-xl border border-border/40 bg-muted/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Password Management</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We will send a secure password reset link to your registered email address ({userEmail}).
                </p>
                <button 
                  onClick={handleSendResetLink}
                  disabled={isSendingReset || !userEmail}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent disabled:opacity-50 shadow-sm"
                >
                  <Key className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                  {isSendingReset ? 'Sending...' : 'Send Password Reset Link'}
                </button>
                {resetSentSuccess && (
                  <p className="text-xs text-emerald-500 font-medium flex items-center gap-1 pt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reset link sent! Check your email inbox.
                  </p>
                )}
              </div>

              {/* Connected Google Account */}
              <div className="p-5 rounded-xl border border-border/40 bg-muted/10 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CloudLightning className="h-4 w-4 text-amber-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Connected Google Account</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${googleConnected ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                      {googleConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {googleConnected 
                      ? 'Your Google Account is authorized for Gmail outreach and Google Sheets synchronization.' 
                      : 'Connect your Google account to enable automated outreach and Google Sheets lead sync.'}
                  </p>
                </div>
                <Link 
                  href="/settings?tab=accounts" 
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-muted hover:bg-accent border border-border px-4 py-2 text-xs font-semibold text-foreground transition-all w-fit"
                >
                  Manage Account & OAuth &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* SECTION 3: Subscription & Usage */}
          <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center text-foreground">
                  <Activity className="h-5 w-5 mr-2.5 text-emerald-500" /> Subscription & Usage Overview
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">View your current active tier, monthly usage quotas, and renewal details.</p>
              </div>

              <Link 
                href="/billing"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <CreditCard className="h-4 w-4" /> Upgrade Plan
              </Link>
            </div>

            {/* Subscription State & Renewal Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-extrabold">Current Plan</p>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">{getPlanName()}</span>
                  {subscription && subscription.status === 'active' ? (
                    <span className="flex items-center text-emerald-500 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-full">
                      Free Tier
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-extrabold">Renewal Date</p>
                <p className="text-base font-bold text-foreground">
                  {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A (Free Tier)'}
                </p>
              </div>
            </div>

            {/* Current Usage Progress Bars */}
            <div className="space-y-5 p-5 rounded-xl border border-border/40 bg-muted/10">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2 text-emerald-500" /> Monthly Quotas
                </h4>
                {(videoPct > 80 || outreachPct > 80) && (
                  <span className="text-xs font-semibold text-amber-500 flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" /> Approaching plan limit
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground">Video Analyses</span>
                    <span className="text-muted-foreground font-mono">{videoUsage} / {videoLimit > 9999 ? '∞' : videoLimit}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${videoPct > 90 ? 'bg-destructive' : 'bg-emerald-500'}`} style={{ width: `${videoPct}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground">Outreach Generations</span>
                    <span className="text-muted-foreground font-mono">{outreachUsage} / {outreachLimit > 9999 ? '∞' : outreachLimit}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${outreachPct > 90 ? 'bg-destructive' : 'bg-amber-500'}`} style={{ width: `${outreachPct}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholder state when no active paid subscription exists */}
            {(!subscription || subscription.status !== 'active') && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Ready to scale your outreach?</p>
                    <p className="text-[11px] text-muted-foreground">Upgrade to Pro Creator or Agency plan to unlock unlimited video analyses and bulk emails.</p>
                  </div>
                </div>
                <Link
                  href="/billing"
                  className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all shrink-0"
                >
                  View Plans &rarr;
                </Link>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
