// scripts/run-migration.js
// Runs every SQL file in supabase/migrations in filename order.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const dir = path.join(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  try {
    const client = await pool.connect();
    console.log('🔌 Connected to database');

    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`📝 Applying ${file}...`);
      await client.query(sql);
      console.log(`✅ ${file}`);
    }

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('📊 Tables:', tables.rows.map((r) => r.table_name).join(', '));

    client.release();
    console.log('✅ Migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
