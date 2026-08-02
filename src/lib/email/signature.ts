export interface SocialLinkConfig {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface UserSignature {
  id?: string;
  user_id?: string;
  signature_name?: string;
  display_name?: string;
  role?: string | null;
  content_html?: string;
  portfolio_url?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  social_links?: SocialLinkConfig[];
  is_enabled: boolean;
}

export const AVAILABLE_SOCIAL_LINKS: { id: string; label: string; defaultUrlPlaceholder?: string }[] = [
  { id: 'portfolio', label: 'Portfolio', defaultUrlPlaceholder: 'https://gustostudio.com' },
  { id: 'website', label: 'Website', defaultUrlPlaceholder: 'https://yourwebsite.com' },
  { id: 'linkedin', label: 'LinkedIn', defaultUrlPlaceholder: 'https://linkedin.com/in/username' },
  { id: 'twitter', label: 'X', defaultUrlPlaceholder: 'https://x.com/username' },
  { id: 'youtube', label: 'YouTube', defaultUrlPlaceholder: 'https://youtube.com/@username' },
  { id: 'instagram', label: 'Instagram', defaultUrlPlaceholder: 'https://instagram.com/username' },
  { id: 'behance', label: 'Behance', defaultUrlPlaceholder: 'https://behance.net/username' },
  { id: 'dribbble', label: 'Dribbble', defaultUrlPlaceholder: 'https://dribbble.com/username' },
  { id: 'github', label: 'GitHub', defaultUrlPlaceholder: 'https://github.com/username' },
];

/**
  * Check if a given URL is non-empty, not a placeholder, and not using example.com
  */
export function isValidSocialUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === '#' || trimmed === 'http://' || trimmed === 'https://') return false;
  if (trimmed.includes('example.com') || trimmed.includes('example.org') || trimmed.includes('example.net')) return false;
  return true;
}

/**
 * Standardize link URL to always include http:// or https:// protocol
 */
export function formatSocialUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Get normalized array of SocialLinkConfig objects from signature data, preserving custom links
 */
export function getNormalizedSocialLinks(signature: UserSignature): SocialLinkConfig[] {
  const legacyMap: Record<string, string | null | undefined> = {
    portfolio: signature.portfolio_url,
    website: signature.website_url,
    linkedin: signature.linkedin_url,
    twitter: signature.twitter_url,
  };

  const existingMap = new Map<string, SocialLinkConfig>();

  if (Array.isArray(signature.social_links)) {
    for (const item of signature.social_links) {
      if (item && item.id) {
        existingMap.set(item.id, item);
      }
    }
  }

  const result: SocialLinkConfig[] = AVAILABLE_SOCIAL_LINKS.map(def => {
    const existing = existingMap.get(def.id);
    if (existing) {
      return {
        id: def.id,
        label: existing.label || def.label,
        url: existing.url || '',
        enabled: Boolean(existing.enabled),
        isCustom: false,
      };
    }

    const legacyVal = legacyMap[def.id];
    const isLegacyValid = isValidSocialUrl(legacyVal);

    return {
      id: def.id,
      label: def.label,
      url: legacyVal || '',
      enabled: isLegacyValid,
      isCustom: false,
    };
  });

  // Preserve any custom user-added links
  if (Array.isArray(signature.social_links)) {
    for (const item of signature.social_links) {
      if (item && item.id && (item.isCustom || !AVAILABLE_SOCIAL_LINKS.some(d => d.id === item.id))) {
        result.push({
          id: item.id,
          label: item.label || 'Custom Link',
          url: item.url || '',
          enabled: Boolean(item.enabled),
          isCustom: true,
        });
      }
    }
  }

  return result;
}

/**
 * Render signature to HTML format.
 */
export function renderSignatureHtml(signature: UserSignature): string {
  if (!signature || !signature.is_enabled) return '';

  const links = getNormalizedSocialLinks(signature);
  const activeLinks = links.filter(l => l.enabled && isValidSocialUrl(l.url));

  const hasContentHtml = Boolean(signature.content_html && signature.content_html.trim());
  const hasName = Boolean(signature.display_name && signature.display_name.trim());
  const hasRole = Boolean(signature.role && signature.role.trim());

  if (!hasContentHtml && !hasName && !hasRole && activeLinks.length === 0) return '';

  let bodyMarkup = '';

  if (hasContentHtml) {
    bodyMarkup = signature.content_html!.trim();
  } else {
    bodyMarkup = `
<p style="margin: 0 0 4px 0; color: #71717a; font-size: 14px;">—</p>
${hasName ? `<p style="margin: 0; font-weight: 700; font-size: 15px;" class="sig-name">${signature.display_name?.trim()}</p>` : ''}
${hasRole ? `<p style="margin: 2px 0 8px 0; color: #71717a; font-size: 13px;" class="sig-role">${signature.role!.trim()}</p>` : ''}
`.trim();
  }

  // Filter active links to check if any active links are NOT already present in bodyMarkup
  const missingLinks = activeLinks.filter(l => {
    const formattedUrl = formatSocialUrl(l.url);
    return !bodyMarkup.includes(formattedUrl) && !bodyMarkup.includes(l.url);
  });

  let linksMarkup = '';
  if (missingLinks.length > 0) {
    const linkElements = missingLinks.map(l => {
      const formattedUrl = formatSocialUrl(l.url);
      return `<a href="${formattedUrl}" target="_blank" rel="noopener noreferrer" style="color: #10b981; font-weight: 600; text-decoration: none;">${l.label}</a>`;
    });
    linksMarkup = `<div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; margin-top: 10px; color: #71717a;" class="sig-links">${linkElements.join(' &bull; ')}</div>`;
  }

  return `
<div class="ctrforge-email-signature" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(228,228,231,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
  ${bodyMarkup}
  ${linksMarkup}
</div>`.trim();
}

