"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  PenTool, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Globe, 
  Linkedin, 
  Twitter, 
  User, 
  Briefcase, 
  ExternalLink,
  Eye,
  Check,
  X,
  Plus,
  Trash2,
  Youtube,
  Instagram,
  Palette,
  Layers,
  FolderGit2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  RemoveFormatting
} from "lucide-react";
import { 
  renderSignatureHtml, 
  UserSignature, 
  SocialLinkConfig, 
  getNormalizedSocialLinks, 
  AVAILABLE_SOCIAL_LINKS,
  formatSocialUrl,
  isValidSocialUrl
} from "@/lib/email/signature";
import { useGlobalSignature } from "@/hooks/use-global-signature";

export default function EmailSignatureEditor() {
  const { signature: globalSig, loading: globalLoading, refresh: refreshGlobalSig, updateSignature: updateGlobalSig } = useGlobalSignature();

  const [signature, setSignature] = useState<UserSignature>({
    signature_name: "Main Outreach",
    display_name: "",
    role: "",
    content_html: "",
    portfolio_url: "",
    website_url: "",
    linkedin_url: "",
    twitter_url: "",
    social_links: [],
    is_enabled: true,
  });

  const [socialLinks, setSocialLinks] = useState<SocialLinkConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  // Track whether the editor has been seeded with initial content so we only
  // set innerHTML once (prevents cursor-jump on every re-render).
  const editorSeeded = useRef(false);

  // Sync state from global signature context
  useEffect(() => {
    if (globalSig) {
      console.log('[EmailSignatureEditor] Syncing setSignature() from globalSig:', globalSig);
      const normalized = getNormalizedSocialLinks(globalSig);
      setSocialLinks(normalized);

      // content_html is now always populated by normalizeSignatureFromDb on the server.
      // Use it directly; never fall back to a hardcoded client-side default.
      const initialHtml = globalSig.content_html || "";

      setSignature({
        ...globalSig,
        // Ensure signature_name from the new schema column is respected
        signature_name: globalSig.signature_name || "Main Outreach",
        content_html: initialHtml,
      });
      editorSeeded.current = false; // allow editor to re-seed with the fetched content
      setLoading(false);
    } else if (!globalLoading) {
      setLoading(false);
    }
  }, [globalSig, globalLoading]);

  // Seed the rich text editor DOM with the loaded content — only once per load.
  // Using a ref guard prevents re-setting innerHTML on every keystroke re-render,
  // which would reset the cursor position mid-typing.
  useEffect(() => {
    if (!loading && editorRef.current && !editorSeeded.current && signature.content_html !== undefined) {
      editorRef.current.innerHTML = signature.content_html;
      editorSeeded.current = true;
    }
  }, [loading, signature.content_html]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setSignature((prev) => ({ ...prev, content_html: html }));
      setSaveStatus(null);
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      handleEditorInput();
    }
  };

  const handleAddLinkPrompt = () => {
    const url = prompt("Enter hyperlink URL:", "https://");
    if (url && url.trim()) {
      execCommand("createLink", formatSocialUrl(url));
    }
  };

  const handleQuickInsertLink = (platformId: string) => {
    let targetLink = socialLinks.find((l) => l.id === platformId);
    let label = targetLink?.label || platformId;
    let rawUrl = targetLink?.url || "";

    if (!targetLink || !isValidSocialUrl(rawUrl)) {
      const userPromptUrl = prompt(`Enter URL for ${label}:`, "https://");
      if (!userPromptUrl || !userPromptUrl.trim()) return;
      rawUrl = userPromptUrl;
      handleLinkUrlChange(platformId, rawUrl);
    }

    const finalUrl = formatSocialUrl(rawUrl);
    const anchorHtml = `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" style="color: #10b981; font-weight: 600; text-decoration: underline;">${label}</a>&nbsp;`;

    if (editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const el = document.createElement("div");
          el.innerHTML = anchorHtml;
          let frag = document.createDocumentFragment(), node, lastNode;
          while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          handleEditorInput();
          return;
        }
      }

      // Appends to bottom if cursor not inside editor
      editorRef.current.innerHTML += `<br/>${anchorHtml}`;
      handleEditorInput();
    }
  };

  const handleFieldChange = (field: keyof UserSignature, val: any) => {
    setSignature((prev) => ({ ...prev, [field]: val }));
    setSaveStatus(null);
  };

  const handleLinkToggle = (id: string) => {
    setSocialLinks((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      );
      setSignature((sig) => ({ ...sig, social_links: updated }));
      return updated;
    });
    setSaveStatus(null);
  };

  const handleLinkUrlChange = (id: string, url: string) => {
    setSocialLinks((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, url } : item
      );
      setSignature((sig) => ({ ...sig, social_links: updated }));
      return updated;
    });
    setSaveStatus(null);
  };

  const handleCustomLabelChange = (id: string, label: string) => {
    setSocialLinks((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, label } : item
      );
      setSignature((sig) => ({ ...sig, social_links: updated }));
      return updated;
    });
    setSaveStatus(null);
  };

  const handleAddCustomLink = () => {
    const customId = `custom-${Date.now()}`;
    const newLink: SocialLinkConfig = {
      id: customId,
      label: "Custom Link",
      url: "https://",
      enabled: true,
      isCustom: true,
    };
    setSocialLinks((prev) => {
      const updated = [...prev, newLink];
      setSignature((sig) => ({ ...sig, social_links: updated }));
      return updated;
    });
    setSaveStatus(null);
  };

  const handleRemoveCustomLink = (id: string) => {
    setSocialLinks((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setSignature((sig) => ({ ...sig, social_links: updated }));
      return updated;
    });
    setSaveStatus(null);
  };

  const getLinkIcon = (id: string) => {
    switch (id) {
      case "portfolio": return <ExternalLink className="h-3.5 w-3.5 text-emerald-500" />;
      case "website": return <Globe className="h-3.5 w-3.5 text-blue-500" />;
      case "linkedin": return <Linkedin className="h-3.5 w-3.5 text-sky-500" />;
      case "twitter": return <Twitter className="h-3.5 w-3.5 text-slate-400" />;
      case "youtube": return <Youtube className="h-3.5 w-3.5 text-red-500" />;
      case "instagram": return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
      case "behance": return <Palette className="h-3.5 w-3.5 text-indigo-500" />;
      case "dribbble": return <Layers className="h-3.5 w-3.5 text-rose-400" />;
      case "github": return <FolderGit2 className="h-3.5 w-3.5 text-purple-400" />;
      default: return <Globe className="h-3.5 w-3.5 text-emerald-500" />;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setSaveStatus(null);

    // Build explicit payload so all three new schema columns are always present
    const payload = {
      ...signature,
      signature_name: signature.signature_name || "Main Outreach",
      content_html: signature.content_html || "",
      social_links: socialLinks,
    };

    try {
      const res = await fetch("/api/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('[EmailSignatureEditor] POST /api/signature response:', data);
      if (res.ok && data.success) {
        setSaveStatus({
          success: true,
          message: "Email Signature saved successfully!",
        });
        if (data.signature) {
          const sig = data.signature;
          console.log('[EmailSignatureEditor] Updating local & global state with saved signature:', sig);
          setSignature(sig);
          setSocialLinks(getNormalizedSocialLinks(sig));
          // Allow the editor to re-seed on next context refresh
          editorSeeded.current = false;
          updateGlobalSig(sig);
        }
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus({
          success: false,
          message: data.error || "Failed to save signature.",
        });
      }
    } catch (err: any) {
      setSaveStatus({
        success: false,
        message: err.message || "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentSigState: UserSignature = {
    ...signature,
    social_links: socialLinks,
  };

  const liveHtml = renderSignatureHtml(currentSigState);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border/40 p-6">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-500 mb-2" />
        <p className="text-xs text-muted-foreground">Loading Email Signature...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border/40 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-xl text-foreground tracking-tight flex items-center gap-2">
            <PenTool className="h-5 w-5 text-emerald-500" /> Email Signature
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gmail-inspired signature builder. Appended automatically below every email template.
          </p>
        </div>

        {/* Global Activation Toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none bg-muted/40 px-3.5 py-2 rounded-xl border border-border/50 shrink-0">
          <input
            type="checkbox"
            checked={signature.is_enabled}
            onChange={(e) => handleFieldChange("is_enabled", e.target.checked)}
            className="h-4 w-4 rounded border-input text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
          />
          <span className="text-xs font-bold text-foreground">
            Enable Email Signature
          </span>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Signature Name Input */}
        <div className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-2">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
            Signature Name
          </label>
          <input
            type="text"
            value={signature.signature_name || "Main Outreach"}
            onChange={(e) => handleFieldChange("signature_name", e.target.value)}
            placeholder="Main Outreach"
            className="w-full max-w-md h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          
          {/* Editor & Social Links Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Signature Content - Rich Text Editor */}
            <div className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Signature Content
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  Gmail-style Rich Text Editor
                </span>
              </div>

              {/* Editor Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-t-xl border border-border/60 bg-muted/30">
                <button
                  type="button"
                  onClick={() => execCommand("bold")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("italic")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("underline")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Underline"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-border/60 mx-1" />
                <button
                  type="button"
                  onClick={() => execCommand("insertUnorderedList")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Bulleted List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("insertOrderedList")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Numbered List"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-border/60 mx-1" />
                <button
                  type="button"
                  onClick={() => execCommand("justifyLeft")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Align Left"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("justifyCenter")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Align Center"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("justifyRight")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Align Right"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-border/60 mx-1" />
                <button
                  type="button"
                  onClick={handleAddLinkPrompt}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Add Link"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("removeFormat")}
                  className="p-1.5 rounded hover:bg-muted text-foreground transition-colors"
                  title="Clear Formatting"
                >
                  <RemoveFormatting className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Rich Text Editor Canvas */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
                className="w-full min-h-[140px] p-3 rounded-b-xl border border-t-0 border-border/60 bg-[#0c0c0e] text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans prose prose-invert max-w-none"
              />

              {/* Quick Insert Bar */}
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Quick Insert Hyperlinks
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "portfolio", label: "+ Portfolio" },
                    { id: "website", label: "+ Website" },
                    { id: "linkedin", label: "+ LinkedIn" },
                    { id: "twitter", label: "+ X" },
                    { id: "youtube", label: "+ YouTube" },
                    { id: "behance", label: "+ Behance" },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleQuickInsertLink(btn.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-muted/40 hover:bg-emerald-500/10 hover:text-emerald-500 border border-border/50 transition-all cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddCustomLink}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    + Custom Link
                  </button>
                </div>
              </div>

            </div>

            {/* Social Links List */}
            <div className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Social Links
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  Only checked links with valid URLs render in signature
                </span>
              </div>

              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                {socialLinks.map((item) => {
                  const def = AVAILABLE_SOCIAL_LINKS.find((d) => d.id === item.id);
                  const placeholder = def?.defaultUrlPlaceholder || "https://...";
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-3 rounded-xl border transition-all ${
                        item.enabled 
                          ? "border-emerald-500/30 bg-emerald-500/[0.02]" 
                          : "border-border/40 bg-muted/20 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => handleLinkToggle(item.id)}
                            className="h-3.5 w-3.5 rounded border-input text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                          />
                          {item.isCustom ? (
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleCustomLabelChange(item.id, e.target.value)}
                              placeholder="Custom Label"
                              className="h-6 px-1.5 text-xs font-semibold bg-background border border-input rounded text-foreground focus:outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              {getLinkIcon(item.id)} {item.label}
                            </span>
                          )}
                        </label>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${item.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
                            {item.enabled ? "[✓ Enabled]" : "[Disabled]"}
                          </span>
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomLink(item.id)}
                              className="text-destructive/70 hover:text-destructive p-1 rounded transition-colors"
                              title="Remove custom link"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="url"
                        value={item.url}
                        onChange={(e) => handleLinkUrlChange(item.id, e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Link Button */}
              <button
                type="button"
                onClick={handleAddCustomLink}
                className="w-full h-9 rounded-xl border border-dashed border-emerald-500/40 hover:border-emerald-500 text-emerald-500 hover:bg-emerald-500/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="h-4 w-4" /> Add Custom Link
              </button>

            </div>

          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-emerald-500" /> LIVE PREVIEW
              </label>
              <span className="text-[10px] text-emerald-500 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Real-time
              </span>
            </div>

            <div className="flex-1 p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between space-y-6">
              
              {/* Preview Mail Box */}
              <div className="p-5 rounded-xl bg-[#0c0c0e] border border-white/10 shadow-lg min-h-[220px]">
                <p className="text-[11px] text-zinc-500 italic mb-4 border-b border-white/10 pb-2">
                  Email Body Content Preview...
                </p>
                {signature.is_enabled ? (
                  liveHtml ? (
                    <div 
                      className="text-zinc-200 [&_a]:text-emerald-400 [&_a:hover]:underline"
                      dangerouslySetInnerHTML={{ __html: liveHtml }} 
                    />
                  ) : (
                    <p className="text-xs text-zinc-500 italic">
                      Type your signature content in the editor to see your preview.
                    </p>
                  )
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium">
                    Signature disabled. Check &quot;Enable Email Signature&quot; above to activate.
                  </div>
                )}
              </div>

              {saveStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                    saveStatus.success
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}
                >
                  {saveStatus.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{saveStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Signature Configuration
              </button>

            </div>
          </div>

        </div>
      </form>
    </div>
  );
}



