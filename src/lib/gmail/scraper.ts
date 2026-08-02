import { parseToBigIntOrInt } from '../supabase/db';

interface ScrapeResult {
  contact_email: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  facebook: string | null;
  phone: string | null;
  contact_form: string | null;
  address: string | null;
  email_verified: boolean;
  website_found: boolean;
  social_links_found: boolean;
  lead_score: number;
}

// Simple helper to clean and normalize URLs
export function cleanUrl(url: string, baseUrl?: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    if (baseUrl) {
      try {
        const base = new URL(baseUrl);
        cleaned = new URL(cleaned, base.origin).toString();
      } catch {
        cleaned = 'https://' + cleaned;
      }
    } else {
      cleaned = 'https://' + cleaned;
    }
  }
  return cleaned;
}

// Regex list for social platforms
const SOCIAL_REGEXES = {
  instagram: /(?:instagram\.com\/|instagr\.am\/)([a-zA-Z0-9_.-]+)/i,
  twitter: /(?:twitter\.com\/|x\.com\/)([a-zA-Z0-9_.-]+)/i,
  linkedin: /(?:linkedin\.com\/(?:in|company|school)\/)([a-zA-Z0-9_.-]+)/i,
  facebook: /(?:facebook\.com\/|fb\.com\/)([a-zA-Z0-9_.-]+)/i,
};

// Extractor helper using regex
export function extractEmails(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g;
  const matches = text.match(emailRegex) || [];
  return Array.from(new Set(matches))
    .map(e => e.trim().toLowerCase())
    .filter(e => {
      const parts = e.split('.');
      const ext = parts[parts.length - 1];
      return !['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'css', 'js', 'example', 'bootstrap'].includes(ext);
    });
}

// Advanced extractors for specific email types
export function classifyEmails(emails: string[], text: string): {
  contact_email: string | null;
  support_email: string | null;
  founder_email: string | null;
} {
  let contact_email: string | null = null;
  let support_email: string | null = null;
  let founder_email: string | null = null;

  for (const email of emails) {
    if (email.startsWith('support@') || email.startsWith('help@') || email.startsWith('info@')) {
      if (!support_email) support_email = email;
    } else if (email.startsWith('founder@') || email.startsWith('ceo@') || email.startsWith('owner@')) {
      if (!founder_email) founder_email = email;
    } else {
      if (!contact_email) contact_email = email;
    }
  }

  // Fallbacks if not explicitly found
  if (emails.length > 0) {
    if (!contact_email) contact_email = emails[0];
  }

  return { contact_email, support_email, founder_email };
}

export function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const phoneRegex = /(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return Array.from(new Set(matches)).map(p => p.trim());
}

export function extractSocials(text: string): Record<string, string | null> {
  const result: Record<string, string | null> = {
    instagram: null,
    twitter: null,
    linkedin: null,
    facebook: null,
    tiktok: null,
    discord: null,
  };

  if (!text) return result;

  const tiktokRegex = /(?:tiktok\.com\/@)([a-zA-Z0-9_.-]+)/i;
  const discordRegex = /(?:discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9_-]+)/i;

  for (const [platform, regex] of Object.entries(SOCIAL_REGEXES)) {
    const match = text.match(regex);
    if (match && match[0]) {
      result[platform] = cleanUrl(match[0].split(/[?#]/)[0]);
    }
  }

  const tiktokMatch = text.match(tiktokRegex);
  if (tiktokMatch && tiktokMatch[0]) result.tiktok = cleanUrl(tiktokMatch[0].split(/[?#]/)[0]);

  const discordMatch = text.match(discordRegex);
  if (discordMatch && discordMatch[0]) result.discord = cleanUrl(discordMatch[0]);

  return result;
}

// Extract external website link that is not YouTube or social media
export function extractWebsite(text: string): string | null {
  if (!text) return null;
  const urlRegex = /https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const domain = match[1].toLowerCase();
    if (
      !domain.includes('youtube.com') &&
      !domain.includes('youtu.be') &&
      !domain.includes('ytimg.com') &&
      !domain.includes('ggpht.com') &&
      !domain.includes('googlevideo.com') &&
      !domain.includes('youtubei.googleapis.com') &&
      !domain.includes('gstatic.com') &&
      !domain.includes('googleusercontent.com') &&
      !domain.includes('instagram.com') &&
      !domain.includes('instagr.am') &&
      !domain.includes('twitter.com') &&
      !domain.includes('x.com') &&
      !domain.includes('linkedin.com') &&
      !domain.includes('facebook.com') &&
      !domain.includes('fb.com') &&
      !domain.includes('gmail.com') &&
      !domain.includes('google.com') &&
      !domain.includes('pinterest.com') &&
      !domain.includes('linktr.ee') &&
      !domain.includes('patreon.com') &&
      !domain.includes('subscribestar.com') &&
      !domain.includes('tiktok.com') &&
      !domain.includes('discord.gg') &&
      !domain.includes('youtube-nocookie.com') &&
      !domain.includes('i.ytimg')
    ) {
      return url.split(/[?#]/)[0];
    }
  }
  return null;
}

// Extractor for newsletter, course, booking links, company names
export function extractBookingLink(text: string): string | null {
  if (!text) return null;
  const calRegex = /https?:\/\/(?:www\.)?(?:calendly\.com|cal\.com|meetings\.hubspot\.com|savvycal\.com)\/[a-zA-Z0-9_-]+/gi;
  const match = text.match(calRegex);
  return match ? match[0] : null;
}

export function extractNewsletter(text: string): string | null {
  if (!text) return null;
  const newsRegex = /https?:\/\/(?:www\.)?(?:[a-zA-Z0-9_-]+\.substack\.com|convertkit\.com|beehiiv\.com|mailchimp\.com|[a-zA-Z0-9_-]+\.activehosted\.com)/gi;
  const match = text.match(newsRegex);
  if (match) return match[0];

  // Look for text newsletters
  const textMatch = text.match(/href=["']([^"']*(?:newsletter|subscribe)[^"']*)["']/i);
  return textMatch ? textMatch[1] : null;
}

export function extractStore(text: string): string | null {
  if (!text) return null;
  const shopRegex = /https?:\/\/(?:www\.)?(?:[a-zA-Z0-9_-]+\.myshopify\.com|shopify\.com|etsy\.com\/shop\/[a-zA-Z0-9_-]+|teespring\.com\/stores\/[a-zA-Z0-9_-]+)/gi;
  const match = text.match(shopRegex);
  if (match) return match[0];

  const textMatch = text.match(/href=["']([^"']*(?:shop|store|merch)[^"']*)["']/i);
  return textMatch ? textMatch[1] : null;
}

export function extractCompanyName(text: string): string | null {
  if (!text) return null;
  // Copyright match: e.g. © 2026 CTRForge Inc. or Copyright © 2026 CTRForge
  const copyrightRegex = /(?:©|copyright)\s*(?:\d{4})?\s*([a-zA-Z0-9\s,.-]{3,40})(?:\s*all rights reserved|\s*privacy|\s*terms|\s*•|\s*\||$)/i;
  const match = text.match(copyrightRegex);
  return match ? match[1].trim() : null;
}

export function extractAgency(text: string): string | null {
  if (!text) return null;
  const agencyKeywords = /(?:represented by|management|agency|talent management|bookings contact|bookings agency|represented exclusively by)\s*:\s*([a-zA-Z0-9\s.-]+)/i;
  const match = text.match(agencyKeywords);
  return match ? match[1].trim() : null;
}


// Scrape YouTube About Page Content programmatically
export async function scrapeYoutubeAboutPage(channelId: string): Promise<Partial<ScrapeResult>> {
  const url = `https://www.youtube.com/channel/${channelId}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000), // 6 second timeout
    });

    if (!res.ok) return {};
    const html = await res.text();

    // Check descriptions, social links, emails in html body
    const emails = extractEmails(html);
    const socials = extractSocials(html);
    const website = extractWebsite(html);

    return {
      contact_email: emails[0] || null,
      website: website,
      ...socials,
    };
  } catch (err) {
    console.error(`Error fetching YouTube channel about page for ${channelId}:`, err);
    return {};
  }
}

// Helper to run Apify Google Search Scraper with retries
export async function runApifyGoogleSearch(queries: string, token: string): Promise<any[]> {
  const maxRetries = 2;
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries,
          maxResultsPerQuery: 5,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify Google Search failed with status ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.warn(`[Apify Google Search] Attempt ${attempt} failed: ${error.message}`);
      if (attempt > maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return [];
}

// Helper to run Apify Instagram Scraper with retries
export async function runApifyInstagramScraper(instagramUrl: string, token: string): Promise<any[]> {
  const maxRetries = 2;
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [instagramUrl],
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify Instagram Scraper failed with status ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.warn(`[Apify Instagram Scraper] Attempt ${attempt} failed for URL ${instagramUrl}: ${error.message}`);
      if (attempt > maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return [];
}

// Helper to run Apify Website Content Crawler with retries
export async function runApifyWebsiteContentCrawler(url: string, token: string): Promise<any[]> {
  const maxRetries = 2;
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(`https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          maxCrawlPages: 10,
          maxCrawlDepth: 2,
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify Website Content Crawler failed with status ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.warn(`[Apify Content Crawler] Attempt ${attempt} failed for URL ${url}: ${error.message}`);
      if (attempt > maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return [];
}

// Helper to parse and find target links (homepage, about, contact, footer pages)
export async function discoverWebsiteTargetUrls(websiteUrl: string): Promise<string[]> {
  const urls = new Set<string>();
  if (!websiteUrl) return [];

  const cleanBaseUrl = cleanUrl(websiteUrl);
  urls.add(cleanBaseUrl);

  try {
    const homeRes = await fetch(cleanBaseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (homeRes.ok) {
      const homeHtml = await homeRes.text();
      const linkRegex = /href=["']([^"']+)["']/gi;
      let match;

      const aboutPatterns = ['about', 'team', 'story', 'who-we-are', 'our-history', 'staff', 'founder'];
      const contactPatterns = ['contact', 'support', 'reach-us', 'write-to-us', 'help', 'email-us'];
      const footerPatterns = ['privacy', 'terms', 'legal', 'faq', 'cookies', 'disclaimer', 'tos', 'policy'];

      while ((match = linkRegex.exec(homeHtml)) !== null) {
        const rawHref = match[1];
        if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
          continue;
        }

        const hrefLower = rawHref.toLowerCase();
        const isTarget = [...aboutPatterns, ...contactPatterns, ...footerPatterns].some(pattern => hrefLower.includes(pattern));

        if (isTarget) {
          const fullUrl = cleanUrl(rawHref, cleanBaseUrl);
          try {
            const baseDomain = new URL(cleanBaseUrl).hostname.replace('www.', '');
            const targetDomain = new URL(fullUrl).hostname.replace('www.', '');
            if (baseDomain === targetDomain) {
              urls.add(fullUrl);
            }
          } catch {
            // ignore malformed url parsing
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Apify Link Discovery] Failed to discover subpages for ${websiteUrl}:`, err);
  }

  // Fallbacks if homepage crawl failed or didn't find anything
  if (urls.size === 1) {
    const fallbackPaths = [
      '/about', '/about-us', '/contact', '/contact-us', 
      '/privacy', '/privacy-policy', '/terms', '/terms-of-service'
    ];
    for (const path of fallbackPaths) {
      urls.add(cleanUrl(path, cleanBaseUrl));
    }
  }

  // Limit to at most 10 distinct URLs to avoid hitting limits
  return Array.from(urls).slice(0, 10);
}

// Helper to run Apify Contact Details Scraper synchronously
export async function runApifyContactDetailsScraper(urlOrUrls: string | string[], token: string): Promise<any[]> {
  const maxRetries = 2;
  let delay = 1000;
  const actorName = process.env.APIFY_ACTOR || 'apify/contact-details-scraper';
  const formattedActor = actorName.replace('/', '~');

  let urls: string[] = [];
  if (Array.isArray(urlOrUrls)) {
    urls = urlOrUrls;
  } else {
    // If it's a single URL, discover target pages (homepage, about, contact, footer links)
    urls = await discoverWebsiteTargetUrls(urlOrUrls);
  }

  const startUrls = urls.map(u => ({ url: u }));
  console.log(`[Apify Scraper] Running on startUrls:`, startUrls);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(`https://api.apify.com/v2/acts/${formattedActor}/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startUrls: startUrls,
          maxDepth: 1,
          sameOrigin: true,
          checkFormFields: true,
          maxPagesPerCrawl: 15,
        }),
        signal: AbortSignal.timeout(45000), // increased timeout for more URLs
      });

      if (response.status === 429) {
        throw new Error('Apify API rate limit exceeded (429)');
      }
      if (response.status === 401) {
        throw new Error('Invalid Apify API token (401)');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify Actor failed with status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`[Apify Scraper] Attempt ${attempt} failed for URLs ${urls.join(', ')}: ${error.message}`);
      if (attempt > maxRetries || error.message.includes('401')) {
        throw error;
      }
      // Exponential backoff delay before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error('Apify Actor request failed after retries');
}


// Parse and consolidate items from Apify
export function parseApifyResults(items: any[]): any {
  const result = {
    contact_email: null as string | null,
    support_email: null as string | null,
    founder_email: null as string | null,
    phone: null as string | null,
    contact_form: null as string | null,
    address: null as string | null,
    calendly: null as string | null,
    booking_link: null as string | null,
    newsletter: null as string | null,
    company_name: null as string | null,
    agency: null as string | null,
    store: null as string | null,
    instagram: null as string | null,
    twitter: null as string | null,
    linkedin: null as string | null,
    facebook: null as string | null,
    tiktok: null as string | null,
    discord: null as string | null,
  };

  const allEmails = new Set<string>();
  const allPhones = new Set<string>();
  const allInstagrams = new Set<string>();
  const allTwitters = new Set<string>();
  const allLinkedins = new Set<string>();
  const allFacebooks = new Set<string>();
  const allTiktoks = new Set<string>();
  const allDiscords = new Set<string>();
  const allContactPages = new Set<string>();

  for (const item of items) {
    if (item.emails && Array.isArray(item.emails)) {
      item.emails.forEach((e: string) => allEmails.add(e.trim().toLowerCase()));
    }
    if (item.phones && Array.isArray(item.phones)) {
      item.phones.forEach((p: string) => allPhones.add(p.trim()));
    }
    if (item.instagrams && Array.isArray(item.instagrams)) {
      item.instagrams.forEach((u: string) => allInstagrams.add(u));
    }
    if (item.twitters && Array.isArray(item.twitters)) {
      item.twitters.forEach((u: string) => allTwitters.add(u));
    }
    if (item.linkedins && Array.isArray(item.linkedins)) {
      item.linkedins.forEach((u: string) => allLinkedins.add(u));
    }
    if (item.facebooks && Array.isArray(item.facebooks)) {
      item.facebooks.forEach((u: string) => allFacebooks.add(u));
    }
    if (item.tiktoks && Array.isArray(item.tiktoks)) {
      item.tiktoks.forEach((u: string) => allTiktoks.add(u));
    }
    if (item.discords && Array.isArray(item.discords)) {
      item.discords.forEach((u: string) => allDiscords.add(u));
    }
    if (item.contactPages && Array.isArray(item.contactPages)) {
      item.contactPages.forEach((u: string) => allContactPages.add(u));
    }
  }

  // Classify emails
  const emailsArray = Array.from(allEmails);
  const classified = classifyEmails(emailsArray, '');
  result.contact_email = classified.contact_email;
  result.support_email = classified.support_email;
  result.founder_email = classified.founder_email;

  if (allPhones.size > 0) result.phone = Array.from(allPhones)[0];
  if (allInstagrams.size > 0) result.instagram = Array.from(allInstagrams)[0];
  if (allTwitters.size > 0) result.twitter = Array.from(allTwitters)[0];
  if (allLinkedins.size > 0) result.linkedin = Array.from(allLinkedins)[0];
  if (allFacebooks.size > 0) result.facebook = Array.from(allFacebooks)[0];
  if (allTiktoks.size > 0) result.tiktok = Array.from(allTiktoks)[0];
  if (allDiscords.size > 0) result.discord = Array.from(allDiscords)[0];
  if (allContactPages.size > 0) result.contact_form = Array.from(allContactPages)[0];

  return result;
}

// Scrape website contact details
export async function scrapeWebsiteContacts(websiteUrl: string): Promise<{
  contact_email: string | null;
  support_email: string | null;
  founder_email: string | null;
  phone: string | null;
  contact_form: string | null;
  address: string | null;
  calendly: string | null;
  booking_link: string | null;
  newsletter: string | null;
  company_name: string | null;
  agency: string | null;
  store: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  facebook: string | null;
  tiktok: string | null;
  discord: string | null;
}> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (apifyToken && websiteUrl) {
    try {
      console.log(`[Apify Scraper] Scraping website contacts for URL: ${websiteUrl}`);
      const items = await runApifyContactDetailsScraper(websiteUrl, apifyToken);
      if (items && items.length > 0) {
        return parseApifyResults(items);
      }
    } catch (err) {
      console.error(`[Apify Scraper] Apify crawling failed, falling back to local crawl. Error:`, err);
    }
  } else if (!apifyToken && websiteUrl) {
    console.warn(`[Apify Scraper] APIFY_TOKEN is not defined in env.local. Falling back to local regex crawl.`);
  }

  const result = {
    contact_email: null as string | null,
    support_email: null as string | null,
    founder_email: null as string | null,
    phone: null as string | null,
    contact_form: null as string | null,
    address: null as string | null,
    calendly: null as string | null,
    booking_link: null as string | null,
    newsletter: null as string | null,
    company_name: null as string | null,
    agency: null as string | null,
    store: null as string | null,
    instagram: null as string | null,
    twitter: null as string | null,
    linkedin: null as string | null,
    facebook: null as string | null,
    tiktok: null as string | null,
    discord: null as string | null,
  };

  if (!websiteUrl) return result;
  const cleanBaseUrl = cleanUrl(websiteUrl);

  try {
    // 1. Fetch Homepage
    const homeRes = await fetch(cleanBaseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!homeRes.ok) return result;
    const homeHtml = await homeRes.text();

    // Parse home emails and phone numbers
    const homeEmails = extractEmails(homeHtml);
    const classifiedHome = classifyEmails(homeEmails, homeHtml);
    result.contact_email = classifiedHome.contact_email;
    result.support_email = classifiedHome.support_email;
    result.founder_email = classifiedHome.founder_email;

    const homePhones = extractPhoneNumbers(homeHtml);
    if (homePhones.length > 0) result.phone = homePhones[0];

    // Extract other metrics
    result.calendly = extractBookingLink(homeHtml);
    result.booking_link = extractBookingLink(homeHtml);
    result.newsletter = extractNewsletter(homeHtml);
    result.company_name = extractCompanyName(homeHtml);
    result.agency = extractAgency(homeHtml);
    result.store = extractStore(homeHtml);

    const homeSocials = extractSocials(homeHtml);
    result.instagram = homeSocials.instagram;
    result.twitter = homeSocials.twitter;
    result.linkedin = homeSocials.linkedin;
    result.facebook = homeSocials.facebook;
    result.tiktok = homeSocials.tiktok;
    result.discord = homeSocials.discord;

    // Find contact forms in home
    if (homeHtml.includes('typeform.com')) {
      result.contact_form = 'Typeform detected';
    } else if (homeHtml.includes('docs.google.com/forms')) {
      result.contact_form = 'Google Form detected';
    } else if (homeHtml.includes('<form')) {
      result.contact_form = cleanBaseUrl;
    }

    // Extract address in home
    const addressMatch = homeHtml.match(/\b\d{1,5}\s+[A-Za-z0-9\s,.]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Suite|Ste|Floor|Fl)\b/i);
    if (addressMatch) {
      result.address = addressMatch[0].trim();
    }

    // 2. Discover subpages: /contact, /about, /team, /contact-us, /privacy, /terms
    const subpagePaths = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/privacy', '/terms'];
    const pagesToScrape: string[] = [];

    // Parse links from home page
    const linkRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = linkRegex.exec(homeHtml)) !== null) {
      const href = match[1].toLowerCase();
      if (subpagePaths.some(path => href.includes(path))) {
        const fullSubUrl = cleanUrl(match[1], cleanBaseUrl);
        if (!pagesToScrape.includes(fullSubUrl) && pagesToScrape.length < 5) {
          pagesToScrape.push(fullSubUrl);
        }
      }
    }

    // Fallback: If no links parsed, construct default paths
    if (pagesToScrape.length === 0) {
      pagesToScrape.push(...subpagePaths.slice(0, 4).map(path => cleanBaseUrl.replace(/\/$/, '') + path));
    }

    // 3. Crawl pages in parallel with timeout
    await Promise.all(
      pagesToScrape.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) return;
          const html = await res.text();

          const pageEmails = extractEmails(html);
          const classifiedPage = classifyEmails(pageEmails, html);

          if (classifiedPage.contact_email && !result.contact_email) result.contact_email = classifiedPage.contact_email;
          if (classifiedPage.support_email && !result.support_email) result.support_email = classifiedPage.support_email;
          if (classifiedPage.founder_email && !result.founder_email) result.founder_email = classifiedPage.founder_email;

          const pagePhones = extractPhoneNumbers(html);
          if (pagePhones.length > 0 && !result.phone) {
            result.phone = pagePhones[0];
          }

          if (!result.calendly) result.calendly = extractBookingLink(html);
          if (!result.booking_link) result.booking_link = extractBookingLink(html);
          if (!result.newsletter) result.newsletter = extractNewsletter(html);
          if (!result.company_name) result.company_name = extractCompanyName(html);
          if (!result.agency) result.agency = extractAgency(html);
          if (!result.store) result.store = extractStore(html);

          const pageSocials = extractSocials(html);
          if (pageSocials.instagram && !result.instagram) result.instagram = pageSocials.instagram;
          if (pageSocials.twitter && !result.twitter) result.twitter = pageSocials.twitter;
          if (pageSocials.linkedin && !result.linkedin) result.linkedin = pageSocials.linkedin;
          if (pageSocials.facebook && !result.facebook) result.facebook = pageSocials.facebook;
          if (pageSocials.tiktok && !result.tiktok) result.tiktok = pageSocials.tiktok;
          if (pageSocials.discord && !result.discord) result.discord = pageSocials.discord;

          if (html.includes('typeform.com')) {
            result.contact_form = 'Typeform detected';
          } else if (html.includes('docs.google.com/forms')) {
            result.contact_form = 'Google Form detected';
          } else if (html.includes('<form') && !result.contact_form) {
            result.contact_form = url;
          }

          if (!result.address) {
            const pageAddressMatch = html.match(/\b\d{1,5}\s+[A-Za-z0-9\s,.]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Suite|Ste|Floor|Fl)\b/i);
            if (pageAddressMatch) {
              result.address = pageAddressMatch[0].trim();
            }
          }
        } catch {
          // ignore failed subpage scrapings
        }
      })
    );

  } catch (err) {
    console.error(`Error scraping website ${websiteUrl}:`, err);
  }

  return result;
}

// Master crawler combining YouTube description parsing, channel page fetches, and website crawling
export async function crawlCreatorDetails(
  channelId: string,
  channelDescription: string,
  latestVideoDescription?: string,
  channelName?: string,
  handle?: string
): Promise<any> {
  try {
    const { ProviderManager } = await import('../enrichment/provider-manager');
    const ctx = {
      channelId,
      channelName: channelName || '',
      channelDescription,
      videoDescription: latestVideoDescription || '',
      websiteHint: '',
      subscriberCount: 0,
      averageViews: 0,
      latestVideoTitle: '',
      latestVideoUrl: '',
      thumbnailUrl: '',
      uploadFrequency: '',
      channelAge: '',
      handle: handle || '',
    };
    
    // Parse website from descriptions as initial hint
    const fastWebsite = extractWebsite(`${channelDescription || ''}\n${latestVideoDescription || ''}`);
    if (fastWebsite) {
      ctx.websiteHint = fastWebsite;
    }
    
    return await ProviderManager.enrichContacts(ctx);
  } catch (err) {
    console.error('[crawlCreatorDetails] Provider-based enrichment failed. Running fallback pipeline.', err);
  }

  const apifyToken = process.env.APIFY_TOKEN;

  // 1. Fast extraction from descriptions (no internet fetch required!)
  const combinedDesc = `${channelDescription || ''}\n${latestVideoDescription || ''}`;
  const fastEmails = extractEmails(combinedDesc);
  const classifiedFast = classifyEmails(fastEmails, combinedDesc);
  const fastSocials = extractSocials(combinedDesc);
  const fastWebsite = extractWebsite(combinedDesc);

  let contact_email = classifiedFast.contact_email;
  let support_email = classifiedFast.support_email;
  let founder_email = classifiedFast.founder_email;
  let website = fastWebsite;
  let instagram = fastSocials.instagram;
  let twitter = fastSocials.twitter;
  let linkedin = fastSocials.linkedin;
  let facebook = fastSocials.facebook;
  let tiktok = fastSocials.tiktok;
  let discord = fastSocials.discord;
  
  let phone = null as string | null;
  let contact_form = null as string | null;
  let address = null as string | null;
  let calendly = null as string | null;
  let booking_link = null as string | null;
  let newsletter = null as string | null;
  let company_name = null as string | null;
  let agency = null as string | null;
  let store = null as string | null;

  // 2. Fallback to scraping YouTube Channel About page
  if (channelId && (!contact_email || !website || !instagram || !twitter || !linkedin)) {
    const ytScraped = await scrapeYoutubeAboutPage(channelId);
    if (!contact_email && ytScraped.contact_email) contact_email = ytScraped.contact_email;
    if (!website && ytScraped.website) website = ytScraped.website;
    if (!instagram && ytScraped.instagram) instagram = ytScraped.instagram;
    if (!twitter && ytScraped.twitter) twitter = ytScraped.twitter;
    if (!linkedin && ytScraped.linkedin) linkedin = ytScraped.linkedin;
    if (!facebook && ytScraped.facebook) facebook = ytScraped.facebook;
  }

  // STEP 2: If website exists, run Apify Contact Details Scraper
  if (website && apifyToken) {
    try {
      console.log(`[Apify Pipeline] Launching Contact Details Scraper for website: ${website}`);
      const contactItems = await runApifyContactDetailsScraper(website, apifyToken);
      if (contactItems && contactItems.length > 0) {
        const webScraped = parseApifyResults(contactItems);
        if (!contact_email && webScraped.contact_email) contact_email = webScraped.contact_email;
        if (!support_email && webScraped.support_email) support_email = webScraped.support_email;
        if (!founder_email && webScraped.founder_email) founder_email = webScraped.founder_email;
        
        phone = webScraped.phone;
        contact_form = webScraped.contact_form;
        address = webScraped.address;
        calendly = webScraped.calendly;
        booking_link = webScraped.booking_link;
        newsletter = webScraped.newsletter;
        company_name = webScraped.company_name;
        agency = webScraped.agency;
        store = webScraped.store;

        if (!instagram && webScraped.instagram) instagram = webScraped.instagram;
        if (!twitter && webScraped.twitter) twitter = webScraped.twitter;
        if (!linkedin && webScraped.linkedin) linkedin = webScraped.linkedin;
        if (!facebook && webScraped.facebook) facebook = webScraped.facebook;
        if (!tiktok && webScraped.tiktok) tiktok = webScraped.tiktok;
        if (!discord && webScraped.discord) discord = webScraped.discord;
      }
    } catch (err: any) {
      console.error(`[Apify Pipeline] Contact Details Scraper failed:`, err.message);
    }
  }

  // STEP 3: Run Website Content Crawler
  if (website && apifyToken) {
    try {
      console.log(`[Apify Pipeline] Launching Website Content Crawler for website: ${website}`);
      const contentItems = await runApifyWebsiteContentCrawler(website, apifyToken);
      if (contentItems && contentItems.length > 0) {
        // Extract emails from HTML/text of scanned subpages
        const textToScan = contentItems.map(item => `${item.text || ''}\n${item.html || ''}`).join('\n');
        const crawlerEmails = extractEmails(textToScan);
        if (crawlerEmails.length > 0) {
          const classified = classifyEmails(crawlerEmails, textToScan);
          if (!contact_email && classified.contact_email) {
            contact_email = classified.contact_email;
            console.log(`[Apify Pipeline] Discovered contact email from Website Content Crawler: ${contact_email}`);
          }
          if (!support_email && classified.support_email) support_email = classified.support_email;
          if (!founder_email && classified.founder_email) founder_email = classified.founder_email;
        }
      }
    } catch (err: any) {
      console.error(`[Apify Pipeline] Website Content Crawler failed:`, err.message);
    }
  }

  // STEP 4: If no website exists, run Google Search Scraper
  if (!website && channelName && apifyToken) {
    try {
      console.log(`[Apify Pipeline] No website found. Launching Google Search Scraper for channel: ${channelName}`);
      const searchQueries = [
        `"${channelName}" official website`,
        `"${channelName}" linkedin`,
        `"${channelName}" instagram`,
        `"${channelName}" twitter`
      ].join('\n');
      
      const searchResults = await runApifyGoogleSearch(searchQueries, apifyToken);
      
      if (searchResults && searchResults.length > 0) {
        for (const item of searchResults) {
          const organicResults = item.organicResults || [];
          for (const res of organicResults) {
            const url = res.url || '';
            if (!url) continue;
            
            // Check if it matches a crawlable official website
            const isGoogleOrSocial = /google\.com|youtube\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|facebook\.com/i.test(url);
            if (!website && !isGoogleOrSocial) {
              website = url;
              console.log(`[Apify Pipeline] Discovered website from Google Search: ${website}`);
            } else if (!instagram && url.includes('instagram.com/')) {
              instagram = url;
              console.log(`[Apify Pipeline] Discovered instagram from Google Search: ${instagram}`);
            } else if (!twitter && (url.includes('twitter.com/') || url.includes('x.com/'))) {
              twitter = url;
              console.log(`[Apify Pipeline] Discovered twitter from Google Search: ${twitter}`);
            } else if (!linkedin && url.includes('linkedin.com/')) {
              linkedin = url;
              console.log(`[Apify Pipeline] Discovered linkedin from Google Search: ${linkedin}`);
            }
          }
        }
      }

      // If we newly discovered a website, crawl it immediately!
      if (website) {
        console.log(`[Apify Pipeline] Crawling newly discovered website: ${website}`);
        const webScraped = await scrapeWebsiteContacts(website);
        if (!contact_email && webScraped.contact_email) contact_email = webScraped.contact_email;
        if (!support_email && webScraped.support_email) support_email = webScraped.support_email;
        if (!founder_email && webScraped.founder_email) founder_email = webScraped.founder_email;
        if (!instagram && webScraped.instagram) instagram = webScraped.instagram;
        if (!twitter && webScraped.twitter) twitter = webScraped.twitter;
        if (!linkedin && webScraped.linkedin) linkedin = webScraped.linkedin;
      }
    } catch (err: any) {
      console.error(`[Apify Pipeline] Google Search Scraper failed:`, err.message);
    }
  }

  // STEP 5: If Instagram exists, run Instagram Profile Scraper
  if (instagram && apifyToken) {
    try {
      console.log(`[Apify Pipeline] Instagram exists. Running Instagram Scraper for URL: ${instagram}`);
      const igResults = await runApifyInstagramScraper(instagram, apifyToken);
      if (igResults && igResults.length > 0) {
        const igProfile = igResults[0];
        const igBio = igProfile.biography || igProfile.bio || '';
        const igEmailMatch = igBio.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        
        if (!contact_email && igEmailMatch) {
          contact_email = igEmailMatch[0];
          console.log(`[Apify Pipeline] Found email from Instagram bio: ${contact_email}`);
        }
        if (!website && igProfile.externalUrl) {
          website = igProfile.externalUrl;
          console.log(`[Apify Pipeline] Discovered website from Instagram profile: ${website}`);
        }
      }
    } catch (err: any) {
      console.error(`[Apify Pipeline] Instagram Scraper failed:`, err.message);
    }
  }

  // 4. Calculate verification status
  const email_verified = !!(contact_email && contact_email.includes('@'));
  const website_found = !!website;
  const social_links_found = !!(instagram || twitter || linkedin || facebook || tiktok || discord);

  // Helper to classify email verification status
  let verification_status = 'No Email Found';
  if (contact_email) {
    const emailStr = contact_email.trim().toLowerCase();
    const isGeneric = /@(gmail|yahoo|outlook|hotmail|aol|live|msn|icloud|mail)\.com$/i.test(emailStr);
    verification_status = isGeneric ? 'Likely Email' : 'Verified Email';
  }

  // 5. Calculate Lead Score (0 - 100)
  let lead_score = 15;
  if (contact_email) lead_score += 40;
  if (email_verified) lead_score += 10;
  if (website_found) lead_score += 15;
  if (instagram) lead_score += 5;
  if (twitter) lead_score += 5;
  if (linkedin) lead_score += 5;
  if (facebook) lead_score += 5;
  if (phone || contact_form || address) lead_score += 10;
  lead_score = Math.min(100, lead_score);

  return {
    contact_email,
    support_email,
    founder_email,
    website,
    instagram,
    twitter,
    linkedin,
    facebook,
    tiktok,
    discord,
    phone,
    contact_form,
    address,
    calendly,
    booking_link,
    newsletter,
    company_name,
    agency,
    store,
    email_verified,
    website_found,
    social_links_found,
    lead_score,
    verification_status,
  };
}
