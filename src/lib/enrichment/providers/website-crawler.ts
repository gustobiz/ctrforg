/**
 * CTRForge Enrichment Pipeline — WebsiteCrawlerProvider
 * 
 * Performs a local fetch and regex scrape of the creator's website.
 * Crawls:
 *   - Homepage
 *   - /about, /about-us, /team
 *   - /contact, /contact-us
 *   - /privacy, /terms
 * 
 * Reuses the existing `scrapeWebsiteContacts` logic from scraper.ts
 * to guarantee complete backward compatibility while assigning it
 * Website Contact Page confidence level.
 */

import { BaseProvider } from './base';
import { EnrichmentResult, EnrichmentContext, ProviderConfig, Confidence } from '../types';
import { scrapeWebsiteContacts } from '../../gmail/scraper';
import { isValidExternalUrl } from '../url-utils';
import { enrichmentLog, LogLevel } from '../logger';

export class WebsiteCrawlerProvider extends BaseProvider {
  readonly name = 'WebsiteCrawlerProvider';
  readonly config: ProviderConfig = {
    enabled: true,
    maxRetries: 1,
    timeoutMs: 15000,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
  };

  async execute(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const result = this.emptyResult();
    const websiteUrl = ctx.websiteHint || null;

    if (!websiteUrl) {
      enrichmentLog(LogLevel.DEBUG, this.name, ctx.channelId, 'No website URL available for local crawling');
      return result;
    }

    // Validate the website URL before crawling
    if (!isValidExternalUrl(websiteUrl)) {
      enrichmentLog(LogLevel.WARN, this.name, ctx.channelId, `Skipping invalid/internal URL: ${websiteUrl}`);
      return result;
    }

    try {
      enrichmentLog(LogLevel.INFO, this.name, ctx.channelId, `Launching local website crawl for: ${websiteUrl}`);
      
      // Call the existing crawl logic directly to ensure no functionality is changed or lost
      const webScraped = await scrapeWebsiteContacts(websiteUrl);

      if (webScraped) {
        // Tag found contacts with WEBSITE_CONTACT_PAGE confidence
        result.contact_email = this.field(webScraped.contact_email, Confidence.WEBSITE_CONTACT_PAGE);
        result.support_email = this.field(webScraped.support_email, Confidence.WEBSITE_CONTACT_PAGE);
        result.founder_email = this.field(webScraped.founder_email, Confidence.WEBSITE_CONTACT_PAGE);
        
        result.phone = this.field(webScraped.phone, Confidence.WEBSITE_CONTACT_PAGE);
        result.contact_form = this.field(webScraped.contact_form, Confidence.WEBSITE_CONTACT_PAGE);
        result.address = this.field(webScraped.address, Confidence.WEBSITE_CONTACT_PAGE);
        result.calendly = this.field(webScraped.calendly, Confidence.WEBSITE_CONTACT_PAGE);
        result.booking_link = this.field(webScraped.booking_link, Confidence.WEBSITE_CONTACT_PAGE);
        result.newsletter = this.field(webScraped.newsletter, Confidence.WEBSITE_CONTACT_PAGE);
        result.company_name = this.field(webScraped.company_name, Confidence.WEBSITE_CONTACT_PAGE);
        result.agency = this.field(webScraped.agency, Confidence.WEBSITE_CONTACT_PAGE);
        result.store = this.field(webScraped.store, Confidence.WEBSITE_CONTACT_PAGE);

        result.instagram = this.field(webScraped.instagram, Confidence.WEBSITE_CONTACT_PAGE);
        result.twitter = this.field(webScraped.twitter, Confidence.WEBSITE_CONTACT_PAGE);
        result.linkedin = this.field(webScraped.linkedin, Confidence.WEBSITE_CONTACT_PAGE);
        result.facebook = this.field(webScraped.facebook, Confidence.WEBSITE_CONTACT_PAGE);
        result.tiktok = this.field(webScraped.tiktok, Confidence.WEBSITE_CONTACT_PAGE);
        result.discord = this.field(webScraped.discord, Confidence.WEBSITE_CONTACT_PAGE);
      }
    } catch (err: any) {
      enrichmentLog(LogLevel.ERROR, this.name, ctx.channelId, `Local website crawl failed: ${err.message}`);
    }

    return result;
  }
}
