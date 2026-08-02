/**
 * CTRForge Enrichment Pipeline — Intelligent Confidence-Based Merge
 * 
 * Merges results from multiple providers into a single consolidated
 * enrichment record. Higher-confidence data NEVER gets overwritten
 * by lower-confidence data.
 * 
 * Priority chain (highest → lowest):
 *   YouTube About (100) → Verified (100) → Website Email (95)
 *   → Apify Contact (92) → Website Contact Page (90)
 *   → Regex (85) → Google Search (70) → Instagram (60)
 *   → LinkedIn (55) → AI-inferred (35)
 */

import { EnrichmentField, EnrichmentResult, ENRICHMENT_FIELD_NAMES } from './types';

/**
 * Merge a single field: keep the one with higher confidence.
 * If confidence is equal, the later provider (incoming) wins.
 * Null/undefined values never overwrite non-null values regardless of confidence.
 */
function mergeField(
  existing: EnrichmentField | undefined,
  incoming: EnrichmentField | undefined
): EnrichmentField | undefined {
  // If incoming has no value, keep existing
  if (!incoming?.value) return existing;
  // If existing has no value, take incoming
  if (!existing?.value) return incoming;
  // Higher confidence wins; equal confidence = later provider wins
  return incoming.confidence >= existing.confidence ? incoming : existing;
}

/**
 * Merge multiple provider results into a single flat record.
 * 
 * Returns a plain object matching the shape expected by
 * the existing `crawlCreatorDetails()` return type for
 * full backward compatibility.
 * 
 * @param results - Array of EnrichmentResult from all providers
 * @returns Flat merged record with all contact/social fields
 */
export function mergeEnrichmentResults(results: EnrichmentResult[]): Record<string, any> {
  const merged: Record<string, EnrichmentField | undefined> = {};

  // Merge all fields across all successful provider results
  for (const result of results) {
    // Skip failed providers entirely — their data is unreliable
    if (!result._success) continue;

    for (const field of ENRICHMENT_FIELD_NAMES) {
      const incoming = (result as any)[field] as EnrichmentField | undefined;
      if (incoming) {
        merged[field] = mergeField(merged[field], incoming);
      }
    }
  }

  // Flatten EnrichmentField wrappers to plain values
  // This produces the exact same shape as the existing scraper return
  const flat: Record<string, any> = {};
  for (const field of ENRICHMENT_FIELD_NAMES) {
    flat[field] = merged[field]?.value || null;
  }

  // Determine contact_source from the winning email field's source
  flat.contact_source = merged.contact_email?.source || 'N/A';

  // Email verification status (same logic as existing scraper.ts)
  flat.email_verified = !!(flat.contact_email && flat.contact_email.includes('@'));
  flat.website_found = !!flat.website;
  flat.social_links_found = !!(
    flat.instagram || flat.twitter || flat.linkedin ||
    flat.facebook || flat.tiktok || flat.discord
  );

  // Verification status classification (same logic as existing)
  flat.verification_status = 'No Email Found';
  if (flat.contact_email) {
    const emailStr = flat.contact_email.trim().toLowerCase();
    const isGeneric = /@(gmail|yahoo|outlook|hotmail|aol|live|msn|icloud|mail)\.com$/i.test(emailStr);
    flat.verification_status = isGeneric ? 'Likely Email' : 'Verified Email';
  }

  // Lead score calculation (same formula as existing scraper.ts lines 948-958)
  let lead_score = 15;
  if (flat.contact_email) lead_score += 40;
  if (flat.email_verified) lead_score += 10;
  if (flat.website_found) lead_score += 15;
  if (flat.instagram) lead_score += 5;
  if (flat.twitter) lead_score += 5;
  if (flat.linkedin) lead_score += 5;
  if (flat.facebook) lead_score += 5;
  if (flat.phone || flat.contact_form || flat.address) lead_score += 10;
  flat.lead_score = Math.min(100, lead_score);

  return flat;
}

/**
 * Count how many social links were found across merged results.
 * Used by cost protection logic to decide if Apify is needed.
 */
export function countSocialLinks(flat: Record<string, any>): number {
  let count = 0;
  if (flat.instagram) count++;
  if (flat.twitter) count++;
  if (flat.linkedin) count++;
  if (flat.facebook) count++;
  if (flat.tiktok) count++;
  if (flat.discord) count++;
  return count;
}
