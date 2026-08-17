const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function updateSig() {
  const publicPortfolio = 'https://gustostudio.vercel.app';
  const cleanHtml = `<strong>GustoBiz</strong><div><b>Thumbnail Strategist</b><br><div><strong><a href="${publicPortfolio}" target="_blank" rel="noopener noreferrer" style="color: #10b981; font-weight: 600; text-decoration: underline;">Portfolio</a>&nbsp;<br></strong></div></div>`;

  const { data: rows, error: selectErr } = await supabase.from('user_signatures').select('*');
  if (selectErr) {
    console.error('Error fetching signatures:', selectErr);
    return;
  }

  for (const row of rows) {
    const updatedLinks = Array.isArray(row.social_links)
      ? row.social_links.map(link => link.id === 'portfolio' ? { ...link, url: publicPortfolio } : link)
      : [];

    const { data, error } = await supabase
      .from('user_signatures')
      .update({
        content_html: cleanHtml,
        portfolio_url: publicPortfolio,
        social_links: updatedLinks,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)
      .select();

    console.log(`Updated signature ${row.id}:`, data || error);
  }
}

updateSig().catch(console.error);
