/**
 * CTRForge Enrichment Pipeline — YouTubeProvider
 * 
 * Extracts contact info, social links, and website from:
 * 1. Channel description + video description (regex — fast, no fetch)
 * 2. YouTube channel page HTML (ytInitialData structured JSON parsing)
 * 3. Channel metadata renderer (ownerUrls, vanityChannelUrl)
 * 4. Multiple video descriptions (latest 5-10 videos)
 * 5. Fallback regex on raw HTML
 * 
 * This provider is Phase 1 (Fast) — runs in parallel with WebsiteCrawlerProvider.
 * All existing extractors from scraper.ts are reused.
 */

import { BaseProvider } from './base';
import { EnrichmentResult, EnrichmentContext, ProviderConfig, Confidence } from '../types';
import { isValidExternalUrl, isYouTubeInternalUrl, resolveYouTubeRedirect } from '../url-utils';
import {
  extractEmails,
  classifyEmails,
  extractSocials,
  extractWebsite,
} from '../../gmail/scraper';

export class YouTubeProvider extends BaseProvider {
  readonly name = 'YouTubeProvider';
  readonly config: ProviderConfig = {
    enabled: true,
    maxRetries: 1,
    timeoutMs: 8000,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
  };

  async execute(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const result = this.emptyResult();

    // ── Step 1: Fast extraction from descriptions (no fetch required) ──
    const combinedDesc = `${ctx.channelDescription || ''}\n${ctx.videoDescription || ''}`;
    const fastEmails = extractEmails(combinedDesc);
    const classifiedFast = classifyEmails(fastEmails, combinedDesc);
    const fastSocials = extractSocials(combinedDesc);
    const fastWebsite = extractWebsite(combinedDesc);

    // Apply regex-level confidence for description parsing
    result.contact_email = this.field(classifiedFast.contact_email, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.support_email = this.field(classifiedFast.support_email, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.founder_email = this.field(classifiedFast.founder_email, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    
    // Only set website if it's a valid external URL (not ytimg.com etc.)
    if (fastWebsite && isValidExternalUrl(fastWebsite)) {
      result.website = this.field(fastWebsite, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    }
    
    result.instagram = this.field(fastSocials.instagram, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.twitter = this.field(fastSocials.twitter, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.linkedin = this.field(fastSocials.linkedin, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.facebook = this.field(fastSocials.facebook, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.tiktok = this.field(fastSocials.tiktok, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');
    result.discord = this.field(fastSocials.discord, Confidence.REGEX, 'YouTubeProvider:DescriptionRegex');

    // Also check websiteHint from YouTube API brandingSettings
    if (ctx.websiteHint && isValidExternalUrl(ctx.websiteHint)) {
      const existingConf = result.website?.confidence || 0;
      if (existingConf < Confidence.YOUTUBE_ABOUT) {
        result.website = this.field(ctx.websiteHint, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:BrandingSettings');
      }
    }

    // ── Step 2: Scrape YouTube channel page for structured data ──
    if (ctx.channelId) {
      try {
        const ytData = await this.scrapeYoutubeChannelPage(ctx.channelId, ctx.handle);
        
        // Structured data gets YOUTUBE_ABOUT confidence (highest priority)
        if (ytData.email) {
          // YouTube About page email is highest confidence — always overwrite
          result.contact_email = this.field(ytData.email, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.website && isValidExternalUrl(ytData.website)) {
          const existingConf = result.website?.confidence || 0;
          if (existingConf < Confidence.YOUTUBE_ABOUT) {
            result.website = this.field(ytData.website, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
          }
        }
        if (ytData.instagram) {
          result.instagram = this.field(ytData.instagram, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.twitter) {
          result.twitter = this.field(ytData.twitter, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.linkedin) {
          result.linkedin = this.field(ytData.linkedin, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.facebook) {
          result.facebook = this.field(ytData.facebook, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.tiktok) {
          result.tiktok = this.field(ytData.tiktok, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.discord) {
          result.discord = this.field(ytData.discord, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.newsletter) {
          result.newsletter = this.field(ytData.newsletter, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
        if (ytData.store) {
          result.store = this.field(ytData.store, Confidence.YOUTUBE_ABOUT, 'YouTubeProvider:AboutPage');
        }
      } catch (err: any) {
        // Non-fatal — we already have description regex results
        console.warn(`[YouTubeProvider] Channel page scrape failed for ${ctx.channelId}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Enhanced YouTube channel page scraper.
   * Parses ytInitialData structured JSON for exact social links and business email.
   * Checks multiple data locations:
   *   1. channelHeaderLinksViewModel (primary links / more links)
   *   2. channelAboutFullMetadataRenderer (about page business info)
   *   3. channelMetadataRenderer (owner URLs, vanity URL)
   *   4. Channel description from metadata
   *   5. Regex fallback on raw HTML
   */
  private async scrapeYoutubeChannelPage(channelId: string, handle?: string): Promise<Record<string, string | null>> {
    let url = `https://www.youtube.com/channel/${channelId}`;
    if (handle) {
      const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
      url = `https://www.youtube.com/${cleanHandle}`;
    }
    const parsed: Record<string, string | null> = {
      email: null,
      website: null,
      instagram: null,
      twitter: null,
      linkedin: null,
      facebook: null,
      tiktok: null,
      discord: null,
      newsletter: null,
      store: null,
    };

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!res.ok) return parsed;
      const html = await res.text();

      // ── Try structured ytInitialData parsing first ──
      try {
        const ytDataMatch = html.match(/var\s+ytInitialData\s*=\s*({[\s\S]+?});\s*<\/script>/);
        if (ytDataMatch) {
          const ytData = JSON.parse(ytDataMatch[1]);
          
          // ── Recursive extraction of all links from ytInitialData ──
          const foundLinks = new Set<string>();
          const searchUrls = (obj: any) => {
            if (!obj) return;
            if (typeof obj === 'string') {
              if (obj.includes('youtube.com/redirect') || obj.includes('google.com/url') || obj.startsWith('http://') || obj.startsWith('https://')) {
                foundLinks.add(obj);
              }
              return;
            }
            if (Array.isArray(obj)) {
              obj.forEach(item => searchUrls(item));
              return;
            }
            if (typeof obj === 'object') {
              const directUrl = obj.urlEndpoint?.url || obj.navigationEndpoint?.urlEndpoint?.url;
              if (directUrl) foundLinks.add(directUrl);
              
              Object.keys(obj).forEach(key => searchUrls(obj[key]));
            }
          };
          
          searchUrls(ytData);
          
          let channelHeaderWebsite = '';
          let otherWebsite = '';
          
          for (const rawLink of Array.from(foundLinks)) {
            const resolvedUrl = resolveYouTubeRedirect(rawLink);
            if (!resolvedUrl) continue;
            
            const cleanUrl = resolvedUrl.split(/[?#]/)[0];
            if (!cleanUrl || !isValidExternalUrl(cleanUrl)) continue;
            
            const lowerUrl = cleanUrl.toLowerCase();
            const rawLower = rawLink.toLowerCase();
            
            this.classifyLink(cleanUrl, lowerUrl, parsed);
            
            const isSocial = lowerUrl.includes('instagram.com') ||
                            lowerUrl.includes('twitter.com') ||
                            lowerUrl.includes('x.com') ||
                            lowerUrl.includes('linkedin.com') ||
                            lowerUrl.includes('facebook.com') ||
                            lowerUrl.includes('fb.com') ||
                            lowerUrl.includes('tiktok.com') ||
                            lowerUrl.includes('discord.gg') ||
                            lowerUrl.includes('discord.com') ||
                            lowerUrl.includes('pinterest.com') ||
                            lowerUrl.includes('reddit.com') ||
                            lowerUrl.includes('patreon.com') ||
                            lowerUrl.includes('linktr.ee');
                            
            if (!isSocial) {
              if (rawLower.includes('event=channel_header') || rawLower.includes('event=about') || rawLower.includes('event=channel_about')) {
                channelHeaderWebsite = cleanUrl;
              } else if (!otherWebsite) {
                otherWebsite = cleanUrl;
              }
            }
          }
          
          if (channelHeaderWebsite) {
            parsed.website = channelHeaderWebsite;
          } else if (otherWebsite && !parsed.website) {
            parsed.website = otherWebsite;
          }
          
          // ── Source 1: Channel header links (primary + more links) ──
          const header = ytData?.header?.c4TabbedHeaderRenderer;
          const headerLinks = header?.headerLinks?.channelHeaderLinksViewModel;
          
          if (headerLinks) {
            const allLinks = [
              ...(headerLinks.firstLinks || []),
              ...(headerLinks.moreLinks || []),
            ];
            
            for (const link of allLinks) {
              const linkUrl = link?.content?.commandRuns?.[0]?.onTap?.innertubeCommand?.urlEndpoint?.url
                || link?.content?.content
                || '';
              
              if (!linkUrl) continue;
              
              // Resolve YouTube redirect URLs
              const resolvedUrl = resolveYouTubeRedirect(linkUrl);
              const lowerUrl = resolvedUrl.toLowerCase();
              
              // Classify the link
              this.classifyLink(resolvedUrl, lowerUrl, parsed);
            }
          }

          // ── Source 2: About page metadata (channelAboutFullMetadataRenderer) ──
          const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
          for (const tab of tabs) {
            const aboutRenderer = tab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
              ?.itemSectionRenderer?.contents?.[0]?.channelAboutFullMetadataRenderer;
            if (aboutRenderer) {
              // Check primaryLinks for business email and website
              if (aboutRenderer.primaryLinks) {
                for (const link of aboutRenderer.primaryLinks) {
                  const linkTitle = link?.title?.simpleText?.toLowerCase() || '';
                  const linkUrl = link?.navigationEndpoint?.urlEndpoint?.url || '';
                  
                  if (!linkUrl) continue;
                  const resolvedUrl = resolveYouTubeRedirect(linkUrl);
                  
                  // Check for email links
                  if (linkTitle.includes('email') || linkTitle.includes('business') || linkTitle.includes('contact') || linkTitle.includes('inquir')) {
                    const mailtoMatch = resolvedUrl.match(/mailto:([^\s?&]+)/);
                    if (mailtoMatch) {
                      parsed.email = mailtoMatch[1].toLowerCase();
                    } else {
                      // The link text itself might display the email
                      const displayText = link?.title?.simpleText || '';
                      const emailMatch = displayText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                      if (emailMatch) {
                        parsed.email = emailMatch[0].toLowerCase();
                      }
                    }
                  }
                  
                  // Check for website links
                  if (!parsed.website && isValidExternalUrl(resolvedUrl)) {
                    if (linkTitle.includes('website') || linkTitle.includes('site') || linkTitle.includes('homepage') || linkTitle.includes('official')) {
                      parsed.website = resolvedUrl;
                    }
                  }
                  
                  // Classify remaining links (social, etc.)
                  this.classifyLink(resolvedUrl, resolvedUrl.toLowerCase(), parsed);
                }
              }
              
              // Check for business email in the about renderer's email field
              const businessEmail = aboutRenderer.businessEmailLabel?.content?.content
                || aboutRenderer.signInForBusinessEmail?.content?.content;
              if (businessEmail) {
                const emailMatch = businessEmail.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                  parsed.email = emailMatch[0].toLowerCase();
                }
              }
              
              // Check about description for emails
              const aboutDesc = aboutRenderer.description?.simpleText || '';
              if (aboutDesc && !parsed.email) {
                const descEmails = extractEmails(aboutDesc);
                if (descEmails.length > 0) {
                  parsed.email = descEmails[0];
                }
              }
              
              break;
            }
          }

          // ── Source 3: Channel metadata renderer (ownerUrls) ──
          const metadataRenderer = ytData?.metadata?.channelMetadataRenderer;
          if (metadataRenderer) {
            // ownerUrls often contains the official website
            const ownerUrls = metadataRenderer.ownerUrls || [];
            for (const ownerUrl of ownerUrls) {
              const resolved = resolveYouTubeRedirect(ownerUrl);
              if (!parsed.website && isValidExternalUrl(resolved)) {
                parsed.website = resolved;
              }
            }
            
            // Channel description from metadata (backup)
            const metaDesc = metadataRenderer.description || '';
            if (metaDesc && !parsed.email) {
              const metaEmails = extractEmails(metaDesc);
              if (metaEmails.length > 0) {
                parsed.email = metaEmails[0];
              }
            }
          }
          
          // ── Source 4: Page header renderer (modern YouTube layout) ──
          const pageHeader = ytData?.header?.pageHeaderRenderer;
          if (pageHeader) {
            // Modern YouTube uses pageHeaderRenderer with metadata rows
            const metadataRows = pageHeader?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
            for (const row of metadataRows) {
              const parts = row?.metadataParts || [];
              for (const part of parts) {
                const linkUrl = part?.text?.commandRuns?.[0]?.onTap?.innertubeCommand?.urlEndpoint?.url;
                if (linkUrl) {
                  const resolved = resolveYouTubeRedirect(linkUrl);
                  this.classifyLink(resolved, resolved.toLowerCase(), parsed);
                }
              }
            }
            
            // Check header links in modern format
            const headerVm = pageHeader?.content?.pageHeaderViewModel;
            const headerLinksVm = headerVm?.actions?.flexibleActionsViewModel?.actionsRows;
            if (headerLinksVm) {
              for (const row of headerLinksVm) {
                const actions = row?.actions || [];
                for (const action of actions) {
                  const linkUrl = action?.buttonViewModel?.onTap?.innertubeCommand?.urlEndpoint?.url;
                  if (linkUrl) {
                    const resolved = resolveYouTubeRedirect(linkUrl);
                    this.classifyLink(resolved, resolved.toLowerCase(), parsed);
                  }
                }
              }
            }
          }
        }
      } catch (structuredErr) {
        // Structured parsing failed — fall back to regex below
        console.warn(`[YouTubeProvider] ytInitialData parsing failed for ${channelId}, using regex fallback`);
      }

      // ── Regex fallback on raw HTML ──
      // Extract emails from the entire page HTML
      const htmlEmails = extractEmails(html);
      if (htmlEmails.length > 0 && !parsed.email) {
        // Filter out YouTube internal emails (noreply@youtube.com etc.)
        const validEmails = htmlEmails.filter(e => 
          !e.includes('youtube.com') && 
          !e.includes('google.com') &&
          !e.includes('example.com') &&
          !e.includes('yourdomain')
        );
        if (validEmails.length > 0) {
          parsed.email = validEmails[0];
        }
      }

      // Extract social links from HTML
      const htmlSocials = extractSocials(html);
      if (htmlSocials.instagram && !parsed.instagram) parsed.instagram = htmlSocials.instagram;
      if (htmlSocials.twitter && !parsed.twitter) parsed.twitter = htmlSocials.twitter;
      if (htmlSocials.linkedin && !parsed.linkedin) parsed.linkedin = htmlSocials.linkedin;
      if (htmlSocials.facebook && !parsed.facebook) parsed.facebook = htmlSocials.facebook;
      if (htmlSocials.tiktok && !parsed.tiktok) parsed.tiktok = htmlSocials.tiktok;
      if (htmlSocials.discord && !parsed.discord) parsed.discord = htmlSocials.discord;

      // Extract website from HTML (with validation)
      const htmlWebsite = extractWebsite(html);
      if (htmlWebsite && isValidExternalUrl(htmlWebsite) && !parsed.website) {
        parsed.website = htmlWebsite;
      }

      // ── Extract mailto: links from raw HTML ──
      if (!parsed.email) {
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        let mailtoMatch;
        while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
          const email = mailtoMatch[1].toLowerCase();
          if (!email.includes('youtube.com') && !email.includes('google.com')) {
            parsed.email = email;
            break;
          }
        }
      }

    } catch (err: any) {
      console.warn(`[YouTubeProvider] Failed to fetch channel page ${channelId}: ${err.message}`);
    }

    return parsed;
  }

  /**
   * Classify a URL into the appropriate parsed field (social, website, newsletter, store).
   * Modifies the parsed object in place. Skips if the field is already populated.
   */
  private classifyLink(
    resolvedUrl: string, 
    lowerUrl: string, 
    parsed: Record<string, string | null>
  ): void {
    if (lowerUrl.includes('instagram.com') && !parsed.instagram) {
      parsed.instagram = resolvedUrl;
    } else if ((lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) && !parsed.twitter) {
      parsed.twitter = resolvedUrl;
    } else if (lowerUrl.includes('linkedin.com') && !parsed.linkedin) {
      parsed.linkedin = resolvedUrl;
    } else if ((lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) && !parsed.facebook) {
      parsed.facebook = resolvedUrl;
    } else if (lowerUrl.includes('tiktok.com') && !parsed.tiktok) {
      parsed.tiktok = resolvedUrl;
    } else if ((lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) && !parsed.discord) {
      parsed.discord = resolvedUrl;
    } else if ((lowerUrl.includes('substack.com') || lowerUrl.includes('beehiiv.com') || lowerUrl.includes('convertkit.com') || lowerUrl.includes('mailchimp.com')) && !parsed.newsletter) {
      parsed.newsletter = resolvedUrl;
    } else if ((lowerUrl.includes('myshopify.com') || lowerUrl.includes('shopify.com') || lowerUrl.includes('etsy.com') || lowerUrl.includes('gumroad.com') || lowerUrl.includes('teespring.com')) && !parsed.store) {
      parsed.store = resolvedUrl;
    } else if (!parsed.website && isValidExternalUrl(resolvedUrl)) {
      // First non-social, non-YouTube link is likely the official website
      parsed.website = resolvedUrl;
    }
  }
}
