import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { registerRoutes } from "./routes/index";
import { seedAccessCodes } from "./seed";
import { log, startDevServer, serveStaticFiles } from "./vite-adapter";
import { bodyLimit } from "hono/body-limit";

const app = new Hono();

// CORS - barcha domenlarga ruxsat (production da cheklash kerak)
app.use("/api/*", cors({
  origin: process.env.NODE_ENV === "production" 
    ? (process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5000"])
    : "*",
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

  const port = 5000;
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
