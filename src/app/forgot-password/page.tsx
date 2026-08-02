"use client";

import { Target, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Visual Side */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-muted/30 border-r border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop')] opacity-10 mix-blend-luminosity bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        
        <div className="relative z-10 flex items-center">
          <Target className="h-8 w-8 text-emerald-500 mr-3" />
          <span className="font-bold text-2xl tracking-tight">CTRForge</span>
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500 mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2"></span>
            Account Recovery
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">Get back to dominating YouTube.</h2>
          <p className="text-muted-foreground">Secure password recovery for your Creator OS account.</p>
        </div>
      </div>

      {/* Auth Side */}
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <Link href="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-emerald-500 transition-colors mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
          </Link>
          
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Reset password</h1>
            <p className="text-muted-foreground text-sm">Enter your email address and we'll send you a link to reset your password.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <input 
                type="email" 
                placeholder="name@example.com" 
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
              />
            </div>
            
            <button className="w-full h-11 rounded-md bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors flex items-center justify-center mt-6">
              Send Recovery Link <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
