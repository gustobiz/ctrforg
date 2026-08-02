import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Check for demo/placeholder keys
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl || supabaseUrl.includes('demo.supabase.co')) {
      if (email === 'gustobiz01@gmail.com') {
        return NextResponse.json(
          { error: 'Missing real API key. Please configure NEXT_PUBLIC_SUPABASE_URL in .env.local with your actual Supabase project URL to log in as admin.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Auth service unavailable. Missing valid API keys in environment.' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ user: data.user, session: data.session });
  } catch (error: any) {
    console.error('Login error:', error);
    // This catches fetch failures (e.g. ENOTFOUND or CORS failures from underlying node fetch)
    return NextResponse.json(
      { error: 'Network error or Auth service unavailable. Please check your connection and API keys.' },
      { status: 500 }
    );
  }
}
