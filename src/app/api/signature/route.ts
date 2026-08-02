import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getNormalizedSocialLinks, SocialLinkConfig, normalizeSignatureFromDb } from '@/lib/email/signature';

export const dynamic = 'force-dynamic';

const DEFAULT_SIGNATURE = {
  signature_name: 'Main Outreach',
  display_name: 'Gusto',
  role: '',
  content_html: '',
  portfolio_url: '',
  website_url: '',
  linkedin_url: '',
  twitter_url: '',
  social_links: [],
  is_enabled: true,
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from('user_signatures')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Error reading user_signatures from Supabase, returning default:', error.message);
      const fallbackName = user.email ? user.email.split('@')[0] : DEFAULT_SIGNATURE.display_name;
      const baseSig = { ...DEFAULT_SIGNATURE, display_name: fallbackName, signature_name: 'Main Outreach', content_html: `Thanks,<br/><br/><strong>${fallbackName}</strong>` };
      const fallbackResponse = {
        success: true,
        signature: {
          ...baseSig,
          social_links: getNormalizedSocialLinks(baseSig),
        },
      };
      console.log('[GET /api/signature] Returning fallback signature due to error:', fallbackResponse);
      return NextResponse.json(fallbackResponse);
    }

    const data = (rows && rows.length > 0) ? rows[0] : null;

    if (!data) {
      const fallbackName = user.email ? user.email.split('@')[0] : DEFAULT_SIGNATURE.display_name;
      const baseSig = { ...DEFAULT_SIGNATURE, display_name: fallbackName, signature_name: 'Main Outreach', content_html: `Thanks,<br/><br/><strong>${fallbackName}</strong>` };
      const fallbackResponse = {
        success: true,
        signature: {
          ...baseSig,
          social_links: getNormalizedSocialLinks(baseSig),
        },
      };
      console.log('[GET /api/signature] No signature found, returning default signature:', fallbackResponse);
      return NextResponse.json(fallbackResponse);
    }

    // Use the shared normalizer — same logic that all senders apply before rendering.
    const normalizedSig = normalizeSignatureFromDb(data);

    const successResponse = {
      success: true,
      signature: normalizedSig,
    };
    console.log('[GET /api/signature] Returning active signature:', successResponse);
    return NextResponse.json(successResponse);
  } catch (err: any) {
    console.error('Signature GET endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      signature_name = 'Main Outreach',
      display_name,
      role = '',
      content_html = '',
      portfolio_url = '',
      website_url = '',
      linkedin_url = '',
      twitter_url = '',
      social_links = [],
      is_enabled = true,
    } = body;

    // Helper to find URL from social_links array or legacy columns
    const findLinkUrl = (id: string, legacyVal?: string | null): string | null => {
      if (Array.isArray(social_links)) {
        const item = social_links.find((l: SocialLinkConfig) => l.id === id);
        if (item && item.enabled && item.url && item.url.trim()) {
          return item.url.trim();
        }
      }
      return legacyVal && legacyVal.trim() ? legacyVal.trim() : null;
    };

    const resolvedSignatureName = signature_name ? String(signature_name).trim() : 'Main Outreach';
    // display_name falls back to signature_name for backward compatibility with older records
    const resolvedDisplayName = display_name ? String(display_name).trim() : resolvedSignatureName;
    const resolvedRole = role != null ? String(role).trim() : '';
    const resolvedContentHtml = content_html ? String(content_html) : '';

    const resolvedPortfolio = findLinkUrl('portfolio', portfolio_url);
    const resolvedWebsite = findLinkUrl('website', website_url);
    const resolvedLinkedin = findLinkUrl('linkedin', linkedin_url);
    const resolvedTwitter = findLinkUrl('twitter', twitter_url);

    // Full payload — schema now has signature_name, content_html, social_links columns
    const payload: Record<string, any> = {
      user_id: user.id,
      // New schema columns (primary)
      signature_name: resolvedSignatureName,
      content_html: resolvedContentHtml,
      social_links: Array.isArray(social_links) ? social_links : [],
      // Legacy columns kept for backward compatibility
      display_name: resolvedDisplayName,
      role: resolvedRole,
      portfolio_url: resolvedPortfolio ?? '',
      website_url: resolvedWebsite ?? '',
      linkedin_url: resolvedLinkedin ?? '',
      twitter_url: resolvedTwitter ?? '',
      is_enabled: Boolean(is_enabled),
      updated_at: new Date().toISOString(),
    };

    const { data: savedData, error: saveError } = await supabase
      .from('user_signatures')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (saveError || !savedData) {
      console.error('Error saving signature to DB:', saveError);
      return NextResponse.json({ error: saveError?.message || 'Failed to save signature' }, { status: 500 });
    }

    // Use the shared normalizer so the response matches exactly what GET and senders use
    const normalizedSig = normalizeSignatureFromDb(savedData);

    console.log('[POST /api/signature] Saved and returning normalized signature:', normalizedSig);
    return NextResponse.json({ success: true, signature: normalizedSig });
  } catch (err: any) {
    console.error('Signature POST endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
