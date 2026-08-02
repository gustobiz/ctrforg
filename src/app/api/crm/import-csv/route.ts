import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeCRMLead } from '@/lib/supabase/db';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leads } = await req.json();
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No valid leads provided for import' }, { status: 400 });
    }

    let successCount = 0;
    let errorCount = 0;
    const importedLeads: any[] = [];

    for (const raw of leads) {
      const creatorName = raw.creator_name || raw.name || raw.creatorName || raw.creator || '';
      if (!creatorName) {
        errorCount++;
        continue;
      }

      const email = raw.email || raw.contact_email || raw.contactEmail || '';
      const channelName = raw.channel_name || raw.channelName || raw.channel || creatorName;
      const subscriberCount = raw.subscriber_count || raw.subs || raw.subscribers || 0;
      const notes = raw.notes || raw.info || '';
      const website = raw.website || raw.site || raw.url || '';
      const instagram = raw.instagram || '';
      const twitter = raw.twitter || '';
      const linkedin = raw.linkedin || '';
      const facebook = raw.facebook || '';
      const leadScore = parseInt(raw.lead_score || raw.leadScore || '0', 10) || 0;

      const payload = sanitizeCRMLead({
        user_id: user.id,
        creator_name: creatorName,
        channel_name: channelName,
        subscriber_count: subscriberCount,
        notes: notes,
        email: email || null,
        contact_email: email || null,
        website: website || null,
        instagram: instagram || null,
        twitter: twitter || null,
        linkedin: linkedin || null,
        facebook: facebook || null,
        lead_score: leadScore,
        status: raw.status || 'new',
        contact_source: 'csv_import',
        contact_status: 'imported',
        email_verified: Boolean(email && email.includes('@')),
        website_found: Boolean(website),
        social_links_found: Boolean(instagram || twitter || linkedin || facebook),
        ai_analysis: {
          contact_email: email,
          website: website,
          platform: 'email',
        },
      });

      const { data: inserted, error } = await supabase
        .from('crm_leads')
        .upsert(payload, { onConflict: 'user_id,creator_name' })
        .select()
        .single();

      if (error) {
        // Fallback for missing unique constraint
        const { data: existing } = await supabase
          .from('crm_leads')
          .select('id')
          .eq('user_id', user.id)
          .eq('creator_name', creatorName)
          .maybeSingle();

        if (existing) {
          const { data: updated, error: updateErr } = await supabase
            .from('crm_leads')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single();

          if (!updateErr && updated) {
            successCount++;
            importedLeads.push(updated);
          } else {
            errorCount++;
          }
        } else {
          const { data: insertedNew, error: insertErr } = await supabase
            .from('crm_leads')
            .insert(payload)
            .select()
            .single();

          if (!insertErr && insertedNew) {
            successCount++;
            importedLeads.push(insertedNew);
          } else {
            errorCount++;
          }
        }
      } else if (inserted) {
        successCount++;
        importedLeads.push(inserted);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${successCount} leads from CSV (${errorCount} skipped/failed).`,
      importedCount: successCount,
      importedLeads,
    });
  } catch (error: any) {
    console.error('CSV import API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
