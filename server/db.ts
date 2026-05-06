import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool sozlamalari - retry va timeout bilan
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // maximum connections
  idleTimeoutMillis: 30000, // 30s idle timeout
  connectionTimeoutMillis: 5000, // 5s connection timeout
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