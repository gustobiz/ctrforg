import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/variables — List user's custom variables
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: variables, error } = await supabase
      .from('custom_variables')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Merge with system variables
    const systemVariables = [
      { name: 'name', default_value: '', system: true, description: 'Full creator name' },
      { name: 'first_name', default_value: '', system: true, description: 'First name' },
      { name: 'last_name', default_value: '', system: true, description: 'Last name' },
      { name: 'email', default_value: '', system: true, description: 'Email address' },
      { name: 'channel_name', default_value: '', system: true, description: 'YouTube channel name' },
      { name: 'subscriber_count', default_value: '', system: true, description: 'Subscriber count' },
      { name: 'video_title', default_value: '', system: true, description: 'Latest video title' },
      { name: 'video_url', default_value: '', system: true, description: 'Video URL' },
      { name: 'latest_video', default_value: '', system: true, description: 'Latest video title (alias)' },
      { name: 'niche', default_value: '', system: true, description: 'Creator niche' },
    ];

    return NextResponse.json({
      success: true,
      systemVariables,
      customVariables: variables || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/variables — Create custom variable
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, defaultValue } = body;

    if (!name) {
      return NextResponse.json({ error: 'Variable name is required' }, { status: 400 });
    }

    // Sanitize variable name
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!cleanName) {
      return NextResponse.json({ error: 'Invalid variable name' }, { status: 400 });
    }

    const { data: variable, error } = await supabase
      .from('custom_variables')
      .upsert({
        user_id: user.id,
        name: cleanName,
        default_value: defaultValue || '',
      }, { onConflict: 'user_id,name' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, variable });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/variables — Delete custom variable
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
      return NextResponse.json({ error: 'Variable ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('custom_variables')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
