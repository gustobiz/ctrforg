const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetchSheet() {
  const { data: conn } = await supabase
    .from('sheets_connections')
    .select('*')
    .single();

  const { data: gmailConn } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', conn.user_id)
    .single();

  console.log('Sheet ID:', conn.sheet_id);
  console.log('Sheet Name:', conn.sheet_name);

  const sheetId = conn.sheet_id;
  const sheetName = conn.sheet_name || 'Sheet1';
  const range = `'${sheetName}'!A1:Z500`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailConn.access_token}` }
  });

  if (!res.ok) {
    console.log('First fetch failed with status:', res.status);
    const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z500?valueRenderOption=FORMATTED_VALUE`;
    res = await fetch(fallbackUrl, {
      headers: { Authorization: `Bearer ${gmailConn.access_token}` }
    });
  }

  console.log('Fetch status:', res.status);
  const data = await res.json();
  console.log('Sheet data response:', JSON.stringify(data, null, 2));
}

testFetchSheet();
