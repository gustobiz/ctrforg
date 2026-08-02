"use client";

import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Sparkles, RefreshCw, Zap } from 'lucide-react';

export default function WarmupWidget() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [warmupStatus, setWarmupStatus] = useState('active');

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/warmup');
      const data = await res.json();
      if (data.success) {
        setStats(data);
        setDailyLimit(data.today.daily_limit);
        setWarmupStatus(data.today.status);
      }
    } catch (err) {
      console.error('Failed to fetch warmup stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleUpdateLimit = async (newLimit: number) => {
    setDailyLimit(newLimit);
    try {
      await fetch('/api/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyLimit: newLimit }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = warmupStatus === 'active' ? 'paused' : 'active';
    setWarmupStatus(nextStatus);
    try {
      await fetch('/api/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border border-white/[0.04] bg-zinc-900/10 rounded-3xl flex justify-center items-center py-12 text-zinc-550">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        <span className="text-xs uppercase font-bold tracking-wider">Syncing warmup core...</span>
      </div>
    );
  }

  const score = stats?.warmupScore || 70;
  const isHealthy = score >= 80;

  return (
    <div className="p-6 border border-white/[0.04] bg-zinc-900/10 rounded-3xl shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
        <div className="space-y-0.5">
          <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-emerald-400" />
            Email Warmup Shield
          </h3>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Protect Gmail domains from spam filters.</p>
        </div>

        <button 
          onClick={handleToggleStatus}
          className={`h-7 px-3 text-[10px] font-extrabold uppercase rounded-full border transition-all ${warmupStatus === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-950 border-white/[0.04] text-zinc-500'}`}
        >
          {warmupStatus === 'active' ? '● Shield Active' : 'Shield Paused'}
        </button>
      </div>

      {/* Main Stats Split */}
      <div className="grid md:grid-cols-2 gap-6 items-center">
        
        {/* Score Ring */}
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/40 rounded-2xl border border-white/[0.02] text-center">
          <div className="relative h-24 w-24 flex items-center justify-center">
            {/* SVG circular progress indicator */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle 
                cx="48" 
                cy="48" 
                r="40" 
                stroke="#18181b" 
                strokeWidth="6" 
                fill="transparent" 
              />
              <circle 
                cx="48" 
                cy="48" 
                r="40" 
                stroke={isHealthy ? '#34d399' : '#fbbf24'} 
                strokeWidth="6" 
                fill="transparent" 
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * score) / 100}
                className="transition-all duration-500"
              />
            </svg>
            <span className="text-2xl font-black text-zinc-150">{score}%</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-zinc-500 mt-3 tracking-wider">Sender Reputation Score</span>
          <div className="flex items-center gap-1 mt-1 text-[10px] font-extrabold text-emerald-400">
            {isHealthy ? (
              <>
                <ShieldCheck className="h-3 w-3" /> Excellent Health
              </>
            ) : (
              <>
                <ShieldAlert className="h-3 w-3 text-amber-500" /> Caution Advised
              </>
            )}
          </div>
        </div>

        {/* Ramp Up Adjustments */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Suggested Limit</span>
              <span className="text-zinc-200 font-extrabold">{stats?.suggestedVolume} / day</span>
            </div>
            <div className="flex justify-between items-baseline text-xs pt-1.5 border-t border-white/[0.02]">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Current Custom Limit</span>
              <span className="text-zinc-200 font-extrabold">{dailyLimit} / day</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold text-zinc-500 block">Daily Limit Throttle</label>
            <input 
              type="range" 
              min={5} 
              max={100} 
              value={dailyLimit}
              onChange={(e) => handleUpdateLimit(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

      </div>

      {/* Advisory Text */}
      <div className="border border-white/[0.04] p-4 bg-zinc-950/20 rounded-2xl flex items-start gap-3">
        <Sparkles className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Google algorithms track abrupt spikes in sending volume. The CTRForge Shield automatically advises a gradual **daily ramp-up limit** based on account age to avoid spam detection blocks. Keep active campaigns under this recommended ceiling.
        </p>
      </div>

    </div>
  );
}
