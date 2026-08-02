"use client";

import { useState } from "react";
import { ArrowLeft, Search, Users, Activity, Eye, Play, Sparkles } from "lucide-react";
import Link from "next/link";

export default function CompetitorsPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 1500);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowConcepts(true);
    }, 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <Users className="h-5 w-5 text-emerald-500" />
          <span className="ml-2 font-bold tracking-tight">Competitor Intelligence</span>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl py-12 mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Competitor Analysis</h1>
            <p className="text-muted-foreground">Discover related videos and analyze their positioning.</p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search niche or paste URL..."
                className="flex h-10 w-full rounded-md border border-input bg-card px-9 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
              />
            </div>
            <button 
              onClick={handleSearch}
              disabled={isSearching}
              className="h-10 px-4 rounded-md bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center"
            >
              {isSearching ? <span className="animate-pulse">Searching...</span> : "Search"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Comparison Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Top Performing Competitors</h2>
              <span className="text-sm text-muted-foreground">Last 30 days</span>
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center h-64 border rounded-xl border-dashed">
                <p className="text-muted-foreground animate-pulse">Analyzing competitive landscape...</p>
              </div>
            ) : (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-6 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                  <div className="w-full sm:w-64 shrink-0 aspect-video bg-muted rounded-md relative overflow-hidden">
                    <img src={`https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=400&auto=format&fit=crop&sig=${i}`} alt="Thumbnail" className="object-cover w-full h-full opacity-80 mix-blend-luminosity" />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">12:34</div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-semibold text-lg line-clamp-2 mb-2">How to Build a $1M/MRR SaaS in 2026 (Full Blueprint)</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center"><Eye className="h-3.5 w-3.5 mr-1"/> 450K</span>
                      <span className="flex items-center"><Activity className="h-3.5 w-3.5 mr-1 text-emerald-500"/> High CTR</span>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-md bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Emotion</p>
                        <p className="text-sm font-medium">Aspirational / Proof</p>
                      </div>
                      <div className="p-3 rounded-md bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Visual Gap</p>
                        <p className="text-sm font-medium">Text-heavy vs Minimal</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar Insights */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
              <h3 className="font-semibold text-lg mb-4">Positioning Gaps</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Based on analyzing 50 top videos in this niche, here are the white-space opportunities.
              </p>
              <ul className="space-y-4">
                <li className="relative pl-6 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500">
                  <p className="font-medium text-sm">Missing "Anti-Tutorial" Angle</p>
                  <p className="text-xs text-muted-foreground mt-1">Everyone is making "How to" videos. A "Why you shouldn't" video would disrupt the feed.</p>
                </li>
                <li className="relative pl-6 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500">
                  <p className="font-medium text-sm">Underutilized Dark Aesthetic</p>
                  <p className="text-xs text-muted-foreground mt-1">90% of competitors use bright, saturated colors. A moody, cinematic thumbnail will stand out.</p>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-card-foreground shadow-sm p-6">
              <h3 className="font-semibold text-emerald-500 mb-2">Generate Differentiation</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use AI to generate title and thumbnail concepts that exploit these positioning gaps.
              </p>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full h-10 px-4 rounded-md bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isGenerating ? "Generating..." : "Generate Concepts"}
              </button>
            </div>

            {showConcepts && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="font-semibold mb-4 flex items-center"><Sparkles className="h-4 w-4 mr-2 text-emerald-500"/> Concept 1: The Warning</h3>
                <p className="text-sm font-medium border-l-2 border-emerald-500 pl-3 mb-3">
                  Title: Do NOT Build a SaaS in 2026 (Until You Watch This)
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Visual: Dark, moody lighting. You holding a red warning sign. Text overlay: "100% FAILURE RATE".
                </p>
                <Link href="/thumbnails" className="text-xs text-emerald-500 hover:underline">
                  Send to Thumbnail Studio →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
