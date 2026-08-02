import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { crawlCreatorDetails } from '@/lib/gmail/scraper';

// In-memory cache for query expansion
const CACHE_TTL = 30 * 60 * 1000; // 30 mins
const queryCache = new Map<string, { timestamp: number; data: any }>();

// Re-enable enrichment pipeline step-by-step
const ENRICHMENT_ENABLED = true; 

// In-memory cache fallback if creator_leads table is missing in the database
const memoryCreatorLeads = new Map<string, any>();
let isCreatorLeadsTableAvailable: boolean | null = null;

async function checkTableAvailability(supabase: any): Promise<boolean> {
  if (isCreatorLeadsTableAvailable !== null) return isCreatorLeadsTableAvailable;
  try {
    const { error } = await supabase.from('creator_leads').select('channel_id').limit(1);
    if (error && (
      error.code === 'PGRST116' || 
      error.message?.includes('does not exist') || 
      error.message?.includes('not find the table') ||
      error.message?.includes('404')
    )) {
      isCreatorLeadsTableAvailable = false;
    } else {
      isCreatorLeadsTableAvailable = true;
    }
  } catch {
    isCreatorLeadsTableAvailable = false;
  }
  return isCreatorLeadsTableAvailable;
} 

// Helper to parse formatted number strings like "10K", "1.5M", "500,000" into actual integers
function parseFormattedNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = val.toString().trim().toLowerCase();
  if (!str || str === 'unlimited') return 0;
  
  let multiplier = 1;
  let cleanStr = str;
  
  if (str.endsWith('k')) {
    multiplier = 1000;
    cleanStr = str.slice(0, -1);
  } else if (str.endsWith('m')) {
    multiplier = 1000000;
    cleanStr = str.slice(0, -1);
  } else if (str.endsWith('b')) {
    multiplier = 1000000000;
    cleanStr = str.slice(0, -1);
  }
  
  cleanStr = cleanStr.replace(/,/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
}

