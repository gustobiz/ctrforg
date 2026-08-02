const fs = require('fs');
const path = require('path');

console.log('=== INCREMENTAL MIGRATION READY ===');
console.log('File path: supabase/migrations/add_missing_platform_tables.sql');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', 'add_missing_platform_tables.sql'), 'utf8');
console.log(`Migration size: ${sql.length} characters`);
console.log('Please execute this SQL script in the Supabase Dashboard -> SQL Editor.');
