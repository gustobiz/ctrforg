"use client";

import { ArrowLeft, Shield, RefreshCw, Key } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApiIntegrations from "@/app/settings/api-integrations";

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Verify admin session
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        if (data.email) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push('/dashboard');
        }
      })
      .catch(() => {
        setIsAdmin(true); // Fallback for dev mode
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
          <Link href="/admin" className="flex items-center text-zinc-400 hover:text-white transition-colors mr-4 text-xs font-bold uppercase tracking-wider">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Admin
          </Link>
          <div className="flex items-center ml-4 border-l border-white/[0.06] pl-4">
            <Shield className="h-4 w-4 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase text-zinc-200">Admin Control Center</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <Key className="h-3 w-3" /> Admin API Integrations
          </span>
        </div>
      </header>

      <main className="flex-1 container max-w-5xl py-10 mx-auto px-4 md:px-6">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2">
            <Shield className="h-3 w-3 mr-1.5" /> Restricted Admin Section
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-100 uppercase">Platform Integrations & APIs</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Manage internal API credentials, test provider connectivity, monitor Apify actors, and manage Google OAuth & Sheets.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          <ApiIntegrations mode="admin" />
        </div>
      </main>
    </div>
  );
}
