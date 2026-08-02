export interface GmailConnection {
  id: string; // UUID
  user_id: string; // UUID
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string; // ISO timestamp
  scopes: string;
  status: 'active' | 'expired' | 'revoked';
  connected_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface EmailTemplate {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  subject: string;
  html_body: string;
  text_body?: string | null;
  variables: string[]; // JSONB array of strings
  is_default: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface EmailCampaign {
  id: string; // UUID
  user_id: string; // UUID
  lead_id?: string | null; // UUID
  template_id?: string | null; // UUID
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  to_email: string;
  subject: string;
  html_body: string;
  text_body?: string | null;
  status: 'draft' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced';
  is_followup: boolean;
  followup_number: number;
  parent_campaign_id?: string | null; // UUID
  total_opens: number;
  total_clicks: number;
  sent_at: string; // ISO timestamp
  opened_at?: string | null; // ISO timestamp
  clicked_at?: string | null; // ISO timestamp
  replied_at?: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
}

export interface EmailEvent {
  id: string; // UUID
  campaign_id: string; // UUID
  user_id: string; // UUID
  lead_id?: string | null; // UUID
  event_type: 'open' | 'click' | 'reply' | 'bounce';
  url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string; // ISO timestamp
}

export interface FollowupSequence {
  id: string; // UUID
  user_id: string; // UUID
  lead_id: string; // UUID
  campaign_id?: string | null; // UUID
  rule_type: 'not_opened' | 'opened_not_clicked' | 'clicked_not_replied';
  delay_days: number;
  followup_number: number;
  status: 'pending' | 'sent' | 'cancelled' | 'skipped';
  scheduled_at: string; // ISO timestamp
  sent_at?: string | null; // ISO timestamp
  generated_content?: string | null;
  created_at: string; // ISO timestamp
}
