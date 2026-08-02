"use client";

import { 
  ArrowLeft, Search, Filter, SlidersHorizontal, Users, Eye, Clock, 
  Image as ImageIcon, Sparkles, CheckCircle2, BookmarkPlus, BrainCircuit, 
  Send, ChevronDown, ChevronUp, BarChart3, TrendingUp, Compass, 
  AlertTriangle, ExternalLink, RefreshCw, Layers, Globe, PlayCircle, 
  CalendarRange, FileText, Check, ArrowRight, Download, Mail, Database,
  FileSpreadsheet, ShieldCheck, CheckSquare, Square, Trash2, Settings, Plus, Save,
  Instagram, Twitter, Linkedin, Facebook
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface FilterSet {
  minSubscribers: string;
  maxSubscribers: string;
  minViews: string;
  maxViews: string;
  country: string;
  language: string;
  lastUploadDays: string;
  minUploadFrequency: string;
  minLikeRate: string;
  minCommentRate: string;
  minViewVelocity: string;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasTikTok: boolean;
  hasDiscord: boolean;
  hasNewsletter: boolean;
  hasStore: boolean;
  hasCourse: boolean;
  verifiedEmailOnly: boolean;
  minOpportunity: number;
  minBuying: number;
  minReply: number;
  minPackaging: number;
  thumbnailWeakness: string;
  contentType: string;
  videoDuration: string;
}

interface Preset {
  name: string;
  filters: FilterSet;
  isCustom?: boolean;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    name: "Small Creators (50K–300K)",
    filters: {
      minSubscribers: "50K",
      maxSubscribers: "300K",
      minViews: "0",
      maxViews: "unlimited",
      country: "worldwide",
      language: "all",
      lastUploadDays: "all",
      minUploadFrequency: "all",
      minLikeRate: "0",
      minCommentRate: "0",
      minViewVelocity: "0",
      hasEmail: false,
      hasWebsite: false,
      hasInstagram: false,
      hasLinkedIn: false,
      hasTwitter: false,
      hasTikTok: false,
      hasDiscord: false,
      hasNewsletter: false,
      hasStore: false,
      hasCourse: false,
      verifiedEmailOnly: false,
      minOpportunity: 0,
      minBuying: 0,
      minReply: 0,
      minPackaging: 0,
      thumbnailWeakness: "all",
      contentType: "all",
      videoDuration: "all"
    }
  },
  {
    name: "Finance Leads",
    filters: {
      minSubscribers: "10K",
      maxSubscribers: "unlimited",
      minViews: "5K",
      maxViews: "unlimited",
      country: "worldwide",
      language: "all",
      lastUploadDays: "all",
      minUploadFrequency: "all",
      minLikeRate: "0",
      minCommentRate: "0",
      minViewVelocity: "0",
      hasEmail: true,
      hasWebsite: false,
      hasInstagram: false,
      hasLinkedIn: false,
      hasTwitter: false,
      hasTikTok: false,
      hasDiscord: false,
      hasNewsletter: false,
      hasStore: false,
      hasCourse: false,
      verifiedEmailOnly: false,
      minOpportunity: 0,
      minBuying: 50,
      minReply: 0,
      minPackaging: 0,
      thumbnailWeakness: "all",
      contentType: "all",
      videoDuration: "all"
    }
  },
  {
    name: "High Reply Creators",
    filters: {
      minSubscribers: "5K",
      maxSubscribers: "unlimited",
      minViews: "0",
      maxViews: "unlimited",
      country: "worldwide",
      language: "all",
      lastUploadDays: "30",
      minUploadFrequency: "all",
      minLikeRate: "0",
      minCommentRate: "0",
      minViewVelocity: "0",
      hasEmail: true,
      hasWebsite: false,
      hasInstagram: false,
      hasLinkedIn: false,
      hasTwitter: false,
      hasTikTok: false,
      hasDiscord: false,
      hasNewsletter: false,
      hasStore: false,
      hasCourse: false,
      verifiedEmailOnly: false,
      minOpportunity: 0,
      minBuying: 0,
      minReply: 70,
      minPackaging: 0,
      thumbnailWeakness: "all",
      contentType: "all",
      videoDuration: "all"
    }
  },
  {
    name: "Perfect Clients",
    filters: {
      minSubscribers: "20K",
      maxSubscribers: "1M",
      minViews: "10K",
      maxViews: "500K",
      country: "worldwide",
      language: "all",
      lastUploadDays: "30",
      minUploadFrequency: "all",
      minLikeRate: "0",
      minCommentRate: "0",
      minViewVelocity: "0",
      hasEmail: true,
      hasWebsite: true,
      hasInstagram: false,
      hasLinkedIn: false,
      hasTwitter: false,
      hasTikTok: false,
      hasDiscord: false,
      hasNewsletter: false,
      hasStore: false,
      hasCourse: false,
      verifiedEmailOnly: true,
      minOpportunity: 75,
      minBuying: 80,
      minReply: 60,
      minPackaging: 0,
      thumbnailWeakness: "all",
      contentType: "all",
      videoDuration: "all"
    }
  }
];

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.63 4.18 1.14 1.25 2.74 2 4.43 2.14V10.2c-1.84-.04-3.62-.75-4.99-1.99-.08 2.87-.04 5.74-.06 8.62-.03 1.94-.7 3.86-1.95 5.28-1.52 1.76-3.82 2.76-6.13 2.74-2.51.01-4.96-1.22-6.39-3.29-1.57-2.22-1.91-5.18-1-7.66.86-2.39 2.88-4.22 5.34-4.82v4.06c-1.12.33-2.07 1.15-2.48 2.25-.56 1.43-.2 3.1 1 4.11 1.05.93 2.58 1.16 3.83.56.96-.45 1.58-1.4 1.63-2.47.05-3.32.02-6.64.03-9.96-.01-2.4-.01-4.8.01-7.2z"/>
  </svg>
);

