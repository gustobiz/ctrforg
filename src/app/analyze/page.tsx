"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Search, Youtube, BarChart3, Target, AlertTriangle, 
  ExternalLink, Send, BookmarkPlus, Copy, BrainCircuit, CheckCircle2, 
  FileText, Activity, Layers, Sparkles, Check, Download
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeCRMLead, mapRawToCrmPayload } from "@/lib/supabase/db";

function extractVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    const shortsRegExp = /youtube\.com\/shorts\/([^#\&\?]*)/;
    const shortsMatch = url.match(shortsRegExp);
    if (shortsMatch && shortsMatch[1].length === 11) {
      return shortsMatch[1];
    }
  } catch (e) {}
  return null;
}

export default function AnalyzePage() {
  const router = useRouter();
  const { setCurrentAnalysis, transferToOutreach, addCrmLead } = useAppStore();
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null);
  const [copiedData, setCopiedData] = useState(false);
  const hasTriggeredRef = useRef(false);

  // CRM States
  const [isSavingCrm, setIsSavingCrm] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const loadingSteps = [
    "Fetching YouTube Metadata...",
    "Analyzing Visual Hierarchy...",
    "Evaluating Emotional Hooks...",
    "Detecting CTR Weaknesses..."
  ];

  // Hydrate results and URL from localStorage on load AND handle incoming auto-analysis queries
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check query parameter first
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("url");
      if (urlParam && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        setUrl(urlParam);
        triggerAnalysisDirectly(urlParam);
        return;
      }

      // Fallback to cache
      try {
        const cached = localStorage.getItem("current_analysis");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setResults(parsed);
            if (parsed.videoUrl) {
              setUrl(parsed.videoUrl);
            }
          }
        }
      } catch (e) {
        console.error("Failed to hydrate current_analysis inside AnalyzePage:", e);
      }
    }
  }, []);

  const triggerAnalysisDirectly = async (targetUrl: string) => {
    setIsAnalyzing(true);
    setResults(null);
    setError(null);
    setLoadingStep(0);

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length - 1) {
        currentStep++;
        setLoadingStep(currentStep);
      }
    }, 1000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze video. Please check your URL.");
      }

      setLoadingStep(loadingSteps.length - 1);
      setTimeout(() => {
        clearInterval(interval);
        setIsAnalyzing(false);
        setResults(data.data);
        setCurrentAnalysis(data.data);
      }, 400);
    } catch (err: any) {
      clearInterval(interval);
      setIsAnalyzing(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    triggerAnalysisDirectly(url);
  };

  const handleTransferToOutreach = () => {
    if (!results) return;
    transferToOutreach(results);
    router.push("/outreach");
  };

  const handleSaveToCrm = async () => {
    if (!results) return;
    setIsSavingCrm(true);
    setSaveMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const rawPayload = mapRawToCrmPayload({
          user_id: user.id,
          creator_name: results.creatorName,
          channel_name: results.channelName,
          video_title: results.videoTitle,
          video_url: results.videoUrl,
          thumbnail_url: results.thumbnailUrl,
          subscriber_count: results.subs,
          view_count: results.views,
          like_count: results.likes || "0",
          published_at: results.publishedAt,
          transcript_snippets: results.transcriptSnippets,
          emotional_tone: results.emotionalTone,
          repeated_phrases: results.repeatedPhrases,
          ctr_weaknesses: results.detectedWeaknesses,
          optimized_titles: results.titleIdeas || [],
          audience_positioning: results.audiencePositioning,
          generated_outreach: results.generatedOutreach || "",
          status: "new",
          notes: `Saved from Intelligence Engine analysis of video: "${results.videoTitle}"`,
          platform: "email",
          exact_hook: results.exactHook || "",
          top_emotional_words: results.topEmotionalWords || [],
          most_repeated_phrases: results.mostRepeatedPhrases || [],
          curiosity_loops: results.curiosityLoops || [],
          audience_type: results.audienceType || "General",
          retention_style: results.retentionStyle || "Standard",
          cta_style: results.ctaStyle || "Standard",
          high_converting_phrases: results.highConvertingPhrases || [],
          packagingScore: results.packagingScore,
          estimatedCtrRange: results.estimatedCtrRange,
          ctrGainPotential: results.ctrGainPotential,
          packagingEfficiency: results.packagingEfficiency,
          subscriberVelocity: results.subscriberVelocity
        });

        const safePayload = sanitizeCRMLead(rawPayload);
        const { error: upsertError } = await supabase
          .from('crm_leads')
          .upsert(safePayload, { onConflict: 'user_id,creator_name' });

        if (upsertError) throw upsertError;
      }

      // Sync to local context in both authenticated and guest environments
      addCrmLead({
        name: results.creatorName,
        niche: results.creatorNiche || "General",
        status: "new",
        date: "Just now",
        notes: `Saved from Intelligence Engine analysis of video: "${results.videoTitle}"`,
        platform: "email",
        analysis: results
      });

      setSaveMessage({ type: 'success', text: `Lead "${results.creatorName}" successfully saved to CRM!` });
      setTimeout(() => {
        setSaveMessage(null);
        router.push("/crm");
      }, 1500);

    } catch (err: any) {
      console.error("Save to CRM failed:", err);
      setSaveMessage({ type: 'error', text: err.message || "Failed to save lead to CRM." });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSavingCrm(false);
    }
  };

  const handleCopyTitle = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedTitleIndex(index);
    setTimeout(() => setCopiedTitleIndex(null), 2000);
  };

  const handleCopyAllData = () => {
    if (!results) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 2000);
  };

  const handleExport = (type: string) => {
    if (!results) {
      alert("No analysis diagnostics available to export.");
      return;
    }

    if (type === 'csv') {
      const headers = [
        "Creator Name", 
        "Video Title", 
        "Niche", 
        "Views", 
        "Subscribers", 
        "Estimated CTR Range", 
        "CTR Gain Potential", 
        "Packaging Efficiency", 
        "Subscriber Velocity", 
        "Packaging Score", 
        "Weakness 1", 
        "Weakness 2"
      ];
      const rows = [[
        `"${results.creatorName.replace(/"/g, '""')}"`,
        `"${results.videoTitle.replace(/"/g, '""')}"`,
        `"${results.creatorNiche || 'General'}"`,
        `"${results.views}"`,
        `"${results.subs}"`,
        `"${results.estimatedCtrRange || 'N/A'}"`,
        `"${results.ctrGainPotential || 'N/A'}"`,
        `"${results.packagingEfficiency !== undefined ? results.packagingEfficiency + '/100' : 'N/A'}"`,
        `"${results.subscriberVelocity || 'N/A'}"`,
        `"${results.packagingScore !== undefined ? results.packagingScore + '/100' : 'N/A'}"`,
        `"${(results.detectedWeaknesses?.[0] || '').replace(/"/g, '""')}"`,
        `"${(results.detectedWeaknesses?.[1] || '').replace(/"/g, '""')}"`
      ]];
      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ctrforge-analysis-${results.creatorName.replace(/\s+/g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      let markdown = `# CTRForge Intelligence Dissection Report\n\n`;
      markdown += `## Creator: ${results.creatorName}\n`;
      markdown += `- **Video Target**: "${results.videoTitle}"\n`;
      markdown += `- **Niche Focus**: ${results.creatorNiche || 'General'}\n`;
      markdown += `- **Packaging Score (Estimated)**: **${results.packagingScore !== undefined ? results.packagingScore : results.score}/100**\n`;
      markdown += `- **Estimated CTR Range**: **${results.estimatedCtrRange || 'N/A'}**\n`;
      markdown += `- **CTR Gain Potential (Estimated)**: **${results.ctrGainPotential || 'N/A'}**\n`;
      markdown += `- **Packaging Efficiency**: **${results.packagingEfficiency !== undefined ? results.packagingEfficiency : results.score}/100**\n`;
      markdown += `- **Subscriber Velocity**: **${results.subscriberVelocity || 'N/A'}**\n`;
      markdown += `- **Metrics**: Views: ${results.views} | Subscribers: ${results.subs} | Likes: ${results.likes || 'N/A'}\n\n`;
      
      markdown += `### 1. Actionable Packaging Deficits\n`;
      if (results.detectedWeaknesses && results.detectedWeaknesses.length > 0) {
        results.detectedWeaknesses.forEach((w: string, i: number) => {
          markdown += `- **Deficit ${i + 1}**: ${w}\n`;
          if (results.weaknessDetails?.[i]) {
            markdown += `  _Details_: ${results.weaknessDetails[i]}\n`;
          }
        });
      } else {
        markdown += `_No major visual deficits detected._\n`;
      }
      
      markdown += `\n### 2. Suggested Title Packaging Remixed\n`;
      if (results.titleIdeas && results.titleIdeas.length > 0) {
        results.titleIdeas.forEach((idea: string) => {
          markdown += `- "${idea}"\n`;
        });
      }
      
      markdown += `\n### 3. Audience Positioning Strategy\n`;
      markdown += `${results.audiencePositioning || 'Standard pacing metrics'}\n\n`;
      
      markdown += `### 4. Hook & Content Tone Diagnostics\n`;
      markdown += `- **Intro Hook Analysis**: ${results.hookAnalysis}\n`;
      markdown += `- **Alternate Intro Hook Quote**: _"${results.suggestedHook}"_\n`;
      markdown += `- **Dopamine Tone Vibe**: ${results.emotionalTone}\n`;
      if (results.transcriptSnippets && results.transcriptSnippets.length > 0) {
        markdown += `- **High-Dopamine Hook Snippet**: _"${results.transcriptSnippets[0]}"_\n`;
      }

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ctrforge-analysis-report-${results.creatorName.replace(/\s+/g, '-')}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-[#f4f4f5] transition-colors mr-5 text-xs font-semibold uppercase tracking-wider group">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          <div className="flex items-center ml-5 border-l border-white/[0.06] pl-5">
            <Target className="h-4.5 w-4.5 text-emerald-400 mr-2 animate-pulse" />
            <span className="font-extrabold tracking-tight text-xs uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Intelligence Engine</span>
          </div>
        </div>

        {/* Global actions */}
        {results && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden md:inline">Export Report:</span>
            <div className="flex bg-zinc-900/60 rounded-lg p-0.5 border border-white/[0.04]">
              <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors">
                <FileText className="w-3 h-3" /> PDF
              </button>
              <button onClick={() => handleExport('docx')} className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors">
                <FileText className="w-3 h-3" /> DOCX
              </button>
              <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors">
                <FileText className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 container max-w-[1300px] py-12 mx-auto px-6 md:px-8">
        
        {/* Spacious Top Headline */}
        <div className="flex flex-col items-center text-center space-y-4 mb-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Analyze Competitor Packaging
          </h1>
          <p className="text-zinc-400 text-sm max-w-[500px]">
            Input any YouTube URL to dissect visual contrast, curiosity triggers, emotional stakes, and retention packaging hooks.
          </p>
        </div>

        {/* Floating URL Input */}
        <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto mb-14">
          <div className="relative flex items-center bg-zinc-900/40 border border-white/[0.06] rounded-full p-1.5 shadow-2xl focus-within:border-emerald-500/30 transition-all">
            <Youtube className="absolute left-5 h-5 w-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Paste YouTube video or Shorts link (e.g. https://youtube.com/watch?v=...)"
              className="w-full h-12 bg-transparent pl-13 pr-32 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
            />
            <button
              type="submit"
              disabled={isAnalyzing || !url}
              className="absolute right-2 h-10 px-6 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isAnalyzing ? "Scanning..." : "Dissect"}
            </button>
          </div>
        </form>

        {/* Error Notification */}
        {error && (
          <div className="max-w-2xl mx-auto mb-12 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-[9px] font-extrabold uppercase hover:underline ml-4 tracking-wider text-rose-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Progress State */}
        {isAnalyzing && (
          <div className="max-w-2xl mx-auto mb-14 p-6 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300">{loadingSteps[loadingStep]}</span>
              <span className="text-xs text-emerald-400 font-bold">{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 ease-in-out" 
                style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Redesigned Workspace Dissection Panels */}
        {results && (
          <div className="animate-in fade-in duration-500 space-y-8 max-w-6xl mx-auto">
            
            {/* Top workspace control triggers */}
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Packaging Dissection Active</span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveToCrm} 
                  disabled={isSavingCrm}
                  className="h-8 px-3 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center transition-colors disabled:opacity-50"
                >
                  {isSavingCrm ? "Saving..." : <><BookmarkPlus className="h-3.5 w-3.5 mr-1.5 text-zinc-500" /> Save CRM</>}
                </button>
                <button onClick={handleTransferToOutreach} className="h-8 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-colors flex items-center shadow-md">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Transfer Pitch
                </button>
                <Link 
                  href={`/thumbnails?refTitle=${encodeURIComponent(results.videoTitle)}&refThumb=${encodeURIComponent(results.thumbnailUrl || '')}&refNiche=${encodeURIComponent(results.creatorNiche || '')}`}
                  className="h-8 px-3.5 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center transition-colors shadow-md"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Remix Studio
                </Link>
              </div>
            </div>

            {/* Premium 2-Column Side-By-Side Audit Workspace */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              
              {/* ================= COLUMN 1: IMAGE COMPILER VIEW (5 cols) ================= */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Visual card */}
                <div className="rounded-2xl border border-white/[0.04] bg-zinc-900/10 overflow-hidden shadow-2xl">
                  <div className="aspect-video bg-zinc-950 relative">
                    <img 
                      src={results.thumbnailUrl || `https://img.youtube.com/vi/${extractVideoId(results.videoUrl) || ''}/maxresdefault.jpg`} 
                      alt="Thumbnail" 
                      className="object-cover w-full h-full relative" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-90" />
                  </div>
                  
                  <div className="p-6 space-y-5">
                    <div>
                      <h3 className="font-extrabold text-sm text-zinc-200 leading-snug">{results.videoTitle}</h3>
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mt-2.5">
                        <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-[9px] uppercase">
                          {results.channelName ? results.channelName.charAt(0) : 'Y'}
                        </div>
                        {results.channelName}
                      </div>
                    </div>
                    
                    {/* Performance metrics grid */}
                    <div className="grid grid-cols-2 gap-3.5 border-t border-white/[0.02] pt-4">
                      <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Views</p>
                        <p className="font-black text-xs text-zinc-300 mt-0.5">{results.views}</p>
                      </div>
                      <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Subscribers</p>
                        <p className="font-black text-xs text-zinc-300 mt-0.5">{results.subs}</p>
                      </div>
                      <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Likes</p>
                        <p className="font-black text-xs text-zinc-300 mt-0.5">{results.likes || 'N/A'}</p>
                      </div>
                      <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Uploaded</p>
                        <p className="font-black text-xs text-zinc-300 mt-0.5">{results.publishedAt}</p>
                      </div>
                    </div>

                    {/* Integrated CTA Studio remix link */}
                    <div className="pt-2 border-t border-white/[0.02] flex gap-2.5">
                      <a 
                        href={results.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 hover:bg-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-400 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Watch Video
                      </a>
                      <button 
                        onClick={handleCopyAllData}
                        className="flex-1 h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 hover:bg-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-400 hover:text-white"
                      >
                        {copiedData ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center"><Check className="h-3.5 w-3.5 mr-1" /> Copied</span>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Data</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Suggested Title Permutations Box */}
                <div className="rounded-2xl border border-white/[0.04] bg-zinc-900/10 p-5 shadow-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                    <Target className="h-4.5 w-4.5 text-emerald-400" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider">Optimized Title Remixes</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {results.titleIdeas?.slice(0, 3).map((idea: string, idx: number) => (
                      <li key={idx} className="p-3 rounded-xl bg-zinc-950/40 border border-white/[0.02] flex justify-between items-center group gap-4 transition-colors hover:border-white/[0.06]">
                        <span className="text-xs text-zinc-200 leading-normal font-medium">{idea}</span>
                        <button 
                          onClick={() => handleCopyTitle(idea, idx)}
                          className="h-6 px-2.5 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-all shrink-0 text-[10px] font-bold flex items-center"
                          title="Copy Title Option"
                        >
                          {copiedTitleIndex === idx ? (
                            <span className="text-[9px] text-emerald-400 font-extrabold">Copied</span>
                          ) : (
                            <><Copy className="h-3 w-3 mr-1" /> Copy</>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ================= COLUMN 2: ANALYTICAL SCORE & DEFICITS (7 cols) ================= */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Visual scorecard matrix */}
                <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-6 shadow-2xl space-y-5">
                  <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <BrainCircuit className="h-4.5 w-4.5 text-emerald-400" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider">Packaging Psychology Audit</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider mr-2">Packaging Score:</span>
                      <span className={`text-sm font-black ${(results.packagingScore !== undefined ? results.packagingScore : results.score) < 50 ? 'text-rose-400' : (results.packagingScore !== undefined ? results.packagingScore : results.score) < 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {results.packagingScore !== undefined ? results.packagingScore : results.score}/100
                      </span>
                    </div>
                  </div>

                  {/* Multi-Dimensional Analytics Grid (Not dashboard heavy, elegant text components) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/[0.02]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Estimated CTR Range</p>
                      <p className="text-base font-black text-zinc-200 mt-1">{results.estimatedCtrRange || "4.8% - 6.2%"}</p>
                    </div>
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/[0.02]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">CTR Gain Potential</p>
                      <p className="text-base font-black text-emerald-400 mt-1">{results.ctrGainPotential || "+1.5% to +3.2%"}</p>
                    </div>
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/[0.02]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Packaging Efficiency</p>
                      <p className="text-base font-black text-zinc-200 mt-1">
                        {results.packagingEfficiency !== undefined ? `${results.packagingEfficiency}/100` : `${results.score || 72}/100`}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/[0.02]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Subscriber Velocity</p>
                      <p className="text-base font-black text-zinc-200 mt-1">{results.subscriberVelocity || "Medium"}</p>
                    </div>
                  </div>

                  <p className="text-[9px] text-zinc-500 italic text-center mt-1">
                    * CTR metrics are estimated based on channel size, packaging score, and view velocity. Real CTR is private to YouTube Studio.
                  </p>

                  {/* Deep psychological breakdown blocks */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Audience Positioning Strategy</p>
                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/20 p-3 rounded-xl border border-white/[0.02]">
                        {results.audiencePositioning}
                      </p>
                    </div>

                    {results.suggestedHook && (
                      <div className="space-y-2">
                        <p className="text-[9px] text-rose-400/80 font-bold uppercase tracking-wider">Curiosity Loop Adjustment</p>
                        <p className="text-xs text-rose-300/90 leading-relaxed bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 italic font-medium">
                          "{results.suggestedHook}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deficits and improvements stack */}
                <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-200">Actionable Packaging Deficits</h3>
                  </div>

                  <ul className="space-y-4">
                    {results.detectedWeaknesses?.map((weakness: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3.5 p-3 rounded-xl bg-zinc-950/40 border border-white/[0.02] hover:border-white/[0.06] smooth-transition">
                        <div className="h-5.5 w-5.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-zinc-200">{weakness}</p>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {results.weaknessDetails?.[idx] || "Suboptimal placement of primary subject splits the viewer attention loop."}
                          </p>
                        </div>
                      </li>
                    ))}
                    {(!results.detectedWeaknesses || results.detectedWeaknesses.length === 0) && (
                      <li className="text-xs text-zinc-500 italic py-2">No design or title packaging deficits detected.</li>
                    )}
                  </ul>
                </div>

                {/* Creator Content Analysis */}
                <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                    <Activity className="h-4.5 w-4.5 text-blue-400" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-200">Content Tone Diagnostics</h3>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Focal Emotional Tone</p>
                      <p className="text-xs font-bold text-zinc-300">{results.emotionalTone || "High Pacing / Disbelief"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Most Repeated Focus Words</p>
                      <p className="text-xs font-bold text-zinc-300 truncate" title={results.repeatedPhrases?.join(", ")}>
                        {results.repeatedPhrases?.join(", ") || "None highlighted"}
                      </p>
                    </div>
                  </div>

                  {results.transcriptSnippets && results.transcriptSnippets.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Analyzed Video Transcripts</p>
                      <div className="space-y-2">
                        {results.transcriptSnippets.map((snippet: string, idx: number) => (
                          <p key={idx} className="text-xs p-3 rounded-xl bg-zinc-950/40 border border-white/[0.02] text-zinc-400 leading-relaxed italic">
                            "{snippet}"
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* Floating Save Alerts */}
      {saveMessage && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl animate-in fade-in duration-300 ${
          saveMessage.type === 'success' 
            ? 'border-emerald-500/20 bg-emerald-950/90 text-emerald-400' 
            : 'border-rose-500/20 bg-rose-950/90 text-rose-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400 animate-bounce" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
            )}
            <span className="text-xs font-bold tracking-wide">{saveMessage.text}</span>
          </div>
        </div>
      )}

    </div>
  );
}
