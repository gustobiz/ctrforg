"use client";

import { 
  ArrowLeft, 
  Settings, 
  Bell, 
  Moon, 
  Sun, 
  Monitor, 
  CheckCircle2, 
  AlertTriangle,
  Globe2,
  Clock,
  Download,
  Sliders,
  Sparkles,
  Link2,
  PenTool
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ApiIntegrations from "./api-integrations";
import EmailSignatureEditor from "./email-signature";

export default function SettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [activeTab, setActiveTab] = useState<'general' | 'signature' | 'accounts'>('general');

  const searchParams = useSearchParams();
  const gmailConnected = searchParams.get('gmail_connected');
  const gmailError = searchParams.get('gmail_error');

  // Switch to tab automatically if redirection parameters are detected
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'signature') {
      setActiveTab('signature');
    } else if (tab === 'api' || tab === 'accounts') {
      setActiveTab('accounts');
    } else if (gmailConnected === 'true' || gmailError) {
      setActiveTab('accounts');
    }
  }, [searchParams, gmailConnected, gmailError]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4 text-xs font-semibold uppercase tracking-wider">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Dashboard
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <Settings className="h-5 w-5 text-emerald-500 mr-2" />
          <span className="font-bold tracking-tight text-sm">Settings & Preferences</span>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl py-10 mx-auto px-4 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your application preferences, email signatures, notifications, theme, and connected accounts.</p>
        </div>

        {/* Gmail connection success/error banners */}
        {gmailConnected === 'true' && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-500">Google Account Connected Successfully</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your Google Account has been authenticated. You can now use Gmail outreach and Google Sheets synchronization.</p>
            </div>
          </div>
        )}
        {gmailError && (
          <div className="mb-6 p-4 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Google OAuth Connection Failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">Error: {gmailError}. Please try again.</p>
            </div>
          </div>
        )}

        {/* Tab switch navigation */}
        <div className="flex border-b border-border/40 mb-8 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 text-sm font-bold border-b-2 px-1 transition-all flex items-center gap-2 relative shrink-0 ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="h-4 w-4" />
            General Settings
          </button>
          <button
            onClick={() => setActiveTab('signature')}
            className={`pb-3 text-sm font-bold border-b-2 px-1 transition-all flex items-center gap-2 relative shrink-0 ${
              activeTab === 'signature'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenTool className="h-4 w-4" />
            Email Signature
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-sm font-bold border-b-2 px-1 transition-all flex items-center gap-2 relative shrink-0 ${
              activeTab === 'accounts'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="h-4 w-4" />
            Connected Accounts
          </button>
        </div>

        <div className="grid gap-8">
          {activeTab === 'general' && (
            <>
              {/* Appearance Section */}
              <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg flex items-center text-foreground">
                    <Monitor className="h-5 w-5 mr-2.5 text-emerald-500" /> Appearance & Theme
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Customize the visual theme of your workspace interface.</p>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-md">
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold' : 'border-border/60 hover:border-emerald-500/40 text-muted-foreground'}`}
                  >
                    <Sun className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">Light</span>
                  </button>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold' : 'border-border/60 hover:border-emerald-500/40 text-muted-foreground'}`}
                  >
                    <Moon className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">Dark</span>
                  </button>
                  <button 
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold' : 'border-border/60 hover:border-emerald-500/40 text-muted-foreground'}`}
                  >
                    <Monitor className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">System</span>
                  </button>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg flex items-center text-foreground">
                    <Bell className="h-5 w-5 mr-2.5 text-emerald-500" /> Notifications & Alerts
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure your email and browser alert preferences.</p>
                </div>
                
                <div className="space-y-6 divide-y divide-border/40">
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="font-medium text-sm">Email Notifications</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Receive weekly reports, lead campaign updates, and account activity notifications.</p>
                    </div>
                    <button 
                      onClick={() => setEmailNotifs(!emailNotifs)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${emailNotifs ? 'bg-emerald-500' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-6">
                    <div>
                      <p className="font-medium text-sm">Browser Push Alerts</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get real-time browser alerts when video analyses or bulk crawls complete.</p>
                    </div>
                    <button 
                      onClick={() => setPushNotifs(!pushNotifs)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pushNotifs ? 'bg-emerald-500' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Global Settings & Preferences */}
              <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg flex items-center text-foreground">
                    <Globe2 className="h-5 w-5 mr-2.5 text-emerald-500" /> Global Preferences
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure default timezone, locale, and export settings.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl border border-border/40 bg-muted/20 relative space-y-2">
                    <div className="flex items-center justify-between">
                      <Clock className="h-4 w-4 text-emerald-500" />
                      <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground">Timezone Engine</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Automatic timezone localization for scheduled email dispatch.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/40 bg-muted/20 relative space-y-2">
                    <div className="flex items-center justify-between">
                      <Globe2 className="h-4 w-4 text-emerald-500" />
                      <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground">Multi-Language AI</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Generate outreach in Spanish, German, French & Japanese.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/40 bg-muted/20 relative space-y-2">
                    <div className="flex items-center justify-between">
                      <Download className="h-4 w-4 text-emerald-500" />
                      <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground">Export Formats</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Default exports to CSV, JSON, and Google Drive PDFs.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'signature' && (
            <EmailSignatureEditor />
          )}

          {activeTab === 'accounts' && (
            <ApiIntegrations mode="public" />
          )}
        </div>
      </main>
    </div>
  );
}
