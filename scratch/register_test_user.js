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

  const email = 'devuser@ctrforge.com';
  const password = 'Password123!';

  console.log(`Registering ${email}...`);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error("Sign up failed:", error.message);
  } else {
    console.log("Sign up succeeded!", data);
  }
}

main().catch(console.error);
