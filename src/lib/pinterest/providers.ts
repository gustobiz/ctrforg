import localData from './pinterest_data.json';

export interface PinterestReference {
  id: string;
  videoId: string; // Keep compatibility with existing InspirationRef
  title: string;
  channelName: string;
  channelAvatar: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  publishedAt: string;
  viewCount: number; // View counts or equivalent
  savedCount: number; // Mapped saved count
  likeCount: number;
  tags: string[];
  category: 'Pinterest Packaging' | 'Pinterest Composition' | 'Pinterest Color' | 'Pinterest Pose' | 'Pinterest Expression';
  niche: string;
  note: string;
  designInsight: string;
  colorPalette: string[];
  poseType?: string;
  expressionType?: string;
  compositionType?: string;
  source: 'youtube' | 'pinterest';

  // Strict Source Tracking Properties
  pinId?: string;
  sourceUrl?: string;
  pinterestUrl?: string;
  boardName?: string;
  creatorName?: string;
  dataSource: 'Pinterest API' | 'Pinterest Scraper' | 'Mock Data' | 'Fallback Data';
}

export interface PinterestProvider {
  name: string;
  search(query: string, sortBy?: 'most_saved' | 'most_relevant' | 'latest'): Promise<PinterestReference[]>;
}

// ============================================================================
// 1. LOCAL JSON PROVIDER
// ============================================================================
export class LocalJsonPinterestProvider implements PinterestProvider {
  name = 'Local JSON Provider';

  async search(query: string, sortBy?: 'most_saved' | 'most_relevant' | 'latest'): Promise<PinterestReference[]> {
    const data = localData as any[];
    const normalizedQuery = query.toLowerCase().trim();

    // Map each item with a relevance score
    const scoredItems = data.map(item => {
      let score = 0;
      
      // Calculate keyword matches
      const titleMatches = (item.title || '').toLowerCase().includes(normalizedQuery);
      const descMatches = (item.description || '').toLowerCase().includes(normalizedQuery);
      const nicheMatches = (item.niche || '').toLowerCase().includes(normalizedQuery);
      const tagMatches = (item.tags || []).some((t: string) => t.toLowerCase().includes(normalizedQuery));

      if (titleMatches) score += 10;
      if (descMatches) score += 5;
      if (nicheMatches) score += 8;
      if (tagMatches) score += 4;

      // Partial word overlap matches
      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
      queryWords.forEach(word => {
        if ((item.title || '').toLowerCase().includes(word)) score += 3;
        if ((item.description || '').toLowerCase().includes(word)) score += 1;
        if ((item.tags || []).some((t: string) => t.toLowerCase().includes(word))) score += 2;
      });

      return { item, score };
    });

    // If query is generic or blank, return all with basic score, otherwise filter those with some relevance
    const filtered = scoredItems
      .filter(x => normalizedQuery === '' || x.score > 0)
      .map(x => ({
        ...x.item,
        videoId: '', // compatibility
        source: 'pinterest' as const,
        viewCount: x.item.savedCount || 0, // compatibility mapping
        dataSource: 'Fallback Data' as const
      }));

    // If we have no keyword-matched references, return all items so the user gets gorgeous inspiration instead of an empty screen
    const finalRefs = filtered.length > 0 ? filtered : data.map(item => ({
      ...item,
      videoId: '',
      source: 'pinterest' as const,
      viewCount: item.savedCount || 0,
      dataSource: 'Fallback Data' as const
    }));

    // Apply Sorting
    if (sortBy === 'most_saved') {
      finalRefs.sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0));
    } else if (sortBy === 'latest') {
      finalRefs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else {
      // most_relevant: Sort by our calculated matching score or dynamic order
      if (normalizedQuery !== '') {
        finalRefs.sort((a, b) => {
          const scoreA = scoredItems.find(x => x.item.id === a.id)?.score || 0;
          const scoreB = scoredItems.find(x => x.item.id === b.id)?.score || 0;
          return scoreB - scoreA;
        });
      }
    }

    return finalRefs;
  }
}

// ============================================================================
// 2. MOCK PROVIDER (Generates tailored design references if needed)
// ============================================================================
export class MockPinterestProvider implements PinterestProvider {
  name = 'Mock Service Provider';

  async search(query: string, sortBy?: 'most_saved' | 'most_relevant' | 'latest'): Promise<PinterestReference[]> {
    const formattedQuery = query.trim() || 'Thumbnail Design';
    const cleanNiche = query.toLowerCase().includes('fitness') ? 'Fitness'
      : query.toLowerCase().includes('tech') ? 'Tech'
      : query.toLowerCase().includes('finance') ? 'Finance'
      : query.toLowerCase().includes('client') || query.toLowerCase().includes('business') ? 'Business'
      : 'Productivity';

    // Curated high quality abstract aesthetic images from Unsplash to ensure visual WOW factor
    const imageCatalog = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80'
    ];

    const mockCategories: ('Pinterest Packaging' | 'Pinterest Composition' | 'Pinterest Color' | 'Pinterest Pose' | 'Pinterest Expression')[] = [
      'Pinterest Packaging',
      'Pinterest Composition',
      'Pinterest Color',
      'Pinterest Pose',
      'Pinterest Expression'
    ];

