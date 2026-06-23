import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// SSL sozlamalari — environment orqali boshqarish.
// Supabase pooler uchun "rejectUnauthorized: false" kerak (CA cert muammosi).
// Productionda (o'z serveringizda) "true" ishlatilsin — MITM ximoyasi.
const dbSsl = process.env.DB_SSL === "disable"
  ? false
  : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };

// Pool sozlamalari - retry va timeout bilan
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: dbSsl,
});

// Connection error handling
pool.on("error", (err) => {
  console.error("[DB] Unexpected database error:", err.message);
});

// Retry function for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[DB] Attempt ${i + 1} failed, retrying...`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

export const db = drizzle({ client: pool, schema });