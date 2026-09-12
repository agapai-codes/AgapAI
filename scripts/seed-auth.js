// scripts/seed-auth.js
// Creates/updates the demo dispatcher account.
// FOR DEMO USE ONLY — do not run against a production/real-user database.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  // Safety guard: refuse unless explicitly acknowledged.
  if (!process.env.ALLOW_DEMO_SEED) {
    console.error('❌ Refusing to seed demo credentials.');
    console.error('   This script creates a known demo dispatcher account.');
    console.error('   Re-run with ALLOW_DEMO_SEED=1 if this is a demo/test database.');
    process.exit(1);
  }

  // ssl.rejectUnauthorized:false is acceptable for Neon's pooled endpoint with
  // channel_binding; do not copy this pattern for arbitrary databases.
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  const email = 'dispatcher@agapai.ph';
  const password = 'agapai123';
  const hash = await bcrypt.hash(password, 10);

  try {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'dispatcher'::user_role)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'dispatcher'::user_role`,
      [email, hash, 'Demo Dispatcher']
    );
    console.log('✅ Dispatcher seeded');
    console.log(`   email:    ${email}`);
    console.log('   password: (see repository docs)');
    client.release();
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
