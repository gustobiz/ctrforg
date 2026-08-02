import { useState, useEffect, useCallback } from 'react';

export interface PipelineHealthData {
  waitingReply: number;
  followupToday: number;
  overdueFollowup: number;
  interested: number;
  closedWon: number;
  notInterested: number;
}

export interface TimelineData {
  today: {
    opens: number;
    clicks: number;
    replies: number;
    followupsDue: number;
  };
  yesterday: {
    opens: number;
    replies: number;
    interested: number;
  };
}

export interface FunnelData {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  closed: number;
}

export interface TaskItem {
  id: string;
  title: string;
  category: string;
  targetUrl: string;
  priority: 'high' | 'medium' | 'low';
}

export interface FollowupItem {
  id: string;
  leadName: string;
  campaignName: string;
  scheduledTime: string;
  status: string;
  targetUrl: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning';
}

export interface CampaignBreakdown {
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
  interested: number;
  waitingReply: number;
  todayFollowups: number;
  overdue: number;
  won: number;
  lost: number;
}

export interface CampaignInsightInfo {
  healthScore: number;
  insights: string[];
  breakdown: CampaignBreakdown;
}

export interface CampaignIntelligencePayload {
  pipelineHealth: PipelineHealthData;
  timeline: TimelineData;
  funnel: FunnelData;
  todayTasks: TaskItem[];
  upcomingFollowups: {
    today: FollowupItem[];
    tomorrow: FollowupItem[];
    next7Days: FollowupItem[];
  };
  notifications: NotificationItem[];
  campaignInsightsMap: Record<string, CampaignInsightInfo>;
  aiSummary: {
    summaryText: string;
    suggestedActions: string;
  };
}

export function useCampaignIntelligence() {
  const [data, setData] = useState<CampaignIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchIntelligence = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns/intelligence');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch campaign intelligence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntelligence();
    const interval = setInterval(fetchIntelligence, 20000);
    return () => clearInterval(interval);
  }, [fetchIntelligence]);

  return {
    intelligence: data,
    loading,
    refreshIntelligence: fetchIntelligence,
    filter,
    setFilter,
  };
}
