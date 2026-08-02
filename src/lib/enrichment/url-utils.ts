/**
 * CTRForge Enrichment Pipeline — URL Validation Utilities
 * 
 * Shared helpers for validating and filtering external URLs.
 * Prevents YouTube internal URLs (ytimg.com, ggpht.com, etc.)
 * from being incorrectly saved as creator websites.
 * 
 * Used by:
 *   - YouTubeProvider
 *   - ApifyProvider
 *   - WebsiteCrawlerProvider
 *   - Discovery route (isCrawlableWebsite)
 *   - scraper.ts (extractWebsite)
 */

/**
 * Domains that are internal YouTube infrastructure.
 * These should NEVER be saved as a creator's website.
 */
const YOUTUBE_INTERNAL_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'ytimg.com',
  'yt3.ggpht.com',
  'i.ytimg.com',
  'yt3.googleusercontent.com',
  'googlevideo.com',
  'youtubei.googleapis.com',
  'gstatic.com',
  'googleusercontent.com',
  'ggpht.com',
  'google.com',
  'googleapis.com',
  'youtube-nocookie.com',
  'i.ytimg',
];

/**
 * Major social media platform domains.
 * These are valid social links but not "official website" candidates.
 */
const SOCIAL_PLATFORM_DOMAINS = [
  'instagram.com',
  'instagr.am',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'discord.gg',
  'discord.com',
  'pinterest.com',
  'reddit.com',
  'snapchat.com',
  'threads.net',
  'mastodon.social',
];

/**
 * Check if a URL is a YouTube internal domain.
 * Returns true if the URL belongs to YouTube infrastructure.
 * 
 * @param url - URL string to check
 * @returns true if the URL is a YouTube internal URL
 */
export function isYouTubeInternalUrl(url: string | null | undefined): boolean {
  if (!url) return true; // null/empty = not valid
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return YOUTUBE_INTERNAL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false; // malformed URL, let other validation handle it
  }
}

/**
 * Check if a URL is a valid external business website.
 * Returns true only for genuine business domains that are:
 *   1. Not YouTube internal URLs
 *   2. Not social media platforms
 *   3. Not common infrastructure domains
 * 
 * @param url - URL string to validate
 * @returns true if the URL is a valid external website
 */
export function isValidExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block YouTube internal domains
    if (YOUTUBE_INTERNAL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    )) {
      return false;
    }

    // Block social media platforms (these are social links, not "websites")
    if (SOCIAL_PLATFORM_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    )) {
      return false;
    }

    // Block common non-business infrastructure
    const infraDomains = [
      'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
      'linktr.ee', 'patreon.com', 'ko-fi.com',
      'bit.ly', 'goo.gl', 'tinyurl.com', 't.co',
      'dicebear.com', 'unsplash.com', 'images.unsplash.com',
    ];
    if (infraDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    )) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL that may be a YouTube redirect.
 * YouTube wraps external links in redirect URLs like:
 *   https://www.youtube.com/redirect?q=https://example.com
 *   https://www.google.com/url?q=https://example.com
 * 
 * This resolves the redirect and returns the actual destination URL.
 * 
 * @param url - URL that may be a redirect
 * @returns The resolved destination URL
 */
export function resolveYouTubeRedirect(url: string): string {
  if (!url) return url;
  try {
    if (url.includes('youtube.com/redirect') || url.includes('google.com/url')) {
      const urlObj = new URL(url);
      const resolved = urlObj.searchParams.get('q') || urlObj.searchParams.get('url');
      if (resolved) return resolved;
    }
  } catch {
    // ignore parse errors
  }
  return url;
}
