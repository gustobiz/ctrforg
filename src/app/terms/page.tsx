"use client";

import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <FileText className="h-5 w-5 text-emerald-500" />
          <span className="ml-2 font-bold tracking-tight">Legal</span>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl py-16 mx-auto px-4 md:px-6">
        <div className="mb-12">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            Last updated: May 19, 2026
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
          <p className="text-xl text-muted-foreground">Please read these terms carefully before using CTRForge.</p>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground">
          <h2 className="text-foreground">1. Acceptance of Terms</h2>
          <p>By accessing or using the CTRForge platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our services.</p>

          <h2 className="text-foreground">2. Description of Service</h2>
          <p>CTRForge is a Creator Intelligence Operating System designed to provide analytics, thumbnail optimization concepts, and automated outreach generation for YouTube creators and strategists. The platform uses advanced AI models to analyze visual hierarchies and generate data-driven recommendations.</p>

          <h2 className="text-foreground">3. User Accounts</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

          <h2 className="text-foreground">4. API Usage and Limits</h2>
          <p>Users on the Pro and Agency tiers are subject to fair use limits as described on our billing page. Automated scraping or excessive API requests that degrade platform performance for other users are strictly prohibited.</p>

          <h2 className="text-foreground">5. Intellectual Property</h2>
          <p>All content, features, and functionality of the CTRForge platform, including but not limited to the design, codebase, and AI models, are owned by CTRForge Inc. and are protected by international copyright laws. Any thumbnails generated through the platform remain the intellectual property of the user.</p>

          <h2 className="text-foreground">6. Limitation of Liability</h2>
          <p>CTRForge is provided on an "as is" basis. We make no guarantees regarding the performance of your YouTube channel or the success of your outreach campaigns based on our analytics or generated concepts.</p>
        </div>
      </main>
    </div>
  );
}
