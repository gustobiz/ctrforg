"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, ArrowRight, CheckCircle2, Target, Plus, RefreshCw, 
  Mail, Users, FileText, Settings, Play, ShieldCheck, HelpCircle, 
  ChevronRight, Calendar, AlertTriangle, Eye, Sliders, Trash2,
  Upload, Loader2, FileSpreadsheet, ExternalLink, Search, Clock, RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import EmailPreview from '@/components/email-preview';

interface CrmLead {
  id: string;
  creator_name: string;
  channel_name: string;
  subscriber_count: any;
  email?: string;
  contact_email?: string;
  video_title?: string;
  VideoTitle?: string;
  videoTitle?: string;
  video_url?: string;
  niche?: string;
  notes?: string;
  contact_source?: string;
  created_at?: string;
  status?: string;
  ai_analysis?: any;
}

/** Unified email fallback — checks email → contact_email → ai_analysis.contact_email → ai_analysis.email */
function getLeadEmail(l: CrmLead): string {
  if (!l) return '';
  let email = l.email || l.contact_email || '';
  if (!email && l.ai_analysis) {
    let ai = l.ai_analysis;
    if (typeof ai === 'string') {
      try { ai = JSON.parse(ai); } catch (e) {}
    }
    if (ai && typeof ai === 'object') {
      email = ai.contact_email || ai.email || '';
    }
  }
  return typeof email === 'string' ? email.trim() : '';
}

/** Helper to retrieve video title from lead object or nested ai_analysis */
function getLeadVideoTitle(l: CrmLead | any): string {
  if (!l) return '';
  let title = l.video_title || l.VideoTitle || l.videoTitle || '';
  if (!title && l.ai_analysis) {
    let ai = l.ai_analysis;
    if (typeof ai === 'string') {
      try { ai = JSON.parse(ai); } catch (e) {}
    }
    if (ai && typeof ai === 'object') {
      title = ai.video_title || ai.VideoTitle || ai.videoTitle || '';
    }
  }
  return typeof title === 'string' ? title.trim() : '';
}

/** Robustly extract rawData object and sheet_headers array from a lead's ai_analysis */
function getLeadRawDataAndHeaders(l: any): { rawData: Record<string, string>; headers: string[] } {
  if (!l) return { rawData: {}, headers: [] };
  let ai = l.ai_analysis;
  if (typeof ai === 'string') {
    try { ai = JSON.parse(ai); } catch (e) {}
  }
  const rawData: Record<string, string> = (ai && typeof ai === 'object' && ai.raw_data && typeof ai.raw_data === 'object')
    ? ai.raw_data
    : {};

  let headers: string[] = (ai && typeof ai === 'object' && Array.isArray(ai.sheet_headers))
    ? ai.sheet_headers
    : Object.keys(rawData);

  return { rawData, headers };
}

/** Helper to retrieve exact string value for a dynamic column header from a lead object */
function getLeadFieldValue(l: any, header: string): string {
  if (!l) return '';
  const { rawData } = getLeadRawDataAndHeaders(l);

  // 1. Check raw_data exact match
  if (rawData[header] !== undefined && rawData[header] !== null) {
    return String(rawData[header]).trim();
  }

  // 2. Check raw_data case-insensitive match
  const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  const foundKey = Object.keys(rawData).find(
    k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerHeader
  );
  if (foundKey && rawData[foundKey] !== undefined && rawData[foundKey] !== null) {
    return String(rawData[foundKey]).trim();
  }

  // 3. Fallback to canonical properties on lead object
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm.includes('firstname') || norm.includes('first') || norm === 'name' || norm.includes('creator')) {
    return l.creator_name || '';
  }
  if (norm.includes('email') || norm.includes('mail') || norm === 'gmail') {
    return getLeadEmail(l);
  }
  if (norm.includes('channel')) {
    return l.channel_name || l.creator_name || '';
  }
  if (norm.includes('video') || norm.includes('title')) {
    return getLeadVideoTitle(l);
  }
  if (norm.includes('sub')) {
    return String(l.subscriber_count ?? '');
  }
  if (norm.includes('note') || norm.includes('info')) {
    return l.notes || '';
  }

  if (l[header] !== undefined && l[header] !== null) {
    return String(l[header]).trim();
  }

  return '';
}

interface Template {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  category: string;
}

interface FollowupRuleInput {
  delayDays: number;
  ruleType: 'not_opened' | 'opened_not_clicked' | 'clicked_not_replied';
  templateId: string;
  useAiGeneration: boolean;
  threadMode?: 'reply' | 'new_thread';
  subjectOverride?: string;
  htmlBodyOverride?: string;
}

const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
};

const getBrowserCurrentTime24 = (): string => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const getBrowserCurrentDateStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getBrowserTimezoneList = (): string[] => {
  const browserTz = getBrowserTimezone();
  const defaults = [
    browserTz,
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
    'UTC'
  ];
  return Array.from(new Set(defaults));
};

const TIMEZONES = getBrowserTimezoneList();

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

/** ISSUE #2 Helpers: Convert 24-hour format string ("09:00", "17:00") <-> 12-hour components */
function parse24HourTo12Hour(time24: string = '09:00') {
  const parts = (time24 || '09:00').split(':');
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) h = 9;
  const mStr = parts[1] || '00';
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour12: String(h12).padStart(2, '0'),
    minute: mStr.padStart(2, '0'),
    period,
  };
}

function format12HourTo24Hour(hour12Str: string, minuteStr: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hour12Str, 10);
  if (isNaN(h)) h = 12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${(minuteStr || '00').padStart(2, '0')}`;
}

function formatTo12HourDisplay(time24: string = '09:00'): string {
  const { hour12, minute, period } = parse24HourTo12Hour(time24);
  return `${hour12}:${minute} ${period}`;
}

/** 12-Hour Time Picker with full 60-minute support (00 to 59) */
function TimePicker12Hour({ 
  label, 
  value24, 
  onChange24 
}: { 
  label: string; 
  value24: string; 
  onChange24: (val24: string) => void;
}) {
  const { hour12, minute, period } = parse24HourTo12Hour(value24);

  const handleHourChange = (newH: string) => {
    onChange24(format12HourTo24Hour(newH, minute, period));
  };

  const handleMinChange = (newM: string) => {
    onChange24(format12HourTo24Hour(hour12, newM, period));
  };

  const handlePeriodChange = (newP: 'AM' | 'PM') => {
    onChange24(format12HourTo24Hour(hour12, minute, newP));
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
        <span className="text-[10px] font-extrabold text-emerald-400 font-mono">
          {formatTo12HourDisplay(value24)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/[0.06] rounded-xl p-2">
        <select
          value={hour12}
          onChange={(e) => handleHourChange(e.target.value)}
          className="bg-zinc-900 border border-white/[0.04] rounded-lg px-2 py-1 text-xs font-extrabold text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          {hours.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="text-xs font-bold text-zinc-500">:</span>
        <select
          value={minute}
          onChange={(e) => handleMinChange(e.target.value)}
          className="bg-zinc-900 border border-white/[0.04] rounded-lg px-2 py-1 text-xs font-extrabold text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          {minutes.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handlePeriodChange(period === 'AM' ? 'PM' : 'AM')}
          className={`ml-auto px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all border ${period === 'AM' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
        >
          {period}
        </button>
      </div>
    </div>
  );
}