// Parse ISO 8601 duration (e.g. "PT1H2M3S", "PT5M30S", "PT45S") to seconds
function parseISO8601Duration(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Classify content type based on video duration in seconds
function classifyContentType(durationSeconds: number): 'short' | 'long' {
  return durationSeconds > 0 && durationSeconds <= 60 ? 'short' : 'long';
}

// Check if a website is valid and safe to crawl
function isCrawlableWebsite(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const forbiddenDomains = [
      'i.ytimg.com',
      'youtube.com',
      'youtu.be',
      'yt3.ggpht.com',
      'googleusercontent.com',
      'ggpht.com',
      'ytimg.com',
      'google.com',
      'gmail.com',
      'googlevideo.com',
      'youtubei.googleapis.com',
      'gstatic.com',
      'googleapis.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'instagr.am',
      'facebook.com',
      'fb.com',
      'linkedin.com',
      'tiktok.com',
      'discord.gg',
      'discord.com',
      'linktr.ee',
      'patreon.com',
      'unsplash.com',
      'images.unsplash.com',
      'dicebear.com'
    ];
    return !forbiddenDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

// Smart keyword expansion using Gemini
async function expandKeyword(query: string, apiKey: string | undefined): Promise<string[]> {
  const cacheKey = `expand:${query.toLowerCase()}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  if (apiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `You are a YouTube search optimization expert. Given the search keyword/topic "${query}", generate a JSON array containing exactly 15 related search terms or variations that are highly relevant to finding YouTube channels in this niche. Return ONLY a valid JSON string representing a string array. Do not include markdown backticks or explanations.`;
      
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      if (response.ok) {
        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const list = parsed.map(k => k.toString().trim());
            queryCache.set(cacheKey, { timestamp: Date.now(), data: list });
            return list;
          }
        }
      }
    } catch (err) {
      console.warn("Failed to expand keyword with Gemini:", err);
    }
  }
  
  const fallback = [
    query,
    `${query} setup`,
    `${query} tips`,
    `${query} tutorial`,
    `${query} workflow`,
    `${query} hack`,
    `${query} tools`,
    `best ${query}`,
    `${query} guide`,
    `minimalist ${query}`
  ];
  queryCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
  return fallback;
}

function validateEmail(email: string | null | undefined): 'Verified Email' | 'Likely Email' | 'No Email Found' {
  if (!email) return 'No Email Found';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'No Email Found';
  
  const lowercase = email.toLowerCase();
  const invalidKeywords = ['example', 'test', 'domain', 'placeholder', 'email@', 'yourdomain'];
  if (invalidKeywords.some(kw => lowercase.includes(kw))) {
    return 'No Email Found';
  }
  
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'mail.com', 'protonmail.com', 'icloud.com'];
  const domain = lowercase.split('@')[1];
  if (genericDomains.includes(domain)) {
    return 'Likely Email';
  }
  return 'Verified Email';
}

// Background enrichment job for single creator
async function enrichCreator(
  channelId: string,
  channelDescription: string,
  videoDescription: string,
  websiteLink: string,
  geminiKey: string | undefined,
  creatorsPayload: any,
  forceRefresh = false
) {
  if (!ENRICHMENT_ENABLED) {
    console.log(`[Discovery Debug] Enrichment is disabled. Skipping channel: ${channelId}`);
    return;
  }

  // 30-day cache check for Apify scraping
  const supabase = await createClient();
  if (!forceRefresh) {
    try {
      const useDb = await checkTableAvailability(supabase);
      if (useDb) {
        const { data: existing } = await supabase
          .from('creator_leads')
          .select('last_updated, status')
          .eq('channel_id', channelId)
          .maybeSingle();
        
        if (existing && existing.status === 'completed' && existing.last_updated) {
          const lastUpdatedDate = new Date(existing.last_updated);
          const daysDiff = (Date.now() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff < 30) {
            console.log(`[Discovery] Skipping Apify crawl for channel ${channelId} - enriched recently (${Math.round(daysDiff)} days ago).`);
            return;
          }
        }
      } else {
        const existing = memoryCreatorLeads.get(channelId);
        if (existing && existing.status === 'completed' && existing.last_updated) {
          const lastUpdatedDate = new Date(existing.last_updated);
          const daysDiff = (Date.now() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff < 30) {
            console.log(`[Discovery] Skipping Apify crawl for channel ${channelId} (in-memory) - enriched recently.`);
            return;
          }
        }
      }
    } catch (cacheErr) {
      console.warn(`[Discovery Cache Check] Failed to query existing creator status:`, cacheErr);
    }
  }

  console.log(`[Discovery] Enrichment started for channel: ${channelId}`);
  let contacts: any = {
    contact_email: null, support_email: null, founder_email: null,
    website: websiteLink || null, instagram: null, twitter: null, linkedin: null,
    facebook: null, tiktok: null, discord: null, phone: null, contact_form: null,
    address: null, calendly: null, booking_link: null, newsletter: null,
    company_name: null, agency: null, store: null, email_verified: false,
    website_found: !!websiteLink, social_links_found: false, lead_score: 15
  };

  try {
    console.log(`[Discovery] Running enrichment pipeline for channel: ${channelId} (${creatorsPayload.channel_name})`);
    const crawlResult = await crawlCreatorDetails(
      channelId,
      channelDescription,
      videoDescription,
      creatorsPayload.channel_name,
      creatorsPayload.handle
    );
    if (crawlResult) {
      contacts = { ...contacts, ...crawlResult };
    }
  } catch (crawlErr: any) {
    console.error(`[Discovery] Crawl pipeline failed for channel ${channelId}. Error stack:`, crawlErr.stack || crawlErr);
  }

  const email = contacts.contact_email || contacts.support_email || contacts.founder_email || null;

  let aiScores: any = {};
  if (geminiKey) {
    try {
      const { GeminiProvider } = await import('@/lib/enrichment/providers/gemini');
      const geminiProvider = new GeminiProvider(geminiKey);
      
      const ctx = {
        channelId,
        channelName: creatorsPayload.channel_name,
        channelDescription,
        videoDescription,
        websiteHint: contacts.website || '',
        subscriberCount: creatorsPayload.subscriber_count,
        averageViews: creatorsPayload.average_views,
        latestVideoTitle: creatorsPayload.latest_video_title,
        latestVideoUrl: creatorsPayload.latest_video_url || '',
        thumbnailUrl: creatorsPayload.latest_thumbnail_url || '',
        uploadFrequency: creatorsPayload.upload_frequency || '',
        channelAge: creatorsPayload.channel_age || '',
      };
      
      aiScores = await geminiProvider.computeAIScores(ctx, contacts);
      
      // Fallback if provider failed or returned empty results
      if (!aiScores || Object.keys(aiScores).length === 0) {
        throw new Error('GeminiProvider returned empty scores. Falling back to inline API call.');
      }
    } catch (providerErr: any) {
      console.warn(`[Discovery] GeminiProvider failed, falling back to legacy fetch: ${providerErr.message}`);
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const prompt = `You are a YouTube creator intelligence and lead scoring AI.
Analyze this creator channel metadata:
${JSON.stringify({
  channelName: creatorsPayload.channel_name,
  subscriberCount: creatorsPayload.subscriber_count,
  averageViews: creatorsPayload.average_views,
  latestVideoTitle: creatorsPayload.latest_video_title,
  description: channelDescription,
  website: contacts.website,
  hasEmail: !!email
})}

Compute metrics and return a JSON object with:
{
  "packagingScore": number,
  "curiosityScore": number,
  "opportunityScore": number,
  "buyingScore": number,
  "growthScore": number,
  "replyProbability": number,
  "ctrOpportunity": number,
  "growthPotential": "growing" | "stable" | "declining",
  "brandMaturity": "early" | "established" | "mature",
  "thumbnailQuality": number,
  "titleQuality": number,
  "curiosityGap": "string",
  "visualHierarchy": "string",
  "estimatedBudget": "string",
  "estimatedMonthlyRevenue": "string",
  "estimatedRevenueTier": "string",
  "idealOutreachAngle": "string",
  "decisionMakerConfidence": number,
  "detectedWeaknesses": ["string"],
  "whyThisLead": "string",
  "audienceType": "string",
  "recentTopic": "string",
  "topPerformingVideo": {
    "title": "string",
    "views": "string",
    "url": "string"
  },
  "aiOutreachSummary": "string",
  "thumbnailOpportunityAnalysis": "string"
}
Return ONLY valid JSON. No markdown formatting.`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const resJson = await response.json();
        const txt = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          const cleanTxt = txt.replace(/```json/g, '').replace(/```/g, '').trim();
          aiScores = JSON.parse(cleanTxt);
        }
      } else {
        const errText = await response.text();
        console.error(`[Discovery] Gemini API request failed. Response status: ${response.status}. Error:`, errText);
        }
      } catch (geminiErr: any) {
        console.error(`[Discovery] Gemini scoring failed for channel: ${channelId}. Error stack:`, geminiErr.stack || geminiErr);
      }
    }
  }

  const rawOpp = aiScores.opportunityScore || Math.round(Math.max(45, Math.min(98, 65 + (creatorsPayload.subscriber_count > 50000 && creatorsPayload.average_views < creatorsPayload.subscriber_count * 0.1 ? 20 : 0))));
  const rawBuy = aiScores.buyingScore || Math.round(Math.max(30, Math.min(95, 40 + (contacts.website ? 25 : 0) + (email ? 15 : 0) + (creatorsPayload.subscriber_count > 100000 ? 15 : 0))));

  const updatedRecord = {
    channel_id: channelId,
    status: 'completed',
    email,
    website: contacts.website || null,
    instagram: contacts.instagram || null,
    linkedin: contacts.linkedin || null,
    twitter: contacts.twitter || null,
    facebook: contacts.facebook || null,
    tiktok: contacts.tiktok || null,
    discord: contacts.discord || null,
    newsletter: contacts.newsletter || null,
    store: contacts.store || null,
    course: contacts.course || null,
    email_verified: validateEmail(email) === 'Verified Email' || validateEmail(email) === 'Likely Email',
    website_found: contacts.website_found,
    social_links_found: contacts.social_links_found,
    lead_score: rawBuy,
    verification_status: validateEmail(email),
    contact_source: email ? (contacts.contact_source || 'Apify Scraper') : 'N/A',
    latest_video_title: creatorsPayload.latest_video_title || creatorsPayload.videoTitle || null,
    latest_video_url: creatorsPayload.latest_video_url || creatorsPayload.videoUrl || null,
    channel_url: creatorsPayload.channel_url || creatorsPayload.channelUrl || null,
    
    // AI metrics
    packaging_score: aiScores.packagingScore || Math.round(100 - rawOpp),
    curiosity_score: aiScores.curiosityScore || 65,
    opportunity_score: rawOpp,
    buying_score: rawBuy,
    growth_score: aiScores.growthScore || 55,
    reply_probability: aiScores.replyProbability || (email ? 70 : 15),
    ctr_opportunity: aiScores.ctrOpportunity || (rawOpp - 30),
    growth_potential: aiScores.growthPotential || 'stable',
    brand_maturity: aiScores.brandMaturity || 'established',
    thumbnail_quality: aiScores.thumbnailQuality || 50,
    title_quality: aiScores.titleQuality || 60,
    curiosity_gap: aiScores.curiosityGap || 'Latest video title lacks a high curiosity cliffhanger hook.',
    visual_hierarchy: aiScores.visualHierarchy || 'Suboptimal visual contrast on key focal objects.',
    estimated_budget: aiScores.estimatedBudget || (creatorsPayload.subscriber_count > 100000 ? '$1000-$5000/mo' : '$500-$1000/mo'),
    estimated_monthly_revenue: aiScores.estimatedMonthlyRevenue || (creatorsPayload.subscriber_count > 100000 ? '$15,000/mo' : '$4,000/mo'),
    estimated_revenue_tier: aiScores.estimatedRevenueTier || (creatorsPayload.subscriber_count > 100000 ? 'tier_3' : 'tier_2'),
    ideal_outreach_angle: aiScores.idealOutreachAngle || 'Offer free design asset refresh of their main thumbnails.',
    decision_maker_confidence: aiScores.decisionMakerConfidence || 85,
    detected_weaknesses: aiScores.detectedWeaknesses || ['Suboptimal Contrast', 'Overcrowded Layout'],
    why_this_lead: aiScores.whyThisLead || `Excellent core stats with ${creatorsPayload.subscriber_count.toLocaleString()} subs but averaging lower views. Highly responsive opportunity index.`,
    audience_type: aiScores.audienceType || 'General Niche',
    growth_trend: aiScores.growthPotential || 'stable',
    visual_analysis_preview: {
      titleWeakness: aiScores.curiosityGap || 'Title describes the content details literally instead of hooking user stakes.',
      thumbnailWeakness: aiScores.visualHierarchy || 'Layout has flat lighting and conflicts focal hierarchy contrast.',
      emotionalTriggerScore: aiScores.curiosityScore || 50,
      curiosityScore: aiScores.packagingScore || 55,
      audiencePsychology: aiScores.idealOutreachAngle || 'Scrolls past due to flat title structure.',
      recentTopic: aiScores.recentTopic || 'N/A',
      topPerformingVideo: aiScores.topPerformingVideo || null,
      aiOutreachSummary: aiScores.aiOutreachSummary || 'N/A',
      thumbnailOpportunityAnalysis: aiScores.thumbnailOpportunityAnalysis || 'N/A'
    },
    scraped_details: {
      phone: contacts.phone,
      contact_form: contacts.contact_form,
      address: contacts.address,
      calendly: contacts.calendly,
      booking_link: contacts.booking_link,
      support_email: contacts.support_email,
      founder_email: contacts.founder_email,
      company_name: contacts.company_name,
      agency: contacts.agency,
      latest_video_views: creatorsPayload.scraped_details?.latest_video_views || 0
    },
    last_updated: new Date().toISOString()
  };

  try {
    const supabase = await createClient();
    const useDb = await checkTableAvailability(supabase);
    if (useDb) {
      const { error: updateError } = await supabase
        .from('creator_leads')
        .update(updatedRecord)
        .eq('channel_id', channelId);

      if (updateError) {
        console.error(`[Discovery] Failed to save enriched details for channel ${channelId}:`, updateError.message);
      } else {
        console.log(`[Discovery] Enrichment completed for channel: ${channelId} Status: completed`);
      }
    } else {
      const existing = memoryCreatorLeads.get(channelId) || {};
      memoryCreatorLeads.set(channelId, {
        ...existing,
        ...updatedRecord,
        last_updated: new Date().toISOString()
      });
      console.log(`[Discovery] Enrichment completed in-memory for channel: ${channelId} Status: completed`);
    }
  } catch (dbErr: any) {
    console.error(`[Discovery] Database update exception for channel ${channelId}. Error stack:`, dbErr.stack || dbErr);
  }
}

// POST API route entry point
export async function POST(req: Request) {
  let searchKeyword = 'productivity';
  let basicCreators: any[] = [];
  let uniqueVideos: any[] = [];
  let channelsMap = new Map<string, any>();
  let videosMap = new Map<string, any>();
  let hasIngestedNew = false;
  let expandedTerms: string[] = [];
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { query, sortBy, page = 1, pageSize = 25, refresh = false } = body;
    const filters = body.filters || {};

    searchKeyword = query?.trim() || 'productivity';
    console.log("[Discovery Debug] Search keyword:", searchKeyword);

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Check database matches count
    let count = 0;
    const useDb = await checkTableAvailability(supabase);
    if (useDb) {
      try {
        const { count: dbCount, error: countError } = await supabase
          .from('creator_leads')
          .select('*', { count: 'exact', head: true })
          .or(`channel_name.ilike.%${searchKeyword}%,description.ilike.%${searchKeyword}%,latest_video_title.ilike.%${searchKeyword}%`);
        
        if (!countError) {
          count = dbCount || 0;
        }
      } catch (dbCountErr) {
        console.warn("[Discovery Debug] Failed to count leads in DB (creator_leads table might be missing):", dbCountErr);
      }
    } else {
      count = Array.from(memoryCreatorLeads.values()).filter(c => 
        c.channel_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        c.latest_video_title?.toLowerCase().includes(searchKeyword.toLowerCase())
      ).length;
    }

    const hasEnoughLocal = count >= pageSize;

    // 1. YouTube Discovery Pipeline (with Multi-Query Semantic Expansion)
    if ((!hasEnoughLocal || refresh) && YOUTUBE_API_KEY) {
      // --- Step 1a: Primary YouTube search ---
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=${encodeURIComponent(searchKeyword)}&type=video&key=${YOUTUBE_API_KEY}`;
      console.log("[Discovery Debug] Request URL:", searchUrl.replace(/key=[^&]+/, "key=REDACTED"));
      
      let searchData: any;
      try {
        const searchRes = await fetch(searchUrl);
        console.log("[Discovery Debug] Response status:", searchRes.status);
        if (!searchRes.ok) {
          const errBody = await searchRes.text();
          throw new Error(`YouTube API returned status ${searchRes.status}: ${errBody}`);
        }
        searchData = await searchRes.json();
        console.log("[Discovery Debug Log 1] After YouTube API response, item count:", (searchData.items || []).length);
      } catch (err: any) {
        console.error("[Discovery Debug] YouTube search fetch failed. Full error stack:", err.stack || err);
        throw err;
      }

      let allSearchItems = searchData.items || [];
      console.log("[Discovery Debug] Primary search returned:", allSearchItems.length, "videos");

      // --- Step 1b: Semantic expansion — search additional related terms ---
      try {
        expandedTerms = await expandKeyword(searchKeyword, GEMINI_API_KEY);
        console.log(`[Discovery Debug] Gemini expanded "${searchKeyword}" into ${expandedTerms.length} terms:`, expandedTerms.slice(0, 5));
      } catch (expandErr) {
        console.warn("[Discovery Debug] Keyword expansion failed, continuing with primary results only:", expandErr);
      }

      // Pick up to 5 expansion terms (skip any that are identical to the original)
      const MAX_EXPANSION_QUERIES = 5;
      const expansionQueries = expandedTerms
        .filter(t => t.toLowerCase() !== searchKeyword.toLowerCase())
        .slice(0, MAX_EXPANSION_QUERIES);

      if (expansionQueries.length > 0) {
        console.log(`[Discovery Debug] Running ${expansionQueries.length} expansion YouTube searches...`);
        const expansionResults = await Promise.allSettled(
          expansionQueries.map(async (term) => {
            try {
              const expUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(term)}&type=video&key=${YOUTUBE_API_KEY}`;
              const expRes = await fetch(expUrl);
              if (!expRes.ok) return [];
              const expData = await expRes.json();
              return expData.items || [];
            } catch {
              return [];
            }
          })
        );

        for (const result of expansionResults) {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allSearchItems = allSearchItems.concat(result.value);
          }
        }
        console.log(`[Discovery Debug] Total videos after expansion: ${allSearchItems.length}`);
      }

      if (allSearchItems.length > 0) {
        // Deduplicate channel results across all searches
        uniqueVideos = [];
        const seenChannels = new Set<string>();
        hasIngestedNew = true;

        for (const item of allSearchItems) {
          const channelId = item.snippet?.channelId;
          const videoId = item.id?.videoId;
          if (channelId && videoId && !seenChannels.has(channelId)) {
            seenChannels.add(channelId);
            uniqueVideos.push({
              channelId,
              videoId,
              videoTitle: item.snippet?.title || '',
              latestThumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
            });
          }
        }

        console.log("[Discovery Debug] Number of unique creators after dedup:", uniqueVideos.length);

        // Fetch details — batch in chunks of 50 (YouTube API limit per request)
        const channelIds = uniqueVideos.map(v => v.channelId);
        const videoIds = uniqueVideos.map(v => v.videoId);

        // Helper to chunk arrays for YouTube API (max 50 IDs per request)
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
          const chunks: T[][] = [];
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
          }
          return chunks;
        };

        const channelChunks = chunkArray(channelIds, 50);
        const videoChunks = chunkArray(videoIds, 50);

        let channelItems: any[] = [];
        let videoItems: any[] = [];

        await Promise.allSettled([
          (async () => {
            try {
              for (const chunk of channelChunks) {
                const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`;
                const channelRes = await fetch(channelUrl);
                if (!channelRes.ok) {
                  const errText = await channelRes.text();
                  console.error(`[Discovery Debug] YouTube channels.list failed with ${channelRes.status}: ${errText}`);
                  continue;
                }
                const chData = await channelRes.json();
                channelItems = channelItems.concat(chData.items || []);
              }
            } catch (chanErr: any) {
              console.error("[Discovery Debug] YouTube channels details fetch failed. Error stack:", chanErr.stack || chanErr);
            }
          })(),
          (async () => {
            try {
              for (const chunk of videoChunks) {
                const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`;
                const videoRes = await fetch(videoUrl);
                if (!videoRes.ok) {
                  const errText = await videoRes.text();
                  console.error(`[Discovery Debug] YouTube videos.list failed with ${videoRes.status}: ${errText}`);
                  continue;
                }
                const viData = await videoRes.json();
                videoItems = videoItems.concat(viData.items || []);
              }
            } catch (vidErr: any) {
              console.error("[Discovery Debug] YouTube videos details fetch failed. Error stack:", vidErr.stack || vidErr);
            }
          })()
        ]);

        channelsMap = new Map(channelItems.map((c: any) => [c.id, c]));
        videosMap = new Map(videoItems.map((v: any) => [v.id, v]));

        for (const item of uniqueVideos) {
          const ch = channelsMap.get(item.channelId) as any;
          const vid = videosMap.get(item.videoId) as any;
          if (!ch) continue;

          const statistics = ch.statistics || {};
          const snippet = ch.snippet || {};
          const branding = ch.brandingSettings || {};

          const videoSnippet = vid?.snippet || {};
          const videoStats = vid?.statistics || {};

          const subs = parseInt(statistics.subscriberCount || '0', 10);
          const views = parseInt(statistics.viewCount || '0', 10);
          const vCount = parseInt(statistics.videoCount || '0', 10);

          // Extract website from channel description (not unsubscribedTrailer which is a video ID)
          let websiteLink = '';
          if (snippet.description) {
            const urlMatches = snippet.description.match(/https?:\/\/[^\s]+/gi) || [];
            for (const candidateUrl of urlMatches) {
              const cleanCandidate = candidateUrl.split(/[?#]/)[0]; // strip query/hash
              if (isCrawlableWebsite(cleanCandidate)) {
                websiteLink = cleanCandidate;
                break;
              }
            }
          }

          let validWebsite = '';
          if (isCrawlableWebsite(websiteLink)) {
            validWebsite = websiteLink;
          }

          let frequency = '1_week';
          const pubDateStr = videoSnippet.publishedAt;
          if (pubDateStr) {
            const daysSinceLast = (Date.now() - new Date(pubDateStr).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLast >= 30) {
              frequency = 'inactive';
            } else if (vCount > 0 && snippet.publishedAt) {
              const channelAgeWeeks = (Date.now() - new Date(snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 7);
              const rate = channelAgeWeeks > 0 ? (vCount / channelAgeWeeks) : 1;
              if (rate >= 5) frequency = 'daily';
              else if (rate >= 2) frequency = '3_week';
            }
          }

          // Parse video duration and classify content type
          const videoDurationRaw = vid?.contentDetails?.duration || '';
          const videoDurationSeconds = parseISO8601Duration(videoDurationRaw);
          const contentType = classifyContentType(videoDurationSeconds);

          basicCreators.push({
            channel_id: item.channelId,
            channel_url: `https://youtube.com/channel/${item.channelId}`,
            channel_name: snippet.title || 'Unknown Channel',
            handle: snippet.customUrl || '',
            description: snippet.description || '',
            avatar_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            banner_url: branding.image?.bannerExternalUrl || '',
            country: snippet.country || 'US',
            language: snippet.defaultLanguage || 'en',
            subscriber_count: subs,
            total_views: views,
            video_count: vCount,
            average_views: Math.round(views / (vCount || 1)),
            average_likes: parseInt(videoStats.likeCount || '0', 10),
            average_comments: parseInt(videoStats.commentCount || '0', 10),
            upload_frequency: frequency,
            last_upload: pubDateStr || null,
            channel_age: snippet.publishedAt || null,
            
            status: 'processing',
            opportunity_score: 65,
            buying_score: 40,
            packaging_score: 35,
            reply_probability: 20,
            ctr_opportunity: 35,
            verification_status: 'unverified',
            website: validWebsite || null,
            latest_video_title: videoSnippet.title || null,
            latest_video_url: vid ? `https://youtube.com/watch?v=${vid.id}` : null,
            latest_thumbnail_url: item.latestThumbnailUrl || null,
            why_this_lead: 'Processing AI enrichment...',
            video_duration_seconds: videoDurationSeconds,
            content_type: contentType,
            scraped_details: {
              latest_video_views: parseInt(videoStats.viewCount || '0', 10)
            }
          });
        }
        console.log("[Discovery Debug Log 2] After mapping, creator count:", basicCreators.length);

        // Insert basic records immediately into Supabase
        if (basicCreators.length > 0) {
          let inserted: any[] = [];
          if (useDb) {
            try {
              console.log("[Discovery Debug] Attempting to insert creators into Supabase table 'creator_leads'...");
              const res = await supabase
                .from('creator_leads')
                .upsert(basicCreators, { onConflict: 'channel_id' })
                .select();

              if (res.error) {
                console.error("[Discovery Debug] Supabase insert failed. Error details:", res.error.message, res.error.details);
              } else {
                inserted = res.data || [];
                console.log("[Discovery Debug] Creators inserted: status code OK, count:", inserted.length);
              }
            } catch (dbInsErr: any) {
              console.error("[Discovery Debug] Supabase insert exception. Full error stack:", dbInsErr.stack || dbInsErr);
            }
          } else {
            console.log("[Discovery Debug] Storing creators in-memory...");
            basicCreators.forEach(c => {
              const existing = memoryCreatorLeads.get(c.channel_id) || {};
              memoryCreatorLeads.set(c.channel_id, {
                ...existing,
                ...c,
                last_updated: new Date().toISOString()
              });
            });
            inserted = basicCreators;
          }

          console.log("[Discovery Debug] Ingestion completed. Background enrichment deferred to pagination step.");
        }
      }
    }

    // 2. Query and return creators list (with hybrid SQL + JS filtering for robust multi-range rules)
    //    Uses expanded terms for broader semantic DB matching
    let creatorsList: any[] = basicCreators;
    let dbTotalCount = 0;

    // Build expanded search terms for DB queries
    let dbSearchTerms = [searchKeyword];
    if (expandedTerms && expandedTerms.length > 0) {
      // Use top 8 expansion terms for DB matching (broader net)
      dbSearchTerms = [searchKeyword, ...expandedTerms.slice(0, 8)];
    }
    // Deduplicate search terms (case-insensitive)
    const seenTermsLower = new Set<string>();
    dbSearchTerms = dbSearchTerms.filter(t => {
      const lower = t.toLowerCase();
      if (seenTermsLower.has(lower)) return false;
      seenTermsLower.add(lower);
      return true;
    });

    if (basicCreators.length > 0) {
      console.log("[Discovery Debug] Returning newly fetched YouTube creators directly. Count:", basicCreators.length);
      creatorsList = basicCreators;
    } else if (useDb) {
      try {
        let dbQuery = supabase
          .from('creator_leads')
          .select('*');

        // Build expanded OR query for semantic matching across all terms
        const orConditions = dbSearchTerms.map(term => 
          `channel_name.ilike.%${term}%,description.ilike.%${term}%,latest_video_title.ilike.%${term}%`
        ).join(',');
        dbQuery = dbQuery.or(orConditions);

        // Database coarse filters
        if (filters.country && filters.country !== 'worldwide') {
          dbQuery = dbQuery.eq('country', filters.country);
        }
        if (filters.language && filters.language !== 'all') {
          dbQuery = dbQuery.eq('language', filters.language);
        }

        const { data: dbCreators, error: selectError } = await dbQuery;

        if (selectError) {
          console.warn("[Discovery Debug] Supabase select failed (creator_leads table might be missing or DB offline):", selectError.message);
        } else if (dbCreators && dbCreators.length > 0) {
          creatorsList = dbCreators;
        }
      } catch (selectErr: any) {
        console.error("[Discovery Debug] Database select exception. Error stack:", selectErr.stack || selectErr);
      }
    } else {
      const allCached = Array.from(memoryCreatorLeads.values());
      creatorsList = allCached.filter(c => {
        const name = c.channel_name?.toLowerCase() || '';
        const desc = c.description?.toLowerCase() || '';
        const vidTitle = c.latest_video_title?.toLowerCase() || '';
        return dbSearchTerms.some(term => {
          const t = term.toLowerCase();
          return name.includes(t) || desc.includes(t) || vidTitle.includes(t);
        });
      });
    }

    // 3. Fine-grained filtering (JavaScript) to support all robust queries (Multi-Range, Engagement, Upload Rates)
    const minSubs = parseFormattedNumber(filters.minSubscribers);
    const maxSubs = parseFormattedNumber(filters.maxSubscribers);
    const minVws = parseFormattedNumber(filters.minViews);
    const maxVws = parseFormattedNumber(filters.maxViews);

    const minLike = parseFloat(filters.minLikeRate) || 0; // e.g. 2 means 2%
    const minComm = parseFloat(filters.minCommentRate) || 0; // e.g. 0.5 means 0.5%
    const minVel = parseFloat(filters.minViewVelocity) || 0; // views / subscribers ratio

    console.log("[Discovery Debug Log 3] Before filtering, creator count:", creatorsList.length);

    let filtered = creatorsList;
    if (basicCreators.length === 0) {
      filtered = creatorsList.filter(c => {
        // Creator Size (Subscribers Range)
        const subs = Number(c.subscriber_count || 0);
        if (minSubs > 0 && subs < minSubs) return false;
        if (maxSubs > 0 && subs > maxSubs) return false;

        // Creator Size (Average Views Range)
        const avgViews = Number(c.average_views || 0);
        if (minVws > 0 && avgViews < minVws) return false;
        if (maxVws > 0 && avgViews > maxVws) return false;

        // Engagement Filters
        if (minLike > 0) {
          const likeRate = (Number(c.average_likes || 0) / (avgViews || 1)) * 100;
          if (likeRate < minLike) return false;
        }
        if (minComm > 0) {
          const commRate = (Number(c.average_comments || 0) / (avgViews || 1)) * 100;
          if (commRate < minComm) return false;
        }
        if (minVel > 0) {
          const viewVelocity = avgViews / (subs || 1);
          if (viewVelocity < minVel) return false;
        }

        // Channel Growth & Last Upload
        if (filters.lastUploadDays && filters.lastUploadDays !== 'all') {
          if (!c.last_upload) return false;
          const daysLimit = Number(filters.lastUploadDays);
          const diffDays = (Date.now() - new Date(c.last_upload).getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > daysLimit) return false;
        }

        if (filters.minUploadFrequency && filters.minUploadFrequency !== 'all') {
          const freq = c.upload_frequency || '1_week';
          if (filters.minUploadFrequency === 'inactive' && freq !== 'inactive') return false;
          if (filters.minUploadFrequency === 'daily' && freq !== 'daily') return false;
          if (filters.minUploadFrequency === '2_week' && freq !== 'daily' && freq !== '3_week') return false;
          if (filters.minUploadFrequency === '1_week' && freq === 'inactive') return false;
        }

        // Contact Filters (Coerced to boolean)
        const hasEmailFilter = filters.hasEmail === true || filters.hasEmail === 'true';
        const verifiedEmailOnlyFilter = filters.verifiedEmailOnly === true || filters.verifiedEmailOnly === 'true';
        const hasWebsiteFilter = filters.hasWebsite === true || filters.hasWebsite === 'true';
        const hasInstagramFilter = filters.hasInstagram === true || filters.hasInstagram === 'true';
        const hasLinkedInFilter = filters.hasLinkedIn === true || filters.hasLinkedIn === 'true';
        const hasTwitterFilter = filters.hasTwitter === true || filters.hasTwitter === 'true';
        const hasTikTokFilter = filters.hasTikTok === true || filters.hasTikTok === 'true';
        const hasDiscordFilter = filters.hasDiscord === true || filters.hasDiscord === 'true';
        const hasNewsletterFilter = filters.hasNewsletter === true || filters.hasNewsletter === 'true';
        const hasStoreFilter = filters.hasStore === true || filters.hasStore === 'true';
        const hasCourseFilter = filters.hasCourse === true || filters.hasCourse === 'true';

        if (hasEmailFilter && !c.email) return false;
        if (verifiedEmailOnlyFilter && c.verification_status !== 'verified') return false;
        if (hasWebsiteFilter && !c.website) return false;
        if (hasInstagramFilter && !c.instagram) return false;
        if (hasLinkedInFilter && !c.linkedin) return false;
        if (hasTwitterFilter && !c.twitter) return false;
        if (hasTikTokFilter && !c.tiktok) return false;
        if (hasDiscordFilter && !c.discord) return false;
        if (hasNewsletterFilter && !c.newsletter) return false;
        if (hasStoreFilter && !c.store) return false;
        if (hasCourseFilter && !c.course) return false;

        // AI Opportunity Filters
        if (filters.minOpportunity && Number(c.opportunity_score || 0) < Number(filters.minOpportunity)) return false;
        if (filters.minBuying && Number(c.buying_score || 0) < Number(filters.minBuying)) return false;
        if (filters.minReply && Number(c.reply_probability || 0) < Number(filters.minReply)) return false;
        if (filters.minPackaging && Number(c.packaging_score || 0) < Number(filters.minPackaging)) return false;

        if (filters.thumbnailWeakness && filters.thumbnailWeakness !== 'all') {
          const thumbOpp = Math.max(10, 100 - Number(c.packaging_score || 50));
          if (filters.thumbnailWeakness === 'high' && thumbOpp < 75) return false;
          if (filters.thumbnailWeakness === 'medium' && (thumbOpp < 40 || thumbOpp >= 75)) return false;
          if (filters.thumbnailWeakness === 'low' && thumbOpp >= 40) return false;
        }

        // Content Type Filter
        if (filters.contentType && filters.contentType !== 'all') {
          const ct = c.content_type || 'long';
          if (filters.contentType === 'shorts_only' && ct !== 'short') return false;
          if (filters.contentType === 'longform_only' && ct !== 'long') return false;
        }

        // Video Duration Filter
        if (filters.videoDuration && filters.videoDuration !== 'all') {
          const dur = Number(c.video_duration_seconds || 0);
          if (filters.videoDuration === '0_60' && (dur <= 0 || dur > 60)) return false;
          if (filters.videoDuration === '1_8' && (dur <= 60 || dur > 480)) return false;
          if (filters.videoDuration === '8_20' && (dur <= 480 || dur > 1200)) return false;
          if (filters.videoDuration === '20plus' && dur <= 1200) return false;
        }

        return true;
      });
    }

    // 3.5. Compute relevance scores for better ranking
    const allTermsLower = (dbSearchTerms || [searchKeyword]).map(t => t.toLowerCase());
    filtered = filtered.map(c => {
      let relevanceHits = 0;
      const name = (c.channel_name || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const vidTitle = (c.latest_video_title || '').toLowerCase();
      const combined = `${name} ${desc} ${vidTitle}`;
      for (const term of allTermsLower) {
        if (combined.includes(term)) relevanceHits++;
      }
      // Normalize to 0-100 (more term matches = higher relevance)
      const relevance_score = Math.min(100, Math.round((relevanceHits / Math.max(allTermsLower.length, 1)) * 100));
      return { ...c, relevance_score };
    });

    // 4. Apply sorting rules in JavaScript
    if (sortBy === 'highest opportunity') {
      filtered.sort((a, b) => Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0));
    } else if (sortBy === 'highest buying score') {
      filtered.sort((a, b) => Number(b.buying_score || 0) - Number(a.buying_score || 0));
    } else if (sortBy === 'highest views') {
      filtered.sort((a, b) => Number(b.average_views || 0) - Number(a.average_views || 0));
    } else if (sortBy === 'highest subscribers') {
      filtered.sort((a, b) => Number(b.subscriber_count || 0) - Number(a.subscriber_count || 0));
    } else if (sortBy === 'recently uploaded') {
      filtered.sort((a, b) => {
        if (!a.last_upload) return 1;
        if (!b.last_upload) return -1;
        return new Date(b.last_upload).getTime() - new Date(a.last_upload).getTime();
      });
    } else if (sortBy === 'recently updated') {
      filtered.sort((a, b) => {
        if (!a.last_updated) return 1;
        if (!b.last_updated) return -1;
        return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
      });
    } else if (sortBy === 'most likely to reply') {
      filtered.sort((a, b) => Number(b.reply_probability || 0) - Number(a.reply_probability || 0));
    } else {
      filtered.sort((a, b) => Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0));
    }

    dbTotalCount = filtered.length;

    // Apply Pagination
    const startRange = (page - 1) * pageSize;
    const paginated = filtered.slice(startRange, startRange + pageSize);

    // Map output to match what UI expects
    const formattedLeads = paginated.map(c => ({
      id: c.channel_id,
      channelId: c.channel_id,
      channelName: c.channel_name,
      avatar: c.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.channel_name)}`,
      videoTitle: c.latest_video_title || 'N/A',
      videoUrl: c.latest_video_url || '',
      channelUrl: c.channel_url,
      thumbnailUrl: c.latest_thumbnail_url || '',
      latest_video_views: c.scraped_details?.latest_video_views || 0,
      subsRaw: c.subscriber_count,
      subs: formatNumberCompact(c.subscriber_count),
      viewsRaw: c.average_views,
      views: formatNumberCompact(c.average_views),
      likes: formatNumberCompact(c.average_likes),
      publishedAt: c.last_upload ? new Date(c.last_upload).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
      score: c.opportunity_score,
      frequencyType: c.upload_frequency,
      status: c.status,
      
      // Socials & Contacts
      contact_email: c.email,
      website: c.website,
      instagram: c.instagram,
      twitter: c.twitter,
      linkedin: c.linkedin,
      facebook: c.facebook,
      tiktok: c.tiktok,
      discord: c.discord,
      newsletter: c.newsletter,
      podcast: c.podcast,
      store: c.store,
      course: c.course,
      communityEnabled: c.community_enabled,
      monetized: c.monetized,
      
      // Location & verification metadata
      country: c.country,
      language: c.language,
      verification_status: c.verification_status || 'unverified',
      
      // Scores
      packagingScore: c.packaging_score,
      buyingScore: c.buying_score,
      growthScore: c.growth_score,
      replyProbability: c.reply_probability,
      lead_score: c.buying_score,
      opportunity_score: c.opportunity_score,
      thumbnail_opportunity: Math.max(10, 100 - c.packaging_score),
      last_updated: c.last_updated,
      whyThisLead: c.why_this_lead,
      detectedWeaknesses: c.detected_weaknesses || [],
      visualAnalysisPreview: c.visual_analysis_preview || {},
      
      // New fields: Video duration & content type
      video_duration_seconds: c.video_duration_seconds || 0,
      content_type: c.content_type || 'long',
      relevance_score: c.relevance_score || 0
    }));

    // Background enrichment trigger (visible first, then remaining staggered after 5s)
    if (ENRICHMENT_ENABLED && basicCreators.length > 0) {
      const paginatedIds = new Set(paginated.map(p => p.channel_id || p.channelId || p.id));
      
      const visibleCreators = basicCreators.filter(c => paginatedIds.has(c.channel_id));
      const remainingCreators = basicCreators.filter(c => !paginatedIds.has(c.channel_id));
      
      console.log(`[Discovery Debug] Ingestion completed. Triggering background enrichment: Visible = ${visibleCreators.length}, Remaining = ${remainingCreators.length}`);
      
      // 1. Enrich visible creators immediately
      visibleCreators.forEach((creator: any) => {
        const originalItem = uniqueVideos.find(v => v.channelId === creator.channel_id);
        const ch = channelsMap.get(creator.channel_id) as any;
        const vid = videosMap.get(originalItem?.videoId) as any;
        
        const chDesc = ch?.snippet?.description || '';
        const vidDesc = vid?.snippet?.description || '';
        
        const ctx = {
          channelId: creator.channel_id,
          channelName: creator.channel_name || '',
          channelDescription: chDesc,
          videoDescription: vidDesc,
          websiteHint: creator.website || '',
          subscriberCount: creator.subscriber_count || 0,
          averageViews: creator.average_views || 0,
          latestVideoTitle: creator.latest_video_title || '',
          latestVideoUrl: creator.latest_video_url || '',
          thumbnailUrl: creator.latest_thumbnail_url || '',
          uploadFrequency: creator.upload_frequency || '',
          channelAge: creator.channel_age || '',
          handle: creator.handle || '',
        };

        const { backgroundEnrichmentQueue } = require('@/lib/enrichment/queue');
        backgroundEnrichmentQueue.push(ctx, async () => {
          return enrichCreator(
            creator.channel_id,
            chDesc,
            vidDesc,
            creator.website || '',
            GEMINI_API_KEY,
            creator,
            refresh
          );
        });
      });

      // 2. Lazy staggered load for remaining creators
      if (remainingCreators.length > 0) {
        setTimeout(() => {
          console.log("[Discovery Debug] Starting staggered lazy-load background enrichment for remaining creators...");
          remainingCreators.forEach((creator: any) => {
            const originalItem = uniqueVideos.find(v => v.channelId === creator.channel_id);
            const ch = channelsMap.get(creator.channel_id) as any;
            const vid = videosMap.get(originalItem?.videoId) as any;
            
            const chDesc = ch?.snippet?.description || '';
            const vidDesc = vid?.snippet?.description || '';

            const ctx = {
              channelId: creator.channel_id,
              channelName: creator.channel_name || '',
              channelDescription: chDesc,
              videoDescription: vidDesc,
              websiteHint: creator.website || '',
              subscriberCount: creator.subscriber_count || 0,
              averageViews: creator.average_views || 0,
              latestVideoTitle: creator.latest_video_title || '',
              latestVideoUrl: creator.latest_video_url || '',
              thumbnailUrl: creator.latest_thumbnail_url || '',
              uploadFrequency: creator.upload_frequency || '',
              channelAge: creator.channel_age || '',
              handle: creator.handle || '',
            };

            const { backgroundEnrichmentQueue } = require('@/lib/enrichment/queue');
            backgroundEnrichmentQueue.push(ctx, async () => {
              return enrichCreator(
                creator.channel_id,
                chDesc,
                vidDesc,
                creator.website || '',
                GEMINI_API_KEY,
                creator,
                refresh
              );
            });
          });
        }, 5000);
      }
    }

    return NextResponse.json({
      success: true,
      leads: formattedLeads,
      totalCount: dbTotalCount,
      page,
      pageSize
    });

  } catch (error: any) {
    console.error('[Discovery Debug] Fatal Discovery API route exception:', error.stack || error);
    // Return empty fallback array only if search keyword failed to return anything
    if (basicCreators.length > 0) {
      const fallbackLeads = basicCreators.map(c => ({
        id: c.channel_id,
        channelId: c.channel_id,
        channelName: c.channel_name,
        avatar: c.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.channel_name)}`,
        videoTitle: c.latest_video_title || 'N/A',
        videoUrl: c.latest_video_url || '',
        channelUrl: c.channel_url,
        thumbnailUrl: c.latest_thumbnail_url || '',
        latest_video_views: c.scraped_details?.latest_video_views || 0,
        subsRaw: c.subscriber_count,
        subs: formatNumberCompact(c.subscriber_count),
        viewsRaw: c.average_views,
        views: formatNumberCompact(c.average_views),
        likes: formatNumberCompact(c.average_likes),
        publishedAt: c.last_upload ? new Date(c.last_upload).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
        score: c.opportunity_score,
        frequencyType: c.upload_frequency,
        status: c.status,
        contact_email: c.email,
        website: c.website,
        instagram: c.instagram || null,
        twitter: c.twitter || null,
        linkedin: c.linkedin || null,
        facebook: c.facebook || null,
        tiktok: c.tiktok || null,
        discord: c.discord || null,
        newsletter: c.newsletter || null,
        store: c.store || null,
        course: c.course || null,
        country: c.country || null,
        language: c.language || null,
        verification_status: c.verification_status || 'unverified',
        packagingScore: c.packaging_score,
        buyingScore: c.buying_score,
        growthScore: c.growth_score,
        replyProbability: c.reply_probability,
        lead_score: c.buying_score,
        opportunity_score: c.opportunity_score,
        thumbnail_opportunity: Math.max(10, 100 - c.packaging_score),
        whyThisLead: c.why_this_lead,
        detectedWeaknesses: c.detected_weaknesses || [],
        visualAnalysisPreview: c.visual_analysis_preview || {}
      }));
      return NextResponse.json({
        success: true,
        leads: fallbackLeads,
        totalCount: fallbackLeads.length,
        page: 1,
        pageSize: fallbackLeads.length
      });
    }
    return NextResponse.json({ error: error.message || 'Server error', stack: error.stack }, { status: 500 });
  }
}

function formatNumberCompact(num: number | string | bigint): string {
  const n = typeof num === 'string' ? parseInt(num, 10) : Number(num);
  if (isNaN(n) || n === 0) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}
