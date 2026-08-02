const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching CRM leads...");
  const { data: leads, error } = await supabase.from('crm_leads').select('*');
  if (error) {
    console.error("Error fetching leads:", error);
  } else {
    console.log(`Successfully fetched ${leads.length} leads:`);
    leads.forEach((l, index) => {
      console.log(`\nLead ${index + 1}:`);
      console.log(`- ID: ${l.id}`);
      console.log(`- Creator Name: ${l.creator_name}`);
      console.log(`- Email Column: ${l.email}`);
      console.log(`- ai_analysis:`, JSON.stringify(l.ai_analysis, null, 2));
    });
  }
}

main().catch(console.error);
