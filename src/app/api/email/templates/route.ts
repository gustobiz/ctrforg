import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's own templates AND any shared templates
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .or(`user_id.eq.${user.id},is_shared.eq.true`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, templates: templates || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { name, subject, htmlBody, textBody, category = 'custom', isShared = false, duplicateFromId } = body;

    // Handle duplication
    if (duplicateFromId) {
      const { data: sourceTemplate, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', duplicateFromId)
        .single();

      if (fetchError || !sourceTemplate) {
        return NextResponse.json({ error: 'Source template not found' }, { status: 404 });
      }

      const { data: clonedTemplate, error: cloneError } = await supabase
        .from('email_templates')
        .insert({
          user_id: user.id,
          name: `${sourceTemplate.name} (Copy)`,
          subject: sourceTemplate.subject,
          html_body: sourceTemplate.html_body,
          text_body: sourceTemplate.text_body,
          category: sourceTemplate.category || 'custom',
          is_shared: false, // Copies are private by default
        })
        .select()
        .single();

      if (cloneError) throw cloneError;
      return NextResponse.json({ success: true, template: clonedTemplate });
    }

    if (!name || !subject) {
      return NextResponse.json({ error: 'Name and subject are required' }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        user_id: user.id,
        name,
        subject,
        html_body: htmlBody || '',
        text_body: textBody || '',
        category,
        is_shared: isShared,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, subject, htmlBody, textBody, category, isShared } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Verify ownership before modifying
    const { data: checkOwn } = await supabase
      .from('email_templates')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!checkOwn || checkOwn.user_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this template' }, { status: 403 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updatePayload.name = name;
    if (subject !== undefined) updatePayload.subject = subject;
    if (htmlBody !== undefined) updatePayload.html_body = htmlBody;
    if (textBody !== undefined) updatePayload.text_body = textBody;
    if (category !== undefined) updatePayload.category = category;
    if (isShared !== undefined) updatePayload.is_shared = isShared;

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: checkOwn } = await supabase
      .from('email_templates')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!checkOwn || checkOwn.user_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this template' }, { status: 403 });
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
