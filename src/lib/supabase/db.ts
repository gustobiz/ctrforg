export const ALLOWED_CRM_FIELDS = [
  'id',
  'user_id',
  'creator_name',
  'channel_name',
  'video_title',
  'video_url',
  'thumbnail_url',
  'subscriber_count',
  'view_count',
  'like_count',
  'published_at',
  'status',
  'created_at',
  'generated_outreach',
  'notes',
  'ai_analysis',
  'email',
  'contact_email',
  'website',
  'instagram',
  'twitter',
  'linkedin',
  'facebook',
  'contact_source',
  'contact_status',
  'sheet_id',
  'csv_batch_id',
  'email_verified',
  'website_found',
  'social_links_found',
  'lead_score',
  'opportunity_score',
  'thumbnail_opportunity',
  'last_updated'
];

const ALLOWED_SET = new Set(ALLOWED_CRM_FIELDS);

/**
 * Utility to parse compact numbers (like "145K", "1.2M", or strings with commas) into clean numeric values for database BIGINT/INT columns.
 */
export function parseToBigIntOrInt(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  const str = val.toString().trim().toUpperCase();
  if (!str) return 0;

  let multiplier = 1;
  let cleanStr = str;

  if (str.endsWith('K')) {
    multiplier = 1000;
    cleanStr = str.slice(0, -1);
  } else if (str.endsWith('M')) {
    multiplier = 1000000;
    cleanStr = str.slice(0, -1);
  } else if (str.endsWith('B')) {
    multiplier = 1000000000;
    cleanStr = str.slice(0, -1);
  }

  // Remove commas or other non-numeric chars
  cleanStr = cleanStr.replace(/,/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
}

/**
 * Strips unknown/undefined columns and casts types cleanly prior to any Supabase insertion or updates.
 * Respects strict whitelist payload requirements, ensuring no unknown fields bypass it.
 */
export function sanitizeCRMLead(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const sanitized: any = {};
  const removedKeys: string[] = [];

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_SET.has(key)) {
      removedKeys.push(key);
      continue;
    }

    const val = payload[key];

    // Strip undefined fields
    if (val === undefined) {
      continue;
    }

    // Handle null values explicitly and safely
    if (val === null) {
      sanitized[key] = null;
      continue;
    }

    // Handle counts
    if (['subscriber_count', 'view_count', 'like_count'].includes(key)) {
      sanitized[key] = parseToBigIntOrInt(val);
      continue;
    }

    // Handle booleans
    if (['email_verified', 'website_found', 'social_links_found'].includes(key)) {
      sanitized[key] = val === true || val === 'true';
      continue;
    }

    // Handle integers
    if (['lead_score', 'opportunity_score', 'thumbnail_opportunity'].includes(key)) {
      sanitized[key] = parseInt(val, 10) || 0;
      continue;
    }

    // Handle JSONB fields (must be valid JSON array/object or null)
    if (key === 'ai_analysis') {
      if (typeof val === 'object') {
        sanitized[key] = val;
      } else if (typeof val === 'string') {
        try {
          sanitized[key] = JSON.parse(val);
        } catch {
          sanitized[key] = val.trim() ? { value: val } : {};
        }
      } else {
        sanitized[key] = val;
      }
      continue;
    }

    // Handle all other text/standard fields
    sanitized[key] = val.toString();
  }

  if (removedKeys.length > 0) {
    console.warn(`[Supabase CRM Sanitization] Stripped unknown/invalid DB fields from crm_leads insertion payload:`, removedKeys);
  }

  return sanitized;
}

/**
 * Backward compatibility alias for sanitizeCRMLead.
 */
export function sanitizeLeadForDB(payload: any): any {
  return sanitizeCRMLead(payload);
}

/**
 * Centralized explicit mapper that extracts incoming payload variables and packs all dynamic
 * AI-generated fields (including emotional_tone, notes, and generated_outreach) into the unified ai_analysis JSONB column.
 * NEVER creates dynamic top-level keys.
 */
