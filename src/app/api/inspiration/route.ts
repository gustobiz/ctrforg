import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// In-memory cache to prevent excessive API quota consumption
interface CacheEntry {
  timestamp: number;
  data: any;
  pinterestQueries: any;
}
const inspirationCache = new Map<string, CacheEntry>();
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

// All valid categories for the Inspiration Lab
const ALL_CATEGORIES = [
  'YouTube References',
  'Pinterest Packaging',
  'Pinterest Composition',
  'Pinterest Color',
  'Pinterest Pose',
  'Pinterest Expression',
  'Pose Library',
  'Expression Library',
  'Composition Library',
  'Color Palette Library',
];

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query, category, niche, sortBy } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'A search query is required.' }, { status: 400 });
    }

    const searchQuery = query.trim();
    const cacheKey = JSON.stringify({ searchQuery, category, niche, sortBy });

    // Check cache
    const cached = inspirationCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        references: cached.data,
        pinterestQueries: cached.pinterestQueries,
        fromCache: true,
      });
    }

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YOUTUBE_API_KEY is not configured.' }, { status: 500 });
    }

    // ============================================================
    // 1. GENERATE PINTEREST SEARCH QUERIES VIA GEMINI
    // ============================================================
    let pinterestQueries: Record<string, string> = {
      packaging: `${searchQuery} thumbnail packaging design`,
      composition: `${searchQuery} thumbnail composition layout`,
      color: `${searchQuery} color palette aesthetic`,
      pose: `${searchQuery} portrait pose reference`,
      expression: `${searchQuery} facial expression reaction`,
    };

    if (GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const queryGenPrompt = `Given this user topic: "${searchQuery}"

Generate optimized Pinterest search queries for thumbnail design inspiration. Return a JSON object:
{
  "packaging": "string - Pinterest search query for thumbnail packaging/layout inspiration related to this topic",
  "composition": "string - Pinterest search query for visual composition and framing related to this topic",
  "color": "string - Pinterest search query for color palettes and color grading related to this topic",
  "pose": "string - Pinterest search query for subject poses and body language related to this topic",
  "expression": "string - Pinterest search query for facial expressions and reactions related to this topic"
}

Make each query specific, creative, and optimized for finding visual design inspiration on Pinterest. Return valid JSON only.`;

        const qRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: queryGenPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });

        if (qRes.ok) {
          const qJson = await qRes.json();
          const rawText = qJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            if (parsed.packaging) pinterestQueries = parsed;
          }
        }
      } catch (e) {
        console.warn('Pinterest query generation fallback:', e);
      }
    }

    // ============================================================
    // 2. RUN TWO PARALLEL YOUTUBE SEARCHES
    //    - Search 1: Direct topic search (→ YouTube References)
    //    - Search 2: Pinterest-focused design search (→ Pinterest categories)
    // ============================================================
    const pinterestSearchTerm = `${searchQuery} thumbnail design inspiration packaging visual reference`;

    const [ytDirectRes, ytPinterestRes] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(searchQuery)}&type=video&key=${YOUTUBE_API_KEY}`),
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(pinterestSearchTerm)}&type=video&key=${YOUTUBE_API_KEY}`),
    ]);

    if (!ytDirectRes.ok) {
      const errText = await ytDirectRes.text();
      console.error('YouTube Search API error:', errText);
      return NextResponse.json({
        success: false,
        error: 'YouTube API unavailable. Please try again later.',
        references: [],
        pinterestQueries,
      }, { status: 502 });
    }

    const directData = await ytDirectRes.json();
    const pinterestData = ytPinterestRes.ok ? await ytPinterestRes.json() : { items: [] };

    const directItems = directData.items || [];
    const pinterestItems = pinterestData.items || [];

    // Deduplicate by video ID
    const seenIds = new Set<string>();
    const allItems: { item: any; source: 'youtube' | 'pinterest' }[] = [];

    for (const item of directItems) {
      const vid = item.id?.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        allItems.push({ item, source: 'youtube' });
      }
    }
    for (const item of pinterestItems) {
      const vid = item.id?.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        allItems.push({ item, source: 'pinterest' });
      }
    }

    if (allItems.length === 0) {
      return NextResponse.json({
        success: true,
        references: [],
        pinterestQueries,
        message: 'No results found for this query.',
      });
    }

    // ============================================================
    // 3. BATCH FETCH VIDEO + CHANNEL DETAILS
    // ============================================================
    const videoIds = allItems.map(a => a.item.id?.videoId).filter(Boolean);
    const channelIds = Array.from(new Set(allItems.map(a => a.item.snippet?.channelId).filter(Boolean))) as string[];

    const [videoDetailRes, channelDetailRes] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`),
      channelIds.length > 0
        ? fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`)
        : Promise.resolve(null),
    ]);

    const videoDetailsMap = new Map<string, any>();
    if (videoDetailRes.ok) {
      const vData = await videoDetailRes.json();
      (vData.items || []).forEach((v: any) => {
        videoDetailsMap.set(v.id, {
          title: v.snippet?.title || '',
          description: (v.snippet?.description || '').substring(0, 200),
          channelTitle: v.snippet?.channelTitle || '',
          publishedAt: v.snippet?.publishedAt || '',
          thumbnailUrl: v.snippet?.thumbnails?.maxres?.url
            || v.snippet?.thumbnails?.high?.url
            || v.snippet?.thumbnails?.medium?.url
            || v.snippet?.thumbnails?.default?.url || '',
          viewCount: v.statistics?.viewCount || '0',
          likeCount: v.statistics?.likeCount || '0',
          tags: v.snippet?.tags || [],
        });
      });
    }

    const channelAvatarMap = new Map<string, string>();
    if (channelDetailRes && channelDetailRes.ok) {
      const cData = await channelDetailRes.json();
      (cData.items || []).forEach((c: any) => {
        channelAvatarMap.set(c.id, c.snippet?.thumbnails?.default?.url || '');
      });
    }

    // ============================================================
    // 4. BUILD RAW REFERENCES WITH SOURCE TAGS
    // ============================================================
    const rawReferences = allItems.map(({ item, source }, idx) => {
      const videoId = item.id?.videoId;
      const detail = videoDetailsMap.get(videoId) || {};
      const channelId = item.snippet?.channelId || '';

      const thumbnailUrl = detail.thumbnailUrl
        || item.snippet?.thumbnails?.high?.url
        || item.snippet?.thumbnails?.medium?.url
        || item.snippet?.thumbnails?.default?.url || '';

      const viewCount = parseInt(detail.viewCount || '0', 10);
      const likeCount = parseInt(detail.likeCount || '0', 10);

      return {
        id: videoId || `ref-${idx}`,
        videoId,
        title: detail.title || item.snippet?.title || 'Untitled',
        channelName: detail.channelTitle || item.snippet?.channelTitle || '',
        channelAvatar: channelAvatarMap.get(channelId) || '',
        description: detail.description || '',
        thumbnailUrl,
        videoUrl: `https://youtube.com/watch?v=${videoId}`,
        publishedAt: detail.publishedAt || item.snippet?.publishedAt || '',
        viewCount,
        likeCount,
        tags: detail.tags || [],
        source, // 'youtube' or 'pinterest'
        // Will be enriched by Gemini
        category: source === 'youtube' ? 'YouTube References' : 'Pinterest Packaging',
        niche: '',
        note: '',
        designInsight: '',
        colorPalette: [] as string[],
        poseType: '',
        expressionType: '',
        compositionType: '',
      };
    });

    // ============================================================
    // 5. ENRICH ALL REFERENCES WITH GEMINI AI
    // ============================================================
    let enrichedReferences = [...rawReferences];

    if (GEMINI_API_KEY && rawReferences.length > 0) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const enrichPrompt = `You are a world-class YouTube thumbnail design expert and Pinterest visual inspiration curator. I have ${rawReferences.length} real YouTube video thumbnails from searches related to "${searchQuery}".

Each reference has a "source" field: "youtube" (from direct topic search) or "pinterest" (from design/inspiration search).

Video data:
${JSON.stringify(rawReferences.map(r => ({
  id: r.id,
  title: r.title,
  channelName: r.channelName,
  viewCount: r.viewCount,
  tags: r.tags.slice(0, 5),
  source: r.source,
})))}

Categorize each reference into the Inspiration Lab structure. For references with source="youtube", assign to one of:
- "YouTube References" (general thumbnail reference)
- "Pose Library" (if the thumbnail likely features a notable human pose)
- "Expression Library" (if the thumbnail likely features a strong facial expression)
- "Composition Library" (if the thumbnail has a notable layout/composition technique)
- "Color Palette Library" (if the thumbnail has distinctive color usage)

For references with source="pinterest", assign to one of:
- "Pinterest Packaging" (visual packaging and branding style)
- "Pinterest Composition" (framing, layout, visual hierarchy)
- "Pinterest Color" (color palette, grading, aesthetic)
- "Pinterest Pose" (subject positioning, body language)
- "Pinterest Expression" (facial expression, emotional impact)

Return a JSON object:
{
  "analyses": [
    {
      "id": "string",
      "category": "string",
      "niche": "string",
      "note": "string",
      "designInsight": "string",
      "colorPalette": ["string"],
      "poseType": "string",
      "expressionType": "string",
      "compositionType": "string"
    }
  ]
}

Rules:
- "niche": content niche (e.g. "Tech", "Finance", "Self-Improvement", "Gaming", "Business", "Productivity")
- "note": 1 sentence describing the specific visual technique
- "designInsight": 1 sentence actionable design takeaway
- "colorPalette": 3-5 hex color codes that likely dominate this thumbnail
- "poseType": if applicable: "pointing", "reaction", "confidence", "curiosity", "surprise", "leaning", "" 
- "expressionType": if applicable: "shock", "confusion", "excitement", "skepticism", "curiosity", "joy", "determination", ""
- "compositionType": if applicable: "split-layout", "face-focus", "object-focus", "comparison", "rule-of-thirds", "centered", ""
- Distribute Pinterest-sourced references evenly across the 5 Pinterest categories
- Distribute YouTube-sourced references meaningfully across the 5 YouTube categories
- Return valid JSON only`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: enrichPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });

        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json();
          const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

          if (rawText) {
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);

            if (parsed.analyses && Array.isArray(parsed.analyses)) {
              enrichedReferences = rawReferences.map(ref => {
                const analysis = parsed.analyses.find((a: any) => a.id === ref.id);
                if (analysis) {
                  return {
                    ...ref,
                    category: analysis.category || ref.category,
                    niche: analysis.niche || '',
                    note: analysis.note || '',
                    designInsight: analysis.designInsight || '',
                    colorPalette: analysis.colorPalette || [],
                    poseType: analysis.poseType || '',
                    expressionType: analysis.expressionType || '',
                    compositionType: analysis.compositionType || '',
                  };
                }
                return ref;
              });
            }
          }
        } else {
          console.warn('Gemini enrichment failed:', geminiRes.status);
        }
      } catch (geminiError) {
        console.warn('Gemini inspiration enrichment error:', geminiError);
      }
    }

    // ============================================================
    // 6. APPLY FILTERS AND SORTING
    // ============================================================
    let finalReferences = enrichedReferences;

    // Category filter
    if (category && category !== 'All') {
      const matched = finalReferences.filter(r => r.category === category);
      if (matched.length >= 1) {
        finalReferences = matched;
      }
    }

    // Niche filter
    if (niche && niche !== 'All Niches') {
      const nicheMatched = finalReferences.filter(r =>
        r.niche.toLowerCase().includes(niche.toLowerCase())
      );
      if (nicheMatched.length >= 1) {
        finalReferences = nicheMatched;
      }
    }

    // Sorting
    if (sortBy === 'latest') {
      finalReferences.sort((a, b) => {
        const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'most_relevant') {
      // Default order from YouTube is already relevance-sorted
    } else if (sortBy === 'most_viewed') {
      finalReferences.sort((a, b) => b.viewCount - a.viewCount);
    }

    // Cache results
    inspirationCache.set(cacheKey, {
      timestamp: now,
      data: finalReferences,
      pinterestQueries,
    });

    return NextResponse.json({
      success: true,
      references: finalReferences,
      pinterestQueries,
      total: finalReferences.length,
    });

  } catch (error: any) {
    console.error('Inspiration API fatal error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch inspiration references. Please try again.',
      references: [],
      pinterestQueries: {},
    }, { status: 500 });
  }
}
