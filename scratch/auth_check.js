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

  const email = 'newtestuser789@gmail.com';
  const password = 'Password123!';

  console.log(`Attempting to sign in as ${email}...`);
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.log("Sign in failed, attempting to sign up instead...");
    const signUpResult = await supabase.auth.signUp({ email, password });
    if (signUpResult.error) {
      console.error("Sign up failed:", signUpResult.error.message);
      return;
    }
    console.log("Sign up succeeded!");
    data = signUpResult.data;
  } else {
    console.log("Sign in succeeded!");
  }

  const userId = data.user.id;
  console.log(`User ID: ${userId}`);

  // Now, check if this user has any crm_leads
  const { data: leads, error: fetchError } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error("Error fetching leads:", fetchError);
    return;
  }

  console.log(`User has ${leads.length} leads in database.`);
  if (leads.length === 0) {
    console.log("Seeding crm_leads for user...");
    const seedLeads = [
      {
        user_id: userId,
        creator_name: 'Ali Abdaal',
        channel_name: 'Ali Abdaal Productivity',
        subscriber_count: 5000000,
        view_count: 100000000,
        like_count: 5000000,
        status: 'new',
        email: 'ali@example.com',
        ai_analysis: {
          contact_email: 'ali@example.com',
          creator_niche: 'Productivity',
          platform: 'email'
        }
      },
      {
        user_id: userId,
        creator_name: 'MKBHD',
        channel_name: 'Marques Brownlee',
        subscriber_count: 18000000,
        view_count: 3000000000,
        like_count: 150000000,
        status: 'new',
        email: 'marques@example.com',
        ai_analysis: {
          contact_email: 'marques@example.com',
          creator_niche: 'Tech',
          platform: 'email'
        }
      },
      {
        user_id: userId,
        creator_name: 'Iman Gadzhi',
        channel_name: 'Iman Gadzhi Business',
        subscriber_count: 4000000,
        view_count: 200000000,
        like_count: 10000000,
        status: 'new',
        email: '',
        ai_analysis: {
          contact_email: 'iman@example.com',
          creator_niche: 'Business',
          platform: 'email'
        }
      }
    ];

    const { data: inserted, error: insertError } = await supabase
      .from('crm_leads')
      .upsert(seedLeads, { onConflict: 'user_id,creator_name' })
      .select();

    if (insertError) {
      console.error("Failed to seed leads:", insertError);
    } else {
      console.log(`Successfully seeded ${inserted.length} leads!`);
    }
  }
}

main().catch(console.error);
