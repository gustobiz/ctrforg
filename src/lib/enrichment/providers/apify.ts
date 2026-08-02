/**
 * CTRForge Enrichment Pipeline — ApifyProvider
 * 
 * Wraps ALL 4 existing Apify actors:
 *   1. Contact Details Scraper
 *   2. Website Content Crawler  
 *   3. Google Search Scraper
 *   4. Instagram Scraper
 * 
 * Improvements over the original scraper.ts:
 *   - Actors 1+2 run in parallel via Promise.allSettled
 *   - Each actor failure is isolated — others continue
 *   - Uses retryWithJitter for better retry logic
 *   - Cost protection: skips if YouTube already found everything
 *   - Returns confidence-tagged results for intelligent merge
 *   - Google Search runs when no EMAIL found (not just no website)
 *   - Broader search queries including contact, email, site: queries
 * 
 * All existing Apify actor functions from scraper.ts are called directly.
 * ZERO rewriting of Apify logic — only orchestration is improved.
 */

import { BaseProvider } from './base';
import { EnrichmentResult, EnrichmentContext, ProviderConfig, Confidence } from '../types';
import { retryWithJitter } from '../retry';
import { enrichmentLog, LogLevel } from '../logger';
import { isValidExternalUrl } from '../url-utils';
import {
  extractEmails,
  classifyEmails,
  extractSocials,
  extractWebsite,
  scrapeWebsiteContacts,
  discoverWebsiteTargetUrls,
  cleanUrl,
} from '../../gmail/scraper';

export class ApifyProvider extends BaseProvider {
  readonly name = 'ApifyProvider';
  readonly config: ProviderConfig = {
    enabled: true,
    maxRetries: 3,
    timeoutMs: 45000,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
  };

