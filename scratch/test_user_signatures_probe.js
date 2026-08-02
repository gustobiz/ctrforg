const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const anonKey = 'sb_publishable_3AeNb3z5aIllOWQ6JdZUZA_ZAshHQgQ';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

console.log('--- PROBING SUPABASE FOR user_signatures ---');
console.log('Project URL:', url);

async function probe() {
  const supabaseService = createClient(url, serviceRoleKey);
  const supabaseAnon = createClient(url, anonKey);

  console.log('\n1. Testing with Service Role Key:');
  const serviceRes = await supabaseService.from('user_signatures').select('*').limit(5);
  console.log('Service Role Result:', JSON.stringify(serviceRes, null, 2));

  console.log('\n2. Testing with Anon Key:');
  const anonRes = await supabaseAnon.from('user_signatures').select('*').limit(5);
  console.log('Anon Result:', JSON.stringify(anonRes, null, 2));
}

probe().catch(console.error);
