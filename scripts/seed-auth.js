// scripts/seed-auth.js
// Creates/updates the demo dispatcher account.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

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
    console.log(`   password: ${password}`);
    client.release();
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
