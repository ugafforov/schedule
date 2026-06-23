import { execSync } from "child_process";

// Free backend port (5001) if it is in use by other processes
if (process.env.NODE_ENV === "development") {
  const portToFree = Number(process.env.PORT) || 5001;
  try {
    const pids = execSync(`lsof -t -sTCP:LISTEN -i:${portToFree}`).toString().trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      const pidNum = Number(pid);
      if (pidNum && pidNum !== process.pid) {
        console.log(`[Port Cleanup] Port ${portToFree} is in use by process ${pidNum}. Killing it...`);
        execSync(`kill -9 ${pidNum}`);
      }
    }
  } catch (e) {
    // ignore lsof errors
  }
}

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { registerRoutes } from "./routes/index";
import { seedAccessCodes } from "./seed";
import { log, startDevServer, serveStaticFiles } from "./vite-adapter";
import { bodyLimit } from "hono/body-limit";

const app = new Hono();

// CORS — ruxsat etilgan originlar ro'yxati (ALLOWED_ORIGINS env orqali).
// Bo'sh bo'lsa: devda Vite(5173)+server(5001), productionda hech narsa (rad etish).
// Eslatma: origin "*" + credentials:true CORS spetsifikatsiyasini buzadi, shuning uchun
// aniq originlar ro'yxati yoki `false` (Allow-Origin yuborilmasligi) ishlatiladi.
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean))
  || (process.env.NODE_ENV === "production"
      ? [] as string[]
      : ["http://localhost:5173", "http://localhost:5001"]);

app.use("/api/*", cors({
  // Origin allowlist: ruxsat berilgan originlar uchun shu originni qaytaradi,
  // aks holda null (CORS header yuborilmaydi — brauzer so'rovni bloklaydi).
  origin: (origin) => (allowedOrigins.length > 0 && allowedOrigins.includes(origin) ? origin : null),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Body size limit - 10MB max
app.use("/api/*", bodyLimit({ maxSize: 10 * 1024 * 1024 }));

// Request logger
app.use("/api/*", logger((str) => {
  if (str.length > 80) str = str.slice(0, 79) + "…";
  log(str, "hono");
}));

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Custom error interface
interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

// Global error handler
app.onError((err, c) => {
  const httpError = err as HttpError;
  const status = httpError.status || httpError.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";
  
  // Log full error to console (server only)
  console.error(`[error] ${err.message}`, err.stack);
  
  // Clientga faqat xavfsiz ma'lumot
  const message = status === 500 && !isDev 
    ? "Server xatosi. Keyinroq urinib ko'ring." 
    : (err.message || "Internal Server Error");
    
  return c.json({ message }, status as 200 | 400 | 401 | 403 | 404 | 500);
});

// Barcha API routelarni ro'yxatdan o'tkazish
registerRoutes(app);

(async () => {
  await seedAccessCodes();

  const port = Number(process.env.PORT) || 5001;
  const isDev = process.env.NODE_ENV === "development";
  let server: any;

  if (isDev) {
    server = await startDevServer(app, port);
  } else {
    serveStaticFiles(app);
    server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
      log(`serving on port ${port}`);
    });
  }

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server?.close?.(() => {
      console.log("Server closed");
      process.exit(0);
    });
    // Force exit after 5 seconds
    setTimeout(() => {
      console.error("Force exit after timeout");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
