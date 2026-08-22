"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  ArrowLeft, Search, Youtube, BarChart3, Target, AlertTriangle, 
  ExternalLink, Send, BookmarkPlus, Copy, BrainCircuit, CheckCircle2, 
  FileText, Activity, Layers, Sparkles, Check, Download, ChevronDown, 
  ChevronUp, Clock, Quote, Flame, TrendingUp, Compass, MessageSquare,
  CheckCheck, Play, Eye, ThumbsUp, Calendar, Zap, ShieldAlert, Sparkle
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

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
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

  // Video Intelligence UI State
  const [intelligenceTab, setIntelligenceTab] = useState<'summary' | 'transcript'>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const loadingSteps = [
    "Fetching YouTube Metadata & Telemetry...",
    "Analyzing Visual Contrast & Hierarchy...",
    "Parsing Spoken Transcript & Emotional Hooks...",
    "Calculating CTR Potential & Deficits..."
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

  // Real timestamped transcript array from backend YouTube caption track
  const fullTranscriptSegments = useMemo(() => {
    if (!results || !Array.isArray(results.fullTranscript)) return [];
    return results.fullTranscript;
  }, [results]);

  // Filtered transcript segments based on live search
  const filteredTranscriptSegments = useMemo(() => {
    if (!transcriptSearch.trim()) return fullTranscriptSegments;
    const query = transcriptSearch.toLowerCase().trim();
    return fullTranscriptSegments.filter((seg: any) => 
      seg.text.toLowerCase().includes(query) || 
      (seg.timestamp && seg.timestamp.toLowerCase().includes(query))
    );
  }, [fullTranscriptSegments, transcriptSearch]);

  const handleTimestampClick = (startSeconds: number) => {
    const videoId = extractVideoId(results?.videoUrl || url);
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`, '_blank', 'noopener,noreferrer');
    } else if (results?.videoUrl) {
      window.open(`${results.videoUrl}&t=${startSeconds}s`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyTranscript = () => {
    if (!fullTranscriptSegments.length) return;
    const formatted = fullTranscriptSegments
      .map((seg: any) => `[${seg.timestamp}] ${seg.text}`)
      .join('\n\n');

    navigator.clipboard.writeText(formatted);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleCopySummary = () => {
    if (!results) return;
    let summaryText = `AI EXECUTIVE SUMMARY: ${results.videoTitle}\n`;
    summaryText += `Creator: ${results.creatorName} (${results.creatorNiche || 'General'})\n\n`;
    if (results.exactHook) summaryText += `• Opening Hook: "${results.exactHook}"\n`;
    if (results.hookAnalysis) summaryText += `• Hook Dynamics: ${results.hookAnalysis}\n`;
    if (results.audiencePositioning) summaryText += `• Audience Positioning: ${results.audiencePositioning}\n`;
    if (results.retentionStyle) summaryText += `• Retention Architecture: ${results.retentionStyle}\n`;
    if (results.emotionalTone) summaryText += `• Emotional Tone: ${results.emotionalTone}\n`;
    if (results.topEmotionalWords?.length) summaryText += `• High-Stakes Keywords: ${results.topEmotionalWords.join(', ')}\n`;
    if (results.ctaStyle) summaryText += `• CTA Conversion Style: ${results.ctaStyle}\n`;
    if (results.detectedWeaknesses?.length) summaryText += `• Key Packaging Deficits: ${results.detectedWeaknesses.join('; ')}\n`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
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

  const packagingScoreValue = results 
    ? (results.packagingScore !== undefined ? results.packagingScore : results.score) 
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header bar */}
      <header className="px-6 md:px-8 h-16 flex items-center justify-between border-b border-white/[0.06] sticky top-0 z-50 bg-[#09090b]/85 backdrop-blur-xl transition-all">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center text-zinc-400 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider group mr-5"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Dashboard
          </Link>
          <div className="flex items-center ml-2 md:ml-5 border-l border-white/[0.08] pl-4 md:pl-5">
            <span className="relative flex h-2 w-2 mr-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold tracking-wider text-xs uppercase bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-400 bg-clip-text text-transparent">
              Intelligence Engine
            </span>
          </div>
        </div>

        {/* Global actions */}
        {results && (
          <div className="flex items-center gap-3 animate-in fade-in duration-200">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">Export:</span>
            <div className="flex bg-zinc-900/80 rounded-lg p-0.5 border border-white/[0.06] shadow-sm">
              <button 
                onClick={() => handleExport('pdf')} 
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-md transition-all active:scale-95"
                title="Export as PDF report"
              >
                <FileText className="w-3 h-3 text-zinc-400" /> PDF
              </button>
              <button 
                onClick={() => handleExport('docx')} 
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-md transition-all active:scale-95"
                title="Export as Word DOCX"
              >
                <FileText className="w-3 h-3 text-zinc-400" /> DOCX
              </button>
              <button 
                onClick={() => handleExport('csv')} 
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-md transition-all active:scale-95"
                title="Export raw data CSV"
              >
                <FileText className="w-3 h-3 text-zinc-400" /> CSV
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 container max-w-[1320px] py-10 md:py-14 mx-auto px-4 sm:px-6 md:px-8">
        
        {/* Spacious Top Headline */}
        <div className="flex flex-col items-center text-center space-y-3 mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 mb-1">
            <Sparkles className="w-3 h-3" />
            <span>AI Competitor Dissection OS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Analyze Competitor Packaging
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-[540px] leading-relaxed">
            Input any YouTube URL to dissect visual contrast, curiosity triggers, emotional stakes, spoken transcript cues, and retention packaging hooks.
          </p>
        </div>

        {/* Floating URL Input Bar */}
        <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto mb-10 md:mb-12">
          <div className="relative flex items-center bg-zinc-900/60 border border-white/[0.08] rounded-full p-1.5 shadow-2xl backdrop-blur-md focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all duration-200">
            <Youtube className="absolute left-4 sm:left-5 h-5 w-5 text-zinc-500 transition-colors" />
            <input
              type="text"
              placeholder="Paste YouTube video or Shorts link (e.g. https://youtube.com/watch?v=...)"
              className="w-full h-11 sm:h-12 bg-transparent pl-11 sm:pl-13 pr-28 sm:pr-32 text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
            />
            <button
              type="submit"
              disabled={isAnalyzing || !url.trim()}
              className="absolute right-1.5 h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all duration-150 disabled:opacity-40 disabled:hover:bg-zinc-100 active:scale-[0.97] shadow-md flex items-center gap-1.5"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
                  <span>Scanning</span>
                </>
              ) : (
                <>
                  <span>Dissect</span>
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Notification */}
        {error && (
          <div className="max-w-2xl mx-auto mb-10 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center justify-between animate-in fade-in duration-200 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-[10px] font-bold uppercase hover:underline ml-4 tracking-wider text-rose-400 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Progress State */}
        {isAnalyzing && (
          <div className="max-w-2xl mx-auto mb-12 p-6 rounded-2xl border border-white/[0.08] bg-zinc-900/40 backdrop-blur-xl shadow-2xl animate-in fade-in duration-300 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-zinc-200 tracking-wide">{loadingSteps[loadingStep]}</span>
              </div>
              <span className="text-xs text-emerald-400 font-black tracking-tight">{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</span>
            </div>
            
            <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]" 
                style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {loadingSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center space-y-1">
                  <div className={`h-1 w-full rounded-full transition-colors duration-300 ${idx <= loadingStep ? 'bg-emerald-500/80' : 'bg-zinc-800'}`} />
                  <span className={`text-[9px] uppercase font-bold tracking-tight ${idx <= loadingStep ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Step {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Redesigned Workspace Dissection Panels */}
        {results && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 md:space-y-8 max-w-6xl mx-auto">
            
            {/* Top workspace control triggers */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  Packaging Dissection Active
                </span>
                {results.creatorNiche && (
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/[0.06] text-[10px] font-semibold text-zinc-400">
                    {results.creatorNiche}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button 
                  onClick={handleSaveToCrm} 
                  disabled={isSavingCrm}
                  className="h-8.5 px-3.5 rounded-lg bg-zinc-900/90 border border-white/[0.08] hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center transition-all duration-150 active:scale-[0.98] disabled:opacity-50 shrink-0 shadow-sm"
                >
                  {isSavingCrm ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <BookmarkPlus className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                      <span>Save CRM</span>
                    </>
                  )}
                </button>

                <Link 
                  href={`/thumbnails?refTitle=${encodeURIComponent(results.videoTitle)}&refThumb=${encodeURIComponent(results.thumbnailUrl || '')}&refNiche=${encodeURIComponent(results.creatorNiche || '')}`}
                  className="h-8.5 px-3.5 rounded-lg bg-zinc-900/90 border border-white/[0.08] hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center transition-all duration-150 active:scale-[0.98] shrink-0 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                  <span>Remix Studio</span>
                </Link>

                <button 
                  onClick={handleTransferToOutreach} 
                  className="h-8.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all duration-150 active:scale-[0.98] flex items-center shadow-md shrink-0 ml-auto sm:ml-0"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  <span>Transfer Pitch</span>
                </button>
              </div>
            </div>

            {/* Premium 2-Column Side-By-Side Audit Workspace */}
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              
              {/* ================= COLUMN 1: IMAGE COMPILER VIEW (5 cols) ================= */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Visual Video Profile Card */}
                <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-200 hover:border-white/[0.12]">
                  <div className="aspect-video bg-zinc-950 relative overflow-hidden group">
                    <img 
                      src={results.thumbnailUrl || `https://img.youtube.com/vi/${extractVideoId(results.videoUrl) || ''}/maxresdefault.jpg`} 
                      alt="Video Thumbnail" 
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-[1.02]" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-90" />
                    
                    <a 
                      href={results.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]"
                      title="Open video on YouTube"
                    >
                      <div className="h-12 w-12 rounded-full bg-white/90 text-zinc-950 flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-5 w-5 ml-0.5 fill-current" />
                      </div>
                    </a>
                  </div>
                  
                  <div className="p-5 sm:p-6 space-y-5">
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-zinc-100 leading-snug tracking-tight">
                        {results.videoTitle}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mt-2.5">
                        <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-[9px] uppercase">
                          {results.channelName ? results.channelName.charAt(0) : 'Y'}
                        </div>
                        <span className="truncate">{results.channelName}</span>
                      </div>
                    </div>
                    
                    {/* Performance metrics grid */}
                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-4">
                      <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Eye className="w-3 h-3" />
                          <p className="text-[9px] font-bold uppercase tracking-wider">Views</p>
                        </div>
                        <p className="font-black text-sm text-zinc-200 mt-1">{results.views}</p>
                      </div>
                      <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <BarChart3 className="w-3 h-3" />
                          <p className="text-[9px] font-bold uppercase tracking-wider">Subscribers</p>
                        </div>
                        <p className="font-black text-sm text-zinc-200 mt-1">{results.subs}</p>
                      </div>
                      <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <ThumbsUp className="w-3 h-3" />
                          <p className="text-[9px] font-bold uppercase tracking-wider">Likes</p>
                        </div>
                        <p className="font-black text-sm text-zinc-200 mt-1">{results.likes || 'N/A'}</p>
                      </div>
                      <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Calendar className="w-3 h-3" />
                          <p className="text-[9px] font-bold uppercase tracking-wider">Uploaded</p>
                        </div>
                        <p className="font-black text-sm text-zinc-200 mt-1">{results.publishedAt}</p>
                      </div>
                    </div>

                    {/* Integrated action buttons */}
                    <div className="pt-2 border-t border-white/[0.04] flex gap-2.5">
                      <a 
                        href={results.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 h-9 rounded-lg border border-white/[0.06] bg-zinc-950/60 hover:bg-zinc-900 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-300 hover:text-white active:scale-[0.98]"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                        <span>Watch Video</span>
                      </a>
                      <button 
                        onClick={handleCopyAllData}
                        className="flex-1 h-9 rounded-lg border border-white/[0.06] bg-zinc-950/60 hover:bg-zinc-900 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-300 hover:text-white active:scale-[0.98]"
                      >
                        {copiedData ? (
                          <span className="text-[11px] text-emerald-400 font-bold flex items-center">
                            <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Copied JSON
                          </span>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                            <span>Copy Data</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Suggested Title Permutations Box */}
                <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-200 hover:border-white/[0.12]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-400" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-200">
                        Optimized Title Remixes
                      </h3>
                    </div>
                    {results.titlePatterns && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-950 border border-white/[0.04] text-zinc-400">
                        {results.titlePatterns}
                      </span>
                    )}
                  </div>
                  
                  <ul className="space-y-2.5">
                    {results.titleIdeas && results.titleIdeas.length > 0 ? (
                      results.titleIdeas.slice(0, 3).map((idea: string, idx: number) => (
                        <li 
                          key={idx} 
                          className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] flex justify-between items-start group gap-3 transition-all hover:border-white/[0.08] hover:bg-zinc-950/80"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="h-5 w-5 rounded-full bg-zinc-900 border border-white/[0.06] text-zinc-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-zinc-200 leading-relaxed font-medium">
                              {idea}
                            </span>
                          </div>
                          
                          <button 
                            onClick={() => handleCopyTitle(idea, idx)}
                            className="h-7 px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all shrink-0 text-[10px] font-bold flex items-center border border-white/[0.04] active:scale-95"
                            title="Copy title remix"
                          >
                            {copiedTitleIndex === idx ? (
                              <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Copied
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Copy className="h-3 w-3" /> Copy
                              </span>
                            )}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-zinc-500 italic p-3 text-center">
                        No title permutations generated.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Opening Hook & Curiosity Adjustment Card */}
                {results.suggestedHook && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 backdrop-blur-xl p-5 shadow-2xl space-y-3">
                    <div className="flex items-center gap-2 text-rose-400 border-b border-rose-500/10 pb-2.5">
                      <Quote className="h-4 w-4" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider">
                        Curiosity Loop Hook Adjustment
                      </h4>
                    </div>
                    <p className="text-xs text-rose-200/90 leading-relaxed italic font-medium bg-zinc-950/40 p-3.5 rounded-xl border border-rose-500/10">
                      "{results.suggestedHook}"
                    </p>
                    {results.hookAnalysis && (
                      <p className="text-[11px] text-zinc-400 leading-normal pl-1">
                        <strong className="text-zinc-300 font-bold">Diagnostics:</strong> {results.hookAnalysis}
                      </p>
                    )}
                  </div>
                )}

              </div>

              {/* ================= COLUMN 2: ANALYTICAL SCORE & DEFICITS (7 cols) ================= */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Visual scorecard matrix */}
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 transition-all duration-200 hover:border-white/[0.12]">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/[0.06] pb-4">
                    <div className="flex items-center gap-2 text-zinc-200">
                      <BrainCircuit className="h-4.5 w-4.5 text-emerald-400" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider">
                        Packaging Psychology Audit
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">
                        Packaging Score:
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        packagingScoreValue < 50 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : packagingScoreValue < 75 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {packagingScoreValue}/100
                      </span>
                    </div>
                  </div>

                  {/* Multi-Dimensional Analytics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Estimated CTR Range</p>
                      <p className="text-sm sm:text-base font-black text-zinc-200 mt-1">{results.estimatedCtrRange || "4.8% - 6.2%"}</p>
                    </div>
                    <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">CTR Gain Potential</p>
                      <p className="text-sm sm:text-base font-black text-emerald-400 mt-1">{results.ctrGainPotential || "+1.5% to +3.2%"}</p>
                    </div>
                    <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Packaging Efficiency</p>
                      <p className="text-sm sm:text-base font-black text-zinc-200 mt-1">
                        {results.packagingEfficiency !== undefined ? `${results.packagingEfficiency}/100` : `${results.score || 72}/100`}
                      </p>
                    </div>
                    <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-white/[0.03] transition-colors hover:border-white/[0.06]">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Subscriber Velocity</p>
                      <p className="text-sm sm:text-base font-black text-zinc-200 mt-1">{results.subscriberVelocity || "Medium"}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 italic text-center">
                    * CTR metrics are estimated based on channel size, packaging score, and view velocity. Real CTR is private to YouTube Studio.
                  </p>

                  {/* Deep psychological breakdown blocks */}
                  {results.audiencePositioning && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Compass className="w-3.5 h-3.5 text-zinc-400" />
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                          Audience Positioning Strategy
                        </p>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3.5 rounded-xl border border-white/[0.03]">
                        {results.audiencePositioning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Deficits and improvements stack */}
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-200 hover:border-white/[0.12]">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-200">
                      Actionable Packaging Deficits
                    </h3>
                  </div>

                  <ul className="space-y-3">
                    {results.detectedWeaknesses?.map((weakness: string, idx: number) => (
                      <li 
                        key={idx} 
                        className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] hover:border-white/[0.08] transition-all hover:bg-zinc-950/80"
                      >
                        <div className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-zinc-200">{weakness}</p>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {results.weaknessDetails?.[idx] || "Suboptimal placement of primary subject splits viewer attention loop."}
                          </p>
                        </div>
                      </li>
                    ))}
                    {(!results.detectedWeaknesses || results.detectedWeaknesses.length === 0) && (
                      <li className="text-xs text-zinc-500 italic py-2">
                        No major design or title packaging deficits detected.
                      </li>
                    )}
                  </ul>
                </div>

                {/* ========================================================================= */}
                {/* ⭐ VIDEO INTELLIGENCE (AI SUMMARY + REAL TIMESTAMPED TRANSCRIPT TABS) */}
                {/* ========================================================================= */}
                <div className="bg-zinc-900/35 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 transition-all duration-200 hover:border-white/[0.14] relative overflow-hidden">
                  
                  {/* Subtle decorative glow */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                  {/* Section Top Header & Tabs */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-emerald-400" />
                          <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-100">
                            Video Intelligence
                          </h3>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Understand what the creator actually said — not just how the video is packaged.
                        </p>
                      </div>

                      {/* Tab Switcher Buttons */}
                      <div className="flex bg-zinc-950/80 p-1 rounded-xl border border-white/[0.06] shrink-0 self-start sm:self-auto">
                        <button
                          onClick={() => setIntelligenceTab('summary')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                            intelligenceTab === 'summary'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Sparkle className="w-3 h-3" />
                          <span>Summary</span>
                        </button>

                        <button
                          onClick={() => setIntelligenceTab('transcript')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                            intelligenceTab === 'transcript'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Quote className="w-3 h-3" />
                          <span>Transcript</span>
                          {fullTranscriptSegments.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 border border-white/[0.04]">
                              {fullTranscriptSegments.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TAB 1: AI SUMMARY VIEW */}
                  {intelligenceTab === 'summary' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* Summary Sub-header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> AI Summary
                          </span>
                          <span className="text-[10px] text-zinc-500">Executive Content Synthesis</span>
                        </div>

                        <button
                          onClick={handleCopySummary}
                          className="h-7 px-2.5 rounded-md bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-all text-[10px] font-bold flex items-center border border-white/[0.04] active:scale-95"
                          title="Copy executive summary"
                        >
                          {copiedSummary ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                              <Check className="w-3 h-3" /> Copied
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Copy className="w-3 h-3" /> Copy Summary
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Core Argument / Opening Spoken Hook Block */}
                      <div className="p-4 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Core Hook & Narrative Intro
                        </p>
                        {results.exactHook ? (
                          <p className="text-xs text-zinc-200 font-medium leading-relaxed italic">
                            "{results.exactHook}"
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {results.hookAnalysis || "Direct instructional pacing with focused subject-matter delivery."}
                          </p>
                        )}
                        {results.hookAnalysis && results.exactHook && (
                          <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/[0.02]">
                            <strong className="text-zinc-300">Pacing Breakdown:</strong> {results.hookAnalysis}
                          </p>
                        )}
                      </div>

                      {/* Strategic Positioning & Retention Style */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Retention Architecture</p>
                          <p className="text-xs font-bold text-zinc-200 capitalize">{results.retentionStyle || "Standard pacing"}</p>
                          <p className="text-[10px] text-zinc-400">
                            Targeting: <span className="text-zinc-300 font-medium capitalize">{results.audienceType || "General"} audience</span>
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Emotional Tone Delivery</p>
                          <p className="text-xs font-bold text-zinc-200">{results.emotionalTone || "Informative"}</p>
                          <p className="text-[10px] text-zinc-400 truncate" title={results.topEmotionalWords?.join(", ")}>
                            High-stakes words: <span className="text-zinc-300 font-medium">{results.topEmotionalWords?.join(", ") || "None"}</span>
                          </p>
                        </div>
                      </div>

                      {/* High-Converting Spoken Phrases / Key Themes if available */}
                      {results.highConvertingPhrases && results.highConvertingPhrases.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                            High-Converting Spoken Dialogue Anchors
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {results.highConvertingPhrases.map((phrase: string, idx: number) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/[0.05] text-xs text-zinc-300 font-medium">
                                "{phrase}"
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conversion CTA Style */}
                      {(results.ctaStyle || (results.ctaOpportunities && results.ctaOpportunities.length > 0)) && (
                        <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                            Call-To-Action (CTA) Positioning
                          </p>
                          {results.ctaStyle && (
                            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                              {results.ctaStyle}
                            </p>
                          )}
                          {results.ctaOpportunities && results.ctaOpportunities[0] && (
                            <p className="text-[11px] text-zinc-400">
                              <strong className="text-zinc-300 font-semibold">Opportunity:</strong> {results.ctaOpportunities[0]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* What this means for Packaging Synergy */}
                      {results.detectedWeaknesses && results.detectedWeaknesses.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                            Content-to-Packaging Alignment
                          </p>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            The creator delivers strong content around <span className="text-zinc-100 font-bold">{results.videoTitle}</span>, but the packaging suffers from <span className="text-amber-300 font-medium">{results.detectedWeaknesses[0]}</span>. Aligning the thumbnail hook with the spoken intro will drastically increase early retention and CTR.
                          </p>
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB 2: REAL TIMESTAMPED CHRONOLOGICAL TRANSCRIPT VIEWER */}
                  {intelligenceTab === 'transcript' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* Search Bar & Copy Controls */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Search transcript..."
                            value={transcriptSearch}
                            onChange={(e) => setTranscriptSearch(e.target.value)}
                            className="w-full h-8.5 bg-zinc-950/70 border border-white/[0.06] rounded-lg pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-emerald-500/40 transition-colors"
                          />
                          {transcriptSearch && (
                            <button
                              onClick={() => setTranscriptSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {transcriptSearch && (
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              {filteredTranscriptSegments.length} match{filteredTranscriptSegments.length === 1 ? '' : 'es'}
                            </span>
                          )}

                          <button
                            onClick={handleCopyTranscript}
                            disabled={!fullTranscriptSegments.length}
                            className="h-8.5 px-3 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all text-xs font-semibold flex items-center border border-white/[0.06] active:scale-95 disabled:opacity-40"
                          >
                            {copiedTranscript ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-bold text-xs">
                                <Check className="w-3.5 h-3.5" /> Copied Transcript
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Copy Transcript</span>
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Real Chronological Transcript Viewer */}
                      <div className={`rounded-xl bg-zinc-950/70 border border-white/[0.04] p-3 sm:p-4 overflow-y-auto space-y-1 divide-y divide-white/[0.02] transition-all duration-300 ${
                        isTranscriptExpanded ? 'max-h-[600px]' : 'max-h-[320px]'
                      }`}>
                        {filteredTranscriptSegments.length > 0 ? (
                          filteredTranscriptSegments.map((seg: any, idx: number) => (
                            <div 
                              key={idx} 
                              className="group flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                            >
                              <button
                                onClick={() => handleTimestampClick(seg.startSeconds)}
                                className="shrink-0 font-mono text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/20 transition-all cursor-pointer flex items-center gap-1 active:scale-95 mt-0.5"
                                title={`Jump to ${seg.timestamp} on YouTube`}
                              >
                                <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                                <span>{seg.timestamp}</span>
                              </button>

                              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal flex-1">
                                {transcriptSearch ? highlightMatch(seg.text, transcriptSearch) : seg.text}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 text-center space-y-2">
                            <Quote className="w-6 h-6 text-zinc-600 mx-auto" />
                            <p className="text-xs text-zinc-400 font-medium">
                              {transcriptSearch 
                                ? `No transcript matching "${transcriptSearch}"`
                                : "Timestamped transcript unavailable for this video."}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {transcriptSearch 
                                ? "Try searching for a different phrase or keyword."
                                : "This video may not have public closed captions or auto-generated subtitles enabled on YouTube."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Expand / Collapse Action */}
                      {filteredTranscriptSegments.length > 6 && (
                        <div className="flex justify-center pt-1">
                          <button
                            onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950/70 border border-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all active:scale-95"
                          >
                            {isTranscriptExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                <span>Collapse Transcript</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Show Full Transcript ({filteredTranscriptSegments.length} segments)</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {/* Creator Content Analysis / Tone Diagnostics */}
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-200 hover:border-white/[0.12]">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
                    <Activity className="h-4.5 w-4.5 text-blue-400" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-200">
                      Content Tone Diagnostics
                    </h3>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-1">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Focal Emotional Tone</p>
                      <p className="text-xs font-bold text-zinc-200">{results.emotionalTone || "High Pacing / Disbelief"}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] space-y-1">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Most Repeated Focus Words</p>
                      <p className="text-xs font-bold text-zinc-200 truncate" title={results.repeatedPhrases?.join(", ") || results.mostRepeatedPhrases?.join(", ")}>
                        {results.repeatedPhrases?.join(", ") || results.mostRepeatedPhrases?.join(", ") || "None highlighted"}
                      </p>
                    </div>
                  </div>

                  {results.transcriptSnippets && results.transcriptSnippets.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Analyzed Video Transcripts</p>
                      <div className="space-y-2">
                        {results.transcriptSnippets.map((snippet: string, idx: number) => (
                          <p key={idx} className="text-xs p-3.5 rounded-xl bg-zinc-950/50 border border-white/[0.03] text-zinc-300 leading-relaxed italic">
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
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl animate-in fade-in duration-300 backdrop-blur-xl ${
          saveMessage.type === 'success' 
            ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300' 
            : 'border-rose-500/30 bg-rose-950/90 text-rose-300'
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
