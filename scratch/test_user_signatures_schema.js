const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const anonKey = 'sb_publishable_3AeNb3z5aIllOWQ6JdZUZA_ZAshHQgQ';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

async function main() {
  console.log('Testing user_signatures select & maybeSingle...');
  const supabase = createClient(url, serviceRoleKey);

  const { data, error } = await supabase
    .from('user_signatures')
    .select('*')
    .limit(1)
    .maybeSingle();

  console.log('Error:', error);
  console.log('Data:', data);
}

main().catch(console.error);
