import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { registerRoutes } from "./routes/index";
import { seedAccessCodes } from "./seed";
import { log, startDevServer, serveStaticFiles } from "./vite-adapter";

const app = new Hono();

// Request logger
app.use("/api/*", logger((str) => {
  if (str.length > 80) str = str.slice(0, 79) + "…";
  log(str, "hono");
}));

// Global error handler
app.onError((err, c) => {
  const status = (err as any).status || (err as any).statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(`[error] ${message}`);
  return c.json({ message }, status);
});

// Barcha API routelarni ro'yxatdan o'tkazish
registerRoutes(app);

(async () => {
  await seedAccessCodes();

  const port = 5000;
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Development: Node.js http.Server + Vite middleware + Hono API
    await startDevServer(app, port);
  } else {
    // Production: Hono serve + static files
    serveStaticFiles(app);
    serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
      log(`serving on port ${port}`);
    });
  }
})();
