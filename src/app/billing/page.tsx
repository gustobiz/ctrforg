"use client";

import { 
  ArrowLeft, 
  CreditCard, 
  CheckCircle2, 
  Zap, 
  AlertCircle, 
  Receipt, 
  ShieldCheck, 
  Clock, 
  Download,
  Lock,
  Sparkles,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Script from "next/script";

export default function BillingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(data => {
        setSubscription(data.subscription);
        setUserId(data.userId);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch subscription:", err);
        setIsLoading(false);
      });
  }, []);

  const handleUpgrade = async (plan: 'pro' | 'agency') => {
    const planId = `${plan}_${isAnnual ? 'yearly' : 'monthly'}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndia = tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';

    if (isIndia) {
      // Razorpay Checkout
      try {
        const res = await fetch('/api/checkout/razorpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, userId })
        });
        const data = await res.json();
        
        if (data.error) {
          alert('Error: ' + data.error);
          return;
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'dummy',
          amount: data.amount,
          currency: data.currency,
          name: "CTRForge OS",
          description: `Upgrade to ${plan} plan`,
          order_id: data.orderId,
          handler: function (response: any) {
            alert('Payment Successful! Your plan will be updated momentarily.');
            window.location.reload();
          },
          theme: {
            color: "#10b981"
          }
        };
        const rzp1 = new (window as any).Razorpay(options);
        rzp1.open();
      } catch (err) {
        console.error("Razorpay error", err);
      }
    } else {
      // Paddle Checkout
      if ((window as any).Paddle) {
        // Fallback IDs if env vars are missing
        const priceIds: Record<string, string> = {
          'pro_monthly': process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY || 'pri_dummy_pro_mo',
          'pro_yearly': process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY || 'pri_dummy_pro_yr',
          'agency_monthly': process.env.NEXT_PUBLIC_PADDLE_AGENCY_MONTHLY || 'pri_dummy_agency_mo',
          'agency_yearly': process.env.NEXT_PUBLIC_PADDLE_AGENCY_YEARLY || 'pri_dummy_agency_yr',
        };
        
        (window as any).Paddle.Checkout.open({
          items: [{ priceId: priceIds[planId], quantity: 1 }],
          customData: { userId, planId }
        });
      } else {
        alert("Payment provider not loaded yet. Please try again in a moment.");
      }
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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="lazyOnload" onLoad={() => {
        if ((window as any).Paddle) {
          (window as any).Paddle.Environment.set('sandbox'); // Sandbox mode
          (window as any).Paddle.Initialize({ 
            token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_token' 
          });
        }
      }} />

      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4 text-xs font-semibold uppercase tracking-wider">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Dashboard
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <CreditCard className="h-5 w-5 text-emerald-500 mr-2" />
          <span className="font-bold tracking-tight text-sm">Billing & Plans</span>
        </div>
      </header>

      <main className="flex-1 container max-w-5xl py-10 mx-auto px-4 md:px-6 space-y-12">
        
        {/* Active Subscription State & Usage Overview */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Plan</h3>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-2xl font-bold tracking-tight">{isLoading ? "Loading..." : getPlanName()}</h2>
                {subscription && subscription.status === 'active' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                )}
              </div>
              {subscription?.current_period_end ? (
                <p className="text-xs text-muted-foreground mb-4">Your next billing date is <strong className="text-foreground">{new Date(subscription.current_period_end).toLocaleDateString()}</strong>.</p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">Upgrade your workspace to unlock higher usage limits and priority AI generation.</p>
              )}
            </div>
            
            {subscription && subscription.status === 'active' && (
              <button className="text-xs font-semibold text-destructive hover:underline text-left mt-2">
                Cancel Subscription &rarr;
              </button>
            )}
          </div>
          
          <div className="md:col-span-2 rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Usage Limits</h3>
              {(videoPct > 80 || outreachPct > 80) && (
                <span className="text-xs font-semibold text-amber-500 flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" /> Approaching limits
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-foreground">Video Analyses</span>
                  <span className="text-muted-foreground font-mono">{videoUsage} / {videoLimit > 9999 ? 'Unlimited' : videoLimit}</span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${videoPct > 90 ? 'bg-destructive' : 'bg-emerald-500'}`} style={{ width: `${videoPct}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-foreground">Outreach Generations</span>
                  <span className="text-muted-foreground font-mono">{outreachUsage} / {outreachLimit > 9999 ? 'Unlimited' : outreachLimit}</span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${outreachPct > 90 ? 'bg-destructive' : 'bg-amber-500'}`} style={{ width: `${outreachPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Tiers Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider mb-3">
            <Zap className="h-3.5 w-3.5" /> Flexible Growth Plans
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl mb-3">Upgrade your intelligence engine</h1>
          <p className="text-muted-foreground text-sm">
            Choose the plan that fits your channel scale and outreach requirements.
          </p>
          
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-xs ${!isAnnual ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-xs flex items-center gap-2 ${isAnnual ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
              Annually <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full uppercase">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Pro Creator Plan */}
          <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-8 relative flex flex-col justify-between hover:border-border transition-all">
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Pro Creator</h3>
                <p className="text-muted-foreground text-xs h-8">Essential toolkit to optimize channel ranking and automate outreach.</p>
                <div className="mt-4 flex items-baseline text-4xl font-extrabold">
                  ${isAnnual ? '29' : '39'}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3.5 mb-8">
                {['100 Video Analyses / mo', 'Unlimited Competitor Searches', '500 Outreach Generations', '200 Thumbnail Concepts', 'Priority Support'].map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2.5 shrink-0" />
                    <span className="text-xs text-foreground font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {subscription?.plan_id?.startsWith('pro') ? (
              <button disabled className="w-full h-11 rounded-xl bg-muted text-muted-foreground font-bold text-xs cursor-default flex items-center justify-center border border-border/40">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Current Plan
              </button>
            ) : (
              <button onClick={() => handleUpgrade('pro')} className="w-full h-11 rounded-xl border border-emerald-500 text-emerald-500 font-bold text-xs hover:bg-emerald-500/10 transition-colors shadow-sm">
                Upgrade to Pro Creator
              </button>
            )}
          </div>

          {/* Agency Plan */}
          <div className="rounded-2xl border-2 border-emerald-500 bg-card text-card-foreground shadow-lg p-8 relative flex flex-col justify-between">
            <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Most Popular
            </div>
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Agency</h3>
                <p className="text-muted-foreground text-xs h-8">Uncapped power for teams managing multiple creator channels.</p>
                <div className="mt-4 flex items-baseline text-4xl font-extrabold">
                  ${isAnnual ? '99' : '129'}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3.5 mb-8">
                {['Unlimited Video Analyses', 'Unlimited Competitor Searches', 'Unlimited Outreach Generations', '1000 Thumbnail Concepts', 'API Access & Webhooks', 'Custom White-label Reports'].map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2.5 shrink-0" />
                    <span className="text-xs text-foreground font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {subscription?.plan_id?.startsWith('agency') ? (
              <button disabled className="w-full h-11 rounded-xl bg-muted text-muted-foreground font-bold text-xs cursor-default flex items-center justify-center border border-border/40">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Current Plan
              </button>
            ) : (
              <button onClick={() => handleUpgrade('agency')} className="w-full h-11 rounded-xl bg-foreground text-background font-bold text-xs hover:opacity-90 transition-colors shadow-md">
                Upgrade to Agency Plan
              </button>
            )}
          </div>
        </div>

        {/* SECTION: Payment Method Placeholder */}
        <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h3 className="font-semibold text-base flex items-center text-foreground">
                <CreditCard className="h-5 w-5 mr-2.5 text-emerald-500" /> Payment Methods
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage default credit cards, UPI IDs, and billing checkout integrations.</p>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
              Coming Soon
            </span>
          </div>

          <div className="p-5 rounded-xl border border-border/40 bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-background border border-border rounded-xl flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Paddle & Razorpay Payment Vault</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Secure payment method management for stored credit cards, debit cards, and UPI payment methods will be available upon gateway activation.</p>
              </div>
            </div>
            <button disabled className="px-3.5 py-2 rounded-xl bg-muted border border-border text-muted-foreground text-xs font-semibold shrink-0 cursor-not-allowed">
              Manage Cards (Coming Soon)
            </button>
          </div>
        </div>

        {/* SECTION: Billing History Placeholder */}
        <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h3 className="font-semibold text-base flex items-center text-foreground">
                <Receipt className="h-5 w-5 mr-2.5 text-emerald-500" /> Billing History & Invoices
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Download tax invoices and past payment receipts.</p>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
              Coming Soon
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground italic">
                    No past invoices found. Billing history will be listed here once payment gateway integration is live.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="text-center text-xs text-muted-foreground pt-4 flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Payments are securely processed by Paddle (International) & Razorpay (India).</span>
        </div>
      </main>
    </div>
  );
}
