"use client";

import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Sparkles, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface DeliverabilityPanelProps {
  subject: string;
  htmlBody: string;
}

export default function DeliverabilityPanel({ subject, htmlBody }: DeliverabilityPanelProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deliverability/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, htmlBody }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
      }
    } catch (err) {
      console.error('Failed to run deliverability audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subject || htmlBody) {
      const delayDebounce = setTimeout(() => {
        runAudit();
      }, 800); // Debounce checks to minimize API calls
      return () => clearTimeout(delayDebounce);
    }
  }, [subject, htmlBody]);

  const score = results?.healthScore ?? 100;
  const recommendations = results?.recommendations ?? [];
  
  const getScoreColor = (s: number) => {
    if (s >= 85) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (s >= 65) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  return (
    <div className="p-5 border border-white/[0.04] bg-zinc-900/10 rounded-2xl shadow-xl space-y-4">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Deliverability Audit
        </h4>
        {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
      </div>

      {/* Score gauge */}
      <div className="flex items-center justify-between gap-4 p-3 bg-zinc-950/40 rounded-xl border border-white/[0.02]">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Inbox Health Index</span>
          <h3 className="text-lg font-black text-zinc-200">{score}%</h3>
        </div>
        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getScoreColor(score)}`}>
          {score >= 85 ? 'Excellent' : score >= 65 ? 'Fair' : 'Risk Flagged'}
        </span>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-bold text-zinc-500 block">Suggested Improvements</span>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {recommendations.map((rec: string, idx: number) => (
              <div key={idx} className="flex gap-2 text-[10px] text-zinc-400 leading-relaxed bg-zinc-950/20 p-2.5 rounded-lg border border-white/[0.01]">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl text-xs">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Email content is fully optimized. Excellent spam filters bypass rate!</span>
        </div>
      )}

      {/* Small stats summary */}
      {results && (
        <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-zinc-500 text-center border-t border-white/[0.04] pt-3">
          <div>Spam words: <strong className="text-zinc-300">{results.detectedSpamWords?.length}</strong></div>
          <div>Links: <strong className="text-zinc-300">{results.linkCount}</strong></div>
          <div>Opt-Out: <strong className={results.hasUnsubscribe ? "text-emerald-400" : "text-rose-450"}>{results.hasUnsubscribe ? "Yes" : "No"}</strong></div>
        </div>
      )}

    </div>
  );
}
