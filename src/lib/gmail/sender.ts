import { getValidAccessToken } from './oauth';

/**
 * Resolves the application's public base URL for outgoing email links and tracking.
 * Prioritizes explicitly configured public environment variables (NEXT_PUBLIC_APP_URL,
 * NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_VERCEL_URL, VERCEL_URL, etc.).
 * Guarantees 'localhost' or '127.0.0.1' is never embedded into outgoing email hyperlinks.
 */
export function getPublicAppBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/^https?:\/\//, '')}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}` : null,
    process.env.TRACKING_BASE_URL,
    process.env.NEXTAUTH_URL,
  ];

  for (const url of candidates) {
    if (url && typeof url === 'string') {
      const trimmed = url.trim().replace(/\/$/, '');
      if (trimmed) {
        return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      }
    }
  }

  // Fallback for local development if no public environment URL is set
  return 'http://localhost:3000';
}

/**
 * Interpolate template variables like {{creator_name}}, {{channel_name}}, {{latest_video}}
 */
/**
 * Interpolate template variables like {{FirstName}}, {{Email}}, {{ChannelName}}, {{VideoTitle}}, {{first_name}}, etc.
 * Any missing or unrecognized {{...}} variables are replaced with an empty string so raw placeholders are never sent to Gmail.
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, any>
): string {
  if (!template) return '';

  const normalizedVars = new Map<string, string>();
  const normalizeKey = (k: string) => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  if (variables && typeof variables === 'object') {
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const valStr = typeof value === 'object' ? '' : String(value);
        normalizedVars.set(key, valStr);
        normalizedVars.set(key.toLowerCase(), valStr);
        normalizedVars.set(normalizeKey(key), valStr);
      }
    }
  }

  const getVarValue = (varName: string): string => {
    if (variables && variables[varName] !== undefined && variables[varName] !== null) {
      const direct = variables[varName];
      return typeof direct === 'object' ? '' : String(direct);
    }
    const norm = normalizeKey(varName);
    if (normalizedVars.has(norm)) {
      return normalizedVars.get(norm)!;
    }
    return '';
  };

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, varName) => {
    const trimmed = varName.trim();
    return getVarValue(trimmed);
  });
}

/**
 * Inject a 1x1 tracking pixel into HTML email body
 */
export function injectTrackingPixel(html: string, campaignId: string): string {
  const baseUrl = getPublicAppBaseUrl();
  const encodedId = Buffer.from(campaignId).toString('base64url');
  const pixelUrl = `${baseUrl}/api/email/track/open?cid=${encodedId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;

  // Insert before closing </body> tag, or append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrite all links in HTML body to tracking redirect URLs
 */
export function rewriteLinksForTracking(html: string, campaignId: string): string {
  const baseUrl = getPublicAppBaseUrl();
  const encodedCampaignId = Buffer.from(campaignId).toString('base64url');
  
  // Match href attributes in anchor tags
  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/gi,
    (match, url) => {
      // Don't rewrite tracking URLs or mailto links
      if (url.includes('/api/email/track/') || url.startsWith('mailto:')) {
        return match;
      }
      const encodedUrl = encodeURIComponent(url);
      const trackingUrl = `${baseUrl}/api/email/track/click?cid=${encodedCampaignId}&url=${encodedUrl}`;
      return `href="${trackingUrl}"`;
    }
  );
}

/**
 * Build a MIME message for Gmail API
 */
/**
 * Fetch the Message-ID header of a Gmail message by its Gmail API message ID
 */
export async function fetchMessageIdHeader(userId: string, gmailMessageId: string): Promise<string | null> {
  try {
    const tokenData = await getValidAccessToken(userId);
    if (!tokenData) return null;

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=metadata&metadataHeaders=Message-ID`,
      {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const header = data.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'message-id');
    return header?.value || null;
  } catch (err) {
    console.error('Error fetching Message-ID header:', err);
    return null;
  }
}

/**
 * Build a MIME message for Gmail API
 */
function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  messageId?: string;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
  ];

  if (params.messageId) {
    headers.push(`Message-ID: ${params.messageId}`);
  }
  if (params.replyTo) {
    headers.push(`Reply-To: ${params.replyTo}`);
  }
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    headers.push(`References: ${params.references}`);
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const headersStr = headers.join('\r\n');

  const textPart = params.textBody
    ? [
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        params.textBody,
      ].join('\r\n')
    : '';

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    params.htmlBody,
  ].join('\r\n');

  const body = [headersStr, '', textPart, htmlPart, `--${boundary}--`].join('\r\n');

  // Gmail API requires base64url encoding
  return Buffer.from(body).toString('base64url');
}

/**
 * Send an email via Gmail API
 * Returns the Gmail message ID and thread ID for tracking
 */
export async function sendEmail(params: {
  userId: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  threadId?: string; // For follow-ups in the same thread
  parentGmailMessageId?: string; // Parent internal Gmail message ID to query Message-ID header
  replyTo?: string;
}): Promise<{ messageId: string; threadId: string }> {
  const tokenData = await getValidAccessToken(params.userId);
  if (!tokenData) {
    throw new Error('Gmail is not connected. Please connect your Gmail account in Settings.');
  }

  let inReplyTo: string | undefined;
  let references: string | undefined;

  if (params.parentGmailMessageId) {
    const parentMsgIdHeader = await fetchMessageIdHeader(params.userId, params.parentGmailMessageId);
    if (parentMsgIdHeader) {
      inReplyTo = parentMsgIdHeader;
      references = parentMsgIdHeader;
    }
  }

  // Generate a custom Message-ID for tracking or thread preservation
  const customMessageId = `<${Math.random().toString(36).substring(2)}-${Date.now()}@ctrforge.com>`;

  const raw = buildMimeMessage({
    from: tokenData.email,
    to: params.to,
    subject: params.subject,
    htmlBody: params.htmlBody,
    textBody: params.textBody,
    replyTo: params.replyTo || tokenData.email,
    inReplyTo,
    references,
    messageId: customMessageId,
  });

  const gmailPayload: any = { raw };
  if (params.threadId) {
    gmailPayload.threadId = params.threadId;
  }

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gmailPayload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail send failed: ${errText}`);
  }

  const data = await response.json();
  return {
    messageId: data.id,
    threadId: data.threadId,
  };
}

/**
 * Generate a plain text version from HTML
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
