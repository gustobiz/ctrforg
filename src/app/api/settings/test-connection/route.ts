import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/gmail/oauth';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        error: 'Unauthorized access.',
        details: {
          api: 'Supabase Auth',
          route: '/api/settings/test-connection',
          function: 'POST',
          reason: 'Active session is missing or expired.',
          suggestedFix: 'Try logging out and logging back in.'
        }
      }, { status: 401 });
    }

    const { provider } = await req.json();

    if (provider === 'youtube') {
      const youtubeKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeKey) {
        return NextResponse.json({
          error: 'YOUTUBE_API_KEY environment variable is not defined.',
          details: {
            api: 'YouTube Data API',
            route: '/api/settings/test-connection',
            function: 'POST (YouTube Check)',
            reason: 'Environment variable YOUTUBE_API_KEY is missing.',
            suggestedFix: 'Add YOUTUBE_API_KEY to your .env.local file.'
          }
        }, { status: 400 });
      }

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=MrBeast&type=video&key=${youtubeKey}`
      );

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          error: `YouTube API Error: ${errText}`,
          details: {
            api: 'YouTube Data API',
            route: '/api/settings/test-connection',
            function: 'POST (YouTube Search)',
            reason: 'Google returned a non-200 status code.',
            suggestedFix: 'Verify that your YOUTUBE_API_KEY is valid and has search quotas enabled in the Google Developer Console.'
          }
        }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'YouTube connection successful!' });
    }

    if (provider === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return NextResponse.json({
          error: 'GEMINI_API_KEY environment variable is not defined.',
          details: {
            api: 'Google Gemini Pro API',
            route: '/api/settings/test-connection',
            function: 'POST (Gemini Check)',
            reason: 'Environment variable GEMINI_API_KEY is missing.',
            suggestedFix: 'Add GEMINI_API_KEY to your .env.local file.'
          }
        }, { status: 400 });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }],
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          error: `Gemini API Error: ${errText}`,
          details: {
            api: 'Google Gemini Pro API',
            route: '/api/settings/test-connection',
            function: 'POST (Gemini generateContent)',
            reason: 'Gemini model returned an error response.',
            suggestedFix: 'Verify your GEMINI_API_KEY is correct and billing/credits are active on Google AI Studio.'
          }
        }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Gemini connection successful!' });
    }

    if (provider === 'apify') {
      const apifyToken = process.env.APIFY_TOKEN;
      if (!apifyToken) {
        return NextResponse.json({
          error: 'APIFY_TOKEN environment variable is not defined.',
          details: {
            api: 'Apify Actor Runner API',
            route: '/api/settings/test-connection',
            function: 'POST (Apify Check)',
            reason: 'Environment variable APIFY_TOKEN is missing.',
            suggestedFix: 'Add APIFY_TOKEN to your .env.local file.'
          }
        }, { status: 400 });
      }

      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~contact-details-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url: 'https://example.com' }],
            maxPagesPerCrawl: 1,
            maxDepth: 0,
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          error: `Apify API Error: ${errText}`,
          details: {
            api: 'Apify Actor Runner API',
            route: '/api/settings/test-connection',
            function: 'POST (Apify contact-details-scraper run)',
            reason: 'Apify runner rejected the token or task payload.',
            suggestedFix: 'Ensure your APIFY_TOKEN is correct and active on your Apify dashboard.'
          }
        }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Apify connection successful!' });
    }

    if (provider === 'google-oauth') {
      const tokenData = await getValidAccessToken(user.id);
      if (!tokenData) {
        return NextResponse.json({
          error: 'Google Account not connected or OAuth token expired.',
          details: {
            api: 'Google Identity OAuth 2.0',
            route: '/api/settings/test-connection',
            function: 'POST (Google OAuth Check)',
            reason: 'No credentials row was found in database for this user.',
            suggestedFix: 'Connect your Google account using the Connect button.'
          }
        }, { status: 400 });
      }

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          error: `Google OAuth Error: ${errText}`,
          details: {
            api: 'Google Identity OAuth 2.0',
            route: '/api/settings/test-connection',
            function: 'POST (Google userinfo query)',
            reason: 'Access token validation failed at Google gateway.',
            suggestedFix: 'Disconnect and re-authenticate your Google Account.'
          }
        }, { status: 400 });
      }

      const info = await res.json();
      return NextResponse.json({ success: true, message: `Connected as ${info.email}` });
    }

    if (provider === 'google-sheets') {
      const tokenData = await getValidAccessToken(user.id);
      if (!tokenData) {
        return NextResponse.json({
          error: 'Google Account not connected or OAuth token expired. Please connect Google OAuth first.',
          details: {
            api: 'Google Sheets API',
            route: '/api/settings/test-connection',
            function: 'POST (Google Sheets Check)',
            reason: 'Active OAuth credentials missing in public.gmail_connections.',
            suggestedFix: 'Authorize your Google Account via the popup login flow first.'
          }
        }, { status: 400 });
      }

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: 'CTRForge Temporary Connection Test' },
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        return NextResponse.json({
          error: `Google Sheets Write Error: ${errText}`,
          details: {
            api: 'Google Sheets API',
            route: '/api/settings/test-connection',
            function: 'POST (v4/spreadsheets create)',
            reason: 'Sheets scope mismatch or Drive write permission denied.',
            suggestedFix: 'Disconnect and reconnect your Google Account to ensure all sheets and drive permissions are authorized.'
          }
        }, { status: 400 });
      }

      const tempSheet = await createRes.json();
      const spreadsheetId = tempSheet.spreadsheetId;

      if (spreadsheetId) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenData.accessToken}` },
          });
        } catch (cleanupErr) {
          console.error('Failed to clean up temporary spreadsheet:', cleanupErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Google Sheets read/write test successful!' });
    }

    return NextResponse.json({
      error: 'Invalid provider specified.',
      details: {
        api: 'Settings Connection Engine',
        route: '/api/settings/test-connection',
        function: 'POST',
        reason: 'Specified provider is unsupported.',
        suggestedFix: 'Select a valid provider (youtube, gemini, apify, google-oauth, google-sheets).'
      }
    }, { status: 400 });
  } catch (error: any) {
    console.error('Test connection endpoint error:', error);
    return NextResponse.json({
      error: error.message || 'Server error',
      details: {
        api: 'Settings Connection Engine',
        route: '/api/settings/test-connection',
        function: 'POST',
        reason: 'Unexpected execution exception.',
        suggestedFix: 'Check server logs for database connectivity or network state.'
      }
    }, { status: 500 });
  }
}
