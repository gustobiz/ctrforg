const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '.env.local');
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

  const functions = ['exec_sql', 'execute_sql', 'run_sql'];
  for (const fn of functions) {
    console.log(`Testing RPC function '${fn}'...`);
    const { data, error } = await supabase.rpc(fn, { sql: "NOTIFY pgrst, 'reload schema';" });
    if (error) {
      console.log(`RPC '${fn}' failed/not found:`, error.message);
    } else {
      console.log(`RPC '${fn}' succeeded:`, data);
    }
  }
}

main().catch(console.error);