    const references: PinterestReference[] = mockCategories.map((cat, idx) => {
      const savedCount = Math.floor(Math.random() * 4000) + 1000;
      const likeCount = Math.floor(savedCount * 0.75);
      const randomImage = imageCatalog[idx % imageCatalog.length];
      
      let note = '';
      let insight = '';
      let pose = '';
      let expr = '';
      let comp = '';
      let colors: string[] = [];

      switch (cat) {
        case 'Pinterest Packaging':
          note = `Premium visual framing combining sharp borders and glowing outline graphics.`;
          insight = `Frame high-value visual sections with bold accent colors to double your click-through potential.`;
          colors = ['#18181b', '#38bdf8', '#0284c7', '#ffffff'];
          break;
        case 'Pinterest Composition':
          note = `Deep perspective layout utilizing split screen comparisons and centered focal points.`;
          insight = `Place key emotional objects in the exact center and split your background contrast 50/50 for extreme click appeal.`;
          comp = 'split-layout';
          colors = ['#09090b', '#f43f5e', '#ec4899', '#ffffff'];
          break;
        case 'Pinterest Color':
          note = `High contrast futuristic grading utilizing deep neon pinks and ambient cyberpunk blue shadows.`;
          insight = `Color grade human subjects with slightly warmer facial tones, and apply neon ambient backing glow to pop them out.`;
          colors = ['#f472b6', '#2563eb', '#0f172a', '#fdf2f8'];
          break;
        case 'Pinterest Pose':
          note = `Dynamic low-angle portrait showing the subject pointing forward with confident lighting outlines.`;
          insight = `Always point slightly diagonally toward the focal element to naturally guide the user's focus.`;
          pose = 'pointing';
          colors = ['#27272a', '#eab308', '#ca8a04', '#fafafa'];
          break;
        case 'Pinterest Expression':
          note = `High intensity facial reaction showcasing shocked eyes and slightly elevated inquisitive posture.`;
          insight = `Keep the facial scale above 40% of your total thumbnail height to make micro-expressions readable on mobile feeds.`;
          expr = 'shock';
          colors = ['#450a0a', '#ef4444', '#f87171', '#fef2f2'];
          break;
      }

      return {
        id: `mock-pin-${idx}-${Date.now()}`,
        videoId: '',
        title: `Curated ${cat.replace('Pinterest ', '')} Concept for: "${formattedQuery}"`,
        channelName: 'Pinterest Designer',
        channelAvatar: '',
        description: `Premium graphic design reference carefully curated for thumbnail designers looking to master ${cat.toLowerCase()}.`,
        thumbnailUrl: randomImage,
        videoUrl: `https://pinterest.com/search/pins/?q=${encodeURIComponent(formattedQuery)}`,
        publishedAt: new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString(),
        viewCount: savedCount, // mapped to savedCount for compatibility
        savedCount,
        likeCount,
        tags: [cat.replace('Pinterest ', '').toLowerCase(), 'design', 'inspiration', cleanNiche.toLowerCase()],
        category: cat,
        niche: cleanNiche,
        note,
        designInsight: insight,
        colorPalette: colors,
        poseType: pose,
        expressionType: expr,
        compositionType: comp,
        source: 'pinterest',
        dataSource: 'Mock Data' as const
      };
    });

    if (sortBy === 'most_saved') {
      references.sort((a, b) => b.savedCount - a.savedCount);
    } else if (sortBy === 'latest') {
      references.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }

    return references;
  }
}

// ============================================================================
// 3. PROVIDER MANAGER / REGISTRY
// ============================================================================
export class PinterestProviderManager {
  private providers: PinterestProvider[] = [];
  private activeProviderIndex = 0;
  public simulateFailure = false; // Toggle to demonstrate error fallback gracefully!
  public isConnected = false; // Real Pinterest API/Scraper connection status

  constructor() {
    // Register standard active providers (Architecturally registered, but disabled while isConnected is false)
    this.providers.push(new LocalJsonPinterestProvider());
    this.providers.push(new MockPinterestProvider());
  }

  // Generate automated search queries optimized for Pinterest visual research (Requirement 1)
  generatePinterestQueries(keyword: string) {
    const clean = keyword.trim();
    return {
      packaging: `${clean} thumbnail packaging layout design`,
      composition: `${clean} graphic composition visual framing`,
      color: `${clean} color palette color grading aesthetic`,
      pose: `${clean} portrait subject pose body language`,
      expression: `${clean} facial reaction expressions emotion`
    };
  }

  async search(query: string, sortBy?: 'most_saved' | 'most_relevant' | 'latest'): Promise<PinterestReference[]> {
    // If not connected to a real Pinterest source, throw Connection error (disabling all generic fallback mock cards)
    if (!this.isConnected) {
      throw new Error('Pinterest Integration Not Connected');
    }

    if (this.simulateFailure) {
      throw new Error('Pinterest Service Provider Connection Timed Out (Simulated Error).');
    }

    // Try primary provider (Local JSON Provider)
    try {
      const primaryProvider = this.providers[0];
      const results = await primaryProvider.search(query, sortBy);
      if (results && results.length > 0) {
        return results;
      }
    } catch (e) {
      console.warn('Primary Pinterest provider failed. Gracefully falling back to backup...', e);
    }

    // Fall back to Mock Provider
    try {
      const backupProvider = this.providers[1];
      return await backupProvider.search(query, sortBy);
    } catch (e) {
      console.error('All Pinterest providers failed:', e);
      throw new Error('All Pinterest Inspiration provider services are currently offline.');
    }
  }
}
