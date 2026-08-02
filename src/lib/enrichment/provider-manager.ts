/**
 * CTRForge Enrichment Pipeline — ProviderManager
 * 
 * Orchestrates all enrichment providers in progressive phases,
 * performs confidence-based merging, handles cost protection rules,
 * and maintains full backward compatibility with the existing scraper.ts contract.
 */

import { EnrichmentContext, EnrichmentResult, Confidence } from './types';
import { YouTubeProvider } from './providers/youtube';
import { ApifyProvider } from './providers/apify';
import { WebsiteCrawlerProvider } from './providers/website-crawler';
import { mergeEnrichmentResults, countSocialLinks } from './merge';
import { enrichmentLog, LogLevel } from './logger';
import { isValidExternalUrl } from './url-utils';

export class ProviderManager {
  /**
   * Main entry point for contact & social links enrichment.
   * Runs providers in parallel phases with cost protection checks.
   * 
   * Pipeline order:
   *   1. Discover creators (already done by route.ts)
   *   2. Complete ALL enrichment (Phase 1 + Phase 2)
   *   3. Merge contacts (confidence-based)
   *   4. Verify data (URL validation)
   *   5. Apply filters (done by route.ts after enrichment)
   * 
   * @param ctx - Context representing the creator
   * @returns Flat record matching crawlCreatorDetails shape
   */
  static async enrichContacts(ctx: EnrichmentContext): Promise<Record<string, any>> {
    const channelId = ctx.channelId;
    enrichmentLog(LogLevel.INFO, 'ProviderManager', channelId, `Starting enrichment flow for: ${ctx.channelName}`);

    // Validate websiteHint before passing to providers
    if (ctx.websiteHint && !isValidExternalUrl(ctx.websiteHint)) {
      enrichmentLog(LogLevel.WARN, 'ProviderManager', channelId, `Filtering invalid websiteHint: ${ctx.websiteHint}`);
      ctx = { ...ctx, websiteHint: '' };
    }

    // Instantiate providers
    const ytProvider = new YouTubeProvider();
    const crawlProvider = new WebsiteCrawlerProvider();
    const apifyProvider = new ApifyProvider();

    // ── Phase 1: Fast Enrichment (Parallel YouTube Scrape + Website Crawl) ──
    enrichmentLog(LogLevel.DEBUG, 'ProviderManager', channelId, 'Phase 1: Running YouTube & Website crawl in parallel');
    const [ytRes, crawlRes] = await Promise.allSettled([
      ytProvider.run(ctx),
      crawlProvider.run(ctx),
    ]);

    const phase1Results: EnrichmentResult[] = [];
    if (ytRes.status === 'fulfilled') phase1Results.push(ytRes.value);
    if (crawlRes.status === 'fulfilled') phase1Results.push(crawlRes.value);

    // Merge Phase 1 results to check progress
    const mergedPhase1 = mergeEnrichmentResults(phase1Results);
    
    // ── Cost Protection Check ──
    // If we already have a verified email, official website, and decent social footprint,
    // we can skip expensive Apify crawls to protect user's credits.
    const hasEmail = !!mergedPhase1.contact_email;
    const hasWebsite = !!mergedPhase1.website;
    const socialCount = countSocialLinks(mergedPhase1);
    
    const shouldSkipApify = hasEmail && hasWebsite && socialCount >= 3;

    let finalResults = [...phase1Results];

    if (shouldSkipApify) {
      enrichmentLog(
        LogLevel.INFO,
        'ProviderManager',
        channelId,
        'Cost protection triggered: Phase 1 found complete profile. Skipping Apify actors.'
      );
    } else {
      // ── Phase 2: Deep Enrichment (Apify Actors) ──
      enrichmentLog(LogLevel.DEBUG, 'ProviderManager', channelId, 'Phase 2: Launching Apify actors');
      
      // Update context with any website discovered in Phase 1
      // Validate that the discovered website is a real external URL
      let discoveredWebsite = mergedPhase1.website || ctx.websiteHint;
      if (discoveredWebsite && !isValidExternalUrl(discoveredWebsite)) {
        enrichmentLog(LogLevel.WARN, 'ProviderManager', channelId, `Filtering invalid website before Phase 2: ${discoveredWebsite}`);
        discoveredWebsite = '';
      }

      const updatedCtx = {
        ...ctx,
        websiteHint: discoveredWebsite || '',
      };

      try {
        const apifyRes = await apifyProvider.run(updatedCtx);
        finalResults.push(apifyRes);
      } catch (apifyErr: any) {
        enrichmentLog(LogLevel.ERROR, 'ProviderManager', channelId, `Apify Provider run crashed: ${apifyErr.message}`);
      }
    }

    // ── Consolidation & Merge ──
    const consolidated = mergeEnrichmentResults(finalResults);
    
    // ── Post-merge validation: ensure website is not a YouTube internal URL ──
    if (consolidated.website && !isValidExternalUrl(consolidated.website)) {
      enrichmentLog(LogLevel.WARN, 'ProviderManager', channelId, `Post-merge: removing invalid website: ${consolidated.website}`);
      consolidated.website = null;
      consolidated.website_found = false;
    }

    enrichmentLog(
      LogLevel.INFO,
      'ProviderManager',
      channelId,
      `Consolidated enrichment metrics: email=${!!consolidated.contact_email}, website=${!!consolidated.website}, socials=${countSocialLinks(consolidated)}`
    );

    return consolidated;
  }
}
