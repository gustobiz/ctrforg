"use client";

import { ArrowLeft, Users, Filter, Mail, MessageSquare, CheckCircle2, Clock, StickyNote, Bell, ExternalLink, PenTool, Search, LayoutGrid, List, FileText, Send, Sparkles, AlertCircle, RefreshCw, ShieldAlert, CheckCircle, ToggleLeft, ToggleRight, Trash2, X, Globe, Upload, Loader2, Plus, Copy, Archive, RotateCcw, ChevronLeft, ChevronRight, ArrowUpDown, Check, MoreHorizontal, Download } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAppStore, CrmLead } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { formatCompactNumber, sanitizeCRMLead } from "@/lib/supabase/db";
import { useGlobalSignature } from "@/hooks/use-global-signature";

export default function CRMPage() {
  const { signature: globalSig, renderedHtml: globalSigHtml } = useGlobalSignature();
  const [useSignature, setUseSignature] = useState(true);
  const { crmLeads, setCrmLeads, updateCrmLeadStatus, transferToOutreach } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [searchQuery, setSearchQuery] = useState("");

  // Phase 3 CRM Lead Management States
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [undoTrash, setUndoTrash] = useState<{ ids: string[]; leads: CrmLead[]; timer: any } | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'lead_score' | 'subs' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [csvUploading, setCsvUploading] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // New Lead Form state
  const [createFormData, setCreateFormData] = useState({
    name: '',
    channel_name: '',
    email: '',
    website: '',
    niche: 'General',
    notes: '',
    lead_score: 50,
    status: 'new' as CrmLead['status'],
    contact_source: 'manual',
    instagram: '',
    twitter: '',
    linkedin: '',
    facebook: ''
  });

  const supabase = createClient();

  // Navigation states
  const [currentSection, setCurrentSection] = useState<"pipeline" | "followups" | "analytics">("pipeline");

  // Gmail integration state
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    email: string | null;
    status: string;
  }>({ connected: false, email: null, status: "loading" });

  // Lead drawer state
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "email" | "history" | "followup">("overview");

  // Lead drawer specific data states
  const [leadCampaigns, setLeadCampaigns] = useState<any[]>([]);
  const [leadEvents, setLeadEvents] = useState<any[]>([]);
  const [leadFollowups, setLeadFollowups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Follow-ups section states
  const [allFollowups, setAllFollowups] = useState<any[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);

  // Google Sheets state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetsConnection, setSheetsConnection] = useState<any>(null);
  const [sheetConnecting, setSheetConnecting] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [driveSheets, setDriveSheets] = useState<{ id: string; name: string; webViewLink: string }[]>([]);
  const [loadingDriveSheets, setLoadingDriveSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [isOAuthConnected, setIsOAuthConnected] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);

  const fetchDriveSpreadsheets = async () => {
    setLoadingDriveSheets(true);
    try {
      const oauthRes = await fetch('/api/gmail/status');
      if (oauthRes.ok) {
        const oauthData = await oauthRes.json();
        setIsOAuthConnected(oauthData.connected);
        if (oauthData.connected) {
          const res = await fetch("/api/sheets/list");
          if (res.ok) {
            const data = await res.json();
            setDriveSheets(data.files || []);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch Google Drive sheets:", err);
    } finally {
      setLoadingDriveSheets(false);
    }
  };

  useEffect(() => {
    if (isSheetsModalOpen) {
      fetchDriveSpreadsheets();
    }
  }, [isSheetsModalOpen]);

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const fetchSheetsConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('sheets_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (data) {
        setSheetsConnection(data);
        setSheetUrl(data.sheet_url);
      }
    } catch (err) {
      console.error("Failed to fetch sheets connection:", err);
    }
  };

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedLeads: CrmLead[] = data.map((lead: any) => ({
          id: lead.id,
          name: lead.creator_name,
          niche: lead.ai_analysis?.creator_niche || lead.creator_niche || "General",
          status: lead.status || "new",
          date: lead.created_at ? formatRelativeTime(lead.created_at) : "Just now",
          notes: lead.notes || "",
          platform: lead.ai_analysis?.platform || lead.platform || "email",
          
          // Contact Presence & Details
          email: lead.email || lead.contact_email || lead.ai_analysis?.contact_email || null,
          contact_email: lead.contact_email || lead.email || lead.ai_analysis?.contact_email || null,
          website: lead.website || lead.ai_analysis?.website || null,
          instagram: lead.instagram || lead.ai_analysis?.instagram || null,
          twitter: lead.twitter || lead.ai_analysis?.twitter || null,
          linkedin: lead.linkedin || lead.ai_analysis?.linkedin || null,
          facebook: lead.facebook || lead.ai_analysis?.facebook || null,
          contact_source: lead.contact_source || 'youtube_scraping',
          contact_status: lead.contact_status || 'discovered',
          email_verified: lead.email_verified || false,
          website_found: lead.website_found || false,
          social_links_found: lead.social_links_found || false,
          lead_score: lead.lead_score || 0,
          opportunity_score: lead.opportunity_score || lead.score || 65,
          thumbnail_opportunity: lead.thumbnail_opportunity || 0,
          last_updated: lead.last_updated || lead.created_at,

          analysis: {
            creatorName: lead.creator_name,
            channelName: lead.channel_name || lead.creator_name,
            videoTitle: lead.video_title || "",
            detectedWeaknesses: lead.ctr_weaknesses || [],
            weaknessDetails: lead.ctr_weaknesses?.map(() => "") || [],
            titlePatterns: lead.ai_analysis?.title_patterns || lead.title_patterns || "",
            hookAnalysis: lead.ai_analysis?.hook_analysis || lead.hook_analysis || "",
            emotionalTone: lead.ai_analysis?.emotional_tone || lead.emotional_tone || "",
            creatorNiche: lead.ai_analysis?.creator_niche || lead.creator_niche || "",
            videoUrl: lead.video_url || "",
            channelUrl: lead.ai_analysis?.channel_url || lead.channel_url || "",
            transcriptSnippets: lead.transcript_snippets || [],
            repeatedPhrases: lead.repeated_phrases || [],
            ctaOpportunities: lead.ai_analysis?.cta_opportunities || lead.cta_opportunities || [],
            subs: formatCompactNumber(lead.subscriber_count),
            views: formatCompactNumber(lead.view_count),
            likes: formatCompactNumber(lead.like_count),
            publishedAt: lead.published_at || "",
            thumbnailUrl: lead.thumbnail_url || "",
            score: lead.ai_analysis?.score || lead.score || 65,
            packagingScore: lead.ai_analysis?.packaging_score !== undefined ? lead.ai_analysis.packaging_score : (lead.ai_analysis?.packagingScore !== undefined ? lead.ai_analysis.packagingScore : (lead.score || 65)),
            estimatedCtrRange: lead.ai_analysis?.estimated_ctr_range || lead.ai_analysis?.estimatedCtrRange || "N/A",
            ctrGainPotential: lead.ai_analysis?.ctr_gain_potential || lead.ai_analysis?.ctrGainPotential || "N/A",
            packagingEfficiency: lead.ai_analysis?.packaging_efficiency !== undefined ? lead.ai_analysis.packaging_efficiency : (lead.ai_analysis?.packagingEfficiency !== undefined ? lead.ai_analysis.packagingEfficiency : 65),
            subscriberVelocity: lead.ai_analysis?.subscriber_velocity || lead.ai_analysis?.subscriberVelocity || "Medium",
            titleIdeas: lead.optimized_titles || [],
            suggestedHook: lead.ai_analysis?.suggested_hook || lead.suggested_hook || "",
            audiencePositioning: lead.audience_positioning || "",
            generatedOutreach: lead.generated_outreach || ""
          }
        }));
        setCrmLeads(mappedLeads);
      }
    } catch (err) {
      console.error("Failed to load leads from Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 3 CRM Lead Management Handlers
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name) {
      alert("Creator name is required");
      return;
    }
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createFormData)
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        const lead = data.lead;
        const newCrmLead: CrmLead = {
          id: lead.id,
          name: lead.creator_name,
          niche: lead.niche || createFormData.niche,
          status: lead.status || 'new',
          date: 'Just now',
          notes: lead.notes || '',
          platform: 'email',
          email: lead.email || lead.contact_email,
          contact_email: lead.contact_email || lead.email,
          website: lead.website,
          instagram: lead.instagram,
          twitter: lead.twitter,
          linkedin: lead.linkedin,
          facebook: lead.facebook,
          contact_source: lead.contact_source || 'manual',
          contact_status: lead.contact_status || 'discovered',
          email_verified: Boolean(lead.email),
          website_found: Boolean(lead.website),
          lead_score: lead.lead_score || 50,
          opportunity_score: 65,
          thumbnail_opportunity: 0,
          last_updated: lead.created_at,
          analysis: {
            creatorName: lead.creator_name,
            channelName: lead.channel_name || lead.creator_name,
            videoTitle: '',
            detectedWeaknesses: [],
            titlePatterns: '',
            hookAnalysis: '',
            emotionalTone: '',
            creatorNiche: createFormData.niche,
            videoUrl: '',
            channelUrl: '',
            transcriptSnippets: [],
            repeatedPhrases: [],
            ctaOpportunities: [],
            subs: '0',
            views: '0',
            score: 65,
          }
        };
        setCrmLeads([newCrmLead, ...crmLeads]);
        setIsCreateModalOpen(false);
        setCreateFormData({
          name: '',
          channel_name: '',
          email: '',
          website: '',
          niche: 'General',
          notes: '',
          lead_score: 50,
          status: 'new',
          contact_source: 'manual',
          instagram: '',
          twitter: '',
          linkedin: '',
          facebook: ''
        });
        alert("Lead created successfully!");
      } else {
        alert(data.error || "Failed to create lead.");
      }
    } catch (err: any) {
      alert(`Error creating lead: ${err.message}`);
    }
  };

  const handleEditLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    try {
      const res = await fetch("/api/crm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLead.id,
          creator_name: editingLead.name,
          notes: editingLead.notes,
          status: editingLead.status,
          contact_email: editingLead.email || editingLead.contact_email,
          email: editingLead.email || editingLead.contact_email,
          website: editingLead.website,
          lead_score: editingLead.lead_score,
          instagram: editingLead.instagram,
          twitter: editingLead.twitter,
          linkedin: editingLead.linkedin,
          facebook: editingLead.facebook
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCrmLeads(crmLeads.map(l => l.id === editingLead.id ? editingLead : l));
        setEditingLead(null);
        alert("Lead updated successfully!");
      } else {
        alert(data.error || "Failed to update lead.");
      }
    } catch (err: any) {
      alert(`Error updating lead: ${err.message}`);
    }
  };

  const handleDeleteLeads = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    const leadsToRemove = crmLeads.filter(l => idsToDelete.includes(l.id));

    setCrmLeads(crmLeads.filter(l => !idsToDelete.includes(l.id)));
    setSelectedLeadIds(prev => prev.filter(id => !idsToDelete.includes(id)));

    if (undoTrash?.timer) {
      clearTimeout(undoTrash.timer);
    }

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/crm?id=${idsToDelete.join(',')}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
        });
      } catch (err) {
        console.error("Failed to commit deletion to DB:", err);
      }
      setUndoTrash(null);
    }, 5000);

    setUndoTrash({ ids: idsToDelete, leads: leadsToRemove, timer });
  };

  const handleUndoDelete = () => {
    if (!undoTrash) return;
    if (undoTrash.timer) clearTimeout(undoTrash.timer);
    setCrmLeads([...undoTrash.leads, ...crmLeads]);
    setUndoTrash(null);
  };

  const handleDuplicateLead = async (lead: CrmLead) => {
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", leadId: lead.id })
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        const copy: CrmLead = {
          ...lead,
          id: data.lead.id,
          name: data.lead.creator_name,
          date: 'Just now'
        };
        setCrmLeads([copy, ...crmLeads]);
        alert("Lead duplicated successfully!");
      } else {
        alert(data.error || "Failed to duplicate lead");
      }
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const handleArchiveRestoreLead = async (lead: CrmLead, archive: boolean) => {
    const newStatus = archive ? ('archived' as any) : 'new';
    try {
      await fetch("/api/crm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, status: newStatus })
      });
      setCrmLeads(crmLeads.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleScanDuplicates = async () => {
    setIsDuplicateModalOpen(true);
    setLoadingDuplicates(true);
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "find_duplicates" })
      });
      const data = await res.json();
      if (data.success) {
        setDuplicateGroups(data.duplicateGroups || []);
      }
    } catch (err: any) {
      console.error("Duplicate scan error:", err);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const handleMergeDuplicateGroup = async (targetLeadId: string, duplicateLeadIds: string[]) => {
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", targetLeadId, duplicateLeadIds })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Duplicates merged successfully!");
        fetchLeads();
        handleScanDuplicates();
      } else {
        alert(data.error || "Failed to merge duplicates");
      }
    } catch (err: any) {
      alert(`Merge error: ${err.message}`);
    }
  };

  const handleDeleteBySource = async (source: string) => {
    if (!confirm(`Are you sure you want to delete all leads from source '${source}'?`)) return;
    try {
      const res = await fetch(`/api/crm?action=delete_by_source&source=${source}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Deleted leads from ${source}`);
        fetchLeads();
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("CAUTION: Are you sure you want to DELETE ALL LEADS permanently? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/crm?action=delete_all`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Deleted all leads");
        fetchLeads();
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCSVImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 1) {
          alert("CSV file is empty or has no header row.");
          return;
        }

        const parseLine = (line: string) => {
          const res = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { res.push(cur.trim()); cur = ''; }
            else cur += char;
          }
          res.push(cur.trim());
          return res;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('creator') || h.includes('lead'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
        const channelIdx = headers.findIndex(h => h.includes('channel') || h.includes('youtube'));
        const subIdx = headers.findIndex(h => h.includes('subscriber') || h.includes('subs'));
        const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('info'));
        const websiteIdx = headers.findIndex(h => h.includes('website') || h.includes('url') || h.includes('site'));

        const parsedLeads: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseLine(lines[i]);
          const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : (row[0] || '');
          if (!name) continue;

          parsedLeads.push({
            creator_name: name,
            email: emailIdx !== -1 ? row[emailIdx] || '' : '',
            channel_name: channelIdx !== -1 ? row[channelIdx] || name : name,
            subscriber_count: subIdx !== -1 ? parseInt(row[subIdx]?.replace(/[^0-9]/g, ''), 10) || 0 : 0,
            notes: notesIdx !== -1 ? row[notesIdx] || '' : '',
            website: websiteIdx !== -1 ? row[websiteIdx] || '' : '',
            status: 'new',
            contact_source: 'csv_import'
          });
        }

        const res = await fetch("/api/crm/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: parsedLeads })
        });

        const data = await res.json();
        if (res.ok) {
          alert(data.message || `Imported ${data.importedCount} leads from CSV!`);
          setIsCSVModalOpen(false);
          fetchLeads();
        } else {
          alert(`CSV Import Error: ${data.error}`);
        }
      } catch (err: any) {
        alert(`CSV parsing error: ${err.message}`);
      } finally {
        setCsvUploading(false);
      }
    };
    reader.readAsText(file);
  };

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads();
    fetchSheetsConnection();
  }, []);

  const handleConnectSheet = async () => {
    let payload: any = {};
    if (selectedSheetId) {
      const selected = driveSheets.find(s => s.id === selectedSheetId);
      if (!selected) {
        alert("Selected sheet not found");
        return;
      }
      payload = { sheetId: selected.id, sheetUrl: selected.webViewLink };
    } else if (sheetUrl) {
      payload = { sheetUrl };
    } else {
      alert("Please select a spreadsheet or enter a Google Sheet URL");
      return;
    }
    setSheetConnecting(true);
    try {
      const res = await fetch("/api/sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSheetsConnection(data.connection);
        alert(data.message || "Google Sheet connected!");
        // Auto trigger sync immediately
        setSyncingSheet(true);
        const syncRes = await fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: data.connection.id }),
        });
        const syncData = await syncRes.json();
        if (syncData.success) {
          alert(`Initial sync successful! Imported ${syncData.totalSynced} leads.`);
          fetchLeads();
          fetchSheetsConnection();
        }
      } else {
        alert(data.error || "Connection failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting Google Sheet");
    } finally {
      setSheetConnecting(false);
      setSyncingSheet(false);
    }
  };

  const handleSyncSheet = async () => {
    if (!sheetsConnection) return;
    setSyncingSheet(true);
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnection.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sync finished successfully! Imported/Updated ${data.totalSynced} creator leads.`);
        fetchLeads();
        fetchSheetsConnection();
      } else {
        alert(data.error || "Sync failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error syncing sheet");
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleExportCRMToSheet = async () => {
    if (!sheetsConnection) return;
    setExportingSheet(true);
    try {
      const res = await fetch("/api/sheets/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnection.id })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "CRM leads exported successfully!");
      } else {
        alert(data.error || "Export failed");
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CRM leads to Google Sheet.");
    } finally {
      setExportingSheet(false);
    }
  };

  const handleDisconnectSheet = async () => {
    if (!sheetsConnection) return;
    if (!confirm("Are you sure you want to disconnect this Google Sheet connection? This will delete the connection and remove imported leads.")) return;
    try {
      const res = await fetch('/api/sheets/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: sheetsConnection.id,
          sheetId: sheetsConnection.sheet_id,
          deleteLeads: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSheetsConnection(null);
        setSheetUrl("");
        alert(data.message || "Google Sheet disconnected successfully.");
        fetchLeads();
      } else {
        alert(`Failed to disconnect: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Failed to disconnect: ${err.message}`);
    }
  };

  // Fetch Gmail status
  useEffect(() => {
    async function checkGmail() {
      try {
        const res = await fetch('/api/gmail/status');
        const data = await res.json();
        setGmailStatus(data);
      } catch (err) {
        console.error("Gmail status check failed in CRM:", err);
      }
    }
    checkGmail();
  }, []);

  // Fetch templates when drawer is open
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/email/templates');
        const data = await res.json();
        if (data.success) {
          setTemplates(data.templates);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
    }
    if (drawerOpen) {
      fetchTemplates();
    }
  }, [drawerOpen]);

  // Fetch global followups
  const fetchAllFollowups = async () => {
    try {
      const { data, error } = await supabase
        .from('followup_sequences')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setAllFollowups(data || []);
    } catch (err) {
      console.error("Failed to fetch all followups:", err);
    }
  };

  useEffect(() => {
    if (currentSection === "followups") {
      fetchAllFollowups();
    }
  }, [currentSection]);

  // Fetch global analytics
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/email/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.analytics);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (currentSection === "analytics") {
      fetchAnalytics();
    }
  }, [currentSection]);

  function formatRelativeTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0) return 'recently';
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return 'recently';
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: CrmLead["status"]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const safePayload = sanitizeCRMLead({ status: newStatus });
        const { error } = await supabase
          .from('crm_leads')
          .update(safePayload)
          .eq('id', id);
        if (error) throw error;
      }
      
      updateCrmLeadStatus(id, newStatus);
    } catch (err) {
      console.error("Failed to update status in Supabase, updating locally:", err);
      updateCrmLeadStatus(id, newStatus);
    }
  };

  // Open lead details drawer
  const handleSelectLead = async (lead: CrmLead, initialTab: "overview" | "email" | "history" | "followup" = "overview") => {
    setSelectedLead(lead);
    setDrawerTab(initialTab);
    setDrawerOpen(true);
    setSendSuccess(false);

    // Set recipient email
    const parsedEmail = lead.analysis?.videoUrl?.includes("mailto:") 
      ? lead.analysis.videoUrl.split("mailto:")[1] 
      : `${lead.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
    setEmailTo(parsedEmail);

    // Initial email content pre-population
    setEmailSubject(`Boost CTR for your video: "${lead.analysis?.videoTitle || ''}"`);
    setEmailBody(lead.analysis?.generatedOutreach || "");

    // Fetch lead-specific campaigns/events/followups
    await fetchLeadDetails(lead.id);
  };

  const fetchLeadDetails = async (leadId: string) => {
    try {
      const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: false });
      setLeadCampaigns(campaigns || []);

      const { data: events } = await supabase
        .from('email_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      setLeadEvents(events || []);

      const { data: followups } = await supabase
        .from('followup_sequences')
        .select('*')
        .eq('lead_id', leadId)
        .order('scheduled_at', { ascending: true });
      setLeadFollowups(followups || []);
    } catch (err) {
      console.error("Failed to fetch lead details:", err);
    }
  };

  // Select Email Template
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (template && selectedLead) {
      const vars = {
        creator_name: selectedLead.name,
        channel_name: selectedLead.analysis?.channelName || selectedLead.name,
        latest_video: selectedLead.analysis?.videoTitle || "",
      };

      let subject = template.subject;
      let htmlBody = template.html_body;

      for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        subject = subject.replace(regex, value);
        htmlBody = htmlBody.replace(regex, value);
      }

      setEmailSubject(subject);
      setEmailBody(htmlBody.replace(/<[^>]*>/g, '\n').trim());
    }
  };

  // Save current subject/body as template
  const handleSaveAsTemplate = async () => {
    if (!emailSubject || !emailBody) {
      alert("Subject and Body are required to save a template.");
      return;
    }
    const name = prompt("Enter a name for this template:", `Template for ${selectedLead?.name || 'Leads'}`);
    if (!name) return;

    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject: emailSubject,
          htmlBody: emailBody.replace(/\n/g, '<br/>'),
          textBody: emailBody,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Template saved successfully!");
        const res2 = await fetch('/api/email/templates');
        const data2 = await res2.json();
        if (data2.success) {
          setTemplates(data2.templates);
          setSelectedTemplateId(data.template.id);
        }
      }
    } catch (err: any) {
      alert(`Failed to save template: ${err.message}`);
    }
  };

  // Send email to lead
  const handleSendEmail = async () => {
    if (!selectedLead || !emailTo || !emailSubject || !emailBody) {
      alert("Please fill in all fields.");
      return;
    }

    setIsSendingEmail(true);
    setSendSuccess(false);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          toEmail: emailTo,
          subject: emailSubject,
          htmlBody: emailBody.replace(/\n/g, '<br/>'),
          textBody: emailBody,
          templateId: selectedTemplateId || null,
          disableSignature: !useSignature,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSendSuccess(true);
        await fetchLeadDetails(selectedLead.id);
        await handleUpdateStatus(selectedLead.id, 'contacted');
      } else {
        alert(`Failed to send email: ${data.error}`);
      }
    } catch (err: any) {
      console.error("Error sending email:", err);
      alert(`Error sending email: ${err.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Toggle followup sequence item status
  const handleToggleFollowupStatus = async (followupId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'cancelled' : 'pending';
    try {
      const { error } = await supabase
        .from('followup_sequences')
        .update({ status: newStatus })
        .eq('id', followupId);

      if (error) throw error;

      setLeadFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: newStatus } : f));
      setAllFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: newStatus } : f));
    } catch (err: any) {
      console.error("Failed to update follow-up status:", err);
      alert(`Failed to update follow-up status: ${err.message}`);
    }
  };

  // Manually add follow-up step
  const handleCreateFollowupItem = async (ruleType: string, delayDays: number) => {
    if (!selectedLead) return;
    
    const latestCampaign = leadCampaigns.find(c => c.status === 'sent' || c.status === 'opened' || c.status === 'clicked');
    if (!latestCampaign) {
      alert("Please send an initial email to this lead before scheduling follow-ups.");
      return;
    }

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + delayDays);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('followup_sequences')
        .insert({
          user_id: user.id,
          lead_id: selectedLead.id,
          campaign_id: latestCampaign.id,
          rule_type: ruleType,
          delay_days: delayDays,
          followup_number: leadFollowups.length + 1,
          status: 'pending',
          scheduled_at: scheduledDate.toISOString(),
        });

      if (error) throw error;
      await fetchLeadDetails(selectedLead.id);
    } catch (err: any) {
      console.error("Failed to create follow-up item:", err);
      alert(`Failed to create follow-up item: ${err.message}`);
    }
  };

  // Sync replies and process due follow-ups manually
  const handleSyncAndProcessQueue = async () => {
    setSyncLoading(true);
    try {
      const syncRes = await fetch('/api/email/sync-replies', { method: 'POST' });
      const syncData = await syncRes.json();

      const followupRes = await fetch('/api/email/followups', { method: 'POST' });
      const followupData = await followupRes.json();

      alert(`Queue Sync Complete!\n- Synced Replies: ${syncData.count || 0}\n- Follow-ups Sent: ${followupData.sent || 0}\n- Errors: ${followupData.errors?.length || 0}`);
      await fetchAllFollowups();
    } catch (err: any) {
      console.error("Error processing queue:", err);
      alert(`Error processing queue: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleExportCrm = (type: 'csv' | 'report') => {
    if (crmLeads.length === 0) {
      alert("No leads available to export.");
      return;
    }

    if (type === 'csv') {
      const headers = ["Creator Name", "Niche", "Status", "Platform", "Notes", "Subscriber Count", "View Count"];
      const rows = crmLeads.map(lead => [
        `"${lead.name.replace(/"/g, '""')}"`,
        `"${lead.niche.replace(/"/g, '""')}"`,
        `"${lead.status}"`,
        `"${lead.platform}"`,
        `"${(lead.notes || '').replace(/"/g, '""')}"`,
        `"${lead.analysis?.subs || ''}"`,
        `"${lead.analysis?.views || ''}"`
      ]);
      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ctrforge-crm-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      let markdown = `# CTRForge CRM Leads Report\nExported on: ${new Date().toLocaleDateString()}\nTotal Leads: ${crmLeads.length}\n\n`;
      markdown += `| Creator | Niche | Status | Platform | Notes |\n`;
      markdown += `|---|---|---|---|---|\n`;
      crmLeads.forEach(lead => {
        markdown += `| **${lead.name}** | ${lead.niche} | ${lead.status.toUpperCase()} | ${lead.platform.toUpperCase()} | ${lead.notes.replace(/\n/g, ' ')} |\n`;
      });
      markdown += `\n\n## Lead Analysis Deficit Details\n\n`;
      crmLeads.forEach(lead => {
        if (lead.analysis) {
          markdown += `### Creator: ${lead.name}\n`;
          markdown += `- **Niche**: ${lead.niche}\n`;
          markdown += `- **Opportunity Score**: ${lead.analysis.score}/100\n`;
          markdown += `- **Video Target**: "${lead.analysis.videoTitle}"\n`;
          markdown += `- **Video Views**: ${lead.analysis.views} | Subscribers: ${lead.analysis.subs}\n`;
          markdown += `- **CTR Weaknesses Detected**:\n`;
          lead.analysis.detectedWeaknesses.forEach((w, i) => {
            markdown += `  ${i + 1}. **${w}**\n`;
          });
          if (lead.analysis.generatedOutreach) {
            markdown += `- **Generated Pitch Context**:\n\`\`\`text\n${lead.analysis.generatedOutreach}\n\`\`\`\n`;
          }
          markdown += `\n---\n\n`;
        }
      });

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ctrforge-crm-report-${new Date().toISOString().slice(0, 10)}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const filteredLeads = crmLeads.filter(l => {
    let matchesTab = false;
    if (activeTab === "all") {
      matchesTab = true;
    } else if (activeTab === "saved") {
      matchesTab = l.status === "new" || l.status === "researching";
    } else if (activeTab === "sent") {
      matchesTab = l.status === "contacted" || l.status === "follow_up";
    } else if (activeTab === "replied") {
      matchesTab = l.status === "interested" || l.status === "closed";
    } else {
      matchesTab = l.status === activeTab;
    }
    const matchesSearch = searchQuery === "" || 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (l.notes && l.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.niche && l.niche.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const statuses: {id: CrmLead["status"], label: string}[] = [
    { id: "new", label: "New Lead" },
    { id: "researching", label: "Researching" },
    { id: "contacted", label: "Contacted" },
    { id: "follow_up", label: "Follow Up" },
    { id: "interested", label: "Interested" },
    { id: "closed", label: "Closed" }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "closed":
      case "interested": return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center w-fit"><CheckCircle2 className="h-3 w-3 mr-1"/> {status}</span>;
      case "contacted": return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center w-fit"><Mail className="h-3 w-3 mr-1"/> Sent</span>;
      case "follow_up": return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center w-fit"><Bell className="h-3 w-3 mr-1"/> Follow Up</span>;
      case "new":
      case "researching": return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-muted text-muted-foreground border border-border flex items-center w-fit"><Clock className="h-3 w-3 mr-1"/> Saved</span>;
      default: return null;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "email": return <Mail className="h-4 w-4 text-muted-foreground" />;
      case "twitter": return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      case "ig": return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      case "linkedin": return <Users className="h-4 w-4 text-muted-foreground" />;
      default: return <Mail className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center justify-between border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
          <div className="flex items-center ml-4 border-l border-border/40 pl-4">
            <Users className="h-5 w-5 text-emerald-500" />
            <span className="ml-2 font-bold tracking-tight">Outreach CRM</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider hidden md:inline">Export CRM:</span>
          <div className="flex bg-muted rounded-lg p-0.5 border border-border/40">
            <button onClick={() => handleExportCrm('csv')} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="w-3.5 h-3.5 text-zinc-500" /> CSV
            </button>
            <button onClick={() => handleExportCrm('report')} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="w-3.5 h-3.5 text-zinc-500" /> REPORT
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl py-8 mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Outreach CRM</h1>
            <p className="text-muted-foreground">Manage your creator leads, track outreach status, and send automated campaigns.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-3.5 rounded-md bg-emerald-500 text-black text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition-colors flex items-center shadow-md gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Lead
            </button>
            <button 
              onClick={() => setIsCSVModalOpen(true)}
              className="h-10 px-3.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center shadow-md gap-1.5"
            >
              <Upload className="h-4 w-4 text-sky-400" /> Import CSV
            </button>
            <button 
              onClick={handleScanDuplicates}
              className="h-10 px-3.5 rounded-md bg-zinc-900 border border-zinc-800 text-purple-300 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center shadow-md gap-1.5"
            >
              <Copy className="h-4 w-4 text-purple-400" /> Merge Duplicates
            </button>
            <div className="relative group">
              <button 
                className="h-10 px-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Delete Options
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-950 border border-white/[0.08] rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50">
                <button
                  onClick={() => handleDeleteBySource('google_sheets')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  Delete Google Sheets Leads
                </button>
                <button
                  onClick={() => handleDeleteBySource('csv_import')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  Delete CSV Imported Leads
                </button>
                <button
                  onClick={() => handleDeleteBySource('manual')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  Delete Manual Leads
                </button>
                <div className="border-t border-white/[0.06] my-1" />
                <button
                  onClick={handleDeleteAll}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  Delete ALL Leads
                </button>
              </div>
            </div>
            <Link 
              href="/discovery"
              className="h-10 px-3.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center shadow-md gap-1.5"
            >
              Find More Leads
            </Link>
          </div>
        </div>

        {/* Unconnected Gmail Warning Banner */}
        {!gmailStatus.connected && gmailStatus.status !== "loading" && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4 animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-400">Gmail Integration Not Connected</p>
                <p className="text-xs text-zinc-400 mt-0.5">Link your Gmail in settings to compose, send and automate follow-ups directly from your pipeline.</p>
              </div>
            </div>
            <Link 
              href="/settings"
              className="h-9 px-4 rounded-lg bg-amber-550 hover:bg-amber-500 text-black text-xs font-bold transition-all flex items-center shrink-0 uppercase tracking-wider"
            >
              Connect Gmail
            </Link>
          </div>
        )}

        {/* Global CRM Sections Tabs */}
        <div className="flex border-b border-border/40 mb-6 gap-6">
          {[
            { id: "pipeline", label: "Leads Pipeline" },
            { id: "followups", label: "Follow-up Queue" },
            { id: "analytics", label: "Outreach Analytics" },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setCurrentSection(sec.id as any)}
              className={`text-xs font-bold uppercase tracking-wider pb-3 border-b-2 transition-all ${currentSection === sec.id ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-zinc-200'}`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* SECTION: Pipeline */}
        {currentSection === "pipeline" && (
          <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Bulk Toolbar when items are selected */}
            {selectedLeadIds.length > 0 && (
              <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-4 animate-in fade-in-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded border border-emerald-500/30">
                    {selectedLeadIds.length} Selected
                  </span>
                  <button
                    onClick={() => handleDeleteLeads(selectedLeadIds)}
                    className="h-8 px-3 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-all flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Selected
                  </button>
                </div>
                <button
                  onClick={() => setSelectedLeadIds([])}
                  className="text-xs text-zinc-400 hover:text-white underline"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Controls */}
            <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row justify-between gap-4 bg-muted/30">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-background rounded-md p-1 border border-border/40 w-fit">
                  {[
                    { id: "all", label: "All" },
                    { id: "saved", label: "To Contact" },
                    { id: "sent", label: "Awaiting Reply" },
                    { id: "replied", label: "Replied" },
                    { id: "archived", label: "Archived" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-sm transition-colors ${activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-500 font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Sources</option>
                  <option value="google_sheets">Google Sheets</option>
                  <option value="csv_import">CSV Import</option>
                  <option value="youtube_scraping">YouTube</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search leads..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex h-9 w-full sm:w-[180px] rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <button
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="h-9 px-3 text-xs font-bold uppercase tracking-wider rounded-md border border-border/40 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                  title="Import Leads from Google Sheets"
                >
                  <FileText className="h-4 w-4 text-emerald-400 animate-pulse" />
                  <span>Google Sheet</span>
                </button>

                <div className="flex items-center p-1 rounded-md bg-background border border-border/40 h-9">
                  <button 
                    onClick={() => setViewMode("table")} 
                    className={`p-1 rounded transition-colors ${viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode("kanban")} 
                    className={`p-1 rounded transition-colors ${viewMode === "kanban" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                  <Users className="h-5 w-5 text-emerald-500 absolute" />
                </div>
                <p className="text-muted-foreground text-sm mt-4">Syncing with CRM database...</p>
              </div>
            ) : viewMode === "kanban" ? (
              <div className="flex-1 p-6 overflow-x-auto bg-muted/10">
                <div className="flex gap-6 min-h-[500px]">
                  {statuses.map((status) => (
                    <div key={status.id} className="w-80 shrink-0 flex flex-col h-full bg-muted/30 rounded-xl border border-border/40 overflow-hidden">
                      <div className="p-3 border-b border-border/40 bg-card font-semibold text-sm flex justify-between items-center">
                        <span>{status.label}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {filteredLeads.filter(l => l.status === status.id).length}
                        </span>
                      </div>
                      <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                        {filteredLeads.filter(l => l.status === status.id).map(lead => (
                          <div key={lead.id} className="bg-card border border-border/40 rounded-lg p-4 shadow-sm hover:border-emerald-500/50 transition-colors group relative">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-semibold text-sm text-foreground">{lead.name}</div>
                              {getPlatformIcon(lead.platform)}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{lead.notes}</p>
                            
                            {/* Contact Indicators */}
                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                              {lead.contact_email && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${lead.email_verified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                  Email{lead.email_verified && ' ✓'}
                                </span>
                              )}
                              {lead.website && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Web
                                </span>
                              )}
                              {(lead.instagram || lead.twitter || lead.linkedin) && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  Socials
                                </span>
                              )}
                            </div>
                            
                            {/* Lead Scores */}
                            <div className="flex justify-between items-center gap-1 mb-3 text-[10px] text-zinc-400 border-t border-border/20 pt-2">
                              <span>Lead: <b className="text-zinc-200">{lead.lead_score || 0}</b></span>
                              <span>Opp: <b className="text-emerald-400">{lead.opportunity_score || 65}%</b></span>
                              <span>Thumb: <b className="text-purple-400">{lead.thumbnail_opportunity || 0}%</b></span>
                            </div>
                            
                            {/* CRM Lead Card Buttons */}
                            <div className="grid grid-cols-3 gap-1 mb-3">
                              <button
                                onClick={() => handleSelectLead(lead, 'email')}
                                className="h-7 inline-flex items-center justify-center rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                                title="Send Email"
                              >
                                <Send className="h-2.5 w-2.5 mr-1" /> Send
                              </button>
                              <button
                                onClick={() => handleSelectLead(lead, 'overview')}
                                className="h-7 inline-flex items-center justify-center rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                                title="Generate Pitch"
                              >
                                <Sparkles className="h-2.5 w-2.5 mr-1" /> AI Pitch
                              </button>
                              <button
                                onClick={() => handleSelectLead(lead, 'history')}
                                className="h-7 inline-flex items-center justify-center rounded-md text-[10px] font-bold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
                                title="View Email History"
                              >
                                <Clock className="h-2.5 w-2.5 mr-1" /> History
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border/40">
                              <span className="text-[10px] text-muted-foreground">{lead.date}</span>
                              <select 
                                value={lead.status}
                                onChange={(e) => handleUpdateStatus(lead.id, e.target.value as any)}
                                className="text-[10px] bg-muted border border-border rounded px-1 py-0.5 outline-none text-foreground"
                              >
                                {statuses.map(s => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        {filteredLeads.filter(l => l.status === status.id).length === 0 && (
                          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
                            No leads
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/40">
                    <tr>
                      <th className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                          onChange={() => {
                            if (selectedLeadIds.length === filteredLeads.length) setSelectedLeadIds([]);
                            else setSelectedLeadIds(filteredLeads.map(l => l.id));
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                        />
                      </th>
                      <th className="px-6 py-4 font-medium cursor-pointer" onClick={() => { setSortBy('name'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1">Creator <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Verification</th>
                      <th className="px-6 py-4 font-medium cursor-pointer" onClick={() => { setSortBy('lead_score'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1">Scores <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th className="px-6 py-4 font-medium">Notes & Context</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr key={lead.id} className={`border-b border-border/40 hover:bg-muted/30 transition-colors group ${isSelected ? 'bg-emerald-500/5' : ''}`}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedLeadIds(prev => prev.includes(lead.id) ? prev.filter(i => i !== lead.id) : [...prev, lead.id]);
                              }}
                              className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded bg-background border border-border flex items-center justify-center font-bold text-foreground">
                                {lead.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{lead.name}</div>
                                <div className="text-xs text-muted-foreground">{lead.niche}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(lead.status)}
                            <div className="text-[10px] text-muted-foreground mt-2 flex items-center">
                              <Clock className="h-3 w-3 mr-1" /> Updated {lead.date}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${lead.contact_email ? (lead.email_verified ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-zinc-600'}`} />
                                <span className="text-zinc-300 truncate max-w-[120px] font-mono text-[11px]" title={lead.contact_email}>{lead.contact_email || 'No email'}</span>
                              </div>
                              {lead.website && (
                                <div className="flex items-center gap-1.5">
                                  <Globe className="h-3.5 w-3.5 text-blue-400" />
                                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline truncate max-w-[120px]">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</a>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1 text-xs">
                              <div>Lead: <span className="font-bold text-zinc-300">{lead.lead_score || 0}</span></div>
                              <div>Opp: <span className="font-bold text-emerald-400">{lead.opportunity_score || 65}%</span></div>
                              <div>Thumb: <span className="font-bold text-purple-400">{lead.thumbnail_opportunity || 0}%</span></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="flex items-start gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                              <StickyNote className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
                              <p className="text-xs leading-relaxed line-clamp-2">{lead.notes}</p>
                            </div>
                          </td>
                          {/* CRM Lead Card buttons in Table rows */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSelectLead(lead, 'email')}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                                title="Send Email"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingLead(lead)}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
                                title="Edit Lead"
                              >
                                <PenTool className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateLead(lead)}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
                                title="Duplicate Lead"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleArchiveRestoreLead(lead, lead.status !== ('archived' as any))}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors border border-zinc-800"
                                title={lead.status === ('archived' as any) ? "Restore Lead" : "Archive Lead"}
                              >
                                {lead.status === ('archived' as any) ? <RotateCcw className="h-3.5 w-3.5 text-emerald-400" /> : <Archive className="h-3.5 w-3.5 text-amber-400" />}
                              </button>
                              <button
                                onClick={() => handleDeleteLeads([lead.id])}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                                title="Delete Lead"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLeads.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                          No leads found in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION: Global Followups Manager */}
        {currentSection === "followups" && (
          <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden flex flex-col p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Follow-up Queue Manager</h2>
                <p className="text-xs text-muted-foreground">Manage and trigger automated email followup sequences.</p>
              </div>
              
              <button
                onClick={handleSyncAndProcessQueue}
                disabled={syncLoading}
                className="h-10 px-4 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-widest rounded-lg flex items-center transition-all disabled:opacity-50"
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync & Send Due Queue
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/40">
                  <tr>
                    <th className="px-6 py-4 font-medium">Creator</th>
                    <th className="px-6 py-4 font-medium">Step</th>
                    <th className="px-6 py-4 font-medium">Trigger Rule</th>
                    <th className="px-6 py-4 font-medium">Delay</th>
                    <th className="px-6 py-4 font-medium">Scheduled For</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allFollowups.map((f) => {
                    const leadName = crmLeads.find(l => l.id === f.lead_id)?.name || 'Unknown Lead';
                    return (
                      <tr key={f.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">{leadName}</td>
                        <td className="px-6 py-4 text-zinc-300">Step #{f.followup_number}</td>
                        <td className="px-6 py-4 capitalize text-zinc-400">{f.rule_type.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-zinc-400">{f.delay_days} days</td>
                        <td className="px-6 py-4 text-zinc-400">
                          {new Date(f.scheduled_at).toLocaleDateString()} at {new Date(f.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${f.status === 'sent' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : f.status === 'cancelled' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : f.status === 'skipped' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {f.status === 'pending' || f.status === 'cancelled' ? (
                            <button
                              onClick={() => handleToggleFollowupStatus(f.id, f.status)}
                              className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded transition-colors border ${f.status === 'pending' ? 'bg-rose-500/10 border-rose-500/20 text-rose-450 hover:bg-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}
                            >
                              {f.status === 'pending' ? 'Disable' : 'Enable'}
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-555 italic">Processed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {allFollowups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
                        No follow-up sequences found. Send an outreach email to start follow-up automations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION: Global Outreach Analytics Dashboard */}
        {currentSection === "analytics" && (
          <div className="space-y-8">
            {analyticsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-card border border-border/40 rounded-xl">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
                <p className="text-muted-foreground text-xs mt-4">Compiling outreach analytics reports...</p>
              </div>
            ) : analyticsData ? (
              <div className="space-y-6">
                
                {/* Premium Stat Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: "Total Emails Sent", value: analyticsData.emailsSent, desc: `${analyticsData.followUpsSent || 0} follow-ups sent` },
                    { label: "Open Rate", value: `${analyticsData.openRate}%`, desc: `${analyticsData.totalOpened || 0} unique opens` },
                    { label: "Click Rate", value: `${analyticsData.clickRate}%`, desc: `${analyticsData.totalClicked || 0} link clicks` },
                    { label: "Reply Rate", value: `${analyticsData.replyRate}%`, desc: `${analyticsData.totalReplied || 0} creator replies` },
                  ].map((stat, i) => (
                    <div key={i} className="p-6 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl relative overflow-hidden">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                      <h3 className="text-3xl font-black text-zinc-200 tracking-tight mt-2">{stat.value}</h3>
                      <p className="text-[10px] text-zinc-400 mt-1">{stat.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Conversion Performance & Funnel Analysis */}
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* Conversion progress */}
                  <div className="p-6 bg-card border border-border/40 rounded-2xl shadow-sm space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Outreach Conversion Rate</h3>
                      <p className="text-xs text-zinc-400">Efficiency at acquiring interested creator leads from outreach.</p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.02)" strokeWidth="8" fill="transparent" />
                          <circle cx="48" cy="48" r="40" stroke="#10b981" strokeWidth="8" fill="transparent" 
                                  strokeDasharray={251.2} 
                                  strokeDashoffset={251.2 - (251.2 * analyticsData.conversionRate) / 100} />
                        </svg>
                        <span className="absolute text-lg font-black text-emerald-400">{analyticsData.conversionRate}%</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-zinc-500 font-semibold uppercase tracking-wider">Total Contacted:</span>
                          <span className="text-zinc-250 font-bold ml-1">{analyticsData.totalContacted || 0} leads</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold uppercase tracking-wider">Interested/Closed:</span>
                          <span className="text-emerald-400 font-bold ml-1">{analyticsData.interestedLeads || 0} leads</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed pt-2">Conversion rate measures the percentage of unique contacted leads who reply and move to interested or closed status.</p>
                      </div>
                    </div>
                  </div>

                  {/* Funnel chart */}
                  <div className="p-6 bg-card border border-border/40 rounded-2xl shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Outreach Funnel</h3>
                      <p className="text-xs text-zinc-400">Volume conversion breakdown by funnel stage.</p>
                    </div>
                    
                    <div className="space-y-3 pt-2 text-xs">
                      {[
                        { label: "Sent", count: analyticsData.emailsSent, rate: 100, color: "bg-zinc-800" },
                        { label: "Opened", count: analyticsData.totalOpened, rate: analyticsData.openRate, color: "bg-amber-500/20 text-amber-300" },
                        { label: "Clicked", count: analyticsData.totalClicked, rate: analyticsData.clickRate, color: "bg-blue-500/20 text-blue-300" },
                        { label: "Replied", count: analyticsData.totalReplied, rate: analyticsData.replyRate, color: "bg-emerald-500/20 text-emerald-300" },
                      ].map((step, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between font-medium">
                            <span>{step.label}</span>
                            <span className="text-zinc-450">{step.count} ({step.rate}%)</span>
                          </div>
                          <div className="w-full bg-white/[0.02] border border-white/[0.04] h-2.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${step.color.split(' ')[0]}`} style={{ width: `${step.rate}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic text-center py-10 bg-card border border-border/40 rounded-xl">No analytics data available. Send outreach emails to compile stats.</p>
            )}
          </div>
        )}
      </main>

      {/* sliding Drawer layout for lead details */}
      {drawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="drawer-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-zinc-950 border-l border-white/[0.08] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              <div className="p-6 border-b border-white/[0.04] bg-zinc-900/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400">
                    {selectedLead.name.charAt(0)}
                  </div>
                  <div>
                    <h2 id="drawer-title" className="text-lg font-bold text-zinc-100">{selectedLead.name}</h2>
                    <p className="text-xs text-zinc-400">{selectedLead.niche} • {selectedLead.platform.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg px-3 py-1.5 bg-zinc-900 border border-white/[0.04] text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-xs font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="border-b border-white/[0.04] bg-zinc-950 px-6 flex gap-4">
                {[
                  { id: 'overview', label: 'AI Pitch' },
                  { id: 'email', label: 'Email Outreach' },
                  { id: 'history', label: 'Stats & History' },
                  { id: 'followup', label: 'Follow-ups' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id as any)}
                    className={`text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${drawerTab === tab.id ? 'border-emerald-500 text-emerald-450' : 'border-transparent text-muted-foreground hover:text-zinc-200'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Tab: Overview / AI pitch generator */}
                {drawerTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-white/[0.04] bg-zinc-900/10 p-5 space-y-5">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2" /> AI Packaging Diagnosis & Scores
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs border-b border-white/[0.04] pb-4">
                        <div>
                          <p className="text-zinc-500">Target Video</p>
                          <p className="font-medium text-zinc-200 line-clamp-1">{selectedLead.analysis?.videoTitle || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Subscribers</p>
                          <p className="font-medium text-zinc-200">{selectedLead.analysis?.subs || '0'}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Niche</p>
                          <p className="font-medium text-zinc-200 capitalize">{selectedLead.niche}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Last Updated</p>
                          <p className="font-medium text-zinc-400">{selectedLead.last_updated ? new Date(selectedLead.last_updated).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center border-b border-white/[0.04] pb-4">
                        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.02]">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Lead Score</p>
                          <p className="text-lg font-black text-zinc-200 mt-1">{selectedLead.lead_score || 0}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.02]">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Opportunity</p>
                          <p className="text-lg font-black text-emerald-400 mt-1">{selectedLead.opportunity_score || selectedLead.analysis?.score || 65}%</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.02]">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Thumbnail Opp</p>
                          <p className="text-lg font-black text-purple-400 mt-1">{selectedLead.thumbnail_opportunity || 0}%</p>
                        </div>
                      </div>

                      <div className="space-y-3 text-xs border-b border-white/[0.04] pb-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Contact & Social Discovery</p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Email Address:</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full ${selectedLead.contact_email ? (selectedLead.email_verified ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-zinc-600'}`} />
                            <span className="font-mono text-zinc-200">{selectedLead.contact_email || 'Not Discovered'}</span>
                          </div>
                        </div>

                        {selectedLead.website && (
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Website:</span>
                            <a href={selectedLead.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                              {selectedLead.website.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Social Presence:</span>
                          <div className="flex gap-2">
                            {selectedLead.instagram && (
                              <a href={selectedLead.instagram} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-zinc-900 border border-white/[0.04] text-[10px] text-zinc-350 hover:text-white">Instagram</a>
                            )}
                            {selectedLead.twitter && (
                              <a href={selectedLead.twitter} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-zinc-900 border border-white/[0.04] text-[10px] text-zinc-350 hover:text-white">Twitter</a>
                            )}
                            {selectedLead.linkedin && (
                              <a href={selectedLead.linkedin} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-zinc-900 border border-white/[0.04] text-[10px] text-zinc-350 hover:text-white">LinkedIn</a>
                            )}
                            {!selectedLead.instagram && !selectedLead.twitter && !selectedLead.linkedin && (
                              <span className="text-zinc-500 italic text-[11px]">No social handles synced</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedLead.analysis?.detectedWeaknesses && selectedLead.analysis.detectedWeaknesses.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Detected Flaws</p>
                          <ul className="text-xs text-zinc-300 space-y-1.5">
                            {selectedLead.analysis.detectedWeaknesses.map((w, idx) => (
                              <li key={idx} className="flex items-center text-amber-500 font-medium">
                                <AlertCircle className="h-4 w-4 mr-1.5 shrink-0" /> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Generate Email Pitch</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">Let AI rewrite a custom outreach message focused on these video Packaging Opportunities.</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Tone</label>
                          <select 
                            id="drawer-tone"
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none"
                            defaultValue="direct"
                          >
                            <option value="direct">Direct & Value-First</option>
                            <option value="casual">Casual & Friendly</option>
                            <option value="analytical">Data-Driven / Analytical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Length</label>
                          <select 
                            id="drawer-length"
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none"
                            defaultValue="medium"
                          >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Long</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          const tone = (document.getElementById('drawer-tone') as HTMLSelectElement).value;
                          const length = (document.getElementById('drawer-length') as HTMLSelectElement).value;
                          
                          const btn = document.getElementById('gen-btn') as HTMLButtonElement;
                          btn.disabled = true;
                          btn.innerText = 'Generating Email Draft...';

                          try {
                            const res = await fetch("/api/outreach", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                tone,
                                length,
                                platform: 'email',
                                analysisContext: selectedLead.analysis
                              })
                            });
                            const data = await res.json();
                            if (data.success && data.outreachMessage) {
                              setEmailBody(data.outreachMessage);
                              const updatedAnalysis = { ...selectedLead.analysis, generatedOutreach: data.outreachMessage } as any;
                              selectedLead.analysis = updatedAnalysis;
                              
                              await supabase
                                .from('crm_leads')
                                .update({ generated_outreach: data.outreachMessage, ai_analysis: updatedAnalysis })
                                .eq('id', selectedLead.id);
                              
                              alert("Pitch generated and loaded into Email composer!");
                              setDrawerTab('email');
                            }
                          } catch (err) {
                            alert("Failed to generate AI pitch.");
                          } finally {
                            btn.disabled = false;
                            btn.innerText = 'Generate Outreach Pitch';
                          }
                        }}
                        id="gen-btn"
                        className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors"
                      >
                        Generate Outreach Pitch
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab: Email Outreach Composer */}
                {drawerTab === 'email' && (
                  <div className="space-y-5">
                    {!gmailStatus.connected ? (
                      <div className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.02] text-center space-y-4">
                        <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto" />
                        <h4 className="font-bold text-sm text-amber-400">Gmail Account Required</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">Link your Gmail account in app Settings to compose and send direct outreach messages.</p>
                        <Link 
                          href="/settings"
                          className="inline-flex h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all items-center uppercase tracking-wider mx-auto"
                        >
                          Link Gmail
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-2">
                          <span className="text-zinc-500">Outbox channel:</span>
                          <span className="text-emerald-400 font-semibold">{gmailStatus.email}</span>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Select Template</label>
                          <select 
                            value={selectedTemplateId}
                            onChange={(e) => handleSelectTemplate(e.target.value)}
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none"
                          >
                            <option value="">No template (use active AI pitch)</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">To Email Address</label>
                          <input 
                            type="email"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            placeholder="creator@example.com"
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Subject Line</label>
                          <input 
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Subject line..."
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-bold text-zinc-500">Message Content</label>
                            <button
                              onClick={handleSaveAsTemplate}
                              className="text-[10px] text-zinc-400 hover:text-white transition-colors underline"
                            >
                              Save as Template
                            </button>
                          </div>
                          <textarea 
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            rows={8}
                            placeholder="Compose outreach email..."
                            className="w-full bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500 leading-relaxed"
                          />
                        </div>

                        {/* Gmail-style Global Signature Toggle & Preview */}
                        <div className="p-3 bg-zinc-950/80 border border-white/[0.06] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={useSignature}
                                onChange={(e) => setUseSignature(e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                                <PenTool className="h-3.5 w-3.5 text-emerald-400" /> Use Global Signature
                              </span>
                            </label>
                            <span className="text-[10px] text-zinc-500">
                              {useSignature ? (globalSig?.signature_name || 'Main Outreach') : 'Signature Disabled'}
                            </span>
                          </div>
                          {useSignature && globalSigHtml && (
                            <div className="pt-2 border-t border-white/[0.04] text-xs text-zinc-300 max-h-32 overflow-y-auto">
                              <div 
                                className="[&_.sig-name]:text-zinc-100 [&_.sig-role]:text-zinc-400 [&_a]:text-emerald-400"
                                dangerouslySetInnerHTML={{ __html: globalSigHtml }} 
                              />
                            </div>
                          )}
                        </div>

                        {sendSuccess && (
                          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400 font-medium">
                            ✓ Campaign Sent! Open/click tracking pixel injected, follow-ups scheduled.
                          </div>
                        )}

                        <button
                          onClick={handleSendEmail}
                          disabled={isSendingEmail}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                          {isSendingEmail ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5 mr-2" />
                          )}
                          {isSendingEmail ? 'Sending...' : 'Send Outreach Campaign'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Stats & History (Lead specific) */}
                {drawerTab === 'history' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl border border-white/[0.04] bg-zinc-900/10 text-center">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Campaign Opens</p>
                        <h4 className="text-2xl font-black text-zinc-150 mt-1">
                          {leadCampaigns.reduce((acc, c) => acc + (c.total_opens || 0), 0)}
                        </h4>
                      </div>
                      <div className="p-4 rounded-xl border border-white/[0.04] bg-zinc-900/10 text-center">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Campaign Clicks</p>
                        <h4 className="text-2xl font-black text-zinc-150 mt-1">
                          {leadCampaigns.reduce((acc, c) => acc + (c.total_clicks || 0), 0)}
                        </h4>
                      </div>
                      <div className="p-4 rounded-xl border border-white/[0.04] bg-zinc-900/10 text-center flex flex-col justify-center items-center">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Reply Status</p>
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded mt-2.5 ${selectedLead.status === 'interested' || selectedLead.status === 'closed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-450 border border-zinc-700/50'}`}>
                          {selectedLead.status === 'interested' || selectedLead.status === 'closed' ? 'Replied' : 'No Reply'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 border-b border-white/[0.04] pb-2">Campaign Records</h4>
                      <div className="space-y-3">
                        {leadCampaigns.map((c) => (
                          <div key={c.id} className="p-4 rounded-xl border border-white/[0.02] bg-zinc-950/50 space-y-2">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-bold text-zinc-200 line-clamp-1">{c.subject}</p>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${c.status === 'replied' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : c.status === 'clicked' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : c.status === 'opened' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-zinc-850 text-zinc-400 border-zinc-800'}`}>
                                {c.status}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">To: {c.to_email} • Sent: {new Date(c.sent_at).toLocaleDateString()} {new Date(c.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            <div className="text-[10px] text-zinc-400 bg-zinc-900/40 p-2.5 rounded max-h-24 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                              {c.text_body || c.html_body.replace(/<[^>]*>/g, '')}
                            </div>
                            <div className="flex gap-4 pt-1.5 border-t border-white/[0.02] text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
                              <span>Opens: <span className="text-zinc-300">{c.total_opens}</span></span>
                              <span>Clicks: <span className="text-zinc-300">{c.total_clicks}</span></span>
                              {c.opened_at && <span>First Open: <span className="text-zinc-300">{new Date(c.opened_at).toLocaleDateString()}</span></span>}
                            </div>
                          </div>
                        ))}
                        {leadCampaigns.length === 0 && (
                          <p className="text-xs text-zinc-550 italic text-center py-4">No outreach logs recorded.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 border-b border-white/[0.04] pb-2">Engagement Timeline</h4>
                      <div className="relative border-l border-white/[0.04] pl-4 ml-2 space-y-4">
                        {leadEvents.map((e) => (
                          <div key={e.id} className="relative">
                            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-zinc-600 ring-4 ring-zinc-950" />
                            <div className="text-xs font-bold text-zinc-200 capitalize">{e.event_type} event detected</div>
                            <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">{new Date(e.created_at).toLocaleString()}</p>
                            {e.url && <p className="text-[9px] text-zinc-500 mt-1 truncate">Redirect destination: {e.url}</p>}
                          </div>
                        ))}
                        {leadEvents.length === 0 && (
                          <p className="text-xs text-zinc-550 italic">No engagement tracking events logged.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Follow-ups manager (Lead specific) */}
                {drawerTab === 'followup' && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-white/[0.04] bg-zinc-900/10 p-4 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Schedule Follow-up Step</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Trigger Rule</label>
                          <select 
                            id="f-rule"
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none"
                          >
                            <option value="not_opened">If not opened (wait 3 days)</option>
                            <option value="opened_not_clicked">If opened, not clicked (wait 4 days)</option>
                            <option value="clicked_not_replied">If clicked, not replied (wait 5 days)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500">Delay (Days)</label>
                          <input 
                            type="number"
                            id="f-delay"
                            defaultValue={3}
                            min={1}
                            max={30}
                            className="w-full mt-1 bg-zinc-900 border border-white/[0.08] rounded p-2 text-xs text-zinc-200 outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const rule = (document.getElementById('f-rule') as HTMLSelectElement).value;
                          const delay = parseInt((document.getElementById('f-delay') as HTMLInputElement).value) || 3;
                          handleCreateFollowupItem(rule, delay);
                        }}
                        className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-zinc-300 text-xs font-bold uppercase tracking-wider rounded transition-colors"
                      >
                        + Schedule Follow-up
                      </button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2">Sequenced Automation Steps</h4>
                      <div className="space-y-3">
                        {leadFollowups.map((f) => (
                          <div key={f.id} className="p-4 rounded-xl border border-white/[0.02] bg-zinc-950/50 flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-zinc-200 capitalize flex items-center gap-2">
                                <span>Step #{f.followup_number}: {f.rule_type.replace(/_/g, ' ')}</span>
                                <span className={`text-[8px] font-black uppercase px-1.5 rounded ${f.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : f.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                  {f.status}
                                </span>
                              </div>
                              <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Scheduled: {new Date(f.scheduled_at).toLocaleDateString()} (Delay: {f.delay_days} days)</p>
                            </div>

                            {(f.status === 'pending' || f.status === 'cancelled') && (
                              <button
                                onClick={() => handleToggleFollowupStatus(f.id, f.status)}
                                className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded transition-colors border ${f.status === 'pending' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
                              >
                                {f.status === 'pending' ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </div>
                        ))}
                        {leadFollowups.length === 0 && (
                          <p className="text-xs text-zinc-550 italic text-center py-4">No follow-ups scheduled for this lead.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Integration Modal */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" /> Google Sheets Import
              </h3>
              <button 
                onClick={() => setIsSheetsModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sheetsConnection ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Connected Spreadsheet</h4>
                  <p className="text-xs text-zinc-300 font-semibold truncate">{sheetsConnection.sheet_url}</p>
                  <div className="flex gap-4 text-[10px] text-zinc-500 font-semibold pt-1">
                    <span>Sheet: <strong className="text-zinc-300">{sheetsConnection.sheet_name}</strong></span>
                    <span>Last Synced: <strong className="text-zinc-300">{sheetsConnection.last_synced_at ? new Date(sheetsConnection.last_synced_at).toLocaleTimeString() : 'Never'}</strong></span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h5 className="text-[10px] uppercase font-bold text-zinc-500">Auto Column Mappings</h5>
                  <div className="bg-zinc-900/40 p-3 rounded-lg border border-white/[0.02] text-xs font-mono text-zinc-400 grid grid-cols-2 gap-2">
                    <div>Name → <span className="text-emerald-400">Name / Creator</span></div>
                    <div>Email → <span className="text-emerald-400">Email</span></div>
                    <div>Channel → <span className="text-emerald-400">Channel</span></div>
                    <div>Subs → <span className="text-emerald-400">Subscribers</span></div>
                    <div>Notes → <span className="text-emerald-400">Notes / Info</span></div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-white/[0.04]">
                  <button 
                    onClick={handleDisconnectSheet}
                    className="flex-1 py-2 bg-zinc-900 border border-white/[0.04] text-rose-500 text-xs font-bold uppercase rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Disconnect
                  </button>
                  <button 
                    onClick={handleExportCRMToSheet}
                    disabled={exportingSheet}
                    className="flex-1 py-2 bg-zinc-900 border border-white/[0.04] text-emerald-400 text-xs font-bold uppercase rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {exportingSheet ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" /> Export CRM
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleSyncSheet}
                    disabled={syncingSheet}
                    className="flex-1 py-2 bg-emerald-500 text-zinc-950 text-xs font-extrabold uppercase rounded-lg hover:bg-emerald-400 disabled:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    {syncingSheet ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" /> Sync Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-450 leading-relaxed">
                  Import creator leads in bulk directly from any Google Sheet. Make sure your spreadsheet contains headers for <strong>Name</strong>, <strong>Email</strong>, <strong>Channel</strong>, <strong>Subscribers</strong>, and <strong>Notes</strong>.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Select Sheet from Google Drive</label>
                    <select
                      value={selectedSheetId}
                      onChange={(e) => {
                        setSelectedSheetId(e.target.value);
                        if (e.target.value) setSheetUrl(""); // Clear manual input if selecting
                      }}
                      className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {loadingDriveSheets ? (
                        <option>Loading spreadsheets from Drive...</option>
                      ) : driveSheets.length === 0 ? (
                        <option value="">No spreadsheets found in Drive</option>
                      ) : (
                        <>
                          <option value="">-- Choose Spreadsheet --</option>
                          {driveSheets.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-1">
                    <span className="h-px bg-white/[0.04] flex-1"></span>
                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">or manually connect</span>
                    <span className="h-px bg-white/[0.04] flex-1"></span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Spreadsheet URL</label>
                    <input 
                      type="text" 
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => {
                        setSheetUrl(e.target.value);
                        if (e.target.value) setSelectedSheetId(""); // Clear dropdown if typing manual
                      }}
                      className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleConnectSheet}
                  disabled={sheetConnecting}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10"
                >
                  {sheetConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Establishing Connection...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" /> Link Spreadsheet
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* CREATE LEAD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-500" /> Create New Lead
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Creator Name *</label>
                  <input
                    type="text"
                    required
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. MrBeast"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Channel Name</label>
                  <input
                    type="text"
                    value={createFormData.channel_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, channel_name: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    placeholder="Channel name..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Contact Email</label>
                  <input
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    placeholder="creator@domain.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Website URL</label>
                  <input
                    type="url"
                    value={createFormData.website}
                    onChange={(e) => setCreateFormData({ ...createFormData, website: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Niche</label>
                  <input
                    type="text"
                    value={createFormData.niche}
                    onChange={(e) => setCreateFormData({ ...createFormData, niche: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Lead Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={createFormData.lead_score}
                    onChange={(e) => setCreateFormData({ ...createFormData, lead_score: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Status</label>
                  <select
                    value={createFormData.status}
                    onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value as any })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Notes & Pitch Context</label>
                <textarea
                  rows={3}
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  placeholder="Notes on creator..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition-all">Create Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PenTool className="h-4 w-4 text-emerald-500" /> Edit Lead: {editingLead.name}
              </h3>
              <button onClick={() => setEditingLead(null)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditLeadSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Creator Name</label>
                <input
                  type="text"
                  value={editingLead.name}
                  onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                  className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Contact Email</label>
                  <input
                    type="email"
                    value={editingLead.email || editingLead.contact_email || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value, contact_email: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Website</label>
                  <input
                    type="url"
                    value={editingLead.website || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, website: e.target.value })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Status</label>
                  <select
                    value={editingLead.status}
                    onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as any })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Lead Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingLead.lead_score || 0}
                    onChange={(e) => setEditingLead({ ...editingLead, lead_score: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Notes</label>
                <textarea
                  rows={3}
                  value={editingLead.notes || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  className="w-full mt-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button type="button" onClick={() => setEditingLead(null)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-500" /> Import Leads from CSV
              </h3>
              <button onClick={() => setIsCSVModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Select a <code>.csv</code> file containing columns for <strong>Creator Name</strong>, <strong>Email</strong>, <strong>Channel</strong>, <strong>Subscribers</strong>, and <strong>Notes</strong>.
              </p>
              <div className="p-6 border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all relative">
                <Upload className="h-8 w-8 text-emerald-400 opacity-60" />
                <p className="text-xs font-bold text-zinc-200">Click or drag CSV file to upload</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImportUpload}
                  disabled={csvUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              {csvUploading && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing CSV...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE DETECTION & MERGE MODAL */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Copy className="h-4 w-4 text-purple-400" /> Duplicate Lead Detection & Merge
              </h3>
              <button onClick={() => setIsDuplicateModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingDuplicates ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-wider">Scanning leads for duplicates...</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/40 rounded-xl space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-zinc-200">No Duplicates Found</h4>
                  <p className="text-xs text-zinc-500">All leads in your CRM database have unique names and email addresses.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400">
                    Found <strong>{duplicateGroups.length}</strong> group(s) of potential duplicate leads. Select a primary lead to keep, and click merge to combine records.
                  </p>
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} className="p-4 border border-border/60 bg-zinc-950/40 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full uppercase">
                          {group.reason}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{group.leads.length} duplicates</span>
                      </div>

                      <div className="divide-y divide-white/[0.04]">
                        {group.leads.map((l: any, lIdx: number) => (
                          <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-200">{l.creator_name}</span>
                              <span className="text-[10px] text-zinc-500">
                                Email: {l.email || l.contact_email || 'None'} • Score: {l.lead_score || 0} • Source: {l.contact_source || 'manual'}
                              </span>
                            </div>
                            {lIdx === 0 ? (
                              <button
                                onClick={() => handleMergeDuplicateGroup(l.id, group.leads.slice(1).map((dup: any) => dup.id))}
                                className="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-black font-bold text-[10px] uppercase rounded-lg transition-all"
                              >
                                Keep as Primary & Merge Others
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-500 italic">Will be merged into primary</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/40 pt-3 flex justify-end">
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNDO DELETE TOAST BANNER */}
      {undoTrash && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-zinc-900 border border-emerald-500/50 rounded-xl shadow-2xl flex items-center gap-4 text-white animate-in slide-in-from-bottom-5">
          <div className="text-xs">
            Deleted <strong>{undoTrash.leads.length}</strong> lead(s).
          </div>
          <button
            onClick={handleUndoDelete}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition-all"
          >
            Undo Delete
          </button>
        </div>
      )}
    </div>
  );
}


