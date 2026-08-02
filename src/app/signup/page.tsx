"use client";

import { Target, ArrowRight, Github, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName })
      });
      
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to sign up');
        setIsLoading(false);
      } else {
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setSuccess(true);
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      setError('Network error. Failed to reach auth service.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Visual Side */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-muted/30 border-r border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop')] opacity-10 mix-blend-luminosity bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        
        <div className="relative z-10 flex items-center">
          <Target className="h-8 w-8 text-emerald-500 mr-3" />
          <span className="font-bold text-2xl tracking-tight">CTRForge</span>
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500 mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2"></span>
            Join the elite
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">Stop guessing. Start dominating YouTube.</h2>
          <p className="text-muted-foreground">Join hundreds of creators and strategists using CTRForge to automate discovery and analyze visual hierarchies.</p>
        </div>
      </div>

      {/* Auth Side */}
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create an account</h1>
            <p className="text-muted-foreground text-sm">Start your 14-day free trial. No credit card required.</p>
          </div>

          {success ? (
            <div className="p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-md text-center">
              <h3 className="font-bold text-emerald-500 mb-2">Check your email</h3>
              <p className="text-sm text-foreground/80">We've sent a verification link to {email}. Please verify your account to continue.</p>
              <Link href="/login" className="inline-block mt-4 text-sm font-medium hover:text-emerald-500 transition-colors">Return to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First name</label>
                  <input 
                    type="text" 
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John" 
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last name</label>
                  <input 
                    type="text" 
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe" 
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com" 
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-md bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors flex items-center justify-center mt-6 disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground tracking-wider">Or register with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="h-10 rounded-md border border-border/40 bg-background hover:bg-muted transition-colors flex items-center justify-center text-sm font-medium">
              <Github className="mr-2 h-4 w-4" /> Github
            </button>
            <button className="h-10 rounded-md border border-border/40 bg-background hover:bg-muted transition-colors flex items-center justify-center text-sm font-medium">
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Google
            </button>
          </div>

          <div className="text-center text-sm text-muted-foreground mt-8">
            By clicking "Create Account", you agree to our <Link href="/terms" className="hover:text-emerald-500 underline underline-offset-4 transition-colors">Terms of Service</Link> and <Link href="/privacy" className="hover:text-emerald-500 underline underline-offset-4 transition-colors">Privacy Policy</Link>.
          </div>

          <div className="text-center text-sm text-muted-foreground mt-4">
            Already have an account? <Link href="/login" className="text-emerald-500 font-medium hover:underline underline-offset-4">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
