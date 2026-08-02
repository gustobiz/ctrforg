"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, ImageIcon, Sparkles, Wand2, LayoutPanelLeft, Palette, Type, 
  Loader2, Check, Lock, Zap, Sliders, Play, Eye, Layers, HelpCircle, 
  Activity, Compass, Heart, AlertCircle, TrendingUp, Info, Plus, 
  Trash2, ArrowUpRight, Cpu, Film, Download, Smile, Maximize, Trash, 
  ExternalLink, FileText, Send, Share2, Clipboard, ArrowRight, ShieldCheck,
  Users
} from "lucide-react";
import CompareSlider from "@/components/thumbnails/compare-slider";
import Gauge from "@/components/thumbnails/gauge";
import { useAppStore } from "@/lib/store";

// High-performing YouTube style realistic assets (No illustrations/anime)
const VARIANT_ASSETS = [
  {
    id: 1,
    title: "Variant A: Peak Exhaustion",
    subtitle: "High Curiosity & Contrast",
    originalUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop",
    refinedUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
    ctr: 89,
    emotion: 94,
    curiosity: 91,
    viral: 85,
    psychology: [
      { type: "strength", text: "Exceptional contrast split highlights end goals." },
      { type: "strength", text: "Focal weight directly draws eye to exhausted face expression." },
      { type: "warning", text: "Text overlay 'I FAILED' occupies slightly too much canvas height." }
    ],
    strategy: "Split screen structure creates an instant narrative loop. Apply heavy color grading highlights around the subject edge."
  },
  {
    id: 2,
    title: "Variant B: Cyberpunk Setup",
    subtitle: "Tech-Focused & Vivid",
    originalUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    refinedUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop",
    ctr: 74,
    emotion: 81,
    curiosity: 78,
    viral: 69,
    psychology: [
      { type: "strength", text: "Glow dynamics offer powerful casual-scroll retention." },
      { type: "warning", text: "Background elements are slightly busy, diluting focal weight." },
      { type: "warning", text: "Subtle emotional hook expression is missing from the subject." }
    ],
    strategy: "Best suited for tech and setup audits. Blur background elements by 15% to direct the focal path to the primary gadget."
  },
  {
    id: 3,
    title: "Variant C: Golden Silhouette",
    subtitle: "Cinematic Mystery & Depth",
    originalUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=800&auto=format&fit=crop",
    refinedUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop",
    ctr: 92,
    emotion: 88,
    curiosity: 95,
    viral: 91,
    psychology: [
      { type: "strength", text: "Silhouette element triggers massive curiosity questions." },
      { type: "strength", text: "Golden color gradient feels high premium and cinematic." },
      { type: "strength", text: "Depth of field guides eye directly through the focal center." }
    ],
    strategy: "Excellent for mysterious or high-budget adventure narratives. Keep title typography clean and offset to the lower right."
  }
];

