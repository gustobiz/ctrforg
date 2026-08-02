import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. YouTube Data API status
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const youtubeConnected = !!youtubeKey;

    // 2. Gemini status
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiConnected = !!geminiKey;

    // 3. Apify status & runs monitor
    const apifyToken = process.env.APIFY_TOKEN;
    const apifyActor = process.env.APIFY_ACTOR || null;
    const apifyConnected = !!apifyToken;
    
    let apifyStatus = 'Idle';
    let apifyLastRun = null as string | null;
    let apifyTotalRuns = 0;
    let apifyFailedRuns = 0;
    let apifyAvgRuntime = 0;
    let apifyLastError = null as string | null;

    if (apifyToken) {
      try {
        const apifyRes = await fetch(`https://api.apify.com/v2/actor-runs?limit=100&token=${apifyToken}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (apifyRes.ok) {
          const runData = await apifyRes.json();
          const items = runData.data?.items || [];
          
          if (items.length > 0) {
            apifyLastRun = items[0].startedAt;
            apifyStatus = items[0].status;
            apifyTotalRuns = items.length;
            
            const failed = items.filter((i: any) => i.status === 'FAILED' || i.status === 'ABORTED');
            apifyFailedRuns = failed.length;
            
            const succeeded = items.filter((i: any) => i.status === 'SUCCEEDED' && i.stats?.durationMillis);
            if (succeeded.length > 0) {
              const totalDuration = succeeded.reduce((sum: number, i: any) => sum + (i.stats.durationMillis / 1000), 0);
              apifyAvgRuntime = Math.round(totalDuration / succeeded.length);
            }
            
            const lastFailed = items.find((i: any) => i.status === 'FAILED');
            if (lastFailed) {
              apifyLastError = lastFailed.errorMessage || 'Unknown actor run failure';
            }
          }
        }
      } catch (apifyErr) {
        console.warn('[Settings Status] Failed to query Apify runs info:', apifyErr);
        apifyLastError = 'Connection to Apify API failed';
      }
    }

    // 4. Google OAuth status
    let googleOAuthConnected = false;
    let googleEmail = null;
    let googleOAuthStatus = 'disconnected';
    let lastGoogleSync = null;

    if (user) {
      const { data: connection } = await supabase
        .from('gmail_connections')
        .select('email, status, token_expiry, updated_at')
        .eq('user_id', user.id)
        .single();

      if (connection) {
        const isExpired = new Date(connection.token_expiry) < new Date();
        googleEmail = connection.email;
        googleOAuthStatus = isExpired ? 'expired' : connection.status;
        googleOAuthConnected = connection.status === 'active' && !isExpired;
        lastGoogleSync = connection.updated_at;
      }
    }

    // 5. Google Sheets status
    let googleSheetsConnected = false;
    let lastSync = null;
    let connectedSheetUrl = null;
    let connectedSheetName = null;
    let autoSync = false;
    let importedCount = 0;

    if (user && googleOAuthConnected) {
      const { data: sheetConnection } = await supabase
        .from('sheets_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (sheetConnection) {
        googleSheetsConnected = true;
        lastSync = sheetConnection.last_synced_at || sheetConnection.created_at;
        connectedSheetUrl = sheetConnection.sheet_url;
        connectedSheetName = sheetConnection.sheet_name;
        autoSync = sheetConnection.auto_sync;

        const { count } = await supabase
          .from('crm_leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('contact_source', 'google_sheets');

        importedCount = count || 0;
      }
    }

    return NextResponse.json({
      youtube: { 
        connected: youtubeConnected,
        name: 'YouTube Data API',
        lastSync: null
      },
      gemini: { 
        connected: geminiConnected,
        name: 'Gemini API',
        lastSync: null
      },
      apify: { 
        connected: apifyConnected,
        name: 'Apify API',
        lastSync: null,
        actor: apifyActor,
        status: apifyStatus,
        lastRun: apifyLastRun,
        totalRuns: apifyTotalRuns,
        failedRuns: apifyFailedRuns,
        avgRuntime: apifyAvgRuntime,
        lastError: apifyLastError
      },
      googleOAuth: { 
        connected: googleOAuthConnected,
        name: 'Google OAuth (Gmail)',
        email: googleEmail, 
        status: googleOAuthStatus,
        lastSync: lastGoogleSync
      },
      googleSheets: {
        connected: googleSheetsConnected,
        name: 'Google Sheets',
        lastSync,
        sheetUrl: connectedSheetUrl,
        sheetName: connectedSheetName,
        autoSync,
        importedCount,
      },
    });
  } catch (error: any) {
    console.error('Settings status endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
