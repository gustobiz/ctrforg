"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AnalysisResult = {
  creatorName: string;
  channelName: string;
  videoTitle: string;
  detectedWeaknesses: string[];
  titlePatterns: string;
  hookAnalysis: string;
  emotionalTone: string;
  creatorNiche: string;
  videoUrl: string;
  channelUrl: string;
  transcriptSnippets: string[];
  repeatedPhrases: string[];
  ctaOpportunities: string[];
  subs: string;
  views: string;
  score: number;
  likes?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  titleIdeas?: string[];
  suggestedHook?: string;
  audiencePositioning?: string;
  
  // Deep Creator Intelligence
  exactHook?: string;
  topEmotionalWords?: string[];
  mostRepeatedPhrases?: string[];
  curiosityLoops?: string[];
  audienceType?: string;
  retentionStyle?: string;
  ctaStyle?: string;
  highConvertingPhrases?: string[];
  generatedOutreach?: string;
  estimatedCtrRange?: string;
  ctrGainPotential?: string;
};

export type CrmLead = {
  id: string;
  name: string;
  niche: string;
  status: "new" | "researching" | "contacted" | "follow_up" | "interested" | "closed";
  date: string;
  notes: string;
  platform: string;
  email?: string;
  contact_email?: string;
  website?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  contact_source?: string;
  contact_status?: string;
  email_verified?: boolean;
  website_found?: boolean;
  social_links_found?: boolean;
  lead_score?: number;
  opportunity_score?: number;
  thumbnail_opportunity?: number;
  last_updated?: string;
  analysis?: AnalysisResult | null;
};

type AppState = {
  currentAnalysis: AnalysisResult | null;
  setCurrentAnalysis: (data: AnalysisResult | null) => void;
  crmLeads: CrmLead[];
  setCrmLeads: (leads: CrmLead[]) => void;
  addCrmLead: (lead: Omit<CrmLead, 'id'>) => void;
  updateCrmLeadStatus: (id: string, status: CrmLead["status"]) => void;
  transferToOutreach: (analysis: AnalysisResult) => void;
  outreachContext: AnalysisResult | null;
  clearOutreachContext: () => void;
};

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentAnalysis, setCurrentAnalysisState] = useState<AnalysisResult | null>(null);
  const [outreachContext, setOutreachContextState] = useState<AnalysisResult | null>(null);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);

  const addCrmLead = (lead: Omit<CrmLead, 'id'>) => {
    const newLead = { ...lead, id: Math.random().toString(36).substring(7) };
    setCrmLeads((prev) => {
      const updated = [newLead, ...prev];
      if (typeof window !== "undefined") {
        localStorage.setItem("crm_leads", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const updateCrmLeadStatus = (id: string, status: CrmLead["status"]) => {
    setCrmLeads((prev) => {
      const updated = prev.map(lead => lead.id === id ? { ...lead, status } : lead);
      if (typeof window !== "undefined") {
        localStorage.setItem("crm_leads", JSON.stringify(updated));
      }
      return updated;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedAnalysis = localStorage.getItem("current_analysis");
        if (cachedAnalysis) {
          const parsed = JSON.parse(cachedAnalysis);
          if (parsed && typeof parsed === 'object') {
            setCurrentAnalysisState(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to parse current_analysis from localStorage:", e);
      }

      try {
        const cachedOutreach = localStorage.getItem("outreach_context");
        if (cachedOutreach) {
          const parsed = JSON.parse(cachedOutreach);
          if (parsed && typeof parsed === 'object') {
            setOutreachContextState(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to parse outreach_context from localStorage:", e);
      }

      try {
        const cachedLeads = localStorage.getItem("crm_leads");
        if (cachedLeads) {
          const parsed = JSON.parse(cachedLeads);
          if (Array.isArray(parsed)) {
            setCrmLeads(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to parse crm_leads from localStorage:", e);
      }
    }
  }, []);

  const setCurrentAnalysis = (data: AnalysisResult | null) => {
    setCurrentAnalysisState(data);
    if (typeof window !== "undefined") {
      if (data) {
        localStorage.setItem("current_analysis", JSON.stringify(data));
      } else {
        localStorage.removeItem("current_analysis");
      }
    }
  };

  const transferToOutreach = (analysis: AnalysisResult) => {
    setOutreachContextState(analysis);
    if (typeof window !== "undefined") {
      localStorage.setItem("outreach_context", JSON.stringify(analysis));
    }
  };

  const clearOutreachContext = () => {
    setOutreachContextState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("outreach_context");
    }
  };

  return (
    <AppContext.Provider value={{
      currentAnalysis,
      setCurrentAnalysis,
      crmLeads,
      setCrmLeads,
      addCrmLead,
      updateCrmLeadStatus,
      transferToOutreach,
      outreachContext,
      clearOutreachContext
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppStore must be used within an AppProvider");
  }
  return context;
}