export default function ThumbnailsPage() {
  const { crmLeads, currentAnalysis } = useAppStore();
  const [activeTab, setActiveTab] = useState("generator"); // generator, ideation, expression, upscale, preview
  const [prompt, setPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [activeVariantId, setActiveVariantId] = useState(1);
  const [showCompare, setShowCompare] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  
  // Custom Controls Left Sidebar States
  const [promptMode, setPromptMode] = useState("cinematic");
  const [emotionalAngle, setEmotionalAngle] = useState("shock");
  const [composition, setComposition] = useState("split");
  const [hierarchy, setHierarchy] = useState("subject");
  const [titlePairing, setTitlePairing] = useState("fomo");
  const [stylePreset, setStylePreset] = useState("unreal");

  // Reference Upload States
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);

  // Tab Specific States
  // 1. Ideation
  const [ideationMode, setIdeationMode] = useState("Text Prompt");
  const [competitorLink, setCompetitorLink] = useState("");
  const [pinterestRef, setPinterestRef] = useState("");
  const [sketchFile, setSketchFile] = useState<string | null>(null);
  const [generatedIdeas, setGeneratedIdeas] = useState<any | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

  // 2. Expression
  const [selectedEmotion, setSelectedEmotion] = useState("shocked");
  const [selectedPose, setSelectedPose] = useState("pointing");

  // 3. Upscaler
  const [upscaleFile, setUpscaleFile] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaledResult, setUpscaledResult] = useState<string | null>(null);
  const [upscaleSettings, setUpscaleSettings] = useState({
    upscale4k: true,
    sharpen: true,
    faceRestore: true,
    lightingRecover: false,
    textClarity: true
  });

  // 4. Downloader
  const [downloaderUrl, setDownloaderUrl] = useState("");
  const [downloaderResult, setDownloaderResult] = useState<any | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Generation History State
  const [history, setHistory] = useState([
    { id: 1, prompt: "Cinematic portrait of exhausted creator looking at glowing computer, deep shadows", date: "10 mins ago", active: true },
    { id: 2, prompt: "Cohesive warm glowing workspace audit silhouette, premium camera depth", date: "2 hours ago", active: false },
    { id: 3, prompt: "Hyper-detailed camera close-up of hands on head in distress, low compression artifacts", date: "Yesterday", active: false }
  ]);

  // Loading indicator descriptions
  const loadingSteps = [
    "Deconstructing Prompt Visual Syntax...",
    "Auditing Emotional Psychology Vectors...",
    "Optimizing Graphic Contrast & Focal Paths...",
    "Assembling Cinematic High-Definition Mockup..."
  ];

  const activeVariant = VARIANT_ASSETS.find(v => v.id === activeVariantId) || VARIANT_ASSETS[0];

  // Hydrate styleRef or competitor references from URL parameters if passed from Discovery/Analyze pages
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const styleRefParam = params.get("styleRef");
      const refTitleParam = params.get("refTitle");
      const refThumbParam = params.get("refThumb");
      const refNicheParam = params.get("refNiche");

      if (styleRefParam) {
        setUploadedFile(styleRefParam);
        setPrompt("Cinematic thumbnail remixed from Pinterest reference visual styles, soft lighting...");
        setActiveTab("generator");
      } else if (refTitleParam) {
        setPrompt(`Realistic photorealistic YouTube concept remixed from target competitor style, focusing on: "${refTitleParam}"...`);
        setStylePreset("unreal");
        setComposition("split");
        setEmotionalAngle("shock");
        if (refThumbParam) {
          setUploadedFile(refThumbParam);
        }
        setActiveTab("generator");
      }
    }
  }, []);

  const handleSuperchargePrompt = () => {
    if (!prompt && !history[0].prompt) return;
    setIsEnhancing(true);
    
    setTimeout(() => {
      const supercharged = `Highly dramatic, high-contrast realistic cinematic portrait of a subject looking in absolute ${emotionalAngle} at a glowing monitor screen. Structured with ${composition} splits, featuring precise volumetric depth, rich HSL camera lighting, styled using ${stylePreset} details. Maximum realism, strictly not illustration.`;
      setPrompt(supercharged);
      setIsEnhancing(false);
    }, 1000);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep(0);
    
    const interval = setInterval(() => {
      setGenerationStep(prev => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 700);

    setTimeout(() => {
      clearInterval(interval);
      setIsGenerating(false);
      
      const nextId = activeVariantId === 3 ? 1 : activeVariantId + 1;
      setActiveVariantId(nextId);
      
      const newHistoryItem = {
        id: Math.random(),
        prompt: prompt || `Cinematic YouTube asset remixed with ${emotionalAngle} expression, optimized for ${composition} framing.`,
        date: "Just now",
        active: true
      };
      setHistory(prev => [newHistoryItem, ...prev.map(h => ({ ...h, active: false }))]);
    }, 3000);
  };

  // Ideation Mode triggers
  const handleGenerateIdeas = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingIdeas(true);
    setTimeout(() => {
      setIsGeneratingIdeas(false);
      setGeneratedIdeas({
        permutationTitles: [
          `I Discovered the Hidden Loop. (Curiosity Loop)`,
          `They Lied to Us About This Setup. (Provocative Statement)`,
          `Before It's Too Late... (FOMO Hook)`
        ],
        compositionDirections: [
          "Subject placement in extreme close-up on the right grid line. Left-hand side features glowing, highly visible contrast split details.",
          "Use dramatic, high-intensity color values (Hues: 200, 30) for backlights, simulating ambient monitor glows.",
          "Keep background visual elements clean, blurred by 20%, focusing exclusively on the packaging center."
        ]
      });
    }, 1500);
  };

  // Upscale triggers
  const handleEnhanceConcept = () => {
    if (!upscaleFile) return;
    setIsUpscaling(true);
    setUpscaleProgress(10);
    const interval = setInterval(() => {
      setUpscaleProgress(prev => {
        if (prev < 90) return prev + 25;
        clearInterval(interval);
        return prev;
      });
    }, 450);

    setTimeout(() => {
      clearInterval(interval);
      setIsUpscaling(false);
      setUpscaledResult("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop");
      setUpscaleProgress(100);
      alert("Asset successfully upscaled and optimized for YouTube upload!");
    }, 2000);
  };

  // Downloader triggers
  const handleDownloadMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloaderUrl) return;
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setDownloaderResult({
        title: "Ali Abdaal productivity workflow remixed audit",
        thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
        views: "1.2M views",
        publishedAt: "3 months ago",
        tags: ["productivity", "ipad setups", "workflow mechanics"]
      });
    }, 1200);
  };

  // Drag and Drop mock callbacks
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setUploadDragActive(true);
    else if (e.type === "dragleave") setUploadDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0].name);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] bg-[#09090b]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-white transition-colors mr-5 text-xs font-semibold uppercase tracking-wider group">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          <div className="flex items-center ml-5 border-l border-white/[0.06] pl-5">
            <Cpu className="h-4.5 w-4.5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Thumbnail Studio Cockpit</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-zinc-900 border border-white/[0.04] text-zinc-400">
            AI Creative Director OS
          </span>
        </div>
      </header>

      {/* Main Studio Frame */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-8 max-w-[1550px] mx-auto w-full">
        
        {/* ================= SIDEBAR WORKSPACE SWITCHER (3 cols) ================= */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          
          {/* ChatGPT-style custom workspace navigation list */}
          <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-4 shadow-2xl space-y-3">
            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest px-2.5">Studio Modules</p>
            <nav className="space-y-1">
              {[
                { id: "generator", label: "Thumbnail Generator", desc: "Core Visual Synthesis", icon: Wand2 },
                { id: "ideation", label: "Title & Visual Ideation", desc: "Permutations & Layouts", icon: Type },
                { id: "expression", label: "Face & Pose Planner", desc: "Expression Mapping", icon: Smile },
                { id: "upscale", label: "Upscale & Enhancer", desc: "Sharpen to 4K Ultra", icon: Maximize },
                { id: "preview", label: "YouTube Downloader", desc: "Preview Competitor Assets", icon: Download }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      activeTab === tab.id 
                        ? 'bg-zinc-900/60 border border-white/[0.04] text-white' 
                        : 'border border-transparent text-zinc-400 hover:bg-zinc-900/30 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${activeTab === tab.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate leading-none">{tab.label}</p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 truncate leading-none">{tab.desc}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Creator Context Pipeline Connection */}
          {activeTab === "generator" && (
            <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <Users className="h-3.5 w-3.5 text-zinc-500 mr-2" /> Creator Context
              </h3>
              
              <div className="space-y-3">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Select CRM Lead or Audit</label>
                <select 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    
                    if (val === "current" && currentAnalysis) {
                      setPrompt(`Highly realistic photorealistic thumbnail optimized for "${currentAnalysis.videoTitle}", remixed in Unreal preset, focus on primary subject with volumetric contrast...`);
                      if (currentAnalysis.thumbnailUrl) {
                        setUploadedFile(currentAnalysis.thumbnailUrl);
                      }
                      
                      // Map specific weaknesses to presets
                      const hasLowContrast = currentAnalysis.detectedWeaknesses.some(w => w.toLowerCase().includes("contrast") || w.toLowerCase().includes("hierarchy"));
                      if (hasLowContrast) {
                        setPromptMode("split");
                        setStylePreset("unreal");
                        setComposition("split");
                        setEmotionalAngle("shock");
                      }
                      alert(`Dissection context for "${currentAnalysis.creatorName}" imported successfully! Recommending design tweaks...`);
                    } else {
                      const lead = crmLeads.find(l => l.id === val);
                      if (lead) {
                        setPrompt(`Premium cinematic visual concept for creator ${lead.name} target: "${lead.analysis?.videoTitle || 'new series'}", soft backlights, detailed realistic skin texture...`);
                        if (lead.analysis?.thumbnailUrl) {
                          setUploadedFile(lead.analysis.thumbnailUrl);
                        }
                        
                        const hasLowContrast = lead.analysis?.detectedWeaknesses.some(w => w.toLowerCase().includes("contrast") || w.toLowerCase().includes("hierarchy"));
                        if (hasLowContrast) {
                          setComposition("split");
                          setStylePreset("unreal");
                        }
                        alert(`CRM Lead "${lead.name}" context imported successfully!`);
                      }
                    }
                  }}
                  className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none"
                >
                  <option value="">-- Import Creator --</option>
                  {currentAnalysis && (
                    <option value="current">Recent Scan: {currentAnalysis.creatorName}</option>
                  )}
                  {crmLeads.map(lead => (
                    <option key={lead.id} value={lead.id}>CRM Lead: {lead.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-zinc-550 leading-normal">
                  Loads creator video details, target niches, weaknesses, and custom style suggestions automatically.
                </p>
              </div>
            </div>
          )}

          {/* Quick Stats sidebar widgets (only for active generator workspace) */}
          {activeTab === "generator" && (
            <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-white/[0.04] pb-2 flex items-center">
                <Sliders className="h-3.5 w-3.5 text-zinc-500 mr-2" /> Diffusion Parameters
              </h3>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Frame Size</span>
                    <span className="text-zinc-300 font-bold">1280 x 720 px</span>
                  </div>
                  <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/40 w-full" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Diffusion Steps</span>
                    <span className="text-zinc-300 font-bold">40 (Draft Ready)</span>
                  </div>
                  <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/40 w-[60%]" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>CFG Scale</span>
                    <span className="text-zinc-300 font-bold">8.5 (High Contrast)</span>
                  </div>
                  <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/40 w-[85%]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= ================= ================= ================= */}
        {/* ================= WORKSPACE INTERFACE LOOPS (Col span dependent) ================= */}
        {/* ================= ================= ================= ================= */}

        {/* 1. CORE GENERATOR WORKSPACE */}
        {activeTab === "generator" && (
          <>
            {/* Center Viewport Frame (6 cols) */}
            <div className="lg:col-span-6 space-y-6 flex flex-col">
              
              {/* Main Cinematic Viewport Canvas */}
              <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl relative flex flex-col flex-1 min-h-[420px] justify-between overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[120px] bg-emerald-500/[0.01] blur-[80px] rounded-full pointer-events-none" />

                {/* Viewport Control Panel */}
                <div className="flex items-center justify-between z-10 border-b border-white/[0.04] pb-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-900" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 ml-2">Studio Render</span>
                  </div>

                  <div className="flex bg-zinc-950/60 rounded-lg p-0.5 border border-white/[0.04]">
                    <button 
                      onClick={() => setShowCompare(false)} 
                      className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors flex items-center ${!showCompare ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Eye className="h-3 w-3 mr-1" /> HD Render
                    </button>
                    <button 
                      onClick={() => setShowCompare(true)} 
                      className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors flex items-center ${showCompare ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Layers className="h-3 w-3 mr-1" /> CTR Split Compare
                    </button>
                  </div>
                </div>

                {/* Render Slider Frame */}
                <div className="relative flex-1 flex items-center justify-center rounded-2xl bg-zinc-950/80 border border-white/[0.02] overflow-hidden min-h-[290px]">
                  
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                      <div className="relative flex items-center justify-center mb-6">
                        <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-white" />
                        <Cpu className="h-5 w-5 text-white absolute animate-pulse" />
                      </div>
                      <h4 className="text-[10px] font-black tracking-widest text-zinc-200 mb-1 uppercase">
                        Synthesizing Canvas
                      </h4>
                      <p className="text-emerald-400 font-mono text-[10px] animate-pulse text-center">
                        {loadingSteps[generationStep]}
                      </p>
                    </div>
                  )}

                  {showCompare ? (
                    <div className="w-full h-full p-1">
                      <CompareSlider 
                        leftImage={activeVariant.originalUrl}
                        rightImage={activeVariant.refinedUrl}
                        leftLabel="Original Idea Concept"
                        rightLabel="AI Optimised Output"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full relative group overflow-hidden p-1">
                      <img 
                        src={activeVariant.refinedUrl} 
                        alt="HD Render" 
                        className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-102"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-50" />
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/[0.04]">
                          {activeVariant.title} - Aspect Ratio {aspectRatio}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ambient information note */}
                <div className="mt-4 p-4 border border-white/[0.04] bg-zinc-950/40 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-zinc-300">Psychology Recommendation</p>
                      <p className="text-[11px] text-zinc-400 leading-normal">{activeVariant.strategy}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacious Prompt Console */}
              <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl space-y-4">
                
                {/* Generation settings selectors */}
                <div className="grid grid-cols-2 gap-4 pb-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Generation Preset</label>
                    <select 
                      value={promptMode}
                      onChange={(e) => setPromptMode(e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-3 text-xs text-zinc-300 outline-none"
                    >
                      <option value="cinematic">Thumbnail Realism Mode</option>
                      <option value="face">Creator Face Focus Mode</option>
                      <option value="object">Key Object Focus Mode</option>
                      <option value="split">Split Contrast Layout</option>
                      <option value="beforeafter">Before vs After Setup</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Quality Presets</label>
                    <div className="grid grid-cols-4 gap-1 bg-zinc-950/60 rounded-lg p-0.5 border border-white/[0.04]">
                      {["Draft", "HD", "2K", "4K"].map((q) => (
                        <button
                          key={q}
                          onClick={() => alert(`Quality set to ${q}`)}
                          className="h-7 text-[9px] font-extrabold uppercase rounded transition-colors text-zinc-500 hover:text-white"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating prompt box */}
                <div className="relative border border-white/[0.06] rounded-2xl bg-zinc-950/80 p-3 flex flex-col focus-within:border-white/[0.12] transition-colors">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your realistic visual concept (e.g. Creator distress portrait, split screens)..."
                    className="w-full min-h-[70px] bg-transparent text-xs text-zinc-200 focus:outline-none placeholder:text-zinc-650 resize-none pr-12 leading-relaxed"
                  />
                  
                  <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-2">
                    <div className="flex gap-2">
                      <div className="flex items-center bg-zinc-900/60 rounded-lg p-0.5 border border-white/[0.02]">
                        {["16:9", "9:16", "1:1"].map((aspect) => (
                          <button
                            key={aspect}
                            onClick={() => setAspectRatio(aspect)}
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded transition-colors ${aspectRatio === aspect ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            {aspect}
                          </button>
                        ))}
                      </div>
                      
                      {uploadedFile && (
                        <div className="flex items-center px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                          Reference Loaded
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSuperchargePrompt}
                        disabled={isEnhancing || isGenerating}
                        className="h-8 px-3 rounded-lg border border-white/[0.04] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        {isEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-400" />}
                        Supercharge
                      </button>

                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="h-8 px-4 rounded-lg bg-zinc-100 text-zinc-950 text-xs font-bold hover:bg-white transition-colors flex items-center gap-1.5"
                      >
                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        Generate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-presets info */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 mt-1">Preset Themes:</span>
                  {[
                    "Photorealistic 8K", "UE5 Engine Cinematic", "Moody Split Contrast", "Product Focus Backlight"
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(`Realistic photorealistic ${preset.toLowerCase()} style of creator focus...`)}
                      className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full border border-white/[0.02] bg-zinc-950/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

              </div>

              {/* Upload Dropzone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`bg-zinc-900/10 border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center transition-all ${
                    uploadedFile ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-white/[0.04] hover:bg-zinc-900/20'
                  }`}
                >
                  {uploadedFile ? (
                    <div className="space-y-2 w-full flex flex-col items-center">
                      {uploadedFile.startsWith("http") ? (
                        <div className="h-16 w-28 rounded-lg overflow-hidden border border-white/[0.06] bg-zinc-950 relative shadow-md">
                          <img src={uploadedFile} alt="Visual Reference" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-zinc-300 truncate max-w-[170px] mx-auto">{uploadedFile}</p>
                      )}
                      <button onClick={() => setUploadedFile(null)} className="text-[9px] font-extrabold uppercase text-rose-500 hover:underline">
                        Remove Ref
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer py-4 flex flex-col items-center">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setUploadedFile(e.target.files[0].name);
                        }}
                      />
                      <Plus className="h-5 w-5 text-zinc-500 mb-1.5" />
                      <span className="text-xs font-bold text-zinc-300">Style Reference / Sketch</span>
                      <span className="text-[9px] text-zinc-500 mt-0.5">Drop sketch mockup images to match style</span>
                    </label>
                  )}
                </div>

                <div className="bg-zinc-900/10 border border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                  <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider">Project Concept History</p>
                  <div className="space-y-1.5 mt-2.5 max-h-[85px] overflow-y-auto pr-1">
                    {history.map((hItem) => (
                      <div 
                        key={hItem.id}
                        onClick={() => setPrompt(hItem.prompt)}
                        className={`p-2 rounded-lg border text-[10px] truncate cursor-pointer transition-colors ${hItem.active ? 'border-zinc-500 bg-zinc-950/40 text-white font-bold' : 'border-transparent text-zinc-400 hover:bg-zinc-950/20'}`}
                      >
                        {hItem.prompt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Predictions Sidebar Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-6 flex flex-col">
              
              {/* Predictions Cockpit */}
              <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl space-y-5">
                <h3 className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                  <Cpu className="h-4 w-4 text-emerald-400 mr-2" /> Predictions Cockpit
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Gauge 
                      value={activeVariant.ctr}
                      title="Predicted CTR Potential"
                      subtitle="Packaging Index"
                      size={110}
                      strokeWidth={8}
                    />
                  </div>

                  <Gauge 
                    value={activeVariant.emotion}
                    title="Emotion Intensity"
                    subtitle="Trigger Level"
                    size={80}
                    strokeWidth={6}
                  />

                  <Gauge 
                    value={activeVariant.curiosity}
                    title="Curiosity Mystery"
                    subtitle="Hook Loop"
                    size={80}
                    strokeWidth={6}
                  />
                </div>
              </div>

              {/* Psychology diagnostics list */}
              <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl space-y-4 flex-1">
                <h3 className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                  <Activity className="h-4 w-4 text-emerald-400 mr-2" /> CTR Diagnostics
                </h3>

                <div className="space-y-3">
                  {activeVariant.psychology.map((diag, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-xl border flex gap-2.5 transition-colors ${
                        diag.type === "strength" 
                          ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-400" 
                          : "border-amber-500/10 bg-amber-500/5 text-amber-400"
                      }`}
                    >
                      {diag.type === "strength" ? (
                        <Check className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-400" />
                      )}
                      
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-wider mb-0.5">
                          {diag.type === "strength" ? "Strength" : "Critical Area"}
                        </p>
                        <p className="text-xs text-zinc-300 leading-normal">
                          {diag.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Battery percentage bar */}
                <div className="pt-4 border-t border-white/[0.04] space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                    <span>Viral Probability</span>
                    <span className="text-emerald-400">{activeVariant.viral}%</span>
                  </div>
                  <div className="flex bg-zinc-950/70 p-1 rounded-lg border border-white/[0.02] gap-0.5 h-6 items-center w-full relative overflow-hidden">
                    <div 
                      className="absolute inset-y-1 left-1 bg-emerald-500/30 rounded-md transition-all duration-700 border border-emerald-500/10"
                      style={{ width: `calc(${activeVariant.viral}% - 8px)` }}
                    />
                    {[...Array(8)].map((_, idx) => (
                      <div key={idx} className="flex-1 bg-white/[0.02] h-full z-10" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. TITLE + VISUAL IDEATION WORKSPACE */}
        {activeTab === "ideation" && (
          <div className="lg:col-span-9 grid md:grid-cols-12 gap-8">
            
            {/* Input params (5 cols) */}
            <div className="md:col-span-5 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 space-y-5">
              <h3 className="text-xs font-extrabold uppercase text-zinc-300 border-b border-white/[0.04] pb-2">
                Ideation Param Cockpit
              </h3>

              <form onSubmit={handleGenerateIdeas} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Idea Generation Mode</label>
                  <select 
                    value={ideationMode}
                    onChange={(e) => setIdeationMode(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-3 text-xs text-zinc-300 outline-none"
                  >
                    <option value="Text Prompt">Text Prompt Synthesis</option>
                    <option value="Sketch-to-Idea">Sketch-to-Idea Mapping</option>
                    <option value="Reference-Based">Style Reference Matching</option>
                    <option value="Competitor Remix">Competitor Remixing Mode</option>
                    <option value="Psychology">Packaging Psychology Target</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Target Competitor YouTube URL</label>
                  <input 
                    type="text" 
                    placeholder="https://youtube.com/watch?v=..."
                    value={competitorLink}
                    onChange={(e) => setCompetitorLink(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-3 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Pinterest Board Inspiration</label>
                  <input 
                    type="text" 
                    placeholder="Pinterest board reference pin..."
                    value={pinterestRef}
                    onChange={(e) => setPinterestRef(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-3 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Concept Prompt Keywords</label>
                  <textarea 
                    placeholder="e.g. self-improvement, workspace shadow split..."
                    className="w-full min-h-[70px] rounded-lg border border-white/[0.04] bg-zinc-950/60 p-3 text-xs text-zinc-300 placeholder:text-zinc-650 outline-none resize-none"
                  />
                </div>

                {/* Sketch Mock file upload */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Sketch Upload (Optional)</label>
                  <div className="border border-dashed border-white/[0.04] rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-950/20">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">+ Upload Layout Sketch</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isGeneratingIdeas}
                  className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wide flex items-center justify-center transition-all disabled:opacity-50"
                >
                  {isGeneratingIdeas ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                  {isGeneratingIdeas ? "Ideating..." : "Compute Concepts"}
                </button>
              </form>
            </div>

            {/* Output results (7 cols) */}
            <div className="md:col-span-7 space-y-6">
              {generatedIdeas ? (
                <div className="space-y-6 animate-in fade-in">
                  
                  {/* Titles */}
                  <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                      <Type className="h-4.5 w-4.5 text-emerald-400" />
                      <h4 className="font-extrabold text-xs uppercase text-zinc-300">Generated Title Permutations</h4>
                    </div>
                    <div className="space-y-2.5">
                      {generatedIdeas.permutationTitles.map((t: string, idx: number) => (
                        <div key={idx} className="p-3 bg-zinc-950/40 border border-white/[0.02] rounded-xl flex justify-between items-center group">
                          <span className="text-xs text-zinc-300 font-medium">{t}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(t);
                              alert("Copied title option!");
                            }}
                            className="text-[9px] font-extrabold uppercase text-zinc-500 hover:text-white transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Spatial layouts */}
                  <div className="bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                      <Layers className="h-4.5 w-4.5 text-emerald-400" />
                      <h4 className="font-extrabold text-xs uppercase text-zinc-300">Spatial Layout Composition</h4>
                    </div>
                    <div className="space-y-3">
                      {generatedIdeas.compositionDirections.map((dir: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 text-xs text-zinc-400 leading-relaxed">
                          <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-bold text-[9px]">{idx + 1}</span>
                          <p>{dir}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-full min-h-[400px] border border-dashed border-white/[0.04] rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10">
                  <Cpu className="h-10 w-10 text-zinc-600 mb-4 animate-pulse" />
                  <h3 className="text-sm font-bold text-zinc-300 mb-1">Concept Matrix Empty</h3>
                  <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                    Adjust parameters in the left cockpit and trigger "Compute Concepts" to generate title variants and spatial packaging outlines.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. FACE EXPRESSION + POSE PLANNER WORKSPACE */}
        {activeTab === "expression" && (
          <div className="lg:col-span-9 grid md:grid-cols-12 gap-8">
            
            {/* Options selecting (5 cols) */}
            <div className="md:col-span-5 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 space-y-5">
              <h3 className="text-xs font-extrabold uppercase text-zinc-300 border-b border-white/[0.04] pb-2">
                Expression Preset Selection
              </h3>

              {/* Emotions Grid */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Emotion Type</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    "shocked", "confused", "suspicious", "disgusted", "confident", 
                    "excited", "frightened", "tired", "curious", "victory", "panic"
                  ].map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setSelectedEmotion(emo)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider text-left transition-all border ${
                        selectedEmotion === emo 
                          ? 'bg-zinc-100 text-zinc-950 border-white' 
                          : 'bg-zinc-950/40 text-zinc-400 border-white/[0.02] hover:bg-zinc-900/40 hover:text-zinc-200'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Poses Grid */}
              <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Pose & framing Guidance</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    "pointing", "facepalm", "looking away", "holding object", "reaction pose", "hands on head"
                  ].map((pose) => (
                    <button
                      key={pose}
                      onClick={() => setSelectedPose(pose)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider text-left transition-all border ${
                        selectedPose === pose 
                          ? 'bg-zinc-100 text-zinc-950 border-white' 
                          : 'bg-zinc-950/40 text-zinc-400 border-white/[0.02] hover:bg-zinc-900/40 hover:text-zinc-200'
                      }`}
                    >
                      {pose}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-[10px] text-zinc-550 border-t border-white/[0.04] leading-normal flex items-start space-x-1.5">
                <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                <p>Pose matrices generate original realistic human references, strictly avoiding cloning exact copyright faces.</p>
              </div>
            </div>

            {/* Blueprint visualization layout (7 cols) */}
            <div className="md:col-span-7 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2">
                    <Smile className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
                    <h4 className="font-extrabold text-xs uppercase text-zinc-200">Creative Blueprint Output</h4>
                  </div>
                  <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    READY
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-white/[0.02] relative aspect-video flex items-center justify-center text-center overflow-hidden">
                  {/* Subtle guidelines drawing overlay grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-[0.02] pointer-events-none">
                    {[...Array(9)].map((_, i) => <div key={i} className="border border-white" />)}
                  </div>

                  <div className="space-y-2 z-10 p-4">
                    <ImageIcon className="h-8 w-8 text-zinc-650 mx-auto animate-bounce" />
                    <h5 className="font-extrabold text-xs uppercase tracking-widest text-zinc-300">
                      Original human vector blueprint
                    </h5>
                    <p className="text-[11px] text-zinc-500 max-w-[340px] mx-auto leading-normal">
                      Guideline reference: high resolution {selectedEmotion} face framed with {selectedPose} silhouette structure.
                    </p>
                  </div>
                </div>

                {/* Analytical breakdown */}
                <div className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-zinc-500">Emotional Click Trigger Potential</span>
                    <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                      {selectedEmotion === "shocked" ? "Extremely High. Face disbelief is the highest converting visual anchor in casual-scroll media niches." : "Solid Niche Appeal. Excellent for technical audit or delayed payoff storyboards."}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-zinc-500">YouTube Frame Alignment Guidelines</span>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Position subject on the right lateral 1/3 grid line. Keep hands framing visible close to the head in a medium close-up shot. Backlight highlight recommended.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/[0.04] flex gap-3">
                <button 
                  onClick={() => alert("Guidelines exported as shoot planning PDF.")}
                  className="flex-1 h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 hover:bg-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Export shoot Sheet
                </button>
                <button 
                  onClick={() => {
                    setPrompt(` photorealistic portrait of an original human face showing absolute ${selectedEmotion} emotion, framed with a strong ${selectedPose} reaction pose, highly detailed natural HSL lighting...`);
                    setActiveTab("generator");
                    alert("Preset layout guidelines loaded directly into CTR Generator prompts!");
                  }}
                  className="flex-1 h-8.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center transition-colors"
                >
                  Apply in Generator <ArrowRight className="h-3 w-3 ml-1" />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* 4. UPSCALE & ENHANCER WORKSPACE */}
        {activeTab === "upscale" && (
          <div className="lg:col-span-9 grid md:grid-cols-12 gap-8">
            
            {/* Upload & controls (5 cols) */}
            <div className="md:col-span-5 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 space-y-5">
              <h3 className="text-xs font-extrabold uppercase text-zinc-300 border-b border-white/[0.04] pb-2">
                Restoration Parameters
              </h3>

              <div className="space-y-4">
                
                {/* File dropzone */}
                <div className="border border-dashed border-white/[0.04] rounded-xl p-6 text-center hover:bg-zinc-950/20 cursor-pointer">
                  {upscaleFile ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-zinc-300 truncate max-w-[150px] mx-auto">{upscaleFile}</p>
                      <button onClick={() => setUpscaleFile(null)} className="text-[9px] font-bold uppercase text-zinc-550 hover:text-white">
                        Clear File
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setUpscaleFile(e.target.files[0].name);
                        }}
                      />
                      <Maximize className="h-5 w-5 text-zinc-550 mx-auto mb-1.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">Select Concept Asset</span>
                      <span className="text-[9px] text-zinc-500 mt-1 block">HD or draft resolution PNG / JPG</span>
                    </label>
                  )}
                </div>

                {/* Option Toggles */}
                <div className="space-y-3.5 pt-2 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold uppercase text-zinc-500">Restoration Cockpit</p>
                  
                  {[
                    { id: "upscale4k", label: "Super Resolution to 4K", desc: "Intelligent upscale scale factors" },
                    { id: "sharpen", label: "Focal Sharpness Recovery", desc: "Correct minor camera motion blurs" },
                    { id: "faceRestore", label: "AI Face Restoration (GFPGAN)", desc: "Recover human photorealism details" },
                    { id: "textClarity", label: "Typography Clarity Boost", desc: "Enhance text graphics boundaries" }
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-start space-x-3 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={(upscaleSettings as any)[opt.id]}
                        onChange={() => setUpscaleSettings(prev => ({ ...prev, [opt.id]: !(prev as any)[opt.id] }))}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-300 leading-none">{opt.label}</p>
                        <p className="text-[9px] text-zinc-500 leading-none mt-1">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <button 
                  onClick={handleEnhanceConcept}
                  disabled={isUpscaling || !upscaleFile}
                  className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wide flex items-center justify-center transition-all disabled:opacity-50"
                >
                  {isUpscaling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Maximize className="h-4 w-4 mr-1.5" />}
                  {isUpscaling ? "Enhancing..." : "Enhance Concept"}
                </button>
              </div>
            </div>

            {/* Displaying enhanced result (7 cols) */}
            <div className="md:col-span-7 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                    <h4 className="font-extrabold text-xs uppercase text-zinc-200">Restored Viewport Output</h4>
                  </div>
                  {upscaledResult && (
                    <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      4K Ultra
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/[0.02] aspect-video flex items-center justify-center overflow-hidden relative">
                  {isUpscaling ? (
                    <div className="text-center space-y-3 z-10">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500 mx-auto" />
                      <p className="text-[10px] font-mono text-emerald-400 animate-pulse">RECONSTRUCTING SUB-PIXELS: {upscaleProgress}%</p>
                    </div>
                  ) : upscaledResult ? (
                    <img 
                      src={upscaledResult} 
                      alt="Upscaled result" 
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="text-center space-y-1.5 text-zinc-550">
                      <Maximize className="h-8 w-8 text-zinc-650 mx-auto animate-pulse" />
                      <p className="text-xs font-bold">Awaiting enhancement asset</p>
                      <p className="text-[9px] max-w-[220px] mx-auto leading-normal">Upload draft mockups in the left cockpit to recover 4K pixel precision.</p>
                    </div>
                  )}
                </div>
              </div>

              {upscaledResult && (
                <div className="pt-6 border-t border-white/[0.04]">
                  <button 
                    onClick={() => alert("Asset successfully downloaded as max-res PNG!")}
                    className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" /> Download 4K production ready Asset
                  </button>
                </div>
              )}

            </div>

          </div>
        )}

        {/* 5. YOUTUBE PREVIEW + DOWNLOAD TOOL */}
        {activeTab === "preview" && (
          <div className="lg:col-span-9 grid md:grid-cols-12 gap-8">
            
            {/* Paste URL (5 cols) */}
            <div className="md:col-span-5 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold uppercase text-zinc-300 border-b border-white/[0.04] pb-2">
                YouTube URL Dissector
              </h3>

              <form onSubmit={handleDownloadMetadata} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Paste YouTube Competitor URL</label>
                  <input 
                    type="text" 
                    placeholder="https://youtube.com/watch?v=..."
                    value={downloaderUrl}
                    onChange={(e) => setDownloaderUrl(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-3 text-xs text-zinc-300 placeholder:text-zinc-650 outline-none focus:border-zinc-500"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isDownloading || !downloaderUrl}
                  className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wide flex items-center justify-center transition-all disabled:opacity-50"
                >
                  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                  {isDownloading ? "Extracting..." : "Scan & Fetch Assets"}
                </button>
              </form>
            </div>

            {/* Viewport result (7 cols) */}
            <div className="md:col-span-7 bg-zinc-900/10 border border-white/[0.04] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4.5 w-4.5 text-emerald-400" />
                    <h4 className="font-extrabold text-xs uppercase text-zinc-200">Extracted Assets View</h4>
                  </div>
                </div>

                {isDownloading ? (
                  <div className="aspect-video bg-zinc-950/80 rounded-2xl flex flex-col items-center justify-center text-center p-6 border border-white/[0.02]">
                    <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mb-2" />
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Extracting Maximum resolution vectors...</p>
                  </div>
                ) : downloaderResult ? (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-white/[0.04]">
                      <img 
                        src={downloaderResult.thumbnailUrl} 
                        alt="Competitor Thumbnail Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="space-y-2 bg-zinc-950/40 p-4 rounded-2xl border border-white/[0.02]">
                      <h5 className="font-bold text-xs text-zinc-200 leading-snug">{downloaderResult.title}</h5>
                      <div className="flex gap-4 text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5">
                        <span>{downloaderResult.views}</span>
                        <span>Published {downloaderResult.publishedAt}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-zinc-950/80 rounded-2xl flex flex-col items-center justify-center text-center p-6 border border-white/[0.02]">
                    <Eye className="h-8 w-8 text-zinc-650 mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-zinc-300">Dissector Viewport Standby</p>
                    <p className="text-[9px] text-zinc-500 max-w-[200px] leading-normal mt-1">Input URL in the left cockpit to extract high-res thumbnail assets and metadata.</p>
                  </div>
                )}
              </div>

              {downloaderResult && (
                <div className="pt-6 border-t border-white/[0.04] flex gap-3">
                  <button 
                    onClick={() => {
                      alert("Maximum resolution thumbnail downloaded!");
                    }}
                    className="flex-1 h-8.5 rounded-lg border border-white/[0.04] bg-zinc-950/60 hover:bg-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center text-zinc-400 hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Save Max resolution
                  </button>
                  <button 
                    onClick={() => {
                      setUploadedFile("Competitor Ref Saved");
                      setPrompt(`Cinematic YouTube concept remixed from high-converting competitor styling, soft volumetric lighting...`);
                      setActiveTab("generator");
                      alert("Competitor style reference successfully loaded into Studio Generator prompts!");
                    }}
                    className="flex-1 h-8.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center transition-colors"
                  >
                    Remix in Studio <ArrowRight className="h-3 w-3 ml-1" />
                  </button>
                </div>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
