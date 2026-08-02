/**
 * CTRForge Enrichment Pipeline — Shared Types
 * 
 * Defines the contract between all providers, the merge system,
 * and the ProviderManager orchestrator.
 */

// Confidence levels for merge priority (higher = more trustworthy)
// Used by merge.ts to decide which data source wins on conflict
//
// Priority chain (highest → lowest):
//   YouTube Business Email (100) → Official Website Email (95)
//   → Apify Contact Details (92) → Website Contact Page (90)
//   → LinkedIn (85) → Instagram (80) → Google Search (70)
//   → Regex (50) → AI-inferred (35)
export enum Confidence {
  UNKNOWN = 0,
  GEMINI_AI = 35,           // AI-inferred data (lower confidence than scraped)
  LINKEDIN = 55,            // LinkedIn profile data
  INSTAGRAM = 60,           // Apify Instagram Scraper
  GOOGLE_SEARCH = 70,       // Apify Google Search results
  REGEX = 85,               // Regex from description text
  WEBSITE_CONTACT_PAGE = 90,// Email found on website contact/about page (local crawl)
  APIFY_CONTACT = 92,       // Apify Contact Details Scraper
  WEBSITE_EMAIL = 95,       // Email found on Official Website homepage
  YOUTUBE_ABOUT = 100,      // YouTube structured data / About page business email
  VERIFIED = 100,           // Human-verified / existing DB data
}

/**
 * A single enrichment data point with provenance tracking.
 * Every field returned by a provider wraps its value with
 * the confidence level and source identifier.
 */
export interface EnrichmentField<T = string | null> {
  value: T;
  confidence: Confidence;
  source: string; // e.g. "YouTubeProvider", "ApifyProvider:ContactScraper"
}

/**
 * Standardized result shape every provider returns.
 * All contact/social fields are optional EnrichmentField wrappers.
 * Provider metadata fields (prefixed with _) track execution details.
 */
export interface EnrichmentResult {
  // Contact fields
  contact_email?: EnrichmentField;
  support_email?: EnrichmentField;
  founder_email?: EnrichmentField;

  // Web presence
  website?: EnrichmentField;
  
  // Social links
  instagram?: EnrichmentField;
  twitter?: EnrichmentField;
  linkedin?: EnrichmentField;
  facebook?: EnrichmentField;
  tiktok?: EnrichmentField;
  discord?: EnrichmentField;

  // Additional contact details
  phone?: EnrichmentField;
  contact_form?: EnrichmentField;
  address?: EnrichmentField;
  calendly?: EnrichmentField;
  booking_link?: EnrichmentField;
  newsletter?: EnrichmentField;
  company_name?: EnrichmentField;
  agency?: EnrichmentField;
  store?: EnrichmentField;

  // Provider execution metadata
  _provider: string;
  _durationMs: number;
  _success: boolean;
  _error?: string;
}

/**
 * Configuration for each provider instance.
 */
export interface ProviderConfig {
  enabled: boolean;
  maxRetries: number;
  timeoutMs: number;
  cacheTtlMs: number;
}

/**
 * Context passed to every provider containing all known
 * information about the creator being enriched.
 */
export interface EnrichmentContext {
  channelId: string;
  channelName: string;
  channelDescription: string;
  videoDescription: string;
  websiteHint: string;       // Website from YouTube API brandingSettings if any
  subscriberCount: number;
  averageViews: number;
  latestVideoTitle: string;
  latestVideoUrl: string;
  thumbnailUrl: string;
  uploadFrequency: string;
  channelAge: string;
  handle?: string;           // Optional channel handle (@handle)
}

/**
 * All enrichment field names that providers can populate.
 * Used by merge.ts to iterate over fields generically.
 */
export const ENRICHMENT_FIELD_NAMES = [
  'contact_email', 'support_email', 'founder_email', 'website',
  'instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'discord',
  'phone', 'contact_form', 'address', 'calendly', 'booking_link',
  'newsletter', 'company_name', 'agency', 'store'
] as const;

export type EnrichmentFieldName = typeof ENRICHMENT_FIELD_NAMES[number];
