"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Mail, MessageSquare, Twitter, Copy, RefreshCw, UploadCloud, CheckCircle2, BookmarkPlus, Zap } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeCRMLead, mapRawToCrmPayload } from "@/lib/supabase/db";

export default function OutreachPage() {
  const router = useRouter();
  const { outreachContext, transferToOutreach } = useAppStore();
  const [platform, setPlatform] = useState("email");
  const [tone, setTone] = useState("direct");
  const [length, setLength] = useState("medium");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);

  // Hydrate analysis and outreach message from localStorage/store on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("outreach_context");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            if (parsed.generatedOutreach) {
              setGeneratedText(parsed.generatedOutreach);
            }
          }
        } else if (outreachContext?.generatedOutreach) {
          setGeneratedText(outreachContext.generatedOutreach);
        }
      } catch (e) {
        console.error("Failed to hydrate outreach_context inside OutreachPage:", e);
      }
    }
  }, [outreachContext]);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadedFileName(file.name);

    // Animate progress slightly for a premium feel
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 150);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to upload files.");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { data, error } = await supabase.storage
        .from('outreach-context')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('outreach-context')
        .getPublicUrl(filePath);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedFileUrl(publicUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.message || 'Unknown error'}`);
      setUploadedFileName("");
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFileUrl("");
    setUploadedFileName("");
    setUploadProgress(0);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tone,
          length,
          platform,
          customInstructions,
          uploadedFileUrl,
          analysisContext: outreachContext || {
            creatorName: "Creator",
            videoTitle: "your latest video",
            detectedWeaknesses: ["Missing Curiosity Gap"],
            titleIdeas: ["How I Scaled My Channel"],
            repeatedPhrases: [],
            subs: "10K",
            views: "1K"
          }
        })
      });

      if (!res.ok) throw new Error("Failed to generate outreach message.");
      const data = await res.json();
      if (data.success && data.outreachMessage) {
        setGeneratedText(data.outreachMessage);
        if (outreachContext) {
          const updated = { ...outreachContext, generatedOutreach: data.outreachMessage };
          transferToOutreach(updated);
        }
      } else {
        throw new Error(data.error || "Generation error");
      }
    } catch (err: any) {
      console.error("Outreach generation error, falling back locally:", err);
      const creator = outreachContext?.creatorName || outreachContext?.channelName || "there";
      const title = outreachContext?.videoTitle || "your latest upload";
      const flaws = outreachContext?.detectedWeaknesses || [];
      
      let flawPhrase = "";
      if (flaws.length > 0) {
        flawPhrase = `I noticed some potential opportunities with ${flaws.slice(0, 2).map((f: string) => f.toLowerCase()).join(' and ')}`;
      } else {
        flawPhrase = "I noticed a few packaging opportunities to scale click appeal";
      }

      const contextAny = outreachContext as any;
      const thumbnailCritique = contextAny?.visualAnalysisPreview?.thumbnailWeakness || 
                                contextAny?.thumbnailCritique ||
                                (flaws.length > 1 ? flaws[1] : (flaws.length > 0 ? flaws[0] : "visual hierarchy contrast"));

      const emotionalTone = contextAny?.emotionalTone || contextAny?.transcriptTone || "engaging";

      let localFallback = "";
      if (platform === 'ig' || platform === 'twitter') {
        localFallback = `Hey ${creator}, saw your video "${title}" and really liked the ${emotionalTone} vibe of the content. \n\n${flawPhrase} that might be capping your organic CTR. Specifically: ${thumbnailCritique.toLowerCase().replace(/\.$/, '')}.\n\nI sketched up 2 quick thumbnail concepts with stronger curiosity loops. Mind if I send them over? No pitch, just wanted to share.`;
      } else if (platform === 'linkedin') {
        localFallback = `Hi ${creator},\n\nI recently analyzed your video, "${title}". Really outstanding, ${emotionalTone} core content, but ${flawPhrase.toLowerCase()}.\n\nSpecifically, ${thumbnailCritique}. Applying a stronger focal contrast to the thumbnail hierarchy and sharpening the title curiosity loop could significantly lift your views-to-subscribers ratio.\n\nI sketched out some quick concepts. Would you be open to a quick look? Let me know!`;
      } else {
        const titleSuggestion = outreachContext?.titleIdeas && outreachContext.titleIdeas.length > 0 
          ? `\n\nFor example, instead of the literal title, we could lean into something with a stronger curiosity stake like:\n- "${outreachContext.titleIdeas[0]}"`
          : "";
        localFallback = `Hey ${creator},\n\nI checked out your video "${title}" and noticed a few packaging opportunities that could improve CTR.\n\nYour transcript tone came across as very ${emotionalTone}, which is perfect for retention. However, ${flawPhrase.toLowerCase()} relative to your subscriber counts.\n\nSpecifically: ${thumbnailCritique}. Adjusting the visual depth in the graphic hierarchy would direct casual scroll eyes much more effectively.${titleSuggestion}\n\nI put together two quick title and thumbnail concepts. Let me know if you'd like to check them out. Happy to drop them here!\n\nBest,\nCTRForge Team`;
      }

      if (length === 'short') {
        localFallback = `Hey ${creator}, checked out your video "${title}"! Love the ${emotionalTone} delivery, but noticed some CTR packaging opportunities: ${thumbnailCritique.toLowerCase().replace(/\.$/, '')}.\n\nI mocked up 2 quick concept ideas to boost curiosity. Mind if I send them over? No pitch!`;
      } else if (length === 'long') {
        localFallback += `\n\nLooking forward to hearing your thoughts!`;
      }

      if (customInstructions) {
        localFallback += `\n\n(Adjusted for note: ${customInstructions})`;
      }

      setGeneratedText(localFallback);
      if (outreachContext) {
        const updated = { ...outreachContext, generatedOutreach: localFallback };
        transferToOutreach(updated);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCrm = async () => {
    if (!outreachContext) return;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to save leads.");

      // Prepare the payload to upsert
      const rawPayload = mapRawToCrmPayload({
        user_id: user.id,
        creator_name: outreachContext.creatorName,
        channel_name: outreachContext.channelName,
        video_title: outreachContext.videoTitle,
        video_url: outreachContext.videoUrl,
        thumbnail_url: outreachContext.thumbnailUrl || "",
        subscriber_count: outreachContext.subs,
        view_count: outreachContext.views,
        like_count: outreachContext.likes || "",
        published_at: outreachContext.publishedAt || "",
        transcript_snippets: outreachContext.transcriptSnippets || [],
        emotional_tone: outreachContext.emotionalTone || "",
        repeated_phrases: outreachContext.repeatedPhrases || [],
        ctr_weaknesses: outreachContext.detectedWeaknesses || [],
        optimized_titles: outreachContext.titleIdeas || [],
        audience_positioning: outreachContext.audiencePositioning || "",
        
        // Deep intelligence
        exact_hook: outreachContext.exactHook || "",
        top_emotional_words: outreachContext.topEmotionalWords || [],
        most_repeated_phrases: outreachContext.mostRepeatedPhrases || [],
        curiosity_loops: outreachContext.curiosityLoops || [],
        audience_type: outreachContext.audienceType || "",
        retention_style: outreachContext.retentionStyle || "",
        cta_style: outreachContext.ctaStyle || "",
        high_converting_phrases: outreachContext.highConvertingPhrases || [],
        
        // Save output
        generated_outreach: generatedText,
        status: "contacted", // Transition to contacted
        platform: platform
      });

      const safePayload = sanitizeCRMLead(rawPayload);
      console.log("FINAL SAFE PAYLOAD", safePayload);

      const { error } = await supabase
        .from('crm_leads')
        .upsert(safePayload, { onConflict: 'user_id,creator_name' });

      if (error) throw error;
      
      router.push("/crm");
    } catch (err: any) {
      console.error("Failed to save generated message to CRM:", err);
      alert(`Failed to save to CRM: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <Mail className="h-5 w-5 text-emerald-500" />
          <span className="ml-2 font-bold tracking-tight">Outreach OS</span>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl py-12 mx-auto px-4 md:px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Automated Creator Outreach</h1>
          <p className="text-muted-foreground">Generate highly personalized DMs and emails based on specific video analyses.</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'email', icon: Mail, label: 'Email' },
                  { id: 'ig', icon: MessageSquare, label: 'IG DM' },
                  { id: 'twitter', icon: Twitter, label: 'Twitter' },
                  { id: 'linkedin', icon: MessageSquare, label: 'LinkedIn' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${platform === p.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-border/40 bg-card hover:bg-accent text-foreground'}`}
                  >
                    <p.icon className="h-5 w-5 mb-2" />
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground">Tone & Style</label>
              <select 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
              >
                <option value="direct">Direct & Value-First</option>
                <option value="casual">Casual & Friendly</option>
                <option value="analytical">Data-Driven / Analytical</option>
                <option value="compliment">Compliment Sandwich</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground">Length</label>
              <div className="flex bg-muted rounded-md p-1">
                {['short', 'medium', 'long'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={`flex-1 text-xs font-medium py-2 rounded-sm capitalize transition-colors ${length === l ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground flex justify-between">
                Additional Instructions <span className="text-xs text-muted-foreground font-normal">Optional</span>
              </label>
              <textarea 
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Keep it under 280 chars, focus on high contrast suggestions..."
                className="flex min-h-[85px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-border/40">
              <label className="text-sm font-medium text-foreground flex items-center justify-between">
                Upload Context <span className="text-xs text-muted-foreground font-normal">Optional</span>
              </label>
              
              {uploadedFileUrl ? (
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-500 font-bold shrink-0 text-xs">
                      {uploadedFileName.split('.').pop()?.toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate text-foreground">{uploadedFileName}</p>
                      <p className="text-xs text-emerald-500 flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Style context loaded
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleRemoveFile}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 hover:bg-destructive/10 rounded"
                  >
                    Remove
                  </button>
                </div>
              ) : uploading ? (
                <div className="border border-border/40 rounded-xl p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">Uploading: {uploadedFileName}</span>
                    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-150" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept="application/pdf,image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileUpload}
                  />
                  <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">Drop PDF or screenshots</p>
                  <p className="text-xs text-muted-foreground mt-1">AI adapts to your style & guidelines</p>
                </label>
              )}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 rounded-md bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                "Generate Outreach"
              )}
            </button>
          </div>

          {/* Output Area */}
          <div className={outreachContext ? "lg:col-span-5" : "lg:col-span-8"}>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm h-full flex flex-col min-h-[500px]">
              <div className="p-4 border-b border-border/40 flex justify-between items-center bg-muted/30">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-destructive/80"></div>
                  <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
                </div>
                <div className="flex gap-2">
                  {outreachContext && generatedText && (
                    <button 
                      onClick={handleSaveCrm}
                      className="h-8 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 bg-emerald-500/10"
                    >
                      <BookmarkPlus className="h-3 w-3 mr-2" /> Save to CRM
                    </button>
                  )}
                  <button 
                    onClick={handleGenerate}
                    className="h-8 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-foreground border border-border/40 bg-background"
                  >
                    <RefreshCw className="h-3 w-3 mr-2" /> Regenerate
                  </button>
                  <button 
                    onClick={handleCopy}
                    className="h-8 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-foreground text-background hover:bg-foreground/90"
                  >
                    {copied ? <CheckCircle2 className="h-3 w-3 mr-2 text-emerald-500" /> : <Copy className="h-3 w-3 mr-2" />} 
                    {copied ? "Copied!" : "Copy Text"}
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {generatedText || (
                  <span className="text-muted-foreground italic flex items-center justify-center h-full opacity-50">
                    Your generated outreach will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Context Sidebar */}
          {outreachContext && (
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4 text-emerald-500">
                  <Zap className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Active Transfer Context</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Creator</p>
                    <p className="text-sm font-medium text-foreground">{outreachContext.creatorName || "Creator"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Target Video</p>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{outreachContext.videoTitle || "your latest video"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Detected Weaknesses</p>
                    <ul className="text-sm space-y-1">
                      {outreachContext.detectedWeaknesses && Array.isArray(outreachContext.detectedWeaknesses) ? (
                        outreachContext.detectedWeaknesses.map((w, i) => (
                          <li key={i} className="flex items-start text-amber-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-2 mt-1.5 shrink-0"></span>
                            <span>{w}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-muted-foreground italic">None detected</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transcript Tone</p>
                    <p className="text-sm text-foreground">{outreachContext.emotionalTone || "engaging"}</p>
                  </div>
                </div>
              </div>
 
              {/* Deep Creator Intelligence Info */}
              <div className="rounded-xl border border-border/40 bg-card p-4 space-y-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
                  Deep Creator Intelligence
                </h4>
                
                {outreachContext.exactHook && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Intro Hook Line</p>
                    <p className="text-xs bg-muted p-2 rounded text-foreground italic border border-border/40 line-clamp-3">
                      "{outreachContext.exactHook}"
                    </p>
                  </div>
                )}
 
                {outreachContext.audienceType && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Audience Profile</p>
                    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-block capitalize">
                      {outreachContext.audienceType}
                    </span>
                  </div>
                )}
 
                {outreachContext.retentionStyle && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Retention Style</p>
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 inline-block capitalize font-medium">
                      {outreachContext.retentionStyle}
                    </span>
                  </div>
                )}
 
                {outreachContext.mostRepeatedPhrases && Array.isArray(outreachContext.mostRepeatedPhrases) && outreachContext.mostRepeatedPhrases.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Most Repeated Phrases</p>
                    <div className="flex flex-wrap gap-1">
                      {outreachContext.mostRepeatedPhrases.map((phrase, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground border border-border/40">
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
 
                {outreachContext.curiosityLoops && Array.isArray(outreachContext.curiosityLoops) && outreachContext.curiosityLoops.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Curiosity Loops</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {outreachContext.curiosityLoops.map((loop, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-emerald-500 mr-1.5">⏳</span>
                          <span>{loop}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
 
                {outreachContext.ctaStyle && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">CTA Transition Style</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{outreachContext.ctaStyle}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
