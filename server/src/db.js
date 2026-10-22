import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === "production";
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  ...(connectionString
    ? { connectionString }
    : {
        host: process.env.DATABASE_HOST || "127.0.0.1",
        port: Number(process.env.DATABASE_PORT || 5432),
        database: process.env.DATABASE_NAME || "iips_restaurant",
        user: process.env.DATABASE_USER || "postgres",
        password: process.env.DATABASE_PASSWORD || ""
      }),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  application_name: "iips-restaurant"
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export async function initializeDatabase() {
  const schema = await readFile(new URL("../sql/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);

  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  if (!adminEmail || !adminPassword) {
    console.warn("[config] ADMIN_EMAIL / ADMIN_PASSWORD not set; the admin account will not be bootstrapped.");
    return;
  }
  if (adminPassword.length < 12) {
    console.warn("[security] Admin bootstrap skipped: ADMIN_PASSWORD must contain at least 12 characters.");
    return;
  }
  const { rows: existingAdmins } = await pool.query("SELECT id FROM admins WHERE email = $1 LIMIT 1", [adminEmail]);
  if (existingAdmins.length) return;
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await pool.query(
    `INSERT INTO admins (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, passwordHash]
  );
}
