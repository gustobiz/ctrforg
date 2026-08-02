"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Bot, 
  Video, 
  Globe, 
  CloudLightning,
  ExternalLink,
  Upload,
  Shield,
  UserCheck
} from "lucide-react";

interface StatusData {
  connected: boolean;
  name: string;
  lastSync?: string | null;
  email?: string | null;
  status?: string;
  sheetUrl?: string | null;
  sheetName?: string | null;
  autoSync?: boolean;
  importedCount?: number;
  actor?: string | null;
  totalRuns?: number;
  failedRuns?: number;
  avgRuntime?: number;
  lastRun?: string | null;
  lastError?: string | null;
}

interface StatusResponse {
  youtube: StatusData;
  gemini: StatusData;
  apify: StatusData;
  googleOAuth: StatusData;
  googleSheets: StatusData;
}

interface ApiIntegrationsProps {
  mode?: 'public' | 'admin';
}

export default function ApiIntegrations({ mode = 'public' }: ApiIntegrationsProps) {
  const [statuses, setStatuses] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Sheet management states
  const [driveSheets, setDriveSheets] = useState<{ id: string; name: string; webViewLink: string }[]>([]);
  const [loadingDriveSheets, setLoadingDriveSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [isChangingSheet, setIsChangingSheet] = useState(false);
  
  // Action loading states
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; message: string } | null }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  
  // Fetch connection status of all integrations
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/settings/status");
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
        
        // If Google OAuth is connected, fetch spreadsheets from Drive
        if (data.googleOAuth?.connected) {
          fetchDriveSpreadsheets();
        }
      }
    } catch (err) {
      console.error("Failed to fetch integration status:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available spreadsheets in Google Drive
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
    fetchStatus();
  }, []);

  const handleTestConnection = async (provider: string) => {
    setTestingProvider(provider);
    setTestResult(prev => ({ ...prev, [provider]: null }));
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(prev => ({
          ...prev,
          [provider]: { success: true, message: data.message }
        }));
      } else {
        setTestResult(prev => ({
          ...prev,
          [provider]: { success: false, message: data.error || "Connection test failed." }
        }));
      }
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [provider]: { success: false, message: err.message || "An unexpected error occurred." }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleConnectSheetByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput) return;
    setActionLoading(prev => ({ ...prev, connectSheet: true }));
    try {
      const res = await fetch("/api/sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: sheetUrlInput })
      });
      const data = await res.json();
      if (res.ok) {
        setSheetUrlInput("");
        setIsChangingSheet(false);
        await fetchStatus();
        alert("Google Sheet connected successfully!");
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error connecting sheet: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, connectSheet: false }));
    }
  };

  const handleConnectSelectedSheet = async () => {
    if (!selectedSheetId) return;
    const selected = driveSheets.find(s => s.id === selectedSheetId);
    if (!selected) return;
    
    setActionLoading(prev => ({ ...prev, connectSheet: true }));
    try {
      const res = await fetch("/api/sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: selected.webViewLink })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedSheetId("");
        setIsChangingSheet(false);
        await fetchStatus();
        alert("Google Sheet connected successfully!");
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error connecting sheet: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, connectSheet: false }));
    }
  };

  const handleCreateNewSheet = async () => {
    setActionLoading(prev => ({ ...prev, createSheet: true }));
    try {
      const res = await fetch("/api/sheets/create", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await fetchStatus();
        alert("New Google Sheet created and connected successfully!");
      } else {
        alert(`Error creating sheet: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error creating sheet: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, createSheet: false }));
    }
  };

  const handleDisconnectSheet = async () => {
    if (!confirm("Are you sure you want to disconnect this Google Sheet? All connected sheet records and imported leads will be removed.")) return;
    setActionLoading(prev => ({ ...prev, disconnectSheet: true }));
    try {
      const res = await fetch("/api/sheets/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteLeads: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchStatus();
        alert(data.message || "Google Sheet disconnected successfully.");
      } else {
        alert(`Error: ${data.error || 'Failed to disconnect'}`);
      }
    } catch (err: any) {
      alert(`Error disconnecting sheet: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, disconnectSheet: false }));
    }
  };

  const handleExportLeads = async () => {
    setActionLoading(prev => ({ ...prev, exportLeads: true }));
    try {
      const res = await fetch("/api/sheets/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) {
        await fetchStatus();
        alert(data.message || "Leads exported successfully!");
      } else {
        alert(`Export Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, exportLeads: false }));
    }
  };

  const handleImportLeads = async () => {
    setActionLoading(prev => ({ ...prev, importLeads: true }));
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) {
        await fetchStatus();
        alert(`Successfully imported ${data.totalSynced || 0} leads from your Google Sheet!`);
      } else {
        alert(`Import Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, importLeads: false }));
    }
  };

  const handleToggleAutoSync = async (checked: boolean) => {
    setActionLoading(prev => ({ ...prev, toggleSync: true }));
    try {
      const res = await fetch("/api/sheets/toggle-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync: checked })
      });
      if (res.ok) {
        setStatuses(prev => {
          if (!prev) return null;
          return {
            ...prev,
            googleSheets: {
              ...prev.googleSheets,
              autoSync: checked
            }
          };
        });
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error toggling sync: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, toggleSync: false }));
    }
  };

  const handleConnectGoogleOAuth = () => {
    window.location.href = "/api/gmail/connect";
  };

  const handleDisconnectGoogleOAuth = async () => {
    if (!confirm("Are you sure you want to disconnect your Google Account? This will disable Gmail outreach and Google Sheets synchronization.")) return;
    setActionLoading(prev => ({ ...prev, googleOAuth: true }));
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error("Failed to disconnect Google OAuth:", err);
    } finally {
      setActionLoading(prev => ({ ...prev, googleOAuth: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card text-card-foreground rounded-2xl border border-border/40 p-8 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading accounts and connections...</p>
      </div>
    );
  }

  if (!statuses) {
    return (
      <div className="text-center py-12 rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h3 className="font-semibold text-base text-foreground">Error Loading Connection Status</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Could not retrieve account status from the server. Please verify network connectivity and try again.</p>
        <button onClick={fetchStatus} className="mt-4 px-4 py-2 bg-foreground text-background font-semibold rounded-lg text-xs hover:opacity-90 transition-all shadow-sm">
          Retry Connection Status
        </button>
      </div>
    );
  }

  interface IntegrationItem {
    key: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    envVar?: string;
    connected: boolean;
    isOAuth?: boolean;
    isSheets?: boolean;
    email?: string | null;
    lastSync?: string | null;
    sheetUrl?: string | null;
    sheetName?: string | null;
    autoSync?: boolean;
    importedCount?: number;
    actor?: string | null;
    status?: string;
    totalRuns?: number;
    failedRuns?: number;
    avgRuntime?: number;
    lastRun?: string | null;
    lastError?: string | null;
  }

  // 1. User-Level Connected Accounts
  const userConnectedAccounts: IntegrationItem[] = [
    {
      ...statuses.googleOAuth,
      key: "googleOAuth",
      name: "Google OAuth",
      description: "Authenticate your Google account for sending outreach emails via Gmail and granting access to Google Sheets.",
      icon: <CloudLightning className="h-5 w-5 text-amber-500" />,
      isOAuth: true,
    },
    {
      ...statuses.googleSheets,
      key: "googleSheets",
      name: "Google Sheets",
      description: "Connect spreadsheets to automatically export generated lead lists and import leads for outreach campaigns.",
      icon: <FileSpreadsheet className="h-5 w-5 text-emerald-500" />,
      isSheets: true,
    }
  ];

  // 2. Admin-Only Platform Integrations
  const platformIntegrations: IntegrationItem[] = [
    {
      ...statuses.youtube,
      key: "youtube",
      name: "YouTube Data API",
      description: "Platform service for discovering channels, pulling video metadata, and indexing creator statistics.",
      icon: <Video className="h-5 w-5 text-red-500" />,
      envVar: "YOUTUBE_API_KEY",
    },
    {
      ...statuses.gemini,
      key: "gemini",
      name: "Gemini AI",
      description: "Platform engine for lead scoring, personalized email copy generation, and sentiment analysis.",
      icon: <Bot className="h-5 w-5 text-purple-400" />,
      envVar: "GEMINI_API_KEY",
    },
    {
      ...statuses.apify,
      key: "apify",
      name: "Apify Web Crawler",
      description: "Platform service for automated website crawling, lead contact enrichment, and social media extraction.",
      icon: <Globe className="h-5 w-5 text-sky-400" />,
      envVar: "APIFY_TOKEN",
    }
  ];

  const renderIntegrationCard = (integration: IntegrationItem) => {
    const isConnected = integration.connected;
    const key = integration.key;
    const test = testResult[key];

    return (
      <div key={key} className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden transition-all hover:border-border">
        {/* Header Panel */}
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 bg-muted/20">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-background border border-border/80 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              {integration.icon}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-base tracking-tight text-foreground">{integration.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
                  isConnected 
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      Connected
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Not Connected
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xl leading-relaxed">{integration.description}</p>
              
              {mode === 'admin' && key === 'apify' && (
                <div className="mt-2 text-xs">
                  {integration.actor ? (
                    <span className="text-muted-foreground">
                      Apify Actor: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground text-[11px]">{integration.actor}</code>
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Warning: APIFY_ACTOR environment variable missing.
                    </span>
                  )}
                </div>
              )}
              
              {integration.isOAuth && integration.email && (
                <p className="text-xs text-emerald-500 font-medium mt-1.5 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" /> Authenticated Account: <strong>{integration.email}</strong>
                </p>
              )}
              
              {integration.lastSync && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last Synced: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            {/* Test Connection Button (Admin only) */}
            {mode === 'admin' && (
              <button
                onClick={() => handleTestConnection(key)}
                disabled={testingProvider !== null || (!isConnected && key !== 'googleOAuth' && key !== 'googleSheets')}
                className="px-3.5 py-2 rounded-xl bg-muted border border-border text-foreground text-xs font-semibold hover:bg-accent disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
              >
                {testingProvider === key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Test Connection
              </button>
            )}

            {/* Reconnect/Authorize Actions */}
            {integration.isOAuth ? (
              isConnected ? (
                <button
                  onClick={handleDisconnectGoogleOAuth}
                  disabled={actionLoading.googleOAuth}
                  className="px-3.5 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  {actionLoading.googleOAuth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogleOAuth}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  Connect Google Account
                </button>
              )
            ) : (
              mode === 'admin' && integration.envVar ? (
                <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-1 rounded-lg font-mono border border-border/40">
                  env: {integration.envVar}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Status Test Results display (Admin mode only) */}
        {mode === 'admin' && test && (
          <div className={`px-6 py-3.5 border-b border-border/40 flex items-start gap-2.5 text-xs ${
            test.success ? "bg-emerald-500/5 text-emerald-500" : "bg-destructive/5 text-destructive"
          }`}>
            {test.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            <div>
              <span className="font-semibold">{test.success ? "Success" : "Error Details"}:</span> {test.message}
            </div>
          </div>
        )}

        {/* Expanded Sheets Dashboard Section */}
        {integration.isSheets && (
          <div className="p-6 bg-muted/10 border-t border-border/40">
            {statuses?.googleOAuth?.connected ? (
              <div className="space-y-6">
                {isConnected && !isChangingSheet ? (
                  /* Connected sheet configuration settings */
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                          Connected Spreadsheet
                        </h4>
                        <button
                          onClick={() => setIsChangingSheet(true)}
                          className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> Change Spreadsheet
                        </button>
                      </div>
                      <div className="p-4 rounded-xl border bg-background flex flex-col gap-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground truncate">{integration.sheetName || 'Active Sheet'}</p>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                            {integration.importedCount || 0} Leads Synced
                          </span>
                        </div>
                        {integration.sheetUrl && (
                          <a 
                            href={integration.sheetUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-emerald-500 hover:underline flex items-center gap-1 font-medium"
                          >
                            Open in Google Sheets <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/40 flex items-center justify-between">
                          <span>Last Synced: <strong className="text-foreground">{integration.lastSync ? new Date(integration.lastSync).toLocaleString() : 'Never'}</strong></span>
                        </div>

                        <div className="flex items-center gap-4 mt-1 pt-2 border-t border-border/40">
                          <button
                            onClick={fetchStatus}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" /> Refresh Status
                          </button>
                          <button
                            onClick={handleDisconnectSheet}
                            disabled={actionLoading.disconnectSheet}
                            className="text-xs text-destructive hover:underline flex items-center gap-1 disabled:opacity-50 font-semibold ml-auto"
                          >
                            {actionLoading.disconnectSheet ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Disconnect Sheet
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <CloudLightning className="h-4 w-4 text-emerald-500" />
                        Sync Configuration
                      </h4>
                      <div className="p-4 rounded-xl border bg-background space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Auto-Sync (15 min)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Sync leads continuously in the background.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={integration.autoSync || false} 
                              onChange={(e) => handleToggleAutoSync(e.target.checked)}
                              disabled={actionLoading.toggleSync}
                              className="sr-only peer" 
                            />
                            <div className="w-10 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>

                        <div className="pt-2 border-t border-border/40 flex items-center gap-3">
                          <button
                            onClick={handleImportLeads}
                            disabled={actionLoading.importLeads}
                            className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
                          >
                            {actionLoading.importLeads ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Import Leads
                          </button>
                          <button
                            onClick={handleExportLeads}
                            disabled={actionLoading.exportLeads}
                            className="flex-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-accent disabled:opacity-50 transition-all"
                          >
                            {actionLoading.exportLeads ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Export Leads
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Choose spreadsheet setup methods */
                  <div className="space-y-4">
                    {isConnected && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Currently connected: <strong className="text-foreground">{integration.sheetName}</strong></span>
                        <button onClick={() => setIsChangingSheet(false)} className="text-xs text-muted-foreground hover:text-foreground underline font-medium">Cancel</button>
                      </div>
                    )}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Connect Existing Spreadsheet</h4>
                        
                        {/* Select Spreadsheet Dropdown list */}
                        <div className="space-y-3">
                          <label className="text-xs text-muted-foreground block font-medium">Select sheet from Google Drive:</label>
                          <div className="flex gap-2">
                            <select
                              value={selectedSheetId}
                              onChange={(e) => setSelectedSheetId(e.target.value)}
                              disabled={loadingDriveSheets || driveSheets.length === 0}
                              className="flex-1 px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                            >
                              {loadingDriveSheets ? (
                                <option>Loading your spreadsheets...</option>
                              ) : driveSheets.length === 0 ? (
                                <option>No spreadsheets found in Drive</option>
                              ) : (
                                <>
                                  <option value="">-- Select Spreadsheet --</option>
                                  {driveSheets.map(sheet => (
                                    <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
                                  ))}
                                </>
                              )}
                            </select>
                            <button
                              onClick={handleConnectSelectedSheet}
                              disabled={!selectedSheetId || actionLoading.connectSheet}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-50 transition-all shrink-0"
                            >
                              Connect
                            </button>
                            <button
                              onClick={fetchDriveSpreadsheets}
                              disabled={loadingDriveSheets}
                              title="Refresh sheet list"
                              className="p-2 border rounded-xl bg-background hover:bg-muted text-muted-foreground transition-all flex items-center justify-center shrink-0"
                            >
                              <RefreshCw className={`h-4 w-4 ${loadingDriveSheets ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Manual URL Connect */}
                        <form onSubmit={handleConnectSheetByUrl} className="space-y-3 pt-3 border-t border-border/40">
                          <label className="text-xs text-muted-foreground block font-medium">Or connect manually by spreadsheet URL:</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                              value={sheetUrlInput}
                              onChange={(e) => setSheetUrlInput(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="submit"
                              disabled={!sheetUrlInput || actionLoading.connectSheet}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-50 transition-all shrink-0"
                            >
                              Connect
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="p-6 rounded-2xl border bg-background flex flex-col justify-center items-center text-center space-y-4 shadow-sm">
                        <FileSpreadsheet className="h-10 w-10 text-emerald-500/80" />
                        <div>
                          <h5 className="font-semibold text-sm">Create New Spreadsheet</h5>
                          <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                            Automatically create a formatted Google Sheet in your Drive mapped for CTRForge lead outreach.
                          </p>
                        </div>
                        <button
                          onClick={handleCreateNewSheet}
                          disabled={actionLoading.createSheet}
                          className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                          Create Spreadsheet
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-center gap-2.5 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Please connect your Google Account OAuth credentials above to enable Google Sheets integration.</span>
              </div>
            )}
          </div>
        )}

        {/* Expanded Apify Monitor Section (Admin mode only) */}
        {mode === 'admin' && key === 'apify' && isConnected && (
          <div className="p-6 bg-muted/10 border-t border-border/40">
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-4 text-foreground">
              <Globe className="h-4 w-4 text-sky-400" />
              Apify Run Monitor & Health Status
            </h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Actor Status</span>
                <span className="text-sm font-bold text-foreground mt-1 block">{integration.status || 'Idle'}</span>
              </div>
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Total Runs</span>
                <span className="text-sm font-bold text-foreground mt-1 block">{integration.totalRuns ?? 0}</span>
              </div>
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Failed Runs</span>
                <span className={`text-sm font-bold mt-1 block ${integration.failedRuns && integration.failedRuns > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                  {integration.failedRuns ?? 0}
                </span>
              </div>
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Avg Runtime</span>
                <span className="text-sm font-bold text-foreground mt-1 block">{integration.avgRuntime ?? 0}s</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Last Run</span>
                <span className="text-xs font-semibold text-muted-foreground mt-1 block">
                  {integration.lastRun ? new Date(integration.lastRun).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="p-3 bg-background border border-border/60 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Last Error</span>
                <span className="text-xs font-medium text-destructive mt-1 block truncate" title={integration.lastError || 'None'}>
                  {integration.lastError || 'None detected'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* SECTION 1: Connected Accounts (User Level) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <UserCheck className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Connected Accounts
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage user-specific Google accounts and spreadsheet connections for email outreach and lead sync.
        </p>

        <div className="grid gap-6">
          {userConnectedAccounts.map(renderIntegrationCard)}
        </div>
      </div>

      {/* SECTION 2: Platform Integrations (Admin Only) */}
      {mode === 'admin' && (
        <div className="space-y-4 pt-6 border-t border-border/40">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Platform Integrations (Admin Only)
            </h2>
            <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Restricted Area
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Internal platform services, background crawlers, and AI API integrations configured at the environment level.
          </p>

          <div className="grid gap-6">
            {platformIntegrations.map(renderIntegrationCard)}
          </div>
        </div>
      )}
    </div>
  );
}
