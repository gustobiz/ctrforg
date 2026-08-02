const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: connections } = await supabase
    .from('sheets_connections')
    .select('*');
  console.log('column_mapping:', JSON.stringify(connections[0].column_mapping, null, 2));
}

run();