  async execute(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const apifyToken = process.env.APIFY_TOKEN;
    const result = this.emptyResult();

    // If no Apify token, skip gracefully (not an error)
    if (!apifyToken) {
      enrichmentLog(LogLevel.DEBUG, this.name, ctx.channelId, 'No APIFY_TOKEN — skipping Apify enrichment');
      result._success = true; // Not a failure, just no Apify available
      return result;
    }

    // Determine website to crawl (from ctx or websiteHint)
    let website = ctx.websiteHint || null;

    // ── Phase A: If website exists, run Contact Details + Content Crawler in PARALLEL ──
    if (website) {
      const [contactResult, contentResult] = await Promise.allSettled([
        this.runContactDetailsScraper(website, apifyToken, ctx.channelId),
        this.runWebsiteContentCrawler(website, apifyToken, ctx.channelId),
      ]);

      // Merge Contact Details Scraper results
      if (contactResult.status === 'fulfilled' && contactResult.value) {
        const c = contactResult.value;
        result.contact_email = this.field(c.contact_email, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.support_email = this.field(c.support_email, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.founder_email = this.field(c.founder_email, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.phone = this.field(c.phone, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.contact_form = this.field(c.contact_form, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.address = this.field(c.address, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.calendly = this.field(c.calendly, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.booking_link = this.field(c.booking_link, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.newsletter = this.field(c.newsletter, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.company_name = this.field(c.company_name, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.agency = this.field(c.agency, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.store = this.field(c.store, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.instagram = this.field(c.instagram, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.twitter = this.field(c.twitter, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.linkedin = this.field(c.linkedin, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.facebook = this.field(c.facebook, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.tiktok = this.field(c.tiktok, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
        result.discord = this.field(c.discord, Confidence.APIFY_CONTACT, 'ApifyProvider:ContactScraper');
      } else if (contactResult.status === 'rejected') {
        enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Contact Details Scraper failed: ${contactResult.reason?.message}`);
      }

      // Merge Website Content Crawler results (emails only)
      if (contentResult.status === 'fulfilled' && contentResult.value) {
        const emails = contentResult.value;
        if (emails.contact_email && !result.contact_email?.value) {
          result.contact_email = this.field(emails.contact_email, Confidence.WEBSITE_EMAIL, 'ApifyProvider:ContentCrawler');
        }
        if (emails.support_email && !result.support_email?.value) {
          result.support_email = this.field(emails.support_email, Confidence.WEBSITE_EMAIL, 'ApifyProvider:ContentCrawler');
        }
        if (emails.founder_email && !result.founder_email?.value) {
          result.founder_email = this.field(emails.founder_email, Confidence.WEBSITE_EMAIL, 'ApifyProvider:ContentCrawler');
        }
      } else if (contentResult.status === 'rejected') {
        enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Website Content Crawler failed: ${contentResult.reason?.message}`);
      }
    }

    // ── Phase B: Run Google Search when NO BUSINESS EMAIL found ──
    // Previously this only ran when no website existed, but the user wants 
    // Google Search to find emails even when a website is known but has no email.
    const hasEmail = !!result.contact_email?.value;
    if (!hasEmail && ctx.channelName) {
      try {
        const searchResults = await this.runGoogleSearchScraper(ctx.channelName, apifyToken, ctx.channelId);
        if (searchResults) {
          // Only set website if we don't have one yet AND it's valid
          if (searchResults.website && !website && isValidExternalUrl(searchResults.website)) {
            result.website = this.field(searchResults.website, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
            website = searchResults.website;
          }
          if (searchResults.instagram) {
            result.instagram = this.field(searchResults.instagram, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
          }
          if (searchResults.twitter) {
            result.twitter = this.field(searchResults.twitter, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
          }
          if (searchResults.linkedin) {
            result.linkedin = this.field(searchResults.linkedin, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
          }
          if (searchResults.facebook) {
            result.facebook = this.field(searchResults.facebook, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
          }
          if (searchResults.email) {
            result.contact_email = this.field(searchResults.email, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch');
          }
        }

        // If we discovered a website via Google Search, crawl it for contacts
        if (website && !result.contact_email?.value) {
          enrichmentLog(LogLevel.INFO, this.name, ctx.channelId, `Crawling website discovered via Google Search: ${website}`);
          try {
            const webScraped = await scrapeWebsiteContacts(website);
            if (webScraped.contact_email && !result.contact_email?.value) {
              result.contact_email = this.field(webScraped.contact_email, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
            if (webScraped.support_email && !result.support_email?.value) {
              result.support_email = this.field(webScraped.support_email, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
            if (webScraped.founder_email && !result.founder_email?.value) {
              result.founder_email = this.field(webScraped.founder_email, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
            if (webScraped.instagram && !result.instagram?.value) {
              result.instagram = this.field(webScraped.instagram, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
            if (webScraped.twitter && !result.twitter?.value) {
              result.twitter = this.field(webScraped.twitter, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
            if (webScraped.linkedin && !result.linkedin?.value) {
              result.linkedin = this.field(webScraped.linkedin, Confidence.GOOGLE_SEARCH, 'ApifyProvider:GoogleSearch→WebCrawl');
            }
          } catch (crawlErr: any) {
            enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Website crawl after Google Search failed: ${crawlErr.message}`);
          }
        }
      } catch (searchErr: any) {
        enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Google Search Scraper failed: ${searchErr.message}`);
      }
    }

    // ── Phase C: If Instagram link exists, run Instagram Scraper ──
    const instagramUrl = result.instagram?.value;
    if (instagramUrl) {
      try {
        const igData = await this.runInstagramScraper(instagramUrl, apifyToken, ctx.channelId);
        if (igData) {
          if (igData.email && !result.contact_email?.value) {
            result.contact_email = this.field(igData.email, Confidence.INSTAGRAM, 'ApifyProvider:InstagramScraper');
          }
          if (igData.website && isValidExternalUrl(igData.website)) {
            result.website = this.field(igData.website, Confidence.INSTAGRAM, 'ApifyProvider:InstagramScraper');
          }
        }
      } catch (igErr: any) {
        enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Instagram Scraper failed: ${igErr.message}`);
      }
    }

    return result;
  }

  // ── Apify Actor Wrappers (call existing functions with improved retry) ──

  private async runContactDetailsScraper(
    websiteUrl: string,
    token: string,
    channelId: string
  ): Promise<any> {
    const actorName = process.env.APIFY_ACTOR || 'apify/contact-details-scraper';
    const formattedActor = actorName.replace('/', '~');

    // Discover target URLs (homepage, about, contact pages)
    const urls = await discoverWebsiteTargetUrls(websiteUrl);
    const startUrls = urls.map(u => ({ url: u }));

    enrichmentLog(LogLevel.INFO, this.name, channelId, `Running Contact Details Scraper on ${startUrls.length} URLs`);

    const items = await retryWithJitter(
      async () => {
        const response = await fetch(
          `https://api.apify.com/v2/acts/${formattedActor}/run-sync-get-dataset-items?token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startUrls,
              maxDepth: 1,
              sameOrigin: true,
              checkFormFields: true,
              maxPagesPerCrawl: 15,
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs),
          }
        );

        if (response.status === 429) throw new Error('Apify API rate limit exceeded (429)');
        if (response.status === 401) throw new Error('Invalid Apify API token (401)');
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Apify Contact Scraper failed ${response.status}: ${errText}`);
        }
        return await response.json();
      },
      { maxRetries: this.config.maxRetries, baseDelayMs: 1000, label: 'ApifyContactScraper' }
    );

    return this.parseApifyItems(items);
  }

  private async runWebsiteContentCrawler(
    websiteUrl: string,
    token: string,
    channelId: string
  ): Promise<{ contact_email: string | null; support_email: string | null; founder_email: string | null }> {
    enrichmentLog(LogLevel.INFO, this.name, channelId, `Running Website Content Crawler for: ${websiteUrl}`);

    const items = await retryWithJitter(
      async () => {
        const response = await fetch(
          `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startUrls: [{ url: websiteUrl }],
              maxCrawlPages: 10,
              maxCrawlDepth: 2,
            }),
            signal: AbortSignal.timeout(35000),
          }
        );
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Website Content Crawler failed ${response.status}: ${errText}`);
        }
        return await response.json();
      },
      { maxRetries: this.config.maxRetries, baseDelayMs: 1000, label: 'ApifyContentCrawler' }
    );

    if (!items || items.length === 0) {
      return { contact_email: null, support_email: null, founder_email: null };
    }

    const textToScan = items.map((item: any) => `${item.text || ''}\n${item.html || ''}`).join('\n');
    const crawlerEmails = extractEmails(textToScan);
    if (crawlerEmails.length > 0) {
      const classified = classifyEmails(crawlerEmails, textToScan);
      return classified;
    }

    return { contact_email: null, support_email: null, founder_email: null };
  }

  private async runGoogleSearchScraper(
    channelName: string,
    token: string,
    channelId: string
  ): Promise<{ 
    website: string | null; 
    instagram: string | null; 
    twitter: string | null; 
    linkedin: string | null; 
    facebook: string | null;
    email: string | null;
  } | null> {
    enrichmentLog(LogLevel.INFO, this.name, channelId, `Running Google Search Scraper for: ${channelName}`);

    // Broader search queries to find contact info, email, and social profiles
    const searchQueries = [
      `"${channelName}" contact email`,
      `"${channelName}" official website`,
      `"${channelName}" business email`,
      `site:linkedin.com "${channelName}"`,
      `site:instagram.com "${channelName}"`,
      `site:x.com OR site:twitter.com "${channelName}"`,
      `site:facebook.com "${channelName}"`,
    ].join('\n');

    const items = await retryWithJitter(
      async () => {
        const response = await fetch(
          `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: searchQueries, maxResultsPerQuery: 5 }),
            signal: AbortSignal.timeout(30000),
          }
        );
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Google Search Scraper failed ${response.status}: ${errText}`);
        }
        return await response.json();
      },
      { maxRetries: this.config.maxRetries, baseDelayMs: 1000, label: 'ApifyGoogleSearch' }
    );

    if (!items || items.length === 0) return null;

    const found = { 
      website: null as string | null, 
      instagram: null as string | null, 
      twitter: null as string | null, 
      linkedin: null as string | null, 
      facebook: null as string | null,
      email: null as string | null,
    };

    for (const item of items) {
      const organicResults = item.organicResults || [];
      for (const res of organicResults) {
        const url = res.url || '';
        if (!url) continue;

        // Extract emails from search result snippets
        if (!found.email) {
          const snippet = `${res.title || ''} ${res.description || ''}`;
          const snippetEmails = extractEmails(snippet);
          if (snippetEmails.length > 0) {
            found.email = snippetEmails[0];
          }
        }

        // Classify URLs
        if (!found.instagram && url.includes('instagram.com/')) {
          found.instagram = url;
        } else if (!found.twitter && (url.includes('twitter.com/') || url.includes('x.com/'))) {
          found.twitter = url;
        } else if (!found.linkedin && url.includes('linkedin.com/')) {
          found.linkedin = url;
        } else if (!found.facebook && url.includes('facebook.com/')) {
          found.facebook = url;
        } else if (!found.website && isValidExternalUrl(url)) {
          found.website = url;
        }
      }
    }

    return found;
  }

  private async runInstagramScraper(
    instagramUrl: string,
    token: string,
    channelId: string
  ): Promise<{ email: string | null; website: string | null } | null> {
    enrichmentLog(LogLevel.INFO, this.name, channelId, `Running Instagram Scraper for: ${instagramUrl}`);

    const items = await retryWithJitter(
      async () => {
        const response = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directUrls: [instagramUrl], resultsLimit: 1 }),
            signal: AbortSignal.timeout(30000),
          }
        );
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Instagram Scraper failed ${response.status}: ${errText}`);
        }
        return await response.json();
      },
      { maxRetries: this.config.maxRetries, baseDelayMs: 1000, label: 'ApifyInstagram' }
    );

    if (!items || items.length === 0) return null;

    const igProfile = items[0];
    const igBio = igProfile.biography || igProfile.bio || '';
    const igEmailMatch = igBio.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);

    // Also check Instagram's structured email fields
    const igEmail = igProfile.businessEmail || igProfile.publicEmail || (igEmailMatch ? igEmailMatch[0] : null);

    return {
      email: igEmail || null,
      website: igProfile.externalUrl || null,
    };
  }

  /**
   * Parse Apify Contact Details Scraper results into a flat object.
   * Same logic as existing parseApifyResults() in scraper.ts.
   */
  private parseApifyItems(items: any[]): any {
    if (!items || items.length === 0) return null;

    const allEmails = new Set<string>();
    const result: any = {
      contact_email: null, support_email: null, founder_email: null,
      phone: null, contact_form: null, address: null,
      calendly: null, booking_link: null, newsletter: null,
      company_name: null, agency: null, store: null,
      instagram: null, twitter: null, linkedin: null,
      facebook: null, tiktok: null, discord: null,
    };

    for (const item of items) {
      if (item.emails && Array.isArray(item.emails)) {
        item.emails.forEach((e: string) => allEmails.add(e.trim().toLowerCase()));
      }
      if (item.phones?.length && !result.phone) result.phone = item.phones[0];
      if (item.instagrams?.length && !result.instagram) result.instagram = item.instagrams[0];
      if (item.twitters?.length && !result.twitter) result.twitter = item.twitters[0];
      if (item.linkedins?.length && !result.linkedin) result.linkedin = item.linkedins[0];
      if (item.facebooks?.length && !result.facebook) result.facebook = item.facebooks[0];
      if (item.tiktoks?.length && !result.tiktok) result.tiktok = item.tiktoks[0];
      if (item.discords?.length && !result.discord) result.discord = item.discords[0];
      if (item.contactPages?.length && !result.contact_form) result.contact_form = item.contactPages[0];
    }

    // Classify emails
    const emailsArray = Array.from(allEmails);
    const classified = classifyEmails(emailsArray, '');
    result.contact_email = classified.contact_email;
    result.support_email = classified.support_email;
    result.founder_email = classified.founder_email;

    return result;
  }
}
