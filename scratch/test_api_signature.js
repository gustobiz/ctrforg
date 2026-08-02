const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

async function testSignatureOps() {
  console.log('--- TESTING user_signatures TABLE READ & WRITE ---');
  const supabase = createClient(url, serviceRoleKey);

  // Read
  const readRes = await supabase.from('user_signatures').select('*').limit(5);
  console.log('Read Status:', readRes.status, readRes.statusText);
  console.log('Read Error:', readRes.error);
  console.log('Read Data:', readRes.data);
}

testSignatureOps().catch(console.error);
