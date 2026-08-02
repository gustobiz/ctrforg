import { createClient } from '@/lib/supabase/server';

// ============================================================
// Google OAuth 2.0 Configuration for Gmail Integration
// ============================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/gmail/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
].join(' ');

/**
 * Generate the Google OAuth 2.0 authorization URL
 */
export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString().replace(/\+/g, '%20')}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google token refresh failed: ${errText}`);
  }

  return response.json();
}

/**
 * Revoke a Google OAuth token
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

/**
 * Fetch the Gmail user's email address using the access token
 */
export async function getGmailUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Gmail user info');
  }

  const data = await response.json();
  return data.email;
}

/**
 * Get a valid access token for a user, refreshing if expired
 */
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; email: string } | null> {
  const supabase = await createClient();

  const { data: connection, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !connection) {
    console.error('Failed to fetch gmail_connections:', error?.message || 'No connection found for user', userId);
    return null;
  }

  // Check if all required scopes are present in the connection
  const requiredScopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ];

  const grantedScopes = connection.scopes ? connection.scopes.split(' ') : [];
  const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

  if (missingScopes.length > 0) {
    console.warn('Google connection is missing required scopes. Revoking and forcing reconnect:', missingScopes);
    try {
      if (connection.refresh_token) {
        await revokeToken(connection.refresh_token);
      } else if (connection.access_token) {
        await revokeToken(connection.access_token);
      }
    } catch (revokeErr) {
      console.error('Failed to revoke old Google token:', revokeErr);
    }
    // Delete the connection to force reconnect
    await supabase
      .from('gmail_connections')
      .delete()
      .eq('user_id', userId);
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const expiry = new Date(connection.token_expiry);
  const bufferMs = 5 * 60 * 1000;

  if (now.getTime() + bufferMs >= expiry.getTime()) {
    try {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

      await supabase
        .from('gmail_connections')
        .update({
          access_token: refreshed.access_token,
          token_expiry: newExpiry.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return { accessToken: refreshed.access_token, email: connection.email };
    } catch (err) {
      console.error('Failed to refresh Gmail token:', err);
      await supabase
        .from('gmail_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      return null;
    }
  }

  return { accessToken: connection.access_token, email: connection.email };
}
