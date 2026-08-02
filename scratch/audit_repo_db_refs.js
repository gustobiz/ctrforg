const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(url, serviceRoleKey);

// Recursive file scanner
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.sql')) {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

const srcDir = path.join(__dirname, '..', 'src');
const sqlDir = path.join(__dirname, '..', 'supabase');

const allSrcFiles = [...getAllFiles(srcDir), ...getAllFiles(sqlDir)];

const tableRegex = /\.from\(['"`]([a-zA-Z0-9_]+)['"`]\)/g;
const referencedTables = new Set();
const tableUsages = {};

allSrcFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const table = match[1];
    referencedTables.add(table);
    if (!tableUsages[table]) tableUsages[table] = [];
    tableUsages[table].push(path.relative(path.join(__dirname, '..'), file));
  }
});

async function runAudit() {
  console.log('=== FULL REPOSITORY DATABASE DEPENDENCY AUDIT ===\n');
  console.log('Unique Tables Referenced in Codebase:', Array.from(referencedTables));
  console.log('');

  const auditReport = {
    referencedTables: Array.from(referencedTables),
    tableStatus: {},
    usages: tableUsages
  };

  for (const t of referencedTables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (error) {
        auditReport.tableStatus[t] = {
          exists: false,
          errorCode: error.code,
          errorMessage: error.message
        };
      } else {
        const row = data && data[0] ? data[0] : null;
        auditReport.tableStatus[t] = {
          exists: true,
          columns: row ? Object.keys(row) : 'Table exists but empty'
        };
      }
    } catch (e) {
      auditReport.tableStatus[t] = { exists: false, errorMessage: e.message };
    }
  }

  console.log(JSON.stringify(auditReport, null, 2));
}

runAudit().catch(console.error);
