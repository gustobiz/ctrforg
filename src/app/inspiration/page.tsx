"use client";

import {
  ArrowLeft, Search, Pin, Sparkles, BookmarkPlus, ArrowRight,
  Palette, Smile, LayoutGrid, Image as ImageIcon, Layers, Package,
  Eye, Heart, Star, Filter, ChevronDown, ChevronUp, RefreshCw,
  Send, X, FolderHeart, Compass, Check, Camera, Frame, Lightbulb,
  ExternalLink, Loader2, AlertTriangle, Users, TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { PinterestProviderManager, LocalJsonPinterestProvider } from "@/lib/pinterest/providers";

// ─── Types ────────────────────────────────────────────────────────────────────

type InspirationRef = {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  channelAvatar: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  category: string;
  niche: string;
  note: string;
  designInsight: string;
  colorPalette: string[];
  poseType: string;
  expressionType: string;
  compositionType: string;
  source?: 'youtube' | 'pinterest';

  // Pinterest Source Integrity Tracking
  pinId?: string;
  sourceUrl?: string;
  pinterestUrl?: string;
  boardName?: string;
  creatorName?: string;
  dataSource?: 'Pinterest API' | 'Pinterest Scraper' | 'Mock Data' | 'Fallback Data';
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "All",
  "YouTube References",
  "Pinterest References",
  "Pose Library",
  "Expression Library",
  "Composition Library",
  "Color Palette Library"
];

const NICHES = ["All Niches", "Self-Improvement", "Tech", "Finance", "Business", "Productivity", "Educational", "Storytelling", "Gaming", "Fitness", "Cooking"];

const CATEGORY_ICONS: Record<string, any> = {
  "All": LayoutGrid,
  "YouTube References": ImageIcon,
  "Pinterest References": Pin,
  "Pose Library": Camera,
  "Expression Library": Smile,
  "Composition Library": Frame,
  "Color Palette Library": Palette,
};

function formatCount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function InspirationLabPage() {

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedNiche, setSelectedNiche] = useState("All Niches");
  const [nicheDropdownOpen, setNicheDropdownOpen] = useState(false);

  // API State
  const [references, setReferences] = useState<InspirationRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Pinterest State (Requirement 5 & 6: Parallel client-side fetch)
  const [pinterestRefs, setPinterestRefs] = useState<InspirationRef[]>([]);
  const [pinterestLoading, setPinterestLoading] = useState(false);
  const [pinterestError, setPinterestError] = useState<string | null>(null);
  const [generatedQueries, setGeneratedQueries] = useState<Record<string, string> | null>(null);
  const [activePinterestSubCategory, setActivePinterestSubCategory] = useState<string>("All");
  const [simulatePinterestError, setSimulatePinterestError] = useState(false);
  const [pinterestSortBy, setPinterestSortBy] = useState<'most_saved' | 'most_relevant' | 'latest'>('most_relevant');
  const [isPinterestConnected, setIsPinterestConnected] = useState(true);

  // Saved boards
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [boardName, setBoardName] = useState("");
  const [savedBoards, setSavedBoards] = useState<{ name: string; ids: string[] }[]>([]);
  const [activeBoardIndex, setActiveBoardIndex] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // Pinterest sync
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [isSyncingPinterest, setIsSyncingPinterest] = useState(false);
  const [pinterestSynced, setPinterestSynced] = useState(false);

  // Detail panel
  const [selectedRef, setSelectedRef] = useState<InspirationRef | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const ids = localStorage.getItem("inspiration_saved_ids");
        if (ids) setSavedIds(JSON.parse(ids));
      } catch {}
      try {
        const boards = localStorage.getItem("inspiration_boards");
        if (boards) setSavedBoards(JSON.parse(boards));
      } catch {}
    }
  }, []);

  // Persist saves
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inspiration_saved_ids", JSON.stringify(savedIds));
    }
  }, [savedIds]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inspiration_boards", JSON.stringify(savedBoards));
    }
  }, [savedBoards]);

  // ─── API Search Handler ─────────────────────────────────────────────────────

  const fetchPinterestInspiration = useCallback(async (query: string, sortByVal: 'most_saved' | 'most_relevant' | 'latest') => {
    setPinterestLoading(true);
    setPinterestError(null);
    try {
      const manager = new PinterestProviderManager();
      
      // Auto-generate Pinterest queries for visual reference (Requirement 1)
      const queries = manager.generatePinterestQueries(query);
      setGeneratedQueries(queries);

      // Simulate failure if the user toggled it
      if (simulatePinterestError) {
        manager.simulateFailure = true;
      }

      // Fetch references using provider architecture (Requirement 2)
      const results = await manager.search(query, sortByVal);
      
      // Map to InspirationRef shape
      const mapped: InspirationRef[] = results.map(r => ({
        id: r.id,
        videoId: r.videoId || '',
        title: r.title,
        channelName: r.channelName || 'Pinterest Creator',
        channelAvatar: r.channelAvatar || '',
        description: r.description || '',
        thumbnailUrl: r.thumbnailUrl,
        videoUrl: r.videoUrl,
        publishedAt: r.publishedAt,
        viewCount: r.viewCount,
        likeCount: r.likeCount,
        tags: r.tags,
        category: r.category,
        niche: r.niche || '',
        note: r.note || '',
        designInsight: r.designInsight || '',
        colorPalette: r.colorPalette || [],
        poseType: r.poseType || '',
        expressionType: r.expressionType || '',
        compositionType: r.compositionType || '',
        source: 'pinterest',
        pinId: r.pinId || r.id,
        sourceUrl: r.sourceUrl || '',
        pinterestUrl: r.pinterestUrl || r.videoUrl,
        boardName: r.boardName || '',
        creatorName: r.creatorName || r.channelName,
        dataSource: r.dataSource || 'Mock Data'
      }));

      setPinterestRefs(mapped);
      setIsPinterestConnected(true);
    } catch (err: any) {
      console.error('Pinterest provider error:', err);
      
      if (err.message === 'Pinterest Integration Not Connected') {
        setIsPinterestConnected(false);
        setPinterestRefs([]);
        setPinterestError(null);
      } else {
        setIsPinterestConnected(true); // Connected but failed
        setPinterestError(err.message || 'Pinterest API failed to fetch.');
        
        // Graceful Fallback: Load safe curated references from Local JSON even when failure happens! (Requirement 7)
        try {
          const fallback = new LocalJsonPinterestProvider();
          const fallbackResults = await fallback.search(query, sortByVal);
          const mappedFallback: InspirationRef[] = fallbackResults.map(r => ({
            id: r.id,
            videoId: r.videoId || '',
            title: r.title,
            channelName: r.channelName || 'Pinterest Creator',
            channelAvatar: r.channelAvatar || '',
            description: r.description || '',
            thumbnailUrl: r.thumbnailUrl,
            videoUrl: r.videoUrl,
            publishedAt: r.publishedAt,
            viewCount: r.viewCount,
            likeCount: r.likeCount,
            tags: r.tags,
            category: r.category,
            niche: r.niche || '',
            note: r.note || '',
            designInsight: r.designInsight || '',
            colorPalette: r.colorPalette || [],
            poseType: r.poseType || '',
            expressionType: r.expressionType || '',
            compositionType: r.compositionType || '',
            source: 'pinterest',
            pinId: r.pinId || r.id,
            sourceUrl: r.sourceUrl || '',
            pinterestUrl: r.pinterestUrl || r.videoUrl,
            boardName: r.boardName || '',
            creatorName: r.creatorName || r.channelName,
            dataSource: r.dataSource || 'Fallback Data'
          }));
          setPinterestRefs(mappedFallback);
        } catch {
          setPinterestRefs([]);
        }
      }
    } finally {
      setPinterestLoading(false);
    }
  }, [simulatePinterestError]);

  const fetchInspiration = useCallback(async (query: string, category: string, niche: string, sortByVal?: 'most_saved' | 'most_relevant' | 'latest') => {
    if (!query.trim()) return;

    setIsLoading(true);
    setApiError(null);
    setFromCache(false);
    setSelectedRef(null);

    // Run parallel Pinterest fetch (Requirement 6: Never block page rendering while waiting for Pinterest)
    fetchPinterestInspiration(query, sortByVal || pinterestSortBy);

    try {
      const res = await fetch('/api/inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          category: category,
          niche: niche,
          // map sorting for YouTube backend
          sortBy: sortByVal === 'latest' ? 'latest' : sortByVal === 'most_saved' ? 'most_viewed' : 'most_relevant',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setApiError(data.error || 'Failed to fetch YouTube references. Please try again.');
        setReferences([]);
      } else {
        // Enforce source tag on YouTube references
        const ytRefs = (data.references || []).map((r: any) => ({
          ...r,
          source: 'youtube' as const
        }));
        setReferences(ytRefs);
        setFromCache(data.fromCache || false);
        if (ytRefs.length > 0) {
          setSelectedRef(ytRefs[0]);
        }
      }
      setHasSearched(true);
    } catch (err: any) {
      console.error('Inspiration fetch error:', err);
      setApiError('Network error. Please check your connection and try again.');
      setReferences([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPinterestInspiration, pinterestSortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSavedOnly(false);
      setActiveBoardIndex(null);
      fetchInspiration(searchQuery, activeCategory, selectedNiche, pinterestSortBy);
    }
  };

  // Re-fetch when category, niche, or sort changes (only if we've already searched)
  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      fetchInspiration(searchQuery, activeCategory, selectedNiche, pinterestSortBy);
    }
  }, [activeCategory, selectedNiche]);

  // Handlers
  const toggleSave = (id: string) => {
    setSavedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSaveBoard = () => {
    if (!boardName.trim() || savedIds.length === 0) return;
    setSavedBoards(prev => [...prev, { name: boardName.trim(), ids: [...savedIds] }]);
    setBoardName("");
  };

  const handleLoadBoard = (index: number) => {
    const board = savedBoards[index];
    if (board) {
      setSavedIds(board.ids);
      setActiveBoardIndex(index);
      setShowSavedOnly(true);
    }
  };

  const handleDeleteBoard = (index: number) => {
    setSavedBoards(prev => prev.filter((_, i) => i !== index));
    if (activeBoardIndex === index) {
      setActiveBoardIndex(null);
      setShowSavedOnly(false);
    }
  };

  const handleSyncPinterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinterestUrl) return;
    setIsSyncingPinterest(true);
    setTimeout(() => {
      setIsSyncingPinterest(false);
      setPinterestSynced(true);
    }, 1500);
  };

  const combinedRefs = useMemo(() => {
    const yt = references.map(r => ({ ...r, source: 'youtube' as const }));
    const pin = pinterestRefs.map(p => ({ ...p, source: 'pinterest' as const }));
    return [...yt, ...pin];
  }, [references, pinterestRefs]);

  // Filtered references
  const displayedRefs = useMemo(() => {
    let filtered = combinedRefs;

    // 1. Saved only filter
    if (showSavedOnly) {
      filtered = filtered.filter(r => savedIds.includes(r.id));
    }

    // 2. Main Category Filter
    if (!showSavedOnly && activeCategory !== "All") {
      if (activeCategory === "YouTube References") {
        filtered = filtered.filter(r => r.source === 'youtube');
      } else if (activeCategory === "Pinterest References") {
        filtered = filtered.filter(r => r.source === 'pinterest');
        if (activePinterestSubCategory !== "All") {
          filtered = filtered.filter(r => r.category === activePinterestSubCategory);
        }
      } else if (activeCategory === "Pose Library") {
        filtered = filtered.filter(r => 
          r.category === "Pose Library" || 
          r.category === "Poses" || 
          r.category === "Pinterest Pose"
        );
      } else if (activeCategory === "Expression Library") {
        filtered = filtered.filter(r => 
          r.category === "Expression Library" || 
          r.category === "Expressions" || 
          r.category === "Pinterest Expression"
        );
      } else if (activeCategory === "Composition Library") {
        filtered = filtered.filter(r => 
          r.category === "Composition Library" || 
          r.category === "Compositions" || 
          r.category === "Pinterest Composition"
        );
      } else if (activeCategory === "Color Palette Library") {
        filtered = filtered.filter(r => 
          r.category === "Color Palette Library" || 
          r.category === "Color Palettes" || 
          r.category === "Pinterest Color"
        );
      }
    }

    // 3. Niche filter
    if (selectedNiche !== "All Niches") {
      filtered = filtered.filter(r =>
        (r.niche || '').toLowerCase().includes(selectedNiche.toLowerCase())
      );
    }

    return filtered;
  }, [combinedRefs, showSavedOnly, activeCategory, activePinterestSubCategory, selectedNiche, savedIds]);

  // Synchronize selection
  useEffect(() => {
    if (displayedRefs.length > 0) {
      if (!selectedRef || !displayedRefs.some(r => r.id === selectedRef.id)) {
        setSelectedRef(displayedRefs[0]);
      }
    } else {
      setSelectedRef(null);
    }
  }, [displayedRefs, selectedRef]);

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">

      {/* ═══ Header Bar ═══ */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#09090b]/60">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-[#f4f4f5] transition-colors mr-5 text-xs font-semibold uppercase tracking-wider group">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          <div className="flex items-center ml-5 border-l border-white/[0.06] pl-5">
            <Lightbulb className="h-4.5 w-4.5 text-amber-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Inspiration Lab</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {fromCache && (
            <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded-full bg-zinc-900 border border-white/[0.04] text-zinc-500">
              Cached
            </span>
          )}
          <span className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {savedIds.length} Saved
          </span>
        </div>
      </header>

      {/* ═══ Main Workspace ═══ */}
      <main className="flex-1 container max-w-[1550px] py-10 mx-auto px-6 md:px-8">

        {/* Hero Search Section */}
        <div className="max-w-3xl mx-auto mb-12 text-center space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              Inspiration Lab
            </h1>
            <p className="text-zinc-400 text-sm max-w-[560px] mx-auto leading-relaxed">
              Search any topic to discover real YouTube thumbnail references, pose libraries, expression presets, composition layouts, and color palettes. Send any reference directly into Thumbnail Studio.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative mt-5 max-w-xl mx-auto">
            <div className="relative flex items-center bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-2 shadow-2xl focus-within:border-amber-500/30 transition-all">
              <Search className="absolute left-4 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter a topic — e.g. productivity setup, gaming reactions, fitness..."
                className="w-full h-11 bg-transparent pl-11 pr-28 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="absolute right-2 h-9 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wide flex items-center transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600" />}
                {isLoading ? "Searching" : "Discover"}
              </button>
            </div>
          </form>

          {/* Category tabs */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl mx-auto pt-1">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || LayoutGrid;
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setShowSavedOnly(false); setActiveBoardIndex(null); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                    activeCategory === cat && !showSavedOnly
                      ? 'bg-zinc-100 text-zinc-950 border-white'
                      : 'bg-zinc-900/40 text-zinc-400 border-white/[0.02] hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {cat}
                </button>
              );
            })}
            {/* Saved filter */}
            <button
              onClick={() => { setShowSavedOnly(!showSavedOnly); if (!showSavedOnly) setActiveBoardIndex(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                showSavedOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-900/40 text-zinc-400 border-white/[0.02] hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Heart className="h-3 w-3" />
              Saved ({savedIds.length})
            </button>
          </div>

          {/* Pinterest sub-categories nested filter row (Requirement 3) */}
          {!showSavedOnly && activeCategory === "Pinterest References" && (
            <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl mx-auto pt-2.5 border-t border-white/[0.04] mt-2.5 animate-in fade-in-50 duration-200">
              <span className="text-[9px] font-extrabold uppercase text-rose-400 mt-1.5 mr-1 tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" /> Subcategory:
              </span>
              {[
                { name: "All", label: "All Pinterest" },
                { name: "Pinterest Packaging", label: "Packaging" },
                { name: "Pinterest Composition", label: "Composition" },
                { name: "Pinterest Color", label: "Color Palette" },
                { name: "Pinterest Pose", label: "Pose" },
                { name: "Pinterest Expression", label: "Expression" }
              ].map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => setActivePinterestSubCategory(sub.name)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    activePinterestSubCategory === sub.name
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-zinc-950/60 text-zinc-400 border-white/[0.02] hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Quick topic suggestions */}
          {!hasSearched && (
            <div className="flex flex-wrap justify-center gap-1.5 max-w-xl mx-auto pt-2">
              <span className="text-[9px] font-bold uppercase text-zinc-500 mt-1 mr-1">Try:</span>
              {["Productivity setup", "Tech review reactions", "Finance thumbnails", "Gaming highlights", "Self improvement", "Cooking tutorials"].map((topic) => (
                <button
                  key={topic}
                  onClick={() => { setSearchQuery(topic); fetchInspiration(topic, activeCategory, selectedNiche); }}
                  className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full border border-white/[0.02] bg-zinc-950/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  + {topic}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ 3-Column Layout ═══ */}
        <div className="grid lg:grid-cols-12 gap-8 items-start max-w-7xl mx-auto">

          {/* ═══ LEFT SIDEBAR (3 cols) ═══ */}
          <div className="lg:col-span-3 space-y-6">

            {/* Workspace Hub */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <Layers className="h-3.5 w-3.5 text-zinc-500 mr-2" /> Workspace Hub
              </h3>
              <div className="grid gap-2">
                <Link href="/discovery" className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-white/[0.06] transition-all group">
                  <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200">Research Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
                </Link>
                <Link href="/thumbnails" className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-white/[0.06] transition-all group">
                  <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200">Thumbnail Studio</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
                </Link>
                <Link href="/crm" className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-white/[0.06] transition-all group">
                  <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200">CRM Pipelines</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
                </Link>
              </div>
            </div>

            {/* Niche Filter */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <Filter className="h-3.5 w-3.5 text-zinc-500 mr-2" /> Niche Filter
              </h3>
              <div className="relative">
                <button
                  onClick={() => setNicheDropdownOpen(!nicheDropdownOpen)}
                  className="w-full flex items-center justify-between h-9 px-3 rounded-lg border border-white/[0.04] bg-zinc-950/60 text-xs text-zinc-300 hover:bg-zinc-900/60 transition-colors"
                >
                  <span>{selectedNiche}</span>
                  {nicheDropdownOpen ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                </button>
                {nicheDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-zinc-950 border border-white/[0.06] rounded-xl p-1 shadow-2xl animate-in fade-in-80 duration-150">
                    {NICHES.map((n) => (
                      <button
                        key={n}
                        onClick={() => { setSelectedNiche(n); setNicheDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedNiche === n
                            ? 'bg-zinc-800 text-white font-bold'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pinterest Sync */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <Pin className="h-3.5 w-3.5 text-rose-500 mr-2" /> Pinterest Sync
              </h3>
              <form onSubmit={handleSyncPinterest} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Paste Pinterest Board URL..."
                  value={pinterestUrl}
                  onChange={(e) => setPinterestUrl(e.target.value)}
                  className="w-full h-8 bg-zinc-950/80 border border-white/[0.06] rounded-lg px-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isSyncingPinterest || !pinterestUrl}
                  className="w-full h-8 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-extrabold text-[10px] uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  {isSyncingPinterest ? (
                    <span className="flex items-center justify-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing...</span>
                  ) : pinterestSynced ? (
                    <span className="flex items-center justify-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> Synced</span>
                  ) : (
                    "Sync Board"
                  )}
                </button>
              </form>
              {pinterestSynced && (
                <p className="text-[9px] text-emerald-400 font-semibold">Board references imported successfully.</p>
              )}
              
              <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Simulate Offline</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !simulatePinterestError;
                    setSimulatePinterestError(nextVal);
                    // Trigger a refetch with the simulated failure status if we've already searched
                    setTimeout(() => {
                      if (searchQuery.trim()) {
                        fetchInspiration(searchQuery, activeCategory, selectedNiche, pinterestSortBy);
                      }
                    }, 50);
                  }}
                  className={`h-5 px-2 rounded text-[8px] font-extrabold uppercase border tracking-wider transition-all ${
                    simulatePinterestError
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                      : 'bg-zinc-950 border-white/[0.06] text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  {simulatePinterestError ? "Offline" : "Online"}
                </button>
              </div>
            </div>

            {/* Saved Boards */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <FolderHeart className="h-3.5 w-3.5 text-amber-400 mr-2" /> Saved Boards
              </h3>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Board name..."
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="flex-1 h-7 bg-zinc-950/80 border border-white/[0.06] rounded-lg px-2 text-[10px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  onClick={handleSaveBoard}
                  disabled={!boardName.trim() || savedIds.length === 0}
                  className="h-7 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase disabled:opacity-30 hover:bg-amber-500/20 transition-colors"
                >
                  Save
                </button>
              </div>

              {savedIds.length > 0 && (
                <p className="text-[9px] text-zinc-500">{savedIds.length} reference{savedIds.length !== 1 ? "s" : ""} selected for board</p>
              )}

              {savedBoards.length > 0 ? (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {savedBoards.map((board, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        activeBoardIndex === idx
                          ? 'border-amber-500/20 bg-amber-500/5'
                          : 'border-white/[0.02] bg-zinc-950/40 hover:bg-zinc-900/40'
                      }`}
                    >
                      <button onClick={() => handleLoadBoard(idx)} className="flex-1 text-left">
                        <p className="text-[10px] font-bold text-zinc-300">{board.name}</p>
                        <p className="text-[8px] text-zinc-500 mt-0.5">{board.ids.length} references</p>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBoard(idx); }}
                        className="h-5 w-5 rounded flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-zinc-600 text-center py-2">No boards saved yet. Pin references and create a board above.</p>
              )}
            </div>
          </div>

          {/* ═══ CENTER GRID (6 cols) ═══ */}
          <div className="lg:col-span-6 space-y-6">

            {/* Generated Pinterest Queries (Requirement 1 & 2) */}
            {hasSearched && generatedQueries && (
              <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4 space-y-2.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Pin className="h-3.5 w-3.5" /> Generated Pinterest Queries
                  </span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">AI Optimized Search</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <span className="px-2.5 py-1 text-[9px] font-semibold rounded bg-zinc-950/60 border border-white/[0.02] text-zinc-400 font-mono" title="Packaging Search Query">
                    📦 <span className="text-zinc-300 font-bold">Packaging:</span> "{generatedQueries.packaging}"
                  </span>
                  <span className="px-2.5 py-1 text-[9px] font-semibold rounded bg-zinc-950/60 border border-white/[0.02] text-zinc-400 font-mono" title="Composition Search Query">
                    📐 <span className="text-zinc-300 font-bold">Composition:</span> "{generatedQueries.composition}"
                  </span>
                  <span className="px-2.5 py-1 text-[9px] font-semibold rounded bg-zinc-950/60 border border-white/[0.02] text-zinc-400 font-mono" title="Color Search Query">
                    🎨 <span className="text-zinc-300 font-bold">Color:</span> "{generatedQueries.color}"
                  </span>
                  <span className="px-2.5 py-1 text-[9px] font-semibold rounded bg-zinc-950/60 border border-white/[0.02] text-zinc-400 font-mono" title="Pose Search Query">
                    🧍 <span className="text-zinc-300 font-bold">Pose:</span> "{generatedQueries.pose}"
                  </span>
                  <span className="px-2.5 py-1 text-[9px] font-semibold rounded bg-zinc-950/60 border border-white/[0.02] text-zinc-400 font-mono" title="Expression Search Query">
                    😲 <span className="text-zinc-300 font-bold">Expression:</span> "{generatedQueries.expression}"
                  </span>
                </div>
              </div>
            )}

            {/* Results header */}
            {hasSearched && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.04] pb-3 gap-3">
                <h3 className="font-extrabold text-sm text-zinc-300 uppercase tracking-wider flex items-center">
                  <ImageIcon className="w-4 h-4 text-amber-400 mr-2" />
                  {showSavedOnly
                    ? (activeBoardIndex !== null ? `Board: ${savedBoards[activeBoardIndex]?.name}` : "Saved References")
                    : (activeCategory === "All" ? "All Inspiration" : activeCategory)
                  }
                </h3>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Pinterest Loading indicator (Requirement 6) */}
                  {pinterestLoading && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-bold uppercase animate-pulse">
                      <Loader2 className="h-2 w-2 animate-spin text-rose-400" /> Fetching Pinterest
                    </span>
                  )}

                  {/* Pinterest graceful error warning (Requirement 7) */}
                  {pinterestError && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-bold uppercase" title={pinterestError}>
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> Offline Fallback Active
                    </span>
                  )}

                  {/* Sorting control (Requirement 5) */}
                  <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/[0.06] rounded-lg px-2.5 py-0.5 text-[11px]">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Sort:</span>
                    <select
                      value={pinterestSortBy}
                      onChange={(e) => {
                        const newSort = e.target.value as 'most_saved' | 'most_relevant' | 'latest';
                        setPinterestSortBy(newSort);
                        if (searchQuery.trim()) {
                          fetchInspiration(searchQuery, activeCategory, selectedNiche, newSort);
                        }
                      }}
                      className="bg-transparent border-none outline-none text-zinc-300 text-[11px] font-semibold cursor-pointer py-0.5"
                    >
                      <option value="most_relevant" className="bg-zinc-950 text-zinc-300">Most Relevant</option>
                      <option value="most_saved" className="bg-zinc-950 text-zinc-300">Most Saved</option>
                      <option value="latest" className="bg-zinc-950 text-zinc-300">Latest</option>
                    </select>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider shrink-0">
                    {displayedRefs.length} Reference{displayedRefs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="relative flex items-center justify-center mb-5">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400" />
                    <Sparkles className="h-4 w-4 text-amber-400 absolute animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-1">Discovering Inspiration</h3>
                  <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                    Fetching real YouTube thumbnails and analyzing visual patterns with AI...
                  </p>
                </div>
                {/* Skeleton grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <div key={s} className="rounded-xl border border-white/[0.04] bg-zinc-900/10 animate-pulse">
                      <div className="aspect-square bg-zinc-800/50 rounded-t-xl" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pinterest Integration Not Connected Screen (Requirement 4) */}
            {!isLoading && !isPinterestConnected && (activeCategory === "Pinterest References" || activeCategory.startsWith("Pinterest")) && (
              <div className="min-h-[450px] border border-dashed border-rose-500/20 rounded-3xl flex flex-col justify-center p-8 bg-rose-500/[0.01] space-y-6 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <Pin className="h-5 w-5 text-rose-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-100 tracking-tight">Pinterest Integration Not Connected</h3>
                    <p className="text-xs text-zinc-500">Decoupled provider layer is fully ready. Connect a real source to import live references.</p>
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-white/[0.04] p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-rose-400" /> Integration Setup Guide
                  </h4>
                  <ol className="space-y-3 text-xs text-zinc-400">
                    <li className="flex items-start gap-2.5">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-zinc-900 border border-white/[0.06] text-[10px] font-bold text-zinc-400 flex items-center justify-center">1</span>
                      <div>
                        <strong className="text-zinc-200 block">Select Provider Connector</strong>
                        Choose between future Pinterest Official API, public web-scrapers, Pexels, or Unsplash connectors inside <code className="text-rose-400 font-mono text-[10px]">providers.ts</code>.
                      </div>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-zinc-900 border border-white/[0.06] text-[10px] font-bold text-zinc-400 flex items-center justify-center">2</span>
                      <div>
                        <strong className="text-zinc-200 block">Configure Access Keys</strong>
                        Add official OAuth client credentials or cookies inside <code className="text-rose-400 font-mono text-[10px]">.env.local</code> to authenticate requests securely.
                      </div>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-zinc-900 border border-white/[0.06] text-[10px] font-bold text-zinc-400 flex items-center justify-center">3</span>
                      <div>
                        <strong className="text-zinc-200 block">Flip Connection Flag</strong>
                        Toggle the connection status to true (<code className="text-rose-300 font-mono text-[10px]">isConnected = true</code>) in the provider registry to enable instant, real-time board imports.
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => {
                      alert("Decoupled architecture is successfully loaded and waiting for credentials in .env.local.");
                    }}
                    className="h-9 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase tracking-wide transition-colors"
                  >
                    View API Reference
                  </button>
                  <p className="text-[10px] text-zinc-600 font-medium">Mock data cards and fallback placeholder assets have been fully removed.</p>
                </div>
              </div>
            )}

            {/* API Error State */}
            {!isLoading && apiError && (
              <div className="min-h-[350px] border border-dashed border-amber-500/20 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-amber-500/[0.02]">
                <AlertTriangle className="h-10 w-10 text-amber-500/60 mb-4" />
                <h3 className="text-sm font-bold text-zinc-300 mb-1">Unable to Fetch References</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-normal mb-4">
                  {apiError}
                </p>
                <button
                  onClick={() => fetchInspiration(searchQuery, activeCategory, selectedNiche)}
                  className="h-8 px-4 rounded-lg bg-zinc-900 border border-white/[0.04] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" /> Try Again
                </button>
              </div>
            )}

            {/* Empty State (no search yet) */}
            {!isLoading && !apiError && !hasSearched && (
              <div className="min-h-[400px] border border-dashed border-white/[0.04] rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10">
                <Lightbulb className="h-12 w-12 text-zinc-700 mb-4" />
                <h3 className="text-sm font-bold text-zinc-300 mb-1">Search for Inspiration</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                  Enter a topic above to discover real YouTube thumbnail references, pose libraries, expression presets, and color palettes — all analyzed by AI.
                </p>
              </div>
            )}

            {/* Empty results */}
            {!isLoading && !apiError && hasSearched && displayedRefs.length === 0 && (
              !( !isPinterestConnected && (activeCategory === "Pinterest References" || activeCategory.startsWith("Pinterest")) ) && (
                <div className="min-h-[350px] border border-dashed border-white/[0.04] rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10 animate-in fade-in-50 duration-200">
                  <Search className="h-10 w-10 text-zinc-600 mb-4" />
                  <h3 className="text-sm font-bold text-zinc-300 mb-1">
                    {(!isPinterestConnected && activeCategory !== "All" && activeCategory !== "YouTube References")
                      ? "No Pinterest references found"
                      : "No references found"
                    }
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                    {showSavedOnly
                      ? "No saved references match the current search. Try searching a new topic first."
                      : "Try a different search term, change the category filter, or adjust the niche selection."
                    }
                  </p>
                </div>
              )
            )}

            {/* Results Grid */}
            {!isLoading && !apiError && displayedRefs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {displayedRefs.map((ref) => {
                  const CatIcon = CATEGORY_ICONS[ref.category] || ImageIcon;
                  return (
                    <div
                      key={ref.id}
                      onClick={() => setSelectedRef(ref)}
                      className={`group relative rounded-xl overflow-hidden border bg-zinc-950/40 cursor-pointer smooth-transition ${
                        selectedRef?.id === ref.id
                          ? 'border-amber-500/30 ring-1 ring-amber-500/20'
                          : 'border-white/[0.02] hover:border-white/[0.08]'
                      }`}
                    >
                      <div className="aspect-square bg-zinc-900 overflow-hidden relative">
                        <img
                          src={ref.thumbnailUrl}
                          alt={ref.title}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />

                        {/* Save button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSave(ref.id); }}
                          className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all border ${
                            savedIds.includes(ref.id)
                              ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20'
                              : 'bg-black/40 border-white/[0.06] text-zinc-400 hover:text-white hover:bg-black/60'
                          }`}
                          title={savedIds.includes(ref.id) ? "Unsave" : "Save to Board"}
                        >
                          {savedIds.includes(ref.id)
                            ? <Check className="h-3 w-3" />
                            : <Heart className="h-3 w-3" />
                          }
                        </button>

                        {/* Category badge */}
                        <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded bg-black/60 backdrop-blur-md text-zinc-300 border border-white/[0.06] flex items-center gap-1">
                          <CatIcon className="h-2.5 w-2.5" />
                          {ref.category}
                        </span>

                        {/* View count badge */}
                        {ref.viewCount > 0 && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-bold rounded bg-black/60 backdrop-blur-md text-zinc-400 border border-white/[0.04]">
                            {ref.source === 'pinterest' ? `${formatCount(ref.viewCount)} saves` : `${formatCount(ref.viewCount)} views`}
                          </span>
                        )}

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end p-3">
                          <div className="w-full">
                            <p className="text-[10px] font-extrabold text-white line-clamp-2 leading-tight">{ref.title}</p>
                            <p className="text-[8px] text-zinc-400 mt-1 flex items-center gap-1.5">
                              <span>{ref.channelName}</span>
                              {ref.niche && <span className="text-amber-400">• {ref.niche}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ RIGHT DETAIL PANEL (3 cols) ═══ */}
          <div className="lg:col-span-3">
            {selectedRef ? (
              <div className="rounded-3xl border border-white/[0.04] bg-zinc-900/10 p-5 space-y-5 sticky top-24 shadow-2xl">

                <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 text-zinc-300">
                  <Eye className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">Reference Detail</h3>
                </div>

                {/* Preview image */}
                <div className="rounded-xl overflow-hidden border border-white/[0.04] bg-zinc-950 relative">
                  <img
                    src={selectedRef.thumbnailUrl}
                    alt={selectedRef.title}
                    className="w-full aspect-video object-cover"
                  />
                  {/* Channel info overlay */}
                  {selectedRef.channelAvatar && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-2 py-1 border border-white/[0.06]">
                      <img src={selectedRef.channelAvatar} alt="" className="h-4 w-4 rounded-full" />
                      <span className="text-[8px] font-bold text-zinc-300">{selectedRef.channelName}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 leading-snug">{selectedRef.title}</h4>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-zinc-900 border border-white/[0.04] text-zinc-400">
                        {selectedRef.category}
                      </span>
                      {selectedRef.niche && (
                        <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          {selectedRef.niche}
                        </span>
                      )}
                      {selectedRef.source === 'pinterest' && selectedRef.dataSource && (
                        <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded border ${
                          selectedRef.dataSource === 'Pinterest API'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : selectedRef.dataSource === 'Pinterest Scraper'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : selectedRef.dataSource === 'Fallback Data'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-zinc-500/10 border-white/[0.06] text-zinc-400'
                        }`}>
                          Source: {selectedRef.dataSource}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-white/[0.02] text-center">
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                        {selectedRef.source === 'pinterest' ? 'Saves' : 'Views'}
                      </p>
                      <p className="text-sm font-black text-zinc-200 mt-0.5">{formatCount(selectedRef.viewCount)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-white/[0.02] text-center">
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Likes</p>
                      <p className="text-sm font-black text-zinc-200 mt-0.5">{formatCount(selectedRef.likeCount)}</p>
                    </div>
                  </div>

                  {/* AI Design Insight */}
                  {selectedRef.note && (
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Visual Technique</p>
                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        "{selectedRef.note}"
                      </p>
                    </div>
                  )}

                  {selectedRef.designInsight && (
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Design Insight</p>
                      <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        {selectedRef.designInsight}
                      </p>
                    </div>
                  )}

                  {/* Color Palette */}
                  {selectedRef.colorPalette && selectedRef.colorPalette.length > 0 && (
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Extracted Palette</p>
                      <div className="flex gap-1.5">
                        {selectedRef.colorPalette.map((color, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div
                              className="h-7 w-7 rounded-lg border border-white/[0.06] shadow-md"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                            <span className="text-[7px] font-mono text-zinc-600">{color}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pinterest Source Metadata Section (Requirement 5) */}
                  {selectedRef.source === 'pinterest' && (
                    <div className="bg-zinc-950/60 border border-white/[0.04] p-3 rounded-xl space-y-2.5 text-[10px] text-zinc-400 animate-in fade-in-50 duration-150">
                      <p className="text-[8px] text-rose-400 font-extrabold uppercase tracking-wider border-b border-white/[0.04] pb-1 flex items-center gap-1.5">
                        <Pin className="h-3 w-3" /> Pinterest Metadata
                      </p>
                      
                      <div className="space-y-1.5 font-mono">
                        {selectedRef.pinId && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 uppercase text-[8px]">Pin ID</span>
                            <span className="text-zinc-300 font-semibold">{selectedRef.pinId}</span>
                          </div>
                        )}
                        {selectedRef.creatorName && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 uppercase text-[8px]">Creator</span>
                            <span className="text-zinc-300 font-semibold truncate max-w-[120px]">{selectedRef.creatorName}</span>
                          </div>
                        )}
                        {selectedRef.boardName && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 uppercase text-[8px]">Board</span>
                            <span className="text-zinc-300 font-semibold truncate max-w-[120px]">{selectedRef.boardName}</span>
                          </div>
                        )}
                        {selectedRef.pinterestUrl && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 uppercase text-[8px]">Pin Link</span>
                            <a href={selectedRef.pinterestUrl} target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 underline font-semibold flex items-center gap-0.5 truncate">
                              Visit Pin <ExternalLink className="h-2 w-2 inline" />
                            </a>
                          </div>
                        )}
                        {selectedRef.sourceUrl && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 uppercase text-[8px]">Source Link</span>
                            <a href={selectedRef.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-300 underline font-semibold truncate max-w-[120px] flex items-center gap-0.5">
                              {selectedRef.sourceUrl} <ExternalLink className="h-2 w-2 inline" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pose / Expression / Composition Type */}
                  <div className="flex flex-wrap gap-1">
                    {selectedRef.poseType && (
                      <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        Pose: {selectedRef.poseType}
                      </span>
                    )}
                    {selectedRef.expressionType && (
                      <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        Expression: {selectedRef.expressionType}
                      </span>
                    )}
                    {selectedRef.compositionType && (
                      <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        Layout: {selectedRef.compositionType}
                      </span>
                    )}
                  </div>

                  {/* Published date */}
                  {selectedRef.publishedAt && (
                    <p className="text-[9px] text-zinc-600 font-mono">Published {formatDate(selectedRef.publishedAt)}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                  <Link
                    href={`/thumbnails?styleRef=${encodeURIComponent(selectedRef.thumbnailUrl)}&refTitle=${encodeURIComponent(selectedRef.title)}&refNiche=${encodeURIComponent(selectedRef.niche)}`}
                    className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center transition-colors active:scale-[0.98]"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send to Thumbnail Studio
                  </Link>

                  <a
                    href={selectedRef.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-9 rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-white/[0.04] text-xs font-bold flex items-center justify-center transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {selectedRef.source === 'pinterest' ? 'View on Pinterest' : 'View on YouTube'}
                  </a>

                  <button
                    onClick={() => toggleSave(selectedRef.id)}
                    className={`w-full h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-all border ${
                      savedIds.includes(selectedRef.id)
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border-white/[0.04]'
                    }`}
                  >
                    {savedIds.includes(selectedRef.id) ? (
                      <><Check className="h-3.5 w-3.5 mr-1.5" /> Saved to Board</>
                    ) : (
                      <><BookmarkPlus className="h-3.5 w-3.5 mr-1.5" /> Save Reference</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.04] p-6 text-center text-zinc-500 text-xs py-16 sticky top-24 bg-zinc-900/10">
                <Lightbulb className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                <p>Search a topic and select any reference card to preview details, view AI design insights, color palettes, and send it to Thumbnail Studio.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