export function mapRawToCrmPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  // Construct explicitly mapped base columns only
  const mapped: any = {
    user_id: raw.user_id,
    creator_name: raw.creator_name || raw.creatorName || "",
    channel_name: raw.channel_name || raw.channelName || null,
    video_title: raw.video_title || raw.videoTitle || null,
    video_url: raw.video_url || raw.videoUrl || null,
    thumbnail_url: raw.thumbnail_url || raw.thumbnailUrl || null,
    subscriber_count: raw.subscriber_count !== undefined ? raw.subscriber_count : (raw.subs || null),
    view_count: raw.view_count !== undefined ? raw.view_count : (raw.views || null),
    like_count: raw.like_count !== undefined ? raw.like_count : (raw.likes || null),
    published_at: raw.published_at || raw.publishedAt || null,
    status: raw.status || "new",
    generated_outreach: raw.generated_outreach || raw.generatedOutreach || "",
    notes: raw.notes || "",
    email: raw.email || raw.contact_email || raw.ai_analysis?.contact_email || raw.ai_analysis?.email || null,
    
    // New contact columns
    contact_email: raw.contact_email || raw.email || raw.ai_analysis?.contact_email || raw.ai_analysis?.email || null,
    website: raw.website || raw.ai_analysis?.website || null,
    instagram: raw.instagram || raw.ai_analysis?.instagram || null,
    twitter: raw.twitter || raw.ai_analysis?.twitter || null,
    linkedin: raw.linkedin || raw.ai_analysis?.linkedin || null,
    facebook: raw.facebook || raw.ai_analysis?.facebook || null,
    contact_source: raw.contact_source || raw.ai_analysis?.contact_source || 'youtube_scraping',
    contact_status: raw.contact_status || raw.ai_analysis?.contact_status || 'discovered',
    
    // Scoring metrics
    email_verified: raw.email_verified !== undefined ? raw.email_verified : (raw.ai_analysis?.email_verified || false),
    website_found: raw.website_found !== undefined ? raw.website_found : (raw.ai_analysis?.website_found || false),
    social_links_found: raw.social_links_found !== undefined ? raw.social_links_found : (raw.ai_analysis?.social_links_found || false),
    lead_score: raw.lead_score !== undefined ? raw.lead_score : (raw.ai_analysis?.lead_score || 0),
    opportunity_score: raw.opportunity_score !== undefined ? raw.opportunity_score : (raw.score || raw.ai_analysis?.opportunity_score || 65),
    thumbnail_opportunity: raw.thumbnail_opportunity !== undefined ? raw.thumbnail_opportunity : (raw.ai_analysis?.thumbnail_opportunity || 0),
    last_updated: raw.last_updated || new Date().toISOString()
  };

  // Carry over ID or created_at if already specified
  if (raw.id) mapped.id = raw.id;
  if (raw.created_at) mapped.created_at = raw.created_at;

  // Explicitly pack emotional_tone and all dynamic AI-generated analysis fields into the unified ai_analysis JSONB
  mapped.ai_analysis = {
    // Dynamic fields requested to be packed only inside JSONB
    notes: raw.notes || "",
    generated_outreach: raw.generated_outreach || raw.generatedOutreach || "",
    emotional_tone: raw.emotional_tone || raw.emotionalTone || "",
    audience_positioning: raw.audience_positioning || raw.audiencePositioning || null,
    optimized_titles: raw.optimized_titles || raw.titleIdeas || [],
    transcript_snippets: raw.transcript_snippets || raw.transcriptSnippets || [],
    repeated_phrases: raw.repeated_phrases || raw.repeatedPhrases || [],
    ctr_weaknesses: raw.ctr_weaknesses || raw.detectedWeaknesses || [],

    // Additional deep intelligence fields
    exact_hook: raw.exact_hook || raw.exactHook || "",
    top_emotional_words: raw.top_emotional_words || raw.topEmotionalWords || [],
    most_repeated_phrases: raw.most_repeated_phrases || raw.mostRepeatedPhrases || [],
    curiosity_loops: raw.curiosity_loops || raw.curiosityLoops || [],
    audience_type: raw.audience_type || raw.audienceType || "",
    retention_style: raw.retention_style || raw.retentionStyle || "",
    cta_style: raw.cta_style || raw.ctaStyle || "",
    high_converting_phrases: raw.high_converting_phrases || raw.highConvertingPhrases || [],
    
    // Additional UI pipeline parameters
    platform: raw.platform || "email",
    score: raw.score !== undefined ? raw.score : 65,
    title_patterns: raw.title_patterns || raw.titlePatterns || "",
    hook_analysis: raw.hook_analysis || raw.hookAnalysis || "",
    channel_url: raw.channel_url || raw.channelUrl || "",
    cta_opportunities: raw.cta_opportunities || raw.ctaOpportunities || [],
    suggested_hook: raw.suggested_hook || raw.suggestedHook || "",
    creator_niche: raw.creator_niche || raw.creatorNiche || "",
    
    // Estimated CTR Metrics
    packaging_score: raw.packaging_score !== undefined ? raw.packaging_score : (raw.packagingScore !== undefined ? raw.packagingScore : null),
    estimated_ctr_range: raw.estimated_ctr_range || raw.estimatedCtrRange || null,
    ctr_gain_potential: raw.ctr_gain_potential || raw.ctrGainPotential || null,
    packaging_efficiency: raw.packaging_efficiency !== undefined ? raw.packaging_efficiency : (raw.packagingEfficiency !== undefined ? raw.packagingEfficiency : null),
    subscriber_velocity: raw.subscriber_velocity || raw.subscriberVelocity || null,

    // Duplicate sync variables inside JSONB for safe fallbacks
    contact_email: mapped.contact_email,
    website: mapped.website,
    instagram: mapped.instagram,
    twitter: mapped.twitter,
    linkedin: mapped.linkedin,
    facebook: mapped.facebook,
    contact_source: mapped.contact_source,
    contact_status: mapped.contact_status,
    email_verified: mapped.email_verified,
    website_found: mapped.website_found,
    social_links_found: mapped.social_links_found,
    lead_score: mapped.lead_score,
    opportunity_score: mapped.opportunity_score,
    thumbnail_opportunity: mapped.thumbnail_opportunity,
    last_updated: mapped.last_updated
  };

  return mapped;
}

/**
 * Formats standard integers back to their compact form (like "145.2K", "1.2M") for consistent CRM UI display.
 */
export function formatCompactNumber(num: any): string {
  if (num === undefined || num === null) return "";
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n) || n === 0) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}