const formatViews = (n: number | string): string => {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (isNaN(num) || num === 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};

const SUGGESTED_KEYWORDS = [
  "AI Automation",
  "AI Agency",
  "Business",
  "Finance",
  "Productivity",
  "Marketing",
  "Education",
  "Coding",
  "Self Improvement",
  "Notion"
];

export default function DiscoveryPage() {
  const router = useRouter();
  const { transferToOutreach, addCrmLead } = useAppStore();

  // Search and Mode States
  const [searchQuery, setSearchQuery] = useState("Productivity");
  const [sortBy, setSortBy] = useState("highest opportunity");
  const [isSearching, setIsSearching] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Results and Pagination States
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [savedCreators, setSavedCreators] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  
  // Database Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Statistics State
  const [stats, setStats] = useState({
    total: 0,
    highOpportunity: 0,
    highBuyingScore: 0,
    businessEmailFound: 0,
    verifiedEmails: 0,
    needBetterThumbnails: 0,
    likelyToReply: 0,
    perfectClients: 0
  });

  // Google Sheets Integration State
  const [sheetUrl, setSheetUrl] = useState("");
  const [isConnectedSheet, setIsConnectedSheet] = useState(false);
  const [connectedSheetName, setConnectedSheetName] = useState("");
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isOAuthConnected, setIsOAuthConnected] = useState(false);
  const [driveSheets, setDriveSheets] = useState<{ id: string; name: string; webViewLink: string }[]>([]);
  const [loadingDriveSheets, setLoadingDriveSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState("");

  const fetchDriveSpreadsheets = async () => {
    setLoadingDriveSheets(true);
    try {
      const res = await fetch("/api/sheets/list");
      if (res.ok) {
        const data = await res.json();
        setDriveSheets(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch Google Drive sheets:", err);
    } finally {
      setLoadingDriveSheets(false);
    }
  };

  useEffect(() => {
    if (showSheetModal && isOAuthConnected) {
      fetchDriveSpreadsheets();
    }
  }, [showSheetModal, isOAuthConnected]);

  // Collapsible Filters Accordion States
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [scoresOpen, setScoresOpen] = useState(true);
  const [socialsOpen, setSocialsOpen] = useState(true);

  // Filter Values (Creator Size Range & Formatted Values)
  const [minSubscribers, setMinSubscribers] = useState<string>("0");
  const [maxSubscribers, setMaxSubscribers] = useState<string>("unlimited");
  const [minViews, setMinViews] = useState<string>("0");
  const [maxViews, setMaxViews] = useState<string>("unlimited");
  
  const [selectedCountry, setSelectedCountry] = useState("worldwide");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [lastUploadDays, setLastUploadDays] = useState<string>("all");
  const [minUploadFrequency, setMinUploadFrequency] = useState<string>("all");
  
  // Engagement rates
  const [minLikeRate, setMinLikeRate] = useState<string>("0");
  const [minCommentRate, setMinCommentRate] = useState<string>("0");
  const [minViewVelocity, setMinViewVelocity] = useState<string>("0");
  
  // Score filters
  const [minOpportunity, setMinOpportunity] = useState<number>(0);
  const [minBuying, setMinBuying] = useState<number>(0);
  const [minReply, setMinReply] = useState<number>(0);
  const [minPackaging, setMinPackaging] = useState<number>(0);
  const [thumbnailWeakness, setThumbnailWeakness] = useState<string>("all");

  // Toggle checks
  const [hasEmail, setHasEmail] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [hasLinkedIn, setHasLinkedIn] = useState(false);
  const [hasTwitter, setHasTwitter] = useState(false);
  const [hasTikTok, setHasTikTok] = useState(false);
  const [hasDiscord, setHasDiscord] = useState(false);
  const [hasCourse, setHasCourse] = useState(false);
  const [hasNewsletter, setHasNewsletter] = useState(false);
  const [hasStore, setHasStore] = useState(false);
  const [verifiedEmailOnly, setVerifiedEmailOnly] = useState(false);

  // New filters: Content Type and Video Duration
  const [contentType, setContentType] = useState<string>("all");
  const [videoDuration, setVideoDuration] = useState<string>("all");

  // Presets states
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [customPresetName, setCustomPresetName] = useState("");

  // Load custom presets and sheet connection status on mount
  useEffect(() => {
    fetchConnectedSheet();
    loadCustomPresets();
  }, []);

  // Trigger search on criteria change
  useEffect(() => {
    runDiscoverySearch(1);
  }, [sortBy, pageSize, minSubscribers, maxSubscribers, minViews, maxViews, selectedCountry, selectedLanguage, lastUploadDays, minUploadFrequency, minLikeRate, minCommentRate, minViewVelocity, minOpportunity, minBuying, minReply, minPackaging, thumbnailWeakness, hasEmail, hasWebsite, hasInstagram, hasLinkedIn, hasTwitter, hasTikTok, hasDiscord, hasCourse, hasNewsletter, hasStore, verifiedEmailOnly, contentType, videoDuration]);

  const loadCustomPresets = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ctrforge_filter_presets");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setPresets([...DEFAULT_PRESETS, ...parsed.map(p => ({ ...p, isCustom: true }))]);
          }
        }
      } catch (e) {
        console.error("Failed to parse filter presets:", e);
      }
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    const f = preset.filters;
    setMinSubscribers(f.minSubscribers);
    setMaxSubscribers(f.maxSubscribers);
    setMinViews(f.minViews);
    setMaxViews(f.maxViews);
    setSelectedCountry(f.country);
    setSelectedLanguage(f.language);
    setLastUploadDays(f.lastUploadDays);
    setMinUploadFrequency(f.minUploadFrequency);
    setMinLikeRate(f.minLikeRate);
    setMinCommentRate(f.minCommentRate);
    setMinViewVelocity(f.minViewVelocity);
    setHasEmail(f.hasEmail);
    setHasWebsite(f.hasWebsite);
    setHasInstagram(f.hasInstagram);
    setHasLinkedIn(f.hasLinkedIn);
    setHasTwitter(f.hasTwitter);
    setHasTikTok(f.hasTikTok);
    setHasDiscord(f.hasDiscord);
    setHasNewsletter(f.hasNewsletter);
    setHasStore(f.hasStore);
    setHasCourse(f.hasCourse);
    setVerifiedEmailOnly(f.verifiedEmailOnly);
    setMinOpportunity(f.minOpportunity);
    setMinBuying(f.minBuying);
    setMinReply(f.minReply);
    setMinPackaging(f.minPackaging);
    setThumbnailWeakness(f.thumbnailWeakness);
    setContentType(f.contentType || 'all');
    setVideoDuration(f.videoDuration || 'all');
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPresetName.trim()) return;
    
    const newPreset: Preset = {
      name: customPresetName.trim(),
      filters: {
        minSubscribers,
        maxSubscribers,
        minViews,
        maxViews,
        country: selectedCountry,
        language: selectedLanguage,
        lastUploadDays,
        minUploadFrequency,
        minLikeRate,
        minCommentRate,
        minViewVelocity,
        hasEmail,
        hasWebsite,
        hasInstagram,
        hasLinkedIn,
        hasTwitter,
        hasTikTok,
        hasDiscord,
        hasNewsletter,
        hasStore,
        hasCourse,
        verifiedEmailOnly,
        minOpportunity,
        minBuying,
        minReply,
        minPackaging,
        thumbnailWeakness,
        contentType,
        videoDuration
      }
    };

    const updatedCustom = presets.filter(p => p.isCustom).concat(newPreset);
    if (typeof window !== "undefined") {
      localStorage.setItem("ctrforge_filter_presets", JSON.stringify(updatedCustom));
    }
    setPresets([...DEFAULT_PRESETS, ...updatedCustom.map(p => ({ ...p, isCustom: true }))]);
    setCustomPresetName("");
    alert(`Preset "${newPreset.name}" saved!`);
  };

  const handleDeletePreset = (name: string) => {
    if (!confirm(`Delete preset "${name}"?`)) return;
    const updatedCustom = presets.filter(p => p.isCustom && p.name !== name);
    if (typeof window !== "undefined") {
      localStorage.setItem("ctrforge_filter_presets", JSON.stringify(updatedCustom));
    }
    setPresets([...DEFAULT_PRESETS, ...updatedCustom.map(p => ({ ...p, isCustom: true }))]);
  };

  const fetchConnectedSheet = async () => {
    try {
      const oauthRes = await fetch('/api/gmail/status');
      if (oauthRes.ok) {
        const oauthData = await oauthRes.json();
        setIsOAuthConnected(oauthData.connected);
        setGoogleEmail(oauthData.email);
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sheets_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (data) {
        setIsConnectedSheet(true);
        setConnectedSheetName(data.sheet_name || 'Connected Sheet');
        setSheetUrl(data.sheet_url || '');
      } else {
        setIsConnectedSheet(false);
        setConnectedSheetName("");
        setSheetUrl("");
      }
    } catch (err) {
      console.error("Failed to load sheet connections:", err);
    }
  };

  // Poll for processing leads updates
  useEffect(() => {
    const hasProcessingLeads = leads.some(l => l.status === 'processing');
    if (!hasProcessingLeads) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/discovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            sortBy,
            page: currentPage,
            pageSize,
            refresh: false,
            filters: {
              minSubscribers,
              maxSubscribers,
              minViews,
              maxViews,
              country: selectedCountry,
              language: selectedLanguage,
              lastUploadDays,
              minUploadFrequency,
              minLikeRate,
              minCommentRate,
              minViewVelocity,
              minOpportunity,
              minBuying,
              minReply,
              minPackaging,
              thumbnailWeakness,
              hasEmail: hasEmail || verifiedEmailOnly,
              hasWebsite,
              hasInstagram,
              hasLinkedIn,
              hasTwitter,
              hasTikTok,
              hasDiscord,
              hasCourse,
              hasNewsletter,
              hasStore,
              verifiedEmailOnly,
              contentType,
              videoDuration
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const results = data.leads || [];
            // Merge updated status and socials into the current state
            setLeads(prev => prev.map(oldLead => {
              const fresh = results.find((r: any) => r.channelId === oldLead.channelId);
              return fresh ? { ...oldLead, ...fresh } : oldLead;
            }));
            
            // Also refresh selected lead details panel
            if (selectedLead) {
              const freshSelected = results.find((r: any) => r.channelId === selectedLead.channelId);
              if (freshSelected) {
                setSelectedLead((prev: any) => prev ? { ...prev, ...freshSelected } : null);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to auto-refresh processing leads:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [leads, searchQuery, sortBy, currentPage, pageSize, selectedLead]);

  const handleAutoCreateSheet = async () => {
    setIsConnectingSheet(true);
    try {
      const res = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'CTRForge Leads' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-create sheet');
      
      setIsConnectedSheet(true);
      setConnectedSheetName(data.connection?.sheet_name || 'CTRForge Leads');
      setSheetUrl(data.connection?.sheet_url || '');
      alert('Google Sheet connected successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Error setting up spreadsheet: ${err.message}`);
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const handleConnectSheetClick = async () => {
    if (!isOAuthConnected) {
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        '/api/gmail/connect',
        'GoogleLogin',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        alert("Popup blocker prevented opening the login window. Please allow popups for this site.");
        return;
      }

      const handleAuthMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleAuthMessage);
          // Fetch status again
          const oauthRes = await fetch('/api/gmail/status');
          if (oauthRes.ok) {
            const oauthData = await oauthRes.json();
            setIsOAuthConnected(oauthData.connected);
            setGoogleEmail(oauthData.email);
            // Open sheet selection modal
            setShowSheetModal(true);
          }
        } else if (event.data?.type === 'GOOGLE_OAUTH_ERROR') {
          window.removeEventListener('message', handleAuthMessage);
          alert(`Authentication failed: ${event.data.error}`);
        }
      };

      window.addEventListener('message', handleAuthMessage);
    } else {
      setShowSheetModal(true);
    }
  };

  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    let payload: any = {};
    if (selectedSheetId) {
      const selected = driveSheets.find(s => s.id === selectedSheetId);
      if (!selected) return;
      payload = { sheetId: selected.id, sheetUrl: selected.webViewLink };
    } else if (sheetUrl) {
      payload = { sheetUrl };
    } else {
      alert("Please select a spreadsheet or enter a Google Sheet URL");
      return;
    }
    setIsConnectingSheet(true);
    try {
      const res = await fetch('/api/sheets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      
      setIsConnectedSheet(true);
      setConnectedSheetName(data.connection?.sheet_name || 'Connected Sheet');
      setSheetUrl(data.connection?.sheet_url || '');
      setShowSheetModal(false);
      alert('Google Sheet connected successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Error connecting sheet: ${err.message}`);
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const handleDisconnectSheet = async () => {
    if (!confirm('Are you sure you want to disconnect this Google Sheet? This will remove the connection and all imported leads.')) return;
    try {
      const res = await fetch('/api/sheets/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteLeads: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsConnectedSheet(false);
        setConnectedSheetName("");
        setSheetUrl("");
        alert(data.message || 'Google Sheet disconnected successfully.');
      } else {
        alert(`Failed to disconnect: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error disconnecting: ${err.message}`);
    }
  };

  const handleSyncFromSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(`Sync completed! Imported ${data.totalSynced || 0} creators into your CRM.`);
      runDiscoverySearch(1);
    } catch (err: any) {
      console.error(err);
      alert(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleExportToSheet = async (selectedOnly = false) => {
    const listToExport = selectedOnly 
      ? leads.filter(l => selectedLeads.includes(l.channelId)) 
      : leads;

    if (listToExport.length === 0) {
      alert("No creators found to export.");
      return;
    }

    setIsExportingSheet(true);
    try {
      const res = await fetch('/api/sheets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creators: listToExport })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      alert(`Successfully exported ${listToExport.length} creators directly to your Google Sheet!`);
    } catch (err: any) {
      console.error(err);
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExportingSheet(false);
    }
  };

  const handleExportCSVOrSheet = () => {
    if (isConnectedSheet) {
      handleExportToSheet(false);
    } else {
      handleExportCSV();
    }
  };

  const runDiscoverySearch = async (page = 1, forceRefresh = false) => {
    setIsSearching(true);
    setCurrentPage(page);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          sortBy,
          page,
          pageSize,
          refresh: forceRefresh,
          filters: {
            minSubscribers,
            maxSubscribers,
            minViews,
            maxViews,
            country: selectedCountry,
            language: selectedLanguage,
            lastUploadDays,
            minUploadFrequency,
            minLikeRate,
            minCommentRate,
            minViewVelocity,
            minOpportunity,
            minBuying,
            minReply,
            minPackaging,
            thumbnailWeakness,
            hasEmail: hasEmail || verifiedEmailOnly,
            hasWebsite,
            hasInstagram,
            hasLinkedIn,
            hasTwitter,
            hasTikTok,
            hasDiscord,
            hasCourse,
            hasNewsletter,
            hasStore,
            verifiedEmailOnly,
            contentType,
            videoDuration
          }
        })
      });

      if (!res.ok) throw new Error("Failed to search creator database.");

      const data = await res.json();
      if (data.success) {
        const results = data.leads || [];
        console.log("[Discovery Debug Log 4] Before rendering, lead count:", results.length);
        setLeads(results);
        setTotalCount(data.totalCount || 0);
        setIsBackgroundSyncing(data.isBackgroundSearching || false);
        
        if (results.length > 0) {
          setSelectedLead(results[0]);
        } else {
          setSelectedLead(null);
        }

        calculateDashboardStats(results, data.totalCount || 0);
      }
      setHasSearched(true);
    } catch (err) {
      console.error("Discovery Search Error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateDashboardStats = (creators: any[], totalMatching: number) => {
    let highOpp = 0;
    let highBuy = 0;
    let emailFound = 0;
    let emailVer = 0;
    let needThumb = 0;
    let replyChance = 0;
    let perfClients = 0;

    creators.forEach(c => {
      if (c.opportunity_score > 80) highOpp++;
      if (c.buyingScore > 80) highBuy++;
      if (c.contact_email) emailFound++;
      if (c.verification_status === 'verified') emailVer++;
      if (c.thumbnail_opportunity > 75) needThumb++;
      if (c.replyProbability > 70) replyChance++;
      if (c.buyingScore > 85 && c.opportunity_score > 80 && c.contact_email) perfClients++;
    });

    const multiplier = totalMatching > creators.length ? (totalMatching / creators.length) : 1;

    setStats({
      total: totalMatching,
      highOpportunity: Math.round(highOpp * multiplier),
      highBuyingScore: Math.round(highBuy * multiplier),
      businessEmailFound: Math.round(emailFound * multiplier),
      verifiedEmails: Math.round(emailVer * multiplier),
      needBetterThumbnails: Math.round(needThumb * multiplier),
      likelyToReply: Math.round(replyChance * multiplier),
      perfectClients: Math.round(perfClients * multiplier)
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runDiscoverySearch(1, true);
  };

  const handleSuggestionClick = (keyword: string) => {
    setSearchQuery(keyword);
    // Explicitly run search immediately on set
    setIsSearching(true);
    setTimeout(() => {
      runDiscoverySearch(1, true);
    }, 100);
  };

  const handleSaveToCrm = async (creator: any) => {
    if (savedCreators.includes(creator.id)) return;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const noteStr = `Opportunity Score: ${creator.score}/100. ${creator.whyThisLead || 'AI scored lead'}`;

      if (user) {
        const rawPayload = {
          user_id: user.id,
          creator_name: creator.channelName,
          channel_name: creator.channelName,
          video_title: creator.videoTitle,
          video_url: creator.videoUrl,
          thumbnail_url: creator.thumbnailUrl,
          subscriber_count: creator.subsRaw,
          view_count: creator.viewsRaw,
          like_count: creator.likes || "",
          published_at: creator.publishedAt || "",
          status: "new",
          notes: noteStr,
          contact_email: creator.contact_email,
          website: creator.website,
          instagram: creator.instagram,
          twitter: creator.twitter,
          linkedin: creator.linkedin,
          facebook: creator.facebook,
          contact_source: 'youtube_intelligence',
          contact_status: creator.contact_email ? 'discovered' : 'lead_inbound',
          email_verified: creator.verification_status === 'verified',
          website_found: !!creator.website,
          social_links_found: !!(creator.instagram || creator.twitter || creator.linkedin),
          lead_score: creator.buyingScore,
          opportunity_score: creator.opportunity_score,
          thumbnail_opportunity: creator.thumbnail_opportunity,
          ai_analysis: {
            ctr_weaknesses: creator.detectedWeaknesses || [],
            audience_positioning: creator.whyThisLead || "",
            audience_type: creator.audience_type || "Niche Viewers",
            packaging_score: creator.packagingScore,
            buying_score: creator.buyingScore,
            reply_probability: creator.replyProbability,
            estimated_revenue: creator.estimated_monthly_revenue,
            outreach_angle: creator.idealOutreachAngle
          }
        };

        const { error } = await supabase
          .from('crm_leads')
          .upsert(rawPayload, { onConflict: 'user_id,creator_name' });

        if (error) throw error;
      }

      addCrmLead({
        name: creator.channelName,
        niche: creator.audienceType || "Niche Content",
        status: "new",
        date: "Just now",
        notes: noteStr,
        platform: "email",
        email: creator.contact_email || undefined,
        contact_email: creator.contact_email || undefined,
        website: creator.website || undefined,
        instagram: creator.instagram || undefined,
        twitter: creator.twitter || undefined,
        linkedin: creator.linkedin || undefined,
        contact_source: 'youtube_intelligence',
        contact_status: 'discovered',
        email_verified: creator.verification_status === 'verified',
        website_found: !!creator.website,
        lead_score: creator.buyingScore,
        opportunity_score: creator.opportunity_score,
        analysis: {
          creatorName: creator.channelName,
          channelName: creator.channelName,
          videoTitle: creator.videoTitle,
          detectedWeaknesses: creator.detectedWeaknesses || [],
          titlePatterns: "Dynamic Hook",
          hookAnalysis: creator.visualAnalysisPreview?.titleWeakness || "",
          emotionalTone: "Professional",
          creatorNiche: creator.audienceType || "General",
          videoUrl: creator.videoUrl,
          channelUrl: creator.channelUrl || "",
          transcriptSnippets: [],
          repeatedPhrases: [],
          ctaOpportunities: [],
          subs: creator.subs,
          views: creator.views,
          score: creator.score,
          likes: creator.likes || "",
          publishedAt: creator.publishedAt || "",
          thumbnailUrl: creator.thumbnailUrl || "",
          titleIdeas: [creator.videoTitle],
          suggestedHook: creator.visualAnalysisPreview?.titleWeakness || "",
          audiencePositioning: creator.whyThisLead || "",
          generatedOutreach: ""
        }
      });

      setSavedCreators((prev) => [...prev, creator.id]);
    } catch (err: any) {
      console.error("Failed to save lead to CRM:", err);
      alert(`Save to CRM failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleBulkSaveToCrm = async () => {
    if (selectedLeads.length === 0) return;
    const creatorsToSave = leads.filter(l => selectedLeads.includes(l.channelId));
    let count = 0;
    for (const c of creatorsToSave) {
      await handleSaveToCrm(c);
      count++;
    }
    alert(`Successfully saved ${count} creators to your CRM pipeline!`);
    setSelectedLeads([]);
  };

  const handleOutreach = (creator: any) => {
    transferToOutreach({
      creatorName: creator.channelName,
      channelName: creator.channelName,
      videoTitle: creator.videoTitle,
      videoUrl: creator.videoUrl,
      channelUrl: creator.channelUrl || "",
      thumbnailUrl: creator.thumbnailUrl,
      detectedWeaknesses: creator.detectedWeaknesses || ["Visual Hierarchy Deficits"],
      titlePatterns: "Curiosity loop trigger",
      hookAnalysis: creator.visualAnalysisPreview?.titleWeakness || "Needs packaging lift",
      emotionalTone: "Value-first / Analytical",
      creatorNiche: creator.audienceType || 'Niche',
      transcriptSnippets: [],
      repeatedPhrases: [],
      ctaOpportunities: [],
      subs: creator.subs,
      views: creator.views,
      likes: creator.likes,
      score: creator.score,
      audienceType: creator.audienceType,
      retentionStyle: 'Standard pacing',
      ctaStyle: "Outreach direct"
    });
    router.push("/outreach");
  };

  const handleSelectLeadRow = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(prev => prev.filter(item => item !== id));
    } else {
      setSelectedLeads(prev => [...prev, id]);
    }
  };

  const handleSelectAllOnPage = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l.channelId));
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert("No prospects available to export.");
      return;
    }
    const headers = [
      "Channel Name", "Channel ID", "Subscribers", "Average Views", 
      "Email Address", "Verification Status", "Website URL", 
      "Opportunity Score", "Buying Score", "Outreach Angle"
    ];
    const rows = leads.map(c => [
      `"${c.channelName.replace(/"/g, '""')}"`,
      `"${c.channelId}"`,
      `"${c.subsRaw}"`,
      `"${c.viewsRaw}"`,
      `"${c.contact_email || ''}"`,
      `"${c.verification_status}"`,
      `"${c.website || ''}"`,
      `"${c.opportunity_score}"`,
      `"${c.buyingScore}"`,
      `"${(c.idealOutreachAngle || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ctrforge-creators-${searchQuery.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#09090b]/60">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-[#f4f4f5] transition-colors mr-5 text-xs font-semibold uppercase tracking-wider group">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          <div className="flex items-center ml-5 border-l border-white/[0.06] pl-5">
            <Database className="h-4.5 w-4.5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-xs uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Creator Intelligence Engine</span>
          </div>
        </div>

        {/* Global actions: Sheet integration */}
        <div className="flex items-center gap-3">
          {isConnectedSheet ? (
            <div className="flex flex-col md:flex-row md:items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-[11px] font-semibold text-emerald-400">
              <div className="flex items-center gap-1 font-extrabold text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Connected</span>
              </div>
              <div className="flex flex-col md:flex-row gap-1.5 md:gap-3 text-[10px] text-zinc-400 border-t md:border-t-0 md:border-l border-white/[0.06] pt-1 md:pt-0 md:pl-3">
                {googleEmail && (
                  <div>
                    Google Account: <span className="text-zinc-200">{googleEmail}</span>
                  </div>
                )}
                <div>
                  Spreadsheet: <span className="text-zinc-200">{connectedSheetName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-white/[0.06] pt-1 md:pt-0 md:pl-3 text-[10px]">
                <button 
                  onClick={handleSyncFromSheet}
                  disabled={isSyncingSheet}
                  className="hover:text-white transition-colors flex items-center gap-0.5 text-[9px]"
                  title="Pull new creator leads from Sheet"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isSyncingSheet ? 'animate-spin' : ''}`} /> Sync
                </button>
                <button 
                  onClick={handleDisconnectSheet}
                  className="hover:text-red-400 transition-colors text-[9px]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleConnectSheetClick}
              disabled={isConnectingSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isConnectingSheet ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              )}
              Connect Sheet
            </button>
          )}

          <div className="flex bg-zinc-900/60 rounded-lg p-0.5 border border-white/[0.04]">
            <button 
              onClick={handleExportCSVOrSheet} 
              disabled={isExportingSheet}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {isExportingSheet ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {isConnectedSheet ? "Export to Sheet" : "Export CSV"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-[1700px] py-8 mx-auto px-6 md:px-8 w-full">
        
        {/* Banner with dynamically matching statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {[
            { label: "Creators Found", value: stats.total, color: "text-zinc-200" },
            { label: "High Opportunity", value: stats.highOpportunity, color: "text-emerald-400" },
            { label: "High Buying Score", value: stats.highBuyingScore, color: "text-cyan-400" },
            { label: "Emails Found", value: stats.businessEmailFound, color: "text-purple-400" },
            { label: "Verified Emails", value: stats.verifiedEmails, color: "text-teal-400" },
            { label: "Needs Thumbnail Help", value: stats.needBetterThumbnails, color: "text-amber-400" },
            { label: "Likely to Reply", value: stats.likelyToReply, color: "text-rose-400" },
            { label: "Perfect Clients", value: stats.perfectClients, color: "text-emerald-400 font-extrabold underline" }
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900/25 border border-white/[0.03] rounded-xl p-3.5 text-center flex flex-col justify-between hover:border-white/[0.06] transition-all">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold leading-normal">{stat.label}</span>
              <span className={`text-xl font-black mt-2 ${stat.color}`}>
                {isSearching ? <RefreshCw className="h-4 w-4 animate-spin mx-auto text-zinc-600" /> : stat.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Gemini-Style Floating Workspace Input Area */}
        <div className="max-w-4xl mx-auto mb-10 text-center space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black sm:text-3xl text-zinc-100 tracking-tight">
              Lead Discovery & Creator Intelligence
            </h1>
            <p className="text-zinc-400 text-xs max-w-[500px] mx-auto leading-relaxed">
              Query YouTube creators, enrich with website scraping, run AI lead scoring, and filter the global database for high-value targets.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative mt-4 max-w-xl mx-auto">
            <div className="relative flex items-center bg-zinc-900/40 border border-white/[0.06] rounded-xl p-1.5 shadow-xl focus-within:border-emerald-500/30 transition-all">
              <Search className="absolute left-3.5 h-4.5 w-4.5 text-zinc-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter YouTube query topic or channel name (e.g. Productivity)..." 
                className="w-full h-9 bg-transparent pl-10 pr-24 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="absolute right-1.5 h-7 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-[10px] uppercase tracking-wide flex items-center transition-all disabled:opacity-50"
              >
                {isSearching ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1 text-emerald-600 animate-pulse" />}
                {isSearching ? "Searching" : "Discover"}
              </button>
            </div>
          </form>

          {/* Keyword Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5 max-w-3xl mx-auto">
            <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1">Suggestions:</span>
            {SUGGESTED_KEYWORDS.map((kw, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(kw)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-white/[0.04] text-zinc-400 hover:text-zinc-250 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer active:scale-95"
              >
                {kw}
              </button>
            ))}
          </div>

          {isBackgroundSyncing && (
            <div className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
              <span>AI worker is actively exploring keywords, scraping website contacts, and scoring creators in the background...</span>
            </div>
          )}
        </div>

        {/* 3-Column Studio Workspace */}
        <div className="grid lg:grid-cols-12 gap-8 items-start w-full">
          
          {/* ================= COLUMN 1: INTEL FILTER SIDEBAR (3 cols) ================= */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Save Filter Presets Panel */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.04] pb-2 flex items-center">
                <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500 mr-2" /> Filter Presets
              </h3>
              
              {/* Presets List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {presets.map((p, i) => (
                  <div key={i} className="flex justify-between items-center group w-full text-left">
                    <button
                      onClick={() => handleApplyPreset(p)}
                      className="flex-1 text-[11px] py-1 px-2 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors truncate font-semibold"
                    >
                      {p.name}
                    </button>
                    {p.isCustom && (
                      <button 
                        onClick={() => handleDeletePreset(p.name)}
                        className="text-zinc-600 hover:text-red-400 px-1 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Preset"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Current Filters Form */}
              <form onSubmit={handleSavePreset} className="flex gap-1.5 pt-2 border-t border-white/[0.04]">
                <input
                  type="text"
                  required
                  placeholder="New preset name..."
                  value={customPresetName}
                  onChange={(e) => setCustomPresetName(e.target.value)}
                  className="flex-1 h-7 rounded border border-white/[0.06] bg-zinc-950 px-2 text-[10px] text-zinc-300 outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  className="h-7 px-2.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
              </form>
            </div>

            {/* Advanced Filters */}
            <div className="bg-zinc-900/20 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-5 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Intelligence Criteria</span>
                <Filter className="h-3.5 w-3.5 text-zinc-500" />
              </div>

              {/* 1. Creator Size */}
              <div className="border-b border-white/[0.04] pb-3.5">
                <button 
                  onClick={() => setMetricsOpen(!metricsOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-200 py-1"
                >
                  <span className="flex items-center"><SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-zinc-400" /> Creator Size</span>
                  {metricsOpen ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                </button>
                
                {metricsOpen && (
                  <div className="mt-3 space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Subscribers Range</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="Min (e.g. 50K)"
                          value={minSubscribers}
                          onChange={(e) => setMinSubscribers(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                        <input 
                          type="text" 
                          placeholder="Max (e.g. 500K)"
                          value={maxSubscribers}
                          onChange={(e) => setMaxSubscribers(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Average Views Range</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="Min (e.g. 20K)"
                          value={minViews}
                          onChange={(e) => setMinViews(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                        <input 
                          type="text" 
                          placeholder="Max (e.g. 300K)"
                          value={maxViews}
                          onChange={(e) => setMaxViews(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Channel Growth & Upload Activity */}
              <div className="border-b border-white/[0.04] pb-3.5">
                <button 
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-200 py-1"
                >
                  <span className="flex items-center"><Globe className="h-3.5 w-3.5 mr-2 text-zinc-400" /> Channel Activity</span>
                  {detailsOpen ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                </button>
                {detailsOpen && (
                  <div className="mt-3 space-y-3 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Country</span>
                      <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                      >
                        <option value="worldwide">Worldwide</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="IN">India</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Language</span>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                      >
                        <option value="all">All Languages</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="de">German</option>
                        <option value="hi">Hindi</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Min Upload Frequency</span>
                      <select
                        value={minUploadFrequency}
                        onChange={(e) => setMinUploadFrequency(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                      >
                        <option value="all">Any frequency</option>
                        <option value="1_week">1 video/week</option>
                        <option value="2_week">2 videos/week</option>
                        <option value="4_month">4 videos/month</option>
                        <option value="daily">Daily</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Last Upload</span>
                      <select
                        value={lastUploadDays}
                        onChange={(e) => setLastUploadDays(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                      >
                        <option value="all">Anytime</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last Year</option>
                      </select>
                    </div>

                    {/* Engagement Rates */}
                    <div className="space-y-2 border-t border-white/[0.04] pt-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Engagement & Velocity</span>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                          <span>Min Like Rate</span>
                          <span>{minLikeRate}%</span>
                        </div>
                        <input
                          type="text" placeholder="e.g. 2.5"
                          value={minLikeRate}
                          onChange={(e) => setMinLikeRate(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                          <span>Min Comment Rate</span>
                          <span>{minCommentRate}%</span>
                        </div>
                        <input
                          type="text" placeholder="e.g. 0.2"
                          value={minCommentRate}
                          onChange={(e) => setMinCommentRate(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                          <span>Min Views / Subscribers Velocity</span>
                          <span>{minViewVelocity}</span>
                        </div>
                        <input
                          type="text" placeholder="e.g. 0.15"
                          value={minViewVelocity}
                          onChange={(e) => setMinViewVelocity(e.target.value)}
                          className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2b. Content Type & Video Duration Filters */}
              <div className="border-b border-white/[0.04] pb-3.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center py-1">
                  <PlayCircle className="h-3.5 w-3.5 mr-2 text-zinc-400" /> Content Type & Duration
                </span>
                <div className="mt-2 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Content Type</span>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value)}
                      className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                    >
                      <option value="all">All</option>
                      <option value="longform_only">Long-form Only</option>
                      <option value="shorts_only">Shorts Only</option>
                      <option value="mixed">Mixed Creator</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Video Length</span>
                    <select
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value)}
                      className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                    >
                      <option value="all">All</option>
                      <option value="0_60">0–60 sec</option>
                      <option value="1_8">1–8 min</option>
                      <option value="8_20">8–20 min</option>
                      <option value="20plus">20+ min</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. AI Opportunity Filters */}
              <div className="border-b border-white/[0.04] pb-3.5">
                <button 
                  onClick={() => setScoresOpen(!scoresOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-200 py-1"
                >
                  <span className="flex items-center"><BrainCircuit className="h-3.5 w-3.5 mr-2 text-zinc-400" /> AI Scoring Thresholds</span>
                  {scoresOpen ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                </button>
                {scoresOpen && (
                  <div className="mt-3 space-y-3 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Opportunity Score (0-100)</span>
                        <span>{minOpportunity}+</span>
                      </div>
                      <input 
                        type="range" min="0" max="95" step="5"
                        value={minOpportunity}
                        onChange={(e) => setMinOpportunity(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Buying Probability (0-100)</span>
                        <span>{minBuying}+</span>
                      </div>
                      <input 
                        type="range" min="0" max="95" step="5"
                        value={minBuying}
                        onChange={(e) => setMinBuying(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Packaging Score (0-100)</span>
                        <span>{minPackaging}+</span>
                      </div>
                      <input 
                        type="range" min="0" max="95" step="5"
                        value={minPackaging}
                        onChange={(e) => setMinPackaging(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Reply Probability (0-100)</span>
                        <span>{minReply}+</span>
                      </div>
                      <input 
                        type="range" min="0" max="95" step="5"
                        value={minReply}
                        onChange={(e) => setMinReply(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Thumbnail Weakness</span>
                      <select
                        value={thumbnailWeakness}
                        onChange={(e) => setThumbnailWeakness(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
                      >
                        <option value="all">All Thumbnail Weaknesses</option>
                        <option value="high">High Weakness (Opp &gt; 75)</option>
                        <option value="medium">Medium Weakness (40-75)</option>
                        <option value="low">Low Weakness (&lt; 40)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Contact & Social Channels */}
              <div>
                <button 
                  onClick={() => setSocialsOpen(!socialsOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-200 py-1"
                >
                  <span className="flex items-center"><Mail className="h-3.5 w-3.5 mr-2 text-zinc-400" /> Contact Channels</span>
                  {socialsOpen ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                </button>
                {socialsOpen && (
                  <div className="mt-2 space-y-1.5 pt-1 animate-in fade-in duration-200">
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasEmail}
                        onChange={() => setHasEmail(!hasEmail)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Business Email Only</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={verifiedEmailOnly}
                        onChange={() => setVerifiedEmailOnly(!verifiedEmailOnly)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors">Verified Email</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasWebsite}
                        onChange={() => setHasWebsite(!hasWebsite)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Website Available</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasInstagram}
                        onChange={() => setHasInstagram(!hasInstagram)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Instagram Available</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasLinkedIn}
                        onChange={() => setHasLinkedIn(!hasLinkedIn)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">LinkedIn Available</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasTwitter}
                        onChange={() => setHasTwitter(!hasTwitter)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Twitter/X Available</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasTikTok}
                        onChange={() => setHasTikTok(!hasTikTok)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">TikTok Available</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasDiscord}
                        onChange={() => setHasDiscord(!hasDiscord)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Discord</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasNewsletter}
                        onChange={() => setHasNewsletter(!hasNewsletter)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Newsletter</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasCourse}
                        onChange={() => setHasCourse(!hasCourse)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Course Creator</span>
                    </label>
                    <label className="flex items-center space-x-2 py-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={hasStore}
                        onChange={() => setHasStore(!hasStore)}
                        className="rounded border-white/[0.08] bg-zinc-950 text-emerald-500 focus:ring-0 h-3.5 w-3.5 cursor-pointer" 
                      />
                      <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Store</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================= COLUMN 2: SEARCH RESULTS SCAN (6 cols) ================= */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Header tools */}
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-zinc-300 uppercase tracking-wider">
                  Discovered Database
                </span>
                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {totalCount} Total Match{totalCount !== 1 ? 'es' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-7 bg-zinc-900 border border-white/[0.06] rounded px-2 text-[11px] outline-none text-zinc-300 cursor-pointer"
                >
                  <option value="highest opportunity">Highest Opportunity</option>
                  <option value="highest buying score">Highest Buying Score</option>
                  <option value="highest views">Highest Views</option>
                  <option value="highest subscribers">Highest Subscribers</option>
                  <option value="recently uploaded">Recently Uploaded</option>
                  <option value="recently updated">Recently Updated</option>
                  <option value="most likely to reply">Most Likely To Reply</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="h-7 bg-zinc-900 border border-white/[0.06] rounded px-2 text-[11px] outline-none text-zinc-300 cursor-pointer"
                >
                  <option value={25}>25 / Page</option>
                  <option value={50}>50 / Page</option>
                  <option value={100}>100 / Page</option>
                  <option value={250}>250 / Page</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedLeads.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckSquare className="w-4 h-4" />
                  <span>Selected {selectedLeads.length} creators</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleBulkSaveToCrm}
                    className="h-7 px-3 bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    Save to CRM
                  </button>
                  {isConnectedSheet && (
                    <button 
                      onClick={() => handleExportToSheet(true)}
                      disabled={isExportingSheet}
                      className="h-7 px-3 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      {isExportingSheet ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                      Export to Sheet
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedLeads([])}
                    className="h-7 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] rounded-lg transition-colors"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {isSearching ? (
              <div className="space-y-4">
                {[1, 2, 3].map((skeleton) => (
                  <div key={skeleton} className="p-6 rounded-2xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl animate-pulse space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-800"></div>
                        <div className="space-y-2">
                          <div className="h-3.5 w-32 bg-zinc-800 rounded"></div>
                          <div className="h-2.5 w-20 bg-zinc-800 rounded"></div>
                        </div>
                      </div>
                      <div className="h-5 w-16 bg-zinc-800 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="min-h-[400px] border border-dashed border-white/[0.04] rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10">
                <Database className="h-12 w-12 text-zinc-700 mb-4" />
                <h3 className="text-sm font-bold text-zinc-300 mb-1">No creators matching your query</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                  Try typing a general topic like "productivity" or click "Discover" to crawl live channels from YouTube.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border border-white/[0.04] rounded-2xl overflow-x-auto bg-zinc-950/40 backdrop-blur-md shadow-lg">
                  <table className="w-full text-left text-xs border-collapse min-w-[2000px]">
                    <thead>
                      <tr className="bg-zinc-900/50 border-b border-white/[0.06] text-zinc-400 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-4 w-12 text-center">
                          <button onClick={handleSelectAllOnPage} className="hover:text-white transition-colors">
                            {selectedLeads.length === leads.length ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                        </th>
                        <th className="p-4">Creator / Channel</th>
                        <th className="p-4 text-right">Subscribers</th>
                        <th className="p-4 text-right">Avg Views</th>
                        <th className="p-4 text-center">Scores</th>
                        
                        {/* Extended Columns */}
                        <th className="p-4 min-w-[340px]">Video</th>
                        <th className="p-4 min-w-[140px]">Video Link</th>
                        <th className="p-4 min-w-[140px]">Channel Link</th>
                        <th className="p-4 min-w-[180px]">Business Email</th>
                        <th className="p-4 min-w-[150px]">Website</th>
                        <th className="p-4 min-w-[130px]">Instagram</th>
                        <th className="p-4 min-w-[130px]">LinkedIn</th>
                        <th className="p-4 min-w-[130px]">Twitter/X</th>
                        <th className="p-4 min-w-[130px]">TikTok</th>
                        <th className="p-4 min-w-[100px] text-center">Country</th>
                        <th className="p-4 min-w-[120px]">Last Upload</th>
                        <th className="p-4 min-w-[130px]">Upload Frequency</th>
                        <th className="p-4 min-w-[140px]">Website Status</th>
                        <th className="p-4 min-w-[160px]">Email Verification</th>
                        
                        <th className="p-4 text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((creator) => (
                        <tr 
                          key={creator.id}
                          onClick={() => setSelectedLead(creator)}
                          className={`border-b border-white/[0.02] hover:bg-zinc-900/40 cursor-pointer transition-all duration-150 ${
                            selectedLead?.id === creator.id ? 'bg-zinc-900/30' : ''
                          }`}
                        >
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleSelectLeadRow(creator.channelId)} className="text-zinc-500 hover:text-white transition-colors">
                              {selectedLeads.includes(creator.channelId) ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-4">
                              <a href={creator.channelUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group rounded-full overflow-hidden border border-white/[0.08] shadow-md hover:border-emerald-500/50 transition-colors" onClick={(e) => e.stopPropagation()}>
                                <img 
                                  src={creator.avatar} 
                                  alt={creator.channelName} 
                                  className="h-14 w-14 object-cover group-hover:scale-105 transition-transform duration-200" 
                                />
                              </a>
                              <div className="min-w-0 max-w-[220px] space-y-1">
                                <a href={creator.channelUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-sm text-zinc-100 hover:text-emerald-400 hover:underline transition-colors flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <span className="truncate">{creator.channelName}</span>
                                  {creator.growthScore > 75 && (
                                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Rising
                                    </span>
                                  )}
                                </a>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {creator.handle || `@${creator.channelName.toLowerCase().replace(/\s+/g, '')}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right font-semibold text-xs text-zinc-200">{creator.subs}</td>
                          <td className="p-4 text-right font-semibold text-xs text-zinc-200">{creator.views}</td>
                          <td className="p-4">
                            <div className="flex justify-center gap-1.5">
                              <div className="px-2 py-1 rounded-md text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm" title={`Opportunity Score: ${creator.score}`}>
                                O: {creator.score}
                              </div>
                              <div className="px-2 py-1 rounded-md text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-sm" title={`Buying Score: ${creator.buyingScore}`}>
                                B: {creator.buyingScore}
                              </div>
                              <div className="px-2 py-1 rounded-md text-[9px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/25 shadow-sm" title={`Reply Probability: ${creator.replyProbability}%`}>
                                R: {creator.replyProbability}
                              </div>
                            </div>
                          </td>
                          
                          {/* Rich Latest Video Column */}
                          <td className="p-4">
                            <div className="flex items-center gap-3 min-w-[320px] max-w-[400px]">
                              {creator.thumbnailUrl ? (
                                <a 
                                  href={creator.videoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="relative group shrink-0 w-24 h-14 rounded-lg overflow-hidden border border-white/[0.06] shadow-sm hover:border-emerald-500/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <img 
                                    src={creator.thumbnailUrl} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                    alt="Video Thumbnail" 
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                    <PlayCircle className="w-6 h-6 text-white" />
                                  </div>
                                </a>
                              ) : (
                                <div className="w-24 h-14 rounded-lg bg-zinc-900 border border-white/[0.04] shrink-0 flex items-center justify-center">
                                  <PlayCircle className="w-6 h-6 text-zinc-700" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 space-y-1">
                                <a 
                                  href={creator.videoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="block text-xs font-semibold text-zinc-200 hover:text-emerald-400 truncate hover:underline" 
                                  title={creator.videoTitle}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {creator.videoTitle || 'N/A'}
                                </a>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold">
                                  <span>{creator.latest_video_views ? `${formatViews(creator.latest_video_views)} views` : 'No views'}</span>
                                  <span>•</span>
                                  <span>{creator.publishedAt || 'N/A'}</span>
                                </div>
                                <a 
                                  href={creator.videoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-bold transition-all hover:translate-x-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open Video <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.videoUrl ? (
                                <a href={creator.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-bold text-[10px]" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="w-3 h-3 shrink-0" /> Open Video
                                </a>
                              ) : (
                                <span className="text-zinc-600 font-medium">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.channelUrl ? (
                                <a href={creator.channelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-bold text-[10px]" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="w-3 h-3 shrink-0" /> Open Channel
                                </a>
                              ) : (
                                <span className="text-zinc-600 font-medium">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[180px] truncate select-all" title={creator.contact_email || 'No Email Found'}>
                              {creator.contact_email ? (
                                <a href={`mailto:${creator.contact_email}`} className="text-zinc-200 hover:text-emerald-400 hover:underline font-mono text-xs font-medium inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                                  {creator.contact_email}
                                </a>
                              ) : (
                                <span className="text-zinc-500 italic text-[11px]">No Email Found</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[140px] truncate">
                              {creator.website ? (
                                <a href={creator.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
                                  <Globe className="w-3.5 h-3.5 shrink-0" /> {creator.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-600 border border-white/[0.04] opacity-50">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.instagram ? (
                                <a href={creator.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
                                  <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                                  <span>Instagram</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-500 border border-white/[0.04] opacity-40">
                                  <Instagram className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.linkedin ? (
                                <a href={creator.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
                                  <Linkedin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span>LinkedIn</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-500 border border-white/[0.04] opacity-40">
                                  <Linkedin className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.twitter ? (
                                <a href={creator.twitter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
                                  <Twitter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <span>Twitter</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-500 border border-white/[0.04] opacity-40">
                                  <Twitter className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.tiktok ? (
                                <a href={creator.tiktok} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
                                  <TikTokIcon className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                                  <span>TikTok</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-500 border border-white/[0.04] opacity-40">
                                  <TikTokIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                  <span>Missing</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="min-w-[100px] text-zinc-300 font-bold uppercase text-[10px]">
                              {creator.country || 'US'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px] text-zinc-400 text-[11px] font-medium">
                              {creator.publishedAt || 'N/A'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[130px] uppercase font-bold text-[9px] tracking-wider text-zinc-400">
                              {creator.frequencyType || '1_week'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[120px]">
                              {creator.website ? (
                                <span className="text-[9px] font-black uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-1 rounded-md">Website Found</span>
                              ) : (
                                <span className="text-[9px] font-black uppercase bg-zinc-900 text-zinc-500 border border-white/[0.04] px-2 py-1 rounded-md">No Website</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[150px]">
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase border ${
                                creator.verification_status === 'Verified Email'
                                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/25'
                                  : creator.verification_status === 'Likely Email'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                  : 'bg-zinc-800 text-zinc-500 border-white/[0.02]'
                              }`}>
                                {creator.verification_status || 'No Email Found'}
                              </span>
                            </div>
                          </td>

                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 justify-end pr-2">
                              <button
                                onClick={() => handleOutreach(creator)}
                                className="h-7 px-3 bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center transition-colors"
                                title="Outreach"
                              >
                                <Send className="h-3.5 w-3.5 text-emerald-400" />
                              </button>

                              <button 
                                onClick={() => handleSaveToCrm(creator)}
                                disabled={savedCreators.includes(creator.id)}
                                className={`h-7 px-3 rounded-lg text-[10px] font-bold border transition-colors flex items-center ${
                                  savedCreators.includes(creator.id) 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-zinc-100 text-zinc-950 hover:bg-white border-transparent'
                                }`}
                              >
                                {savedCreators.includes(creator.id) ? 'CRM' : 'Save'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center bg-zinc-900/10 border border-white/[0.03] rounded-xl p-3 text-xs text-zinc-400">
                  <div>
                    Showing <span className="font-semibold text-zinc-200">{leads.length}</span> of <span className="font-semibold text-zinc-200">{totalCount}</span> creators
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => runDiscoverySearch(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors text-[11px] font-bold"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1.5 flex items-center text-zinc-300 font-semibold text-[11px]">
                      Page {currentPage} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>
                    <button
                      onClick={() => runDiscoverySearch(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors text-[11px] font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= COLUMN 3: DEEP PSYCHOLOGY AUDIT PANEL (3 cols) ================= */}
          <div className="lg:col-span-3">
            {selectedLead ? (
              <div className="rounded-2xl border border-white/[0.04] bg-zinc-900/10 p-5 space-y-5 sticky top-24 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                
                <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 text-zinc-300">
                  <BrainCircuit className="h-4 w-4 text-emerald-400 shrink-0" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">Creator Intelligence</h3>
                </div>

                <div className="space-y-4">
                  {/* Header info */}
                  <div className="flex gap-4 items-center">
                    <a href={selectedLead.channelUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group rounded-full overflow-hidden border border-white/[0.08] shadow-md hover:border-emerald-500/50 transition-colors">
                      <img 
                        src={selectedLead.avatar} 
                        alt={selectedLead.channelName} 
                        className="h-14 w-14 object-cover group-hover:scale-105 transition-transform duration-200" 
                      />
                    </a>
                    <div className="min-w-0">
                      <a href={selectedLead.channelUrl} target="_blank" rel="noopener noreferrer" className="font-extrabold text-zinc-100 text-sm hover:text-emerald-400 hover:underline transition-colors block truncate">
                        {selectedLead.channelName}
                      </a>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                        {selectedLead.audienceType || "General"} Creator
                      </p>
                    </div>
                  </div>

                  {/* Score Matrix */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-zinc-950/40 border border-white/[0.02] text-center space-y-0.5 shadow-sm">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Buying Score</p>
                      <p className="text-xl font-black text-emerald-400">{selectedLead.buyingScore || 0}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950/40 border border-white/[0.02] text-center space-y-0.5 shadow-sm">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Opportunity Index</p>
                      <p className="text-xl font-black text-amber-400">{selectedLead.score || 0}%</p>
                    </div>
                  </div>

                  {/* Latest Video Card with Thumbnail */}
                  <div className="space-y-2 border-t border-white/[0.04] pt-4">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Latest Upload</p>
                    {selectedLead.thumbnailUrl ? (
                      <a 
                        href={selectedLead.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="relative group block aspect-video rounded-xl overflow-hidden border border-white/[0.06] shadow-md hover:border-emerald-500/50 transition-colors"
                      >
                        <img 
                          src={selectedLead.thumbnailUrl} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          alt="Video Thumbnail" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <PlayCircle className="w-10 h-10 text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video rounded-xl bg-zinc-900 border border-white/[0.04] flex items-center justify-center">
                        <PlayCircle className="w-10 h-10 text-zinc-700" />
                      </div>
                    )}
                    <a 
                      href={selectedLead.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block text-xs font-bold text-zinc-200 hover:text-emerald-400 line-clamp-2 hover:underline pt-1 leading-snug"
                    >
                      {selectedLead.videoTitle || 'N/A'}
                    </a>
                  </div>

                  {/* Channel stats & Topic */}
                  <div className="space-y-2 border-t border-white/[0.04] pt-4 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-medium">Recent Topic:</span>
                      <span className="text-zinc-350 font-bold max-w-[150px] truncate text-right">
                        {selectedLead.visualAnalysisPreview?.recentTopic || selectedLead.audienceType || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-medium">Upload Frequency:</span>
                      <span className="text-zinc-350 font-bold capitalize">{selectedLead.frequencyType || '1_week'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-medium">Country / Language:</span>
                      <span className="text-zinc-350 font-bold uppercase">{selectedLead.country || 'US'} / {selectedLead.language || 'en'}</span>
                    </div>
                  </div>

                  {/* Top Performing Video */}
                  <div className="space-y-2 border-t border-white/[0.04] pt-4">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Top Performing Video</p>
                    <div className="bg-zinc-950/30 border border-white/[0.02] p-3 rounded-xl space-y-1.5 shadow-sm">
                      {selectedLead.visualAnalysisPreview?.topPerformingVideo?.url || selectedLead.videoUrl ? (
                        <a 
                          href={selectedLead.visualAnalysisPreview?.topPerformingVideo?.url || selectedLead.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs font-bold text-zinc-200 hover:text-emerald-400 line-clamp-2 hover:underline leading-snug flex items-start gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span>{selectedLead.visualAnalysisPreview?.topPerformingVideo?.title || selectedLead.videoTitle || 'N/A'}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">No video linked</span>
                      )}
                      <div className="text-[10px] text-zinc-400 font-semibold">
                        Est. {selectedLead.visualAnalysisPreview?.topPerformingVideo?.views || selectedLead.views} views
                      </div>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-3 border-t border-white/[0.04] pt-4">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Contact Information</p>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Email:</span>
                        {selectedLead.contact_email ? (
                          <a href={`mailto:${selectedLead.contact_email}`} className="text-emerald-400 hover:underline font-mono font-medium truncate max-w-[170px]" title="Click to send email">
                            {selectedLead.contact_email}
                          </a>
                        ) : (
                          <span className="text-zinc-550 italic">Missing</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Website:</span>
                        {selectedLead.website ? (
                          <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-semibold flex items-center gap-1.5 truncate max-w-[170px]">
                            {selectedLead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-zinc-555 italic">Missing</span>
                        )}
                      </div>
                    </div>

                    {/* Social links row of icons */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                      {selectedLead.instagram ? (
                        <a href={selectedLead.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all flex items-center justify-center" title="Instagram Profile">
                          <Instagram className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-600 border border-white/[0.04] flex items-center justify-center opacity-40" title="No Instagram">
                          <Instagram className="w-4 h-4" />
                        </span>
                      )}

                      {selectedLead.linkedin ? (
                        <a href={selectedLead.linkedin} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center justify-center" title="LinkedIn Profile">
                          <Linkedin className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-600 border border-white/[0.04] flex items-center justify-center opacity-40" title="No LinkedIn">
                          <Linkedin className="w-4 h-4" />
                        </span>
                      )}

                      {selectedLead.twitter ? (
                        <a href={selectedLead.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all flex items-center justify-center" title="Twitter Profile">
                          <Twitter className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-600 border border-white/[0.04] flex items-center justify-center opacity-40" title="No Twitter/X">
                          <Twitter className="w-4 h-4" />
                        </span>
                      )}

                      {selectedLead.tiktok ? (
                        <a href={selectedLead.tiktok} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all flex items-center justify-center" title="TikTok Profile">
                          <TikTokIcon className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-600 border border-white/[0.04] flex items-center justify-center opacity-40" title="No TikTok">
                          <TikTokIcon className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deep AI Outreach Summary */}
                  <div className="space-y-3 border-t border-white/[0.04] pt-4">
                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">AI Outreach Summary</p>
                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-white/[0.02]">
                        "{selectedLead.visualAnalysisPreview?.aiOutreachSummary || selectedLead.whyThisLead || 'No analysis available.'}"
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Thumbnail Opportunity Analysis</p>
                      <p className="text-xs text-emerald-400 leading-relaxed bg-emerald-950/15 p-3 rounded-xl border border-emerald-500/15">
                        {selectedLead.visualAnalysisPreview?.thumbnailOpportunityAnalysis || selectedLead.visualAnalysisPreview?.thumbnailWeakness || 'No critique available.'}
                      </p>
                    </div>
                  </div>

                  {/* Outreach buttons / Dissect */}
                  <div className="pt-3 border-t border-white/[0.04] space-y-2">
                    <button
                      onClick={() => handleOutreach(selectedLead)}
                      className="w-full h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Create outreach pitch
                    </button>
                    <Link 
                      href={`/analyze?url=${encodeURIComponent(selectedLead.videoUrl)}`}
                      className="w-full h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold flex items-center justify-center transition-colors"
                    >
                      Dissect in Intelligence Engine
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.04] p-6 text-center text-zinc-500 text-xs py-16 bg-zinc-900/10">
                Select any creator card to view their deep packaging and psychology diagnostics preview.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Sheet connection modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/[0.06] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Connect Google Sheet
              </h3>
              <button 
                onClick={() => setShowSheetModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <p className="text-zinc-400 text-xs leading-normal">
              Provide a public or shared Google Spreadsheet URL. The sheet must have headers like "Name", "Email", "Channel" on the first row so we can map and sync columns.
            </p>

            <form onSubmit={handleConnectSheet} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Select Sheet from Google Drive</label>
                  <select
                    value={selectedSheetId}
                    onChange={(e) => {
                      setSelectedSheetId(e.target.value);
                      if (e.target.value) setSheetUrl(""); // Clear manual input if selecting
                    }}
                    className="w-full h-10 rounded-lg border border-white/[0.06] bg-zinc-950 px-3 text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
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

                <div className="flex items-center justify-center gap-2 py-0.5">
                  <span className="h-px bg-white/[0.04] flex-1"></span>
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">or manually connect</span>
                  <span className="h-px bg-white/[0.04] flex-1"></span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Google Sheet URL</span>
                  <input 
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={sheetUrl}
                    onChange={(e) => {
                      setSheetUrl(e.target.value);
                      if (e.target.value) setSelectedSheetId(""); // Clear dropdown if typing manual
                    }}
                    className="w-full h-10 rounded-lg border border-white/[0.06] bg-zinc-950 px-3 text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSheetModal(false)}
                  className="h-9 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnectingSheet}
                  className="h-9 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isConnectingSheet && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
