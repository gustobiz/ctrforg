import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCodeForTokens, getGmailUserEmail } from '@/lib/gmail/oauth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(new URL('/settings?gmail_error=denied', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?gmail_error=no_code', request.url));
    }

    // Verify state parameter
    let stateData: { userId: string } | null = null;
    if (state) {
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      } catch {
        return NextResponse.redirect(new URL('/settings?gmail_error=invalid_state', request.url));
      }
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    // Get user email from Google
    const gmailEmail = await getGmailUserEmail(tokens.access_token);

    // Store tokens in Supabase
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options }); } catch {}
          },
        },
      }
    );

    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/settings?gmail_error=unauthorized', request.url));
    }

    // Verify state matches current user
    if (stateData && stateData.userId !== user.id) {
      return NextResponse.redirect(new URL('/settings?gmail_error=state_mismatch', request.url));
    }

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert the Gmail connection
    const { error: dbError } = await supabase
      .from('gmail_connections')
      .upsert(
        {
          user_id: user.id,
          email: gmailEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          scopes: tokens.scope,
          status: 'active',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (dbError) {
      console.error('Failed to store Gmail tokens:', dbError);
      return returnResponse(new Error('db_error'), request.url);
    }

    return returnResponse(null, request.url);
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return returnResponse(error, request.url);
  }
}

function returnResponse(error: Error | null, requestUrl: string) {
  const successUrl = '/settings?gmail_connected=true';
  const errorUrl = `/settings?gmail_error=${encodeURIComponent(error?.message || 'unknown')}`;
  const targetUrl = error ? errorUrl : successUrl;

  const html = `
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: ${error ? "'GOOGLE_OAUTH_ERROR'" : "'GOOGLE_OAUTH_SUCCESS'"},
              error: ${error ? `'${error.message.replace(/'/g, "\\'")}'` : 'null'}
            }, '*');
            window.close();
          } else {
            window.location.href = '${targetUrl}';
          }
        </script>
        <p>${error ? 'Connection failed: ' + error.message : 'Connection successful! Closing window...'}</p>
      </body>
    </html>
  `;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