export default function NewCampaignWizard() {
  const router = useRouter();
  const supabase = createClient();
  
  // App-wide hydration state
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const saved = localStorage.getItem('ctrforge_wizard_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.currentStep === 'number' && s.currentStep >= 1 && s.currentStep <= 5) {
          return s.currentStep;
        }
      }
    } catch {}
    return 1;
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [wizardHydrated, setWizardHydrated] = useState(false);

  // Data states
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Form states
  const [campaignName, setCampaignName] = useState('Outreach Campaign #' + Math.floor(Math.random() * 1000));
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [htmlBodyOverride, setHtmlBodyOverride] = useState('');
  
  // Followup states
  const [followupRules, setFollowupRules] = useState<FollowupRuleInput[]>([]);
  
  // Delivery schedule settings (Using Real Browser Time)
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState(() => getBrowserCurrentDateStr());
  const [scheduledTime, setScheduledTime] = useState(() => getBrowserCurrentTime24());
  const [scheduledTz, setScheduledTz] = useState(() => getBrowserTimezone());

  // Delivery speed & delays (Seconds, Minutes, Hours)
  const [sendRate, setSendRate] = useState(20); // per hour
  const [delayMinVal, setDelayMinVal] = useState(30);
  const [delayMinUnit, setDelayMinUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds');
  const [delayMaxVal, setDelayMaxVal] = useState(120);
  const [delayMaxUnit, setDelayMaxUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds');

  const getDelayInSeconds = (val: number, unit: 'seconds' | 'minutes' | 'hours'): number => {
    if (unit === 'minutes') return val * 60;
    if (unit === 'hours') return val * 3600;
    return val;
  };

  const randomDelayMin = getDelayInSeconds(delayMinVal, delayMinUnit);
  const randomDelayMax = getDelayInSeconds(delayMaxVal, delayMaxUnit);

  // Sending Window (stores values in 24-hour format: "09:00", "17:00")
  const [sendWindowStart, setSendWindowStart] = useState('09:00');
  const [sendWindowEnd, setSendWindowEnd] = useState('17:00');
  const [sendWindowTz, setSendWindowTz] = useState(() => getBrowserTimezone());
  const [sendWindowDays, setSendWindowDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Review screen states
  const [reviewLeadIndex, setReviewLeadIndex] = useState(0);
  const [previewSequenceIndex, setPreviewSequenceIndex] = useState<number>(0);
  const [launching, setLaunching] = useState(false);

  // Import sources states
  const [importSource, setImportSource] = useState<'crm' | 'sheets' | 'csv'>('crm');
  const [sheetsConnection, setSheetsConnection] = useState<any>(null);
  const [driveSheets, setDriveSheets] = useState<{ id: string; name: string; webViewLink: string }[]>([]);
  const [loadingDriveSheets, setLoadingDriveSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  const [allConnectedSheets, setAllConnectedSheets] = useState<any[]>([]);
  const [isCustomUrlInputOpen, setIsCustomUrlInputOpen] = useState(false);
  const [customSheetUrl, setCustomSheetUrl] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);

  const clearSheetStorageAndState = () => {
    setSheetsConnection(null);
    setSelectedSheetId('');
    setAllConnectedSheets([]);
    setSheetHeaders([]);
    setSheetError(null);
    setIsCustomUrlInputOpen(false);
    setCustomSheetUrl('');

    if (importSource === 'sheets') {
      setLeads([]);
      setSelectedLeadIds([]);
    }

    try {
      localStorage.removeItem('selectedSheetId');
      localStorage.removeItem('sheetsConnection');
      localStorage.removeItem('selectedSpreadsheet');
      sessionStorage.removeItem('selectedSheetId');
      sessionStorage.removeItem('sheetsConnection');

      const saved = localStorage.getItem('ctrforge_wizard_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.selectedSheetId;
        delete parsed.sheetsConnection;
        localStorage.setItem('ctrforge_wizard_state', JSON.stringify(parsed));
      }
    } catch (e) {
      console.error("Error clearing sheet storage:", e);
    }
  };

  const fetchConnectedSheets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('sheets_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setAllConnectedSheets(data);
        const activeConn = data[0];
        setSheetsConnection(activeConn);
        setSelectedSheetId(activeConn.sheet_id);
        if (activeConn.column_mapping?.raw_headers) {
          setSheetHeaders(activeConn.column_mapping.raw_headers);
        }
        setSheetError(null);
      } else {
        clearSheetStorageAndState();
      }
    } catch (err) {
      console.error("Failed to fetch sheet connections:", err);
      clearSheetStorageAndState();
    }
  };

  const handleConnectCustomUrl = async () => {
    if (!customSheetUrl) return;
    setIsSyncingSheet(true);
    setSheetError(null);
    try {
      const res = await fetch("/api/sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: customSheetUrl })
      });
      const data = await res.json();
      if (res.ok && data.connection) {
        setSheetsConnection(data.connection);
        setSelectedSheetId(data.connection.sheet_id);
        setIsCustomUrlInputOpen(false);
        setCustomSheetUrl('');
        await fetchConnectedSheets();

        const syncRes = await fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: data.connection.id }),
        });
        const syncData = await syncRes.json();
        if (syncData.success) {
          await fetchLeadsForSource('sheets', data.connection.sheet_id);
        }
      } else {
        if (data.isNotFound || res.status === 404 || res.status === 403) {
          setSheetError("This spreadsheet is no longer available. Please select another spreadsheet.");
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch (err: any) {
      alert(`Error connecting sheet: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleDisconnectCurrentSheet = async (silent: boolean = false) => {
    if (!selectedSheetId && !sheetsConnection) {
      clearSheetStorageAndState();
      await fetchDriveSpreadsheets();
      return;
    }

    const currentConn = sheetsConnection || allConnectedSheets.find(s => s.sheet_id === selectedSheetId);
    const connId = currentConn?.id;
    const sheetIdToDisconnect = selectedSheetId || currentConn?.sheet_id;

    if (!silent) {
      if (!confirm(`Are you sure you want to disconnect Google Sheet '${currentConn?.sheet_name || sheetIdToDisconnect}'?`)) return;
    }

    setIsSyncingSheet(true);
    try {
      await fetch('/api/sheets/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: sheetIdToDisconnect,
          connectionId: connId,
          deleteLeads: true,
        }),
      });
    } catch (err: any) {
      console.error("Disconnect error:", err);
    } finally {
      clearSheetStorageAndState();
      await fetchDriveSpreadsheets();
      setIsSyncingSheet(false);
      if (!silent) {
        alert("Google Sheet disconnected successfully.");
      }
    }
  };

  const handleRefreshSheet = async () => {
    if (!sheetsConnection) return;
    setIsSyncingSheet(true);
    setSheetError(null);
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: sheetsConnection.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSheetsConnection((prev: any) => ({
          ...prev,
          last_synced_at: new Date().toISOString(),
        }));
        if (data.syncResults?.[0]?.rawHeaders) {
          setSheetHeaders(data.syncResults[0].rawHeaders);
        }
        await fetchLeadsForSource('sheets', sheetsConnection.sheet_id);
      } else {
        if (data.isNotFound || res.status === 404 || res.status === 403) {
          setSheetError("This spreadsheet is no longer available. Please select another spreadsheet.");
          await handleDisconnectCurrentSheet(true);
        } else {
          alert(data.error || "Sync failed");
        }
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("Failed to sync Google Sheet.");
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleChangeSpreadsheet = async () => {
    setSheetsConnection(null);
    setSelectedSheetId('');
    setLeads([]);
    setSelectedLeadIds([]);
    setSheetHeaders([]);
    setSheetError(null);
    setIsCustomUrlInputOpen(false);
    await fetchDriveSpreadsheets();
  };

  const handleConnectSelectedSheet = async (sheetIdToConnect: string) => {
    if (!sheetIdToConnect) return;

    if (sheetIdToConnect === '__connect_new__') {
      setIsCustomUrlInputOpen(true);
      return;
    }

    setIsSyncingSheet(true);
    setSheetError(null);
    try {
      const res = await fetch("/api/sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: sheetIdToConnect })
      });
      const data = await res.json();
      if (res.ok && data.connection) {
        setSheetsConnection(data.connection);
        setSelectedSheetId(data.connection.sheet_id);
        setIsCustomUrlInputOpen(false);

        const syncRes = await fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: data.connection.id }),
        });
        const syncData = await syncRes.json();
        if (syncData.success) {
          if (syncData.syncResults?.[0]?.rawHeaders) {
            setSheetHeaders(syncData.syncResults[0].rawHeaders);
          }
          await fetchConnectedSheets();
          await fetchLeadsForSource('sheets', data.connection.sheet_id);
        } else {
          if (syncData.isNotFound || syncRes.status === 404 || syncRes.status === 403) {
            setSheetError("This spreadsheet is no longer available. Please select another spreadsheet.");
            await handleDisconnectCurrentSheet(true);
          }
        }
      } else {
        if (data.isNotFound || res.status === 404 || res.status === 403) {
          setSheetError("This spreadsheet is no longer available. Please select another spreadsheet.");
        } else {
          alert(data.error || "Failed to connect sheet.");
        }
      }
    } catch (err: any) {
      alert(`Error connecting sheet: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const fetchLeadsForSource = async (sourceOverride?: string, sheetIdOverride?: string): Promise<CrmLead[]> => {
    setLoadingLeads(true);
    try {
      let query = supabase
        .from('crm_leads')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      const activeSource = sourceOverride || importSource;
      const activeSheetId = sheetIdOverride !== undefined ? sheetIdOverride : selectedSheetId;

      if (activeSource === 'sheets') {
        if (!activeSheetId) {
          setLeads([]);
          setSelectedLeadIds([]);
          setSheetHeaders([]);
          setLoadingLeads(false);
          return [];
        }
        query = query.eq('sheet_id', activeSheetId);
      } else if (activeSource === 'csv') {
        query = query.eq('contact_source', 'csv_import');
      } else {
        query = query.or('contact_source.eq.manual,contact_source.eq.youtube_scraping,contact_source.is.null');
      }

      const { data, error } = await query;
      if (data && data.length > 0) {
        const normalized = data.map((l: any) => {
          const vTitle = getLeadVideoTitle(l);
          return {
            ...l,
            video_title: vTitle || l.video_title || '',
          };
        });
        setLeads(normalized);
        setSelectedLeadIds(normalized.map(l => String(l.id)));

        if (activeSource === 'sheets' || activeSource === 'csv') {
          const { headers: headersFromLead } = getLeadRawDataAndHeaders(normalized[0]);
          if (headersFromLead && headersFromLead.length > 0) {
            setSheetHeaders(headersFromLead);
          }
        }
        return normalized;
      } else {
        setLeads([]);
        setSelectedLeadIds([]);
        if (activeSource === 'sheets') setSheetHeaders([]);
        return [];
      }
    } catch (err) {
      console.error('Error fetching leads for source:', err);
      return [];
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchDriveSpreadsheets = async () => {
    setLoadingDriveSheets(true);
    try {
      const res = await fetch("/api/sheets/list");
      if (res.ok) {
        const data = await res.json();
        setDriveSheets(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch Drive spreadsheets:", err);
    } finally {
      setLoadingDriveSheets(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const parsedLeads = parseCSV(text);
      if (parsedLeads.length === 0) return;

      setIsSyncingSheet(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const leadsToInsert = parsedLeads.map(l => ({
          ...l,
          user_id: user.id,
          channel_name: l.channel_name || l.creator_name,
          subscriber_count: l.subscriber_count || 0,
          status: 'new',
          notes: l.notes || '',
          ai_analysis: {
            contact_email: l.ai_analysis.contact_email,
            platform: 'email'
          }
        }));

        const { data: inserted, error } = await supabase
          .from('crm_leads')
          .upsert(leadsToInsert, { onConflict: 'user_id,creator_name' })
          .select();

        if (error) throw error;

        alert(`Successfully imported ${inserted?.length || leadsToInsert.length} leads from CSV!`);
        await fetchLeadsForSource('csv');
        if (inserted && inserted.length > 0) {
          setSelectedLeadIds(inserted.map(i => String(i.id)));
        }
      } catch (err: any) {
        console.error("CSV insert error:", err);
        alert(`Failed to import leads: ${err.message}`);
      } finally {
        setIsSyncingSheet(false);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];
    
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase());
    
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('creator'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    const channelIdx = headers.findIndex(h => h.includes('channel') || h.includes('youtube'));
    const subIdx = headers.findIndex(h => h.includes('subscriber') || h.includes('subs'));
    const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('info'));

    if (nameIdx === -1 || emailIdx === -1) {
      alert("CSV must contain at least 'Name' and 'Email' columns.");
      return [];
    }

    const importedLeads: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const values = parseLine(line);
      const name = values[nameIdx];
      const email = values[emailIdx];
      if (!name || !email) continue;

      const channel = channelIdx !== -1 ? values[channelIdx] : '';
      const subs = subIdx !== -1 ? parseInt(values[subIdx].replace(/[^0-9]/g, '')) || 0 : 0;
      const notes = notesIdx !== -1 ? values[notesIdx] : '';

      importedLeads.push({
        creator_name: name,
        channel_name: channel || name,
        subscriber_count: subs,
        notes: notes,
        status: 'new',
        ai_analysis: {
          contact_email: email,
          platform: 'email'
        }
      });
    }
    return importedLeads;
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubjectOverride(template.subject || '');
      setHtmlBodyOverride(template.html_body || '');
    }
  };

  // Section 1: Follow-up Template Select & Reset Handlers
  const handleSelectFollowupTemplate = (idx: number, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setFollowupRules(prev => prev.map((rule, i) => {
      if (i === idx) {
        return {
          ...rule,
          templateId,
          subjectOverride: template ? (template.subject || '') : (rule.subjectOverride || ''),
          htmlBodyOverride: template ? (template.html_body || '') : (rule.htmlBodyOverride || ''),
        };
      }
      return rule;
    }));
  };

  const handleResetFollowupStepToTemplate = (idx: number) => {
    const rule = followupRules[idx];
    if (!rule || !rule.templateId) return;
    const template = templates.find(t => t.id === rule.templateId);
    if (template) {
      setFollowupRules(prev => prev.map((r, i) => {
        if (i === idx) {
          return {
            ...r,
            subjectOverride: template.subject || '',
            htmlBodyOverride: template.html_body || '',
          };
        }
        return r;
      }));
    }
  };

  const handleAddFollowup = () => {
    const defaultTemplate = templates[0];
    setFollowupRules(prev => [
      ...prev,
      {
        delayDays: 3,
        ruleType: 'not_opened',
        templateId: defaultTemplate?.id || '',
        useAiGeneration: true,
        threadMode: 'reply',
        subjectOverride: defaultTemplate?.subject || '',
        htmlBodyOverride: defaultTemplate?.html_body || '',
      }
    ]);
  };

  const handleRemoveFollowup = (idx: number) => {
    setFollowupRules(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateFollowup = (idx: number, key: keyof FollowupRuleInput, val: any) => {
    setFollowupRules(prev => prev.map((rule, i) => {
      if (i === idx) {
        return { ...rule, [key]: val };
      }
      return rule;
    }));
  };

  const handleToggleDay = (dayId: number) => {
    setSendWindowDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleLaunch = async () => {
    if (!campaignName) {
      alert('Campaign name is required');
      return;
    }
    setLaunching(true);
    try {
      let scheduledAtISO: string | null = null;
      if (scheduleMode === 'scheduled' && scheduledDate) {
        const timePart = scheduledTime || getBrowserCurrentTime24();
        scheduledAtISO = new Date(`${scheduledDate}T${timePart}:00`).toISOString();
      }

      const payload = {
        name: campaignName,
        templateId: selectedTemplateId || null,
        subjectOverride: subjectOverride || null,
        htmlBodyOverride: htmlBodyOverride || null,
        sendRate,
        randomDelayMin,
        randomDelayMax,
        leadIds: selectedLeadIds,
        followupRules: followupRules,
        leadSourceType: importSource,
        leadSourceId: importSource === 'sheets' ? selectedSheetId : null,
        scheduledAt: scheduledAtISO,
        sendWindowStart,
        sendWindowEnd,
        sendWindowTz,
        sendWindowDays,
      };

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('ctrforge_wizard_state');
        router.push('/campaigns');
      } else {
        alert(data.error || 'Failed to launch campaign');
      }
    } catch (err) {
      console.error('Launch campaign error:', err);
      alert('Launch failed due to a network or server error.');
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
      }
    });

    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/email/templates');
        const data = await res.json();
        if (data.success && data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
          if (!selectedTemplateId) {
            setSelectedTemplateId(data.templates[0].id);
            setSubjectOverride(data.templates[0].subject || '');
            setHtmlBodyOverride(data.templates[0].html_body || '');
          }
        }
      } catch (err) {
        console.error('Error fetching templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchLeadsForSource();
    fetchTemplates();
    fetchConnectedSheets();
    fetchDriveSpreadsheets();

    try {
      const saved = localStorage.getItem('ctrforge_wizard_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.campaignName) setCampaignName(s.campaignName);
        if (s.importSource) setImportSource(s.importSource);
        if (s.selectedSheetId) setSelectedSheetId(s.selectedSheetId);
        if (s.selectedTemplateId) setSelectedTemplateId(s.selectedTemplateId);
        if (s.subjectOverride) setSubjectOverride(s.subjectOverride);
        if (s.htmlBodyOverride) setHtmlBodyOverride(s.htmlBodyOverride);
        if (s.followupRules) setFollowupRules(s.followupRules);
        if (s.sendRate !== undefined) setSendRate(s.sendRate);
        if (s.delayMinVal !== undefined) setDelayMinVal(s.delayMinVal);
        if (s.delayMinUnit) setDelayMinUnit(s.delayMinUnit);
        if (s.delayMaxVal !== undefined) setDelayMaxVal(s.delayMaxVal);
        if (s.delayMaxUnit) setDelayMaxUnit(s.delayMaxUnit);
        if (s.scheduleMode) setScheduleMode(s.scheduleMode);
        if (s.scheduledDate) setScheduledDate(s.scheduledDate);
        if (s.scheduledTime) setScheduledTime(s.scheduledTime);
        if (s.scheduledTz) setScheduledTz(s.scheduledTz);
        if (s.sendWindowStart) setSendWindowStart(s.sendWindowStart);
        if (s.sendWindowEnd) setSendWindowEnd(s.sendWindowEnd);
        if (s.sendWindowTz) setSendWindowTz(s.sendWindowTz);
        if (s.sendWindowDays) setSendWindowDays(s.sendWindowDays);
      }
    } catch (e) {
      console.error('Error hydrating from localStorage:', e);
    }
    setWizardHydrated(true);
  }, []);

  useEffect(() => {
    if (!wizardHydrated) return;
    if (importSource === 'sheets') {
      if (selectedSheetId) {
        const conn = allConnectedSheets.find(s => s.sheet_id === selectedSheetId);
        if (conn) setSheetsConnection(conn);
        setSelectedLeadIds([]);
        fetchLeadsForSource('sheets', selectedSheetId);
      } else {
        setLeads([]);
        setSelectedLeadIds([]);
      }
    } else {
      setSelectedLeadIds([]);
      fetchLeadsForSource(importSource);
    }
  }, [importSource, selectedSheetId, wizardHydrated]);

  useEffect(() => {
    if (!wizardHydrated) return;
    const state = {
      currentStep,
      campaignName,
      importSource,
      selectedSheetId,
      selectedLeadIds,
      selectedTemplateId,
      subjectOverride,
      htmlBodyOverride,
      followupRules,
      sendRate,
      delayMinVal,
      delayMinUnit,
      delayMaxVal,
      delayMaxUnit,
      scheduleMode,
      scheduledDate,
      scheduledTime,
      scheduledTz,
      sendWindowStart,
      sendWindowEnd,
      sendWindowTz,
      sendWindowDays,
    };
    localStorage.setItem('ctrforge_wizard_state', JSON.stringify(state));
  }, [
    wizardHydrated, currentStep, campaignName, importSource, selectedSheetId, selectedLeadIds, 
    selectedTemplateId, subjectOverride, htmlBodyOverride, followupRules, sendRate, 
    delayMinVal, delayMinUnit, delayMaxVal, delayMaxUnit, scheduleMode, scheduledDate, 
    scheduledTime, scheduledTz, sendWindowStart, sendWindowEnd, sendWindowTz, sendWindowDays
  ]);

  const handleSelectLead = (leadId: string) => {
    const strId = String(leadId);
    setSelectedLeadIds(prev => 
      prev.some(id => String(id) === strId) ? prev.filter(id => String(id) !== strId) : [...prev, strId]
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => String(l.id)));
    }
  };

  const selectedLeads = leads.filter(l => selectedLeadIds.some(id => String(id) === String(l.id)));
  const totalLeadsCount = selectedLeads.length;
  const leadsWithEmailCount = selectedLeads.filter(l => {
    const email = getLeadEmail(l);
    return email.trim() !== '' && email.includes('@');
  }).length;

  const currentReviewLead = leads.find(l => l.id === selectedLeadIds[reviewLeadIndex]);
  const creatorName = currentReviewLead?.creator_name || '';
  const rawDataForReview = currentReviewLead?.ai_analysis?.raw_data || {};
  const reviewVars: Record<string, string> = currentReviewLead ? {
    ...rawDataForReview,
    name: creatorName,
    creator_name: creatorName,
    first_name: creatorName ? creatorName.split(' ')[0] : '',
    last_name: creatorName ? creatorName.split(' ').slice(1).join(' ') : '',
    email: getLeadEmail(currentReviewLead) || 'jane@example.com',
    channel_name: currentReviewLead.channel_name || creatorName,
    subscriber_count: String(currentReviewLead.subscriber_count || '0'),
    niche: currentReviewLead.ai_analysis?.creator_niche || 'General',
  } : {};

  const canGoNext = () => {
    if (currentStep === 1) return selectedLeadIds.length > 0;
    if (currentStep === 2) return selectedTemplateId !== '' || (subjectOverride !== '' && htmlBodyOverride !== '');
    if (currentStep === 3) return true;
    if (currentStep === 4) return true;
    return true;
  };

  const selectedTemplateObj = templates.find(t => t.id === selectedTemplateId);

  // Validate scheduled time in future
  const isScheduledInPast = (() => {
    if (scheduleMode !== 'scheduled' || !scheduledDate) return false;
    try {
      const schedTime = scheduledTime || '09:00';
      const scheduledDateTime = new Date(`${scheduledDate}T${schedTime}:00`);
      return scheduledDateTime.getTime() < Date.now();
    } catch {
      return false;
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased">
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/campaigns" className="flex items-center text-zinc-400 hover:text-white transition-colors mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Back to Dashboard</span>
          </Link>
        </div>
        <div className="text-center font-bold tracking-tight text-xs uppercase text-zinc-500">
          Campaign Architect
        </div>
      </header>

      <div className="border-b border-white/[0.02] bg-zinc-950/20 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          {[
            { step: 1, label: 'Choose Leads', icon: Users },
            { step: 2, label: 'Email Template', icon: Mail },
            { step: 3, label: 'Follow-ups', icon: Calendar },
            { step: 4, label: 'Review & Verify', icon: Eye },
            { step: 5, label: 'Delivery Config', icon: Sliders },
          ].map((s) => {
            const isCompleted = currentStep > s.step;
            const isActive = currentStep === s.step;
            return (
              <div key={s.step} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (s.step < currentStep || canGoNext()) {
                      setCurrentStep(s.step);
                    }
                  }}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border ${
                    isActive
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : isCompleted
                      ? 'bg-zinc-900 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-950 text-zinc-600 border-white/[0.04]'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                </button>
                <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        
        {/* Step 1: Choose Leads */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">Select Campaign Recipients</h2>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Select target leads from your CRM pipeline or connect a Google Sheet.</p>
            </div>

            {/* Source Selection Tabs */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setImportSource('crm')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  importSource === 'crm'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-zinc-900/10 border-white/[0.04] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Users className="h-4 w-4" /> CRM Pipeline
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Select from scraped or manual leads</p>
              </button>

              <button
                type="button"
                onClick={() => setImportSource('sheets')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  importSource === 'sheets'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-zinc-900/10 border-white/[0.04] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <FileSpreadsheet className="h-4 w-4" /> Google Sheets
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Import directly from live sheet</p>
              </button>

              <label
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                  importSource === 'csv'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-zinc-900/10 border-white/[0.04] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCSVUpload}
                  className="hidden" 
                />
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Upload className="h-4 w-4" /> Import CSV File
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Upload .csv file with contacts</p>
              </label>
            </div>

            {/* Google Sheets Connection Selector */}
            {importSource === 'sheets' && (
              <div className="p-4 border border-white/[0.04] bg-zinc-900/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Google Sheet Connection</label>
                  {sheetsConnection && (
                    <button
                      type="button"
                      onClick={handleRefreshSheet}
                      disabled={isSyncingSheet}
                      className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSyncingSheet ? 'animate-spin' : ''}`} /> Sync Sheet
                    </button>
                  )}
                </div>

                {sheetsConnection ? (
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-white/[0.06]">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{sheetsConnection.sheet_name || selectedSheetId}</h4>
                      <p className="text-[10px] text-zinc-500">Connected &bull; {leads.length} leads synced</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleChangeSpreadsheet}
                      className="text-xs text-zinc-400 hover:text-white font-bold"
                    >
                      Change Sheet
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedSheetId}
                      onChange={(e) => handleConnectSelectedSheet(e.target.value)}
                      disabled={isSyncingSheet || loadingDriveSheets}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Select a Google Sheet from Drive --</option>
                      {driveSheets.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="__connect_new__">+ Connect via Public URL</option>
                    </select>

                    {isCustomUrlInputOpen && (
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          value={customSheetUrl}
                          onChange={(e) => setCustomSheetUrl(e.target.value)}
                          placeholder="Paste Google Sheet URL"
                          className="flex-1 bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={handleConnectCustomUrl}
                          disabled={isSyncingSheet || !customSheetUrl}
                          className="px-4 py-2 bg-emerald-500 text-zinc-950 font-bold text-xs rounded-xl"
                        >
                          Connect
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {sheetError && <p className="text-xs text-rose-400 font-bold">{sheetError}</p>}
              </div>
            )}

            {/* Leads Table */}
            {loadingLeads ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <RefreshCw className="h-8 w-8 animate-spin mb-4 text-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Loading lead data...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.04] rounded-2xl bg-zinc-950/20">
                <Users className="h-10 w-10 text-zinc-600 mb-4" />
                <h4 className="text-zinc-300 font-bold text-sm mb-1 uppercase tracking-wider">No Leads Found</h4>
                <p className="text-zinc-500 text-xs mb-6">No active contacts found for the selected lead source.</p>
              </div>
            ) : (
              <div className="border border-white/[0.04] rounded-2xl bg-zinc-900/10 overflow-hidden space-y-3">
                <div className="p-4 bg-zinc-950/40 border-b border-white/[0.04] flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {selectedLeadIds.length} of {leads.length} leads selected
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllLeads}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    {selectedLeadIds.length === leads.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {(() => {
                    const sampleLead = leads[0];
                    const { headers: leadHeaders } = getLeadRawDataAndHeaders(sampleLead);
                    const isDynamic = (importSource === 'sheets' || importSource === 'csv') && leadHeaders.length > 0;
                    const headersToRender = isDynamic ? leadHeaders : sheetHeaders;

                    return (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.04] text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/60">
                            <th className="p-3 text-center w-10">Select</th>
                            {isDynamic ? (
                              headersToRender.map((header) => (
                                <th key={header} className="p-3 whitespace-nowrap">
                                  {header}
                                </th>
                              ))
                            ) : (
                              <>
                                <th className="p-3 whitespace-nowrap">Name</th>
                                <th className="p-3 whitespace-nowrap">Channel</th>
                                <th className="p-3 whitespace-nowrap">Email</th>
                              </>
                            )}
                            <th className="p-3 whitespace-nowrap">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {leads.map((l) => {
                            const isSelected = selectedLeadIds.includes(String(l.id));
                            return (
                              <tr 
                                key={l.id} 
                                onClick={() => handleSelectLead(l.id)}
                                className={`cursor-pointer transition-colors hover:bg-white/[0.02] ${isSelected ? 'bg-emerald-500/[0.04]' : ''}`}
                              >
                                <td className="p-3 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    readOnly
                                    className="accent-emerald-500 cursor-pointer"
                                  />
                                </td>
                                {isDynamic ? (
                                  headersToRender.map((header) => (
                                    <td key={header} className="p-3 truncate max-w-[120px] text-zinc-300">
                                      {getLeadFieldValue(l, header) || '-'}
                                    </td>
                                  ))
                                ) : (
                                  <>
                                    <td className="p-3 text-zinc-100 font-bold">{l.creator_name}</td>
                                    <td className="p-3 text-zinc-400">{l.channel_name}</td>
                                    <td className="p-3 text-zinc-400">{getLeadEmail(l)}</td>
                                  </>
                                )}
                                <td className="p-3 text-[10px] text-zinc-500 uppercase font-bold">{l.contact_source || 'crm'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configure Follow-up Sequence & Full Step Template Editor (Section 1) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">Setup Follow-up Automation Rules</h2>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Design custom automated triggers, select templates, and customize step-specific email overrides.</p>
            </div>

            <div className="space-y-6">
              {followupRules.map((rule, idx) => {
                const selectedRuleTemplate = templates.find(t => t.id === rule.templateId);

                return (
                  <div key={idx} className="p-5 border border-white/[0.04] bg-zinc-900/10 rounded-2xl relative space-y-4 animate-in slide-in-from-top-4 duration-150">
                    <button 
                      type="button"
                      onClick={() => handleRemoveFollowup(idx)}
                      className="absolute top-4 right-4 p-1 rounded-lg bg-zinc-950 border border-white/[0.04] text-rose-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors cursor-pointer"
                      title="Remove Step"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-emerald-400 flex items-center">
                      <Target className="h-3.5 w-3.5 mr-1.5" /> STEP #{idx + 1} SEQUENCE RULE
                    </h3>

                    {/* Step Rule Controls */}
                    <div className="grid md:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Delay</label>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            min={1} 
                            max={30}
                            value={rule.delayDays}
                            onChange={(e) => handleUpdateFollowup(idx, 'delayDays', parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-zinc-200 font-bold"
                          />
                          <span className="text-xs text-zinc-400 font-semibold shrink-0">Days</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Condition</label>
                        <select
                          value={rule.ruleType}
                          onChange={(e) => handleUpdateFollowup(idx, 'ruleType', e.target.value)}
                          className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-zinc-200 cursor-pointer"
                        >
                          <option value="not_opened">Has not opened original email</option>
                          <option value="opened_not_clicked">Opened, but has not clicked any link</option>
                          <option value="clicked_not_replied">Clicked link, but has not replied yet</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Thread Mode</label>
                        <select
                          value={rule.threadMode || 'reply'}
                          onChange={(e) => handleUpdateFollowup(idx, 'threadMode', e.target.value)}
                          className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-zinc-200 cursor-pointer"
                        >
                          <option value="reply">Reply in same thread</option>
                          <option value="new_thread">Send as new email thread</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Template</label>
                        <select
                          value={rule.templateId}
                          onChange={(e) => handleSelectFollowupTemplate(idx, e.target.value)}
                          className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-zinc-200 cursor-pointer"
                        >
                          <option value="">(Select sequence template)</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Section 1: Full Step Template Preview & Independent Override Editor */}
                    <div className="border border-white/[0.04] rounded-xl p-4 bg-zinc-950/60 space-y-3 mt-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/[0.04]">
                        <div>
                          <h4 className="font-bold text-[11px] uppercase tracking-wider text-zinc-300">
                            FOLLOW-UP TEMPLATE PREVIEW
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            Campaign-Specific Template Override (Applies only to Step #{idx + 1})
                          </p>
                        </div>
                        {rule.templateId && (
                          <button 
                            type="button"
                            onClick={() => handleResetFollowupStepToTemplate(idx)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" /> Reset To Template
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Subject</label>
                        <input 
                          type="text" 
                          value={rule.subjectOverride || ''}
                          onChange={(e) => handleUpdateFollowup(idx, 'subjectOverride', e.target.value)}
                          placeholder={selectedRuleTemplate?.subject || 'Quick thought on "{{VideoTitle}}"'}
                          className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-zinc-150 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">HTML Editor</label>
                        <textarea 
                          value={rule.htmlBodyOverride || ''}
                          onChange={(e) => handleUpdateFollowup(idx, 'htmlBodyOverride', e.target.value)}
                          placeholder={selectedRuleTemplate?.html_body || 'Hello {{FirstName}},\n\n...\n\nRegards'}
                          rows={6}
                          className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl p-3.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                  </div>
                );
              })}

              <button 
                type="button"
                onClick={handleAddFollowup}
                className="w-full py-4 border border-dashed border-white/[0.06] hover:border-white/[0.1] rounded-2xl flex items-center justify-center text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white bg-zinc-950/10 hover:bg-zinc-950/30 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" /> Add follow-up sequence step
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Campaign Email Preview across ENTIRE Sequence (Section 2) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">Campaign Email Preview</h2>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                Preview the entire campaign sequence with real variable interpolation ({"{{FirstName}}"}, {"{{VideoTitle}}"}, {"{{ChannelName}}"}).
              </p>
            </div>

            {/* Recipient Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/30 border border-white/[0.04] p-4 rounded-2xl">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Recipient Preview ({reviewLeadIndex + 1} of {selectedLeadIds.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reviewLeadIndex === 0}
                  onClick={() => setReviewLeadIndex(p => Math.max(0, p - 1))}
                  className="px-3 py-1 bg-zinc-950 border border-white/[0.04] text-zinc-300 disabled:opacity-40 hover:bg-zinc-900 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Previous Lead
                </button>
                <button
                  type="button"
                  disabled={reviewLeadIndex === selectedLeadIds.length - 1}
                  onClick={() => setReviewLeadIndex(p => Math.min(selectedLeadIds.length - 1, p + 1))}
                  className="px-3 py-1 bg-zinc-950 border border-white/[0.04] text-zinc-300 disabled:opacity-40 hover:bg-zinc-900 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Next Lead
                </button>
              </div>
            </div>

            {/* Section 2: Sequence Step Navigation Tabs (Main Email + Follow-up #1, #2, #3...) */}
            {followupRules.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 border border-white/[0.04] p-3 rounded-2xl">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <button
                    type="button"
                    disabled={previewSequenceIndex === 0}
                    onClick={() => setPreviewSequenceIndex(p => Math.max(0, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-bold disabled:opacity-30 disabled:hover:text-zinc-300 transition-all shrink-0 cursor-pointer"
                  >
                    ◀ Previous
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewSequenceIndex(0)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                        previewSequenceIndex === 0
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-extrabold shadow-md'
                          : 'bg-zinc-950 border-white/[0.04] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Main Email
                    </button>

                    {followupRules.map((_, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => setPreviewSequenceIndex(fIdx + 1)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                          previewSequenceIndex === fIdx + 1
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-extrabold shadow-md'
                            : 'bg-zinc-950 border-white/[0.04] text-zinc-400 hover:text-white'
                        }`}
                      >
                        Follow-up #{fIdx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={previewSequenceIndex >= followupRules.length}
                    onClick={() => setPreviewSequenceIndex(p => Math.min(followupRules.length, p + 1))}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-bold disabled:opacity-30 disabled:hover:text-zinc-300 transition-all shrink-0 cursor-pointer"
                  >
                    Next ▶
                  </button>
                </div>

                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider self-end sm:self-center shrink-0">
                  Step: {previewSequenceIndex === 0 ? 'Main Email' : `Follow-up #${previewSequenceIndex}`}
                </span>
              </div>
            )}

            {/* Email Preview Card with Real Variable Interpolation */}
            {selectedLeadIds.length > 0 && currentReviewLead && (
              <div className="border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl space-y-0">
                <div className="p-4 bg-zinc-900/40 border-b border-white/[0.04] flex items-center justify-between">
                  <div className="flex flex-col text-xs">
                    <span className="text-zinc-550 font-bold uppercase">
                      {previewSequenceIndex === 0 ? 'Main Email Preview' : `Follow-up #${previewSequenceIndex} Preview`}
                    </span>
                    <span className="text-zinc-200 font-extrabold">{currentReviewLead.creator_name} ({getLeadEmail(currentReviewLead) || 'No email'})</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase">
                    Real Variables Interpolated
                  </span>
                </div>
                <EmailPreview 
                  subjectTemplate={
                    previewSequenceIndex === 0 
                      ? (subjectOverride || selectedTemplateObj?.subject || '')
                      : (followupRules[previewSequenceIndex - 1]?.subjectOverride || templates.find(t => t.id === followupRules[previewSequenceIndex - 1]?.templateId)?.subject || '')
                  }
                  bodyTemplate={
                    previewSequenceIndex === 0 
                      ? (htmlBodyOverride || selectedTemplateObj?.html_body || '')
                      : (followupRules[previewSequenceIndex - 1]?.htmlBodyOverride || templates.find(t => t.id === followupRules[previewSequenceIndex - 1]?.templateId)?.html_body || '')
                  }
                  leadData={reviewVars}
                  readOnly={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 5: Delivery Configuration & Real Browser Time Scheduling (Section 3) */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">Delivery Configuration & Launch</h2>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Configure sending schedule, delays, sending windows, and launch your campaign.</p>
            </div>

            <div className="border border-white/[0.04] rounded-3xl p-6 bg-zinc-900/10 space-y-6">
              
              {/* Campaign Title */}
              <div className="space-y-2 border-b border-white/[0.04] pb-4">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Campaign Title Identifier</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-zinc-200 font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Section 3: Launch Mode Toggle (Run Immediately vs Schedule Campaign) */}
              <div className="space-y-3 border-b border-white/[0.04] pb-5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Campaign Launch Schedule</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('immediate')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${scheduleMode === 'immediate' ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md' : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Run Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode('scheduled')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${scheduleMode === 'scheduled' ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md' : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Schedule Campaign
                  </button>
                </div>

                {/* RUN IMMEDIATELY MODE: Hide all scheduling controls */}
                {scheduleMode === 'immediate' ? (
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/[0.04] space-y-1.5 mt-3 animate-in fade-in-50">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Launch Mode: Immediate</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Campaign will be queued and begin dispatching immediately upon clicking <strong>Launch Campaign</strong>.
                    </p>
                    <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider mt-1">
                      Estimated Start: Now
                    </p>
                  </div>
                ) : (
                  /* SCHEDULE CAMPAIGN MODE: Show Date, Time (00..59 mins), AM/PM, Timezone */
                  <div className="space-y-3 pt-3 animate-in fade-in-50">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Date</label>
                        <input 
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      
                      {/* 12-Hour Time Picker with full 00..59 minutes */}
                      <TimePicker12Hour 
                        label="Scheduled Time"
                        value24={scheduledTime}
                        onChange24={setScheduledTime}
                      />

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Timezone (Browser Auto-filled)</label>
                        <select
                          value={scheduledTz}
                          onChange={(e) => setScheduledTz(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          {TIMEZONES.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isScheduledInPast && (
                      <p className="text-xs text-amber-400 font-bold flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Scheduled time must be in the future.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Speed & Delays */}
              <div className="space-y-4 border-b border-white/[0.04] pb-5">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sending Speed (per hour)</label>
                  <span className="text-sm font-extrabold text-emerald-400">{sendRate} emails/hour</span>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={100} 
                  value={sendRate}
                  onChange={(e) => setSendRate(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                <div className="grid md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Min Delay Between Sends</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        min={1} 
                        value={delayMinVal}
                        onChange={(e) => setDelayMinVal(parseInt(e.target.value) || 1)}
                        className="flex-1 bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={delayMinUnit}
                        onChange={(e) => setDelayMinUnit(e.target.value as any)}
                        className="bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="seconds">Seconds</option>
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Max Delay Between Sends</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        min={1} 
                        value={delayMaxVal}
                        onChange={(e) => setDelayMaxVal(parseInt(e.target.value) || 1)}
                        className="flex-1 bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={delayMaxUnit}
                        onChange={(e) => setDelayMaxUnit(e.target.value as any)}
                        className="bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="seconds">Seconds</option>
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sending Window Schedule */}
              <div className="space-y-3 border-b border-white/[0.04] pb-5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Sending Window Schedule</label>
                <div className="grid md:grid-cols-3 gap-4">
                  
                  {/* Start Time 12-Hour Picker */}
                  <TimePicker12Hour 
                    label="Start Time"
                    value24={sendWindowStart}
                    onChange24={setSendWindowStart}
                  />

                  {/* End Time 12-Hour Picker */}
                  <TimePicker12Hour 
                    label="End Time"
                    value24={sendWindowEnd}
                    onChange24={setSendWindowEnd}
                  />

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Timezone</label>
                    <select
                      value={sendWindowTz}
                      onChange={(e) => setSendWindowTz(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Allowed Days of Week</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(d => {
                      const isSelected = sendWindowDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleToggleDay(d.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${isSelected ? 'bg-emerald-500 text-zinc-950 font-black' : 'bg-zinc-950 text-zinc-400 border border-white/[0.04]'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Campaign Pre-Launch Summary Panel */}
              <div className="border border-emerald-500/20 bg-emerald-500/[0.03] p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Campaign Pre-Launch Summary
                </h4>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Recipient Count</span>
                    <p className="text-sm font-extrabold text-zinc-150">{leadsWithEmailCount} leads with email</p>
                    <p className="text-[10px] text-zinc-500">{totalLeadsCount} total leads selected</p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Selected Template</span>
                    <p className="text-sm font-extrabold text-zinc-150 truncate">{selectedTemplateObj?.name || 'Custom Payload'}</p>
                    <p className="text-[10px] text-zinc-500">{followupRules.length} follow-up step(s)</p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Launch Schedule</span>
                    <p className="text-sm font-extrabold text-zinc-150">
                      {scheduleMode === 'immediate' 
                        ? 'Run Immediately (Starts: Now)' 
                        : `${scheduledDate || 'Date TBD'} at ${formatTo12HourDisplay(scheduledTime)} (${scheduledTz})`}
                    </p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Sending Window</span>
                    <p className="text-sm font-extrabold text-zinc-150">
                      {formatTo12HourDisplay(sendWindowStart)} - {formatTo12HourDisplay(sendWindowEnd)} ({sendWindowTz})
                    </p>
                    <p className="text-[10px] text-zinc-500">{sendWindowDays.length} days / week allowed</p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Sending Rate Limit</span>
                    <p className="text-sm font-extrabold text-emerald-400">{sendRate} emails / hour</p>
                    <p className="text-[10px] text-zinc-500">Delays: {delayMinVal} {delayMinUnit} - {delayMaxVal} {delayMaxUnit}</p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/[0.04] space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">Estimated Completion</span>
                    <p className="text-sm font-extrabold text-zinc-150">
                      {leadsWithEmailCount > 0 ? `~${(leadsWithEmailCount / sendRate).toFixed(1)} hours` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div className="mt-10 pt-6 border-t border-white/[0.04] flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1 || launching}
            onClick={() => {
              setCurrentStep(p => Math.max(1, p - 1));
            }}
            className="h-9 px-4 rounded-lg bg-zinc-900 border border-white/[0.04] text-zinc-400 hover:text-white disabled:opacity-40 text-xs font-bold transition-all flex items-center cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </button>

          {currentStep < 5 ? (
            <button
              disabled={!canGoNext()}
              onClick={() => {
                if (canGoNext()) {
                  setCurrentStep(p => Math.min(5, p + 1));
                }
              }}
              className="h-9 px-5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 disabled:hover:bg-zinc-100 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center"
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </button>
          ) : (
            <button
              disabled={launching || leadsWithEmailCount === 0}
              onClick={handleLaunch}
              className="h-9 px-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-850 disabled:opacity-40 text-zinc-950 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center shadow-lg shadow-emerald-500/10"
            >
              {launching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Launching...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" /> Launch Campaign
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
