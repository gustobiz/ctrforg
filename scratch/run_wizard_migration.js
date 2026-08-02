const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(url, serviceRoleKey);

async function runMigration() {
  console.log('Running migration via RPC / schema probe...');
  // Check if columns can be selected or if we can execute via RPC/REST
  const { data, error } = await supabase.from('bulk_campaigns').select('*').limit(1);
  if (error) console.error('Select error:', error);
  else console.log('Current bulk_campaigns columns sample:', data && data[0] ? Object.keys(data[0]) : 'no rows');
}

runMigration();