/**
 * Render signature to Plain Text format.
 */
export function renderSignatureText(signature: UserSignature): string {
  if (!signature || !signature.is_enabled) return '';

  const links = getNormalizedSocialLinks(signature);
  const activeLinks = links.filter(l => l.enabled && isValidSocialUrl(l.url));

  const hasContentHtml = Boolean(signature.content_html && signature.content_html.trim());
  const hasName = Boolean(signature.display_name && signature.display_name.trim());
  const hasRole = Boolean(signature.role && signature.role.trim());

  if (!hasContentHtml && !hasName && !hasRole && activeLinks.length === 0) return '';

  const lines: string[] = ['—'];

  if (hasContentHtml) {
    // Strip HTML tags safely for text format
    const plain = signature.content_html!
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (plain) lines.push(plain);
  } else {
    if (hasName) lines.push(signature.display_name?.trim() || '');
    if (hasRole) lines.push(signature.role!.trim());
  }

  for (const l of activeLinks) {
    const formattedUrl = formatSocialUrl(l.url);
    if (!signature.content_html?.includes(formattedUrl)) {
      lines.push(`${l.label}: ${formattedUrl}`);
    }
  }

  return lines.join('\n');
}

/**
 * Normalize a raw Supabase DB row from `user_signatures` into a proper UserSignature.
 * This mirrors the normalization performed in GET /api/signature and must be called
 * by ALL server-side email senders (campaign engine, send route, followups) before
 * passing the signature to appendSignatureToEmail().
 *
 * Without this, rows that have an empty content_html fall back to rendering only
 * `display_name` — which may be a stale email-prefix like 'gustobiz01'.
 */
export function normalizeSignatureFromDb(row: Record<string, any>): UserSignature {
  if (!row) return { is_enabled: false };

  // Prefer the dedicated signature_name column; fall back to display_name
  const signatureName = (row.signature_name || row.display_name || 'Main Outreach').trim();
  // display_name is the rendered "From" name shown in the email
  const displayName = (row.display_name || row.signature_name || '').trim();
  const role = (row.role ?? '').trim();

  let contentHtml: string = (row.content_html ?? '').trim();
  // If content_html is absent or empty, synthesise it from display_name + role.
  // Priority: content_html (rich editor) → legacy display_name + role fallback.
  if (!contentHtml) {
    contentHtml = `Thanks,<br/><br/><strong>${displayName}</strong>${role ? `<br/>${role}` : ''}`;
  }

  return {
    ...row,
    signature_name: signatureName,
    display_name: displayName,
    role,
    content_html: contentHtml,
    social_links: getNormalizedSocialLinks(row as UserSignature),
    is_enabled: row.is_enabled ?? true,
  } as UserSignature;
}

/**
 * Safely append signature to HTML and text bodies without modifying master templates.
 */
export function appendSignatureToEmail({
  htmlBody,
  textBody,
  signature,
  disableSignature = false,
}: {
  htmlBody: string;
  textBody?: string;
  signature: UserSignature | null;
  disableSignature?: boolean;
}): { html: string; text?: string } {
  if (disableSignature || !signature || !signature.is_enabled) {
    return { html: htmlBody, text: textBody };
  }

  const sigHtml = renderSignatureHtml(signature);
  const sigText = renderSignatureText(signature);

  if (!sigHtml) {
    return { html: htmlBody, text: textBody };
  }

  // Inject into HTML before closing </body> or append
  let updatedHtml = htmlBody;
  if (updatedHtml.includes('</body>')) {
    updatedHtml = updatedHtml.replace('</body>', `${sigHtml}</body>`);
  } else {
    updatedHtml = `${updatedHtml}\n<br/>\n${sigHtml}`;
  }

  const updatedText = textBody ? `${textBody}\n\n${sigText}` : undefined;

  return { html: updatedHtml, text: updatedText };
}



