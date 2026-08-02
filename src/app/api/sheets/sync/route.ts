import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/gmail/oauth';
import { sanitizeCRMLead } from '@/lib/supabase/db';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { connectionId } = body;

    // Retrieve active connection
    let query = supabase
      .from('sheets_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (connectionId) {
      query = query.eq('id', connectionId);
    }

    const { data: connections, error: connError } = await query;
    if (connError || !connections || connections.length === 0) {
      return NextResponse.json({ error: 'No active Google Sheet connections found' }, { status: 404 });
    }

    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ error: 'Google Account unauthorized or token expired.' }, { status: 401 });
    }

    let totalSynced = 0;
    const syncResults: any[] = [];

    for (const conn of connections) {
      const { sheet_id: sheetId, sheet_name: sheetName, column_mapping: mapping } = conn;

      // 1. Fetch spreadsheet metadata to get the actual first worksheet tab title
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      let actualTabName = 'Sheet1';
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.sheets && meta.sheets.length > 0) {
          actualTabName = meta.sheets[0].properties?.title || 'Sheet1';
        }
      }

      // 2. Fetch full worksheet used range dynamically without hardcoded bounds (e.g. A1:Z500 or A:E)
      const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'" + actualTabName.replace(/'/g, "''") + "'")}?valueRenderOption=FORMATTED_VALUE`;

      let response = await fetch(rangeUrl, {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Sheet sync fetch failed for ${sheetId}:`, errText);
        syncResults.push({ sheetId, syncedCount: 0, error: `Google Sheets API fetch failed: ${errText}` });
        continue;
      }

      const data = await response.json();
      const rows = data.values;
      if (!rows || rows.length <= 1) {
        // Empty sheet
        syncResults.push({ sheetId, syncedCount: 0, message: 'Sheet is empty or has no data rows.' });
        continue;
      }

      // 1. Extract raw headers exactly as they appear in the sheet (row 0)
      const rawHeaders: string[] = rows[0].map((h: any) => (h ? h.toString().trim() : ''));
      const lowerHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Helper to find header index matching dynamic aliases
      const findHeaderIdx = (aliases: string[]) => {
        for (const alias of aliases) {
          const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          const idx = lowerHeaders.findIndex(h => h === normAlias);
          if (idx !== -1) return idx;
        }
        for (const alias of aliases) {
          const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          const idx = lowerHeaders.findIndex(h => h.includes(normAlias) || normAlias.includes(h));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Canonical mappings per requirements:
      // Email / Email Address / Gmail -> email
      const emailIdx = findHeaderIdx(['email', 'email address', 'gmail', 'mail', 'contact_email']);

      // FirstName / First Name / Name / Creator -> first_name & creator_name
      let nameIdx = findHeaderIdx(['firstname', 'first name', 'first_name', 'name', 'creator', 'lead', 'contact']);

      // Channel / ChannelName / Channel Name -> channel_name
      const channelIdx = findHeaderIdx(['channel', 'channelname', 'channel_name', 'channel name', 'youtube', 'company']);

      // Video / Video Title / VideoTitle / Latest Video -> video_title
      const videoTitleIdx = findHeaderIdx(['video', 'video title', 'videotitle', 'video_title', 'latest video', 'latestvideo', 'latest_video', 'title']);

      const subIdx = findHeaderIdx(['subscribers', 'subscriber count', 'subs', 'followers']);
      const notesIdx = findHeaderIdx(['notes', 'note', 'info', 'specificthing', 'specific_thing', 'comment']);
      const videoUrlIdx = findHeaderIdx(['videolink', 'video_link', 'videourl', 'video_url']);
      const websiteIdx = findHeaderIdx(['website', 'site']);

      // Fallback for nameIdx if still -1
      if (nameIdx === -1 && rawHeaders.length > 0) {
        nameIdx = 0;
      }

      let count = 0;

      // FIRST: Purge previous leads for this specific sheet to ensure clean state and exact row count match
      await supabase
        .from('crm_leads')
        .delete()
        .eq('user_id', user.id)
        .eq('sheet_id', conn.sheet_id);

      // Process every data row (skipping row 0 which is headers)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        // Build raw_data map preserving exact original column header & exact string value
        const rawDataMap: Record<string, string> = {};
        rawHeaders.forEach((header, colIdx) => {
          if (!header) return;
          const cellVal = row[colIdx] !== undefined && row[colIdx] !== null ? row[colIdx].toString().trim() : '';
          rawDataMap[header] = cellVal;
        });

        // Canonical fields
        const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].toString().trim() : '';
        const channelName = channelIdx !== -1 && row[channelIdx] ? row[channelIdx].toString().trim() : '';
        const rawName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].toString().trim() : '';
        
        const creatorName = rawName || channelName || (email ? email.split('@')[0] : `Lead #${i}`);
        const firstName = rawName ? rawName.split(' ')[0] : creatorName;

        const videoTitle = videoTitleIdx !== -1 && row[videoTitleIdx] ? row[videoTitleIdx].toString().trim() : '';
        const videoUrl = videoUrlIdx !== -1 && row[videoUrlIdx] ? row[videoUrlIdx].toString().trim() : '';
        const specificThing = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].toString().trim() : '';
        const subscriberCount = subIdx !== -1 && row[subIdx] ? row[subIdx].toString().trim() : '0';
        const website = websiteIdx !== -1 && row[websiteIdx] ? row[websiteIdx].toString().trim() : '';
        const cleanSubs = parseInt(subscriberCount.replace(/[^0-9]/g, ''), 10) || 0;

        const rawPayload = {
          user_id: user.id,
          creator_name: creatorName,
          channel_name: channelName || creatorName,
          video_title: videoTitle || null,
          video_url: videoUrl || null,
          subscriber_count: cleanSubs,
          notes: specificThing || '',
          email: email || null,
          contact_email: email || null,
          website: website || null,
          status: 'new',
          contact_source: 'google_sheets',
          sheet_id: conn.sheet_id,
          contact_status: 'imported',
          email_verified: Boolean(email && email.includes('@')),
          website_found: Boolean(website),
          ai_analysis: {
            contact_email: email,
            first_name: firstName,
            creator_name: creatorName,
            channel_name: channelName || creatorName,
            video_title: videoTitle || null,
            VideoTitle: videoTitle || null,
            website: website,
            platform: 'email',
            notes: specificThing || '',
            specific_thing: specificThing || '',
            raw_data: rawDataMap,
            sheet_headers: rawHeaders,
            ...rawDataMap,
          },
        };

        const safePayload = sanitizeCRMLead(rawPayload);

        // Upsert into crm_leads
        const { error: dbError } = await supabase
          .from('crm_leads')
          .upsert(safePayload, { onConflict: 'user_id,creator_name' });

        if (dbError) {
          console.warn(`Upsert failed for lead ${creatorName}, attempting fallback insert/update:`, dbError.message);
          
          const { data: existing } = await supabase
            .from('crm_leads')
            .select('id')
            .eq('user_id', user.id)
            .eq('creator_name', creatorName)
            .maybeSingle();

          if (existing) {
            const { error: updateErr } = await supabase
              .from('crm_leads')
              .update(safePayload)
              .eq('id', existing.id);
            if (!updateErr) count++;
            else console.error(`Failed fallback update for ${creatorName}:`, updateErr.message);
          } else {
            const { error: insertErr } = await supabase
              .from('crm_leads')
              .insert(safePayload);
            if (!insertErr) count++;
            else console.error(`Failed fallback insert for ${creatorName}:`, insertErr.message);
          }
        } else {
          count++;
        }
      }

      // Store detected raw headers and column mapping on connection
      const updatedMapping = {
        ...(mapping || {}),
        raw_headers: rawHeaders,
        sheet_headers: rawHeaders,
      };

      // Update sync timestamp and header schema mapping
      await supabase
        .from('sheets_connections')
        .update({ 
          last_synced_at: new Date().toISOString(),
          column_mapping: updatedMapping,
        })
        .eq('id', conn.id);

      totalSynced += count;
      syncResults.push({ sheetId, syncedCount: count, rawHeaders });
    }

    return NextResponse.json({ 
      success: true, 
      totalSynced, 
      syncResults 
    });
  } catch (error: any) {
    console.error('Sheets sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
