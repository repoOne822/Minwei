// db/migrate.js — Run once to create schema and seed data
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  
  // Split on semicolons but keep statements intact
  const statements = schema
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Running ${statements.length} migration statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    try {
      await sql(stmt);
      console.log(`  ✓ Statement ${i+1}/${statements.length}`);
    } catch (err) {
      console.error(`  ✗ Statement ${i+1} failed:`, err.message);
      console.error('  Statement:', stmt.substring(0, 80) + '...');
    }
  }
  
  console.log('\n✓ Migration complete');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
