"use client";

import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <Shield className="h-5 w-5 text-emerald-500" />
          <span className="ml-2 font-bold tracking-tight">Privacy</span>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl py-16 mx-auto px-4 md:px-6">
        <div className="mb-12">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            Last updated: May 19, 2026
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-xl text-muted-foreground">How we collect, use, and protect your creator intelligence data.</p>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground">
          <h2 className="text-foreground">1. Data Collection</h2>
          <p>We collect information that you provide directly to us, including your name, email address, payment information, and YouTube channel URLs submitted for analysis. We also automatically collect certain usage data through cookies and similar technologies.</p>

          <h2 className="text-foreground">2. Use of Information</h2>
          <p>The information we collect is used to:</p>
          <ul>
            <li>Provide and maintain the CTRForge platform</li>
            <li>Process transactions and send related information</li>
            <li>Train our AI models to improve thumbnail analysis accuracy (only using publicly available YouTube data)</li>
            <li>Send technical notices, updates, and security alerts</li>
          </ul>

          <h2 className="text-foreground">3. Data Security</h2>
          <p>We implement state-of-the-art security measures to protect your data. All communication is encrypted via SSL/TLS. Your API keys and connected account credentials are encrypted at rest using AES-256 encryption.</p>

          <h2 className="text-foreground">4. Third-Party Services</h2>
          <p>We utilize third-party services for payments (Stripe/Paddle) and database management (Supabase). These processors are bound by strict confidentiality agreements and GDPR-compliant data processing addendums.</p>

          <h2 className="text-foreground">5. Your Rights</h2>
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data. You can exercise these rights at any time through your account dashboard or by contacting our privacy team.</p>
        </div>
      </main>
    </div>
  );
}
