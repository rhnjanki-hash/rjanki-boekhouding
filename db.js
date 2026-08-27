const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('beheerder','gebruiker','viewer')),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('bon','rekening','lening')),
      data JSONB NOT NULL,
      created_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS records_type_idx ON records(type);
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  // seed first admin
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0].n === 0) {
    const u = process.env.ADMIN_USER || "admin";
    const p = process.env.ADMIN_PASSWORD || "admin123";
    await pool.query("INSERT INTO users (username,password_hash,role) VALUES ($1,$2,'beheerder')", [u, await bcrypt.hash(p, 10)]);
    console.log(`Eerste beheerder aangemaakt: ${u}`);
  }
}

module.exports = { pool, init };
