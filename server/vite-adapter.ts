import type { Hono } from "hono";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { networkInterfaces } from "os";

export function log(message: string, source = "server") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Development: Node.js http.Server + Vite middleware + Hono API
 */
export async function startDevServer(app: Hono, port: number): Promise<void> {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteConfig = (await import("../vite.config")).default;
  const viteLogger = createLogger();

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: { middlewareMode: true, hmr: true },
    appType: "custom",
  });

  const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "/";

    if (url.startsWith("/api")) {
      handleHono(app, req, res, port);
      return;
    }

    vite.middlewares(req, res, async () => {
      try {
        const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`
        );
        const page = await vite.transformIndexHtml(url.split("?")[0], template);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(page);
      } catch (e) {
        console.error("[vite] SPA fallback xatosi:", e);
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });
  });

  // Avtomatik IP aniqlash
  const nets = networkInterfaces();
  let networkIp: string | undefined;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        networkIp = net.address;
        break;
      }
    }
    if (networkIp) break;
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`\n  ➜  Local:   http://localhost:${port}/`);
      if (networkIp) {
        console.log(`  ➜  Network: http://${networkIp}:${port}/`);
      }
      resolve();
    });
  });
}

/**
 * Node.js IncomingMessage → Hono (Web Fetch API) → Node.js ServerResponse
 */
async function handleHono(
  app: Hono,
  req: IncomingMessage,
  res: ServerResponse,
  port: number
): Promise<void> {
  try {
    // Body o'qish
    const body = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", () => resolve(Buffer.alloc(0)));
    });

    // Headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else headers.set(key, value);
    }

    // Web Fetch Request
    const url = `http://localhost:${port}${req.url || "/"}`;
    const fetchReq = new Request(url, {
      method: req.method || "GET",
      headers,
      body: body.length > 0 && req.method !== "GET" && req.method !== "HEAD"
        ? new Uint8Array(body)
        : undefined,
    });

    // Hono ga yuborish
    const fetchRes = await app.fetch(fetchReq);

    // Response qaytarish
    res.statusCode = fetchRes.status;
    fetchRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const resBody = await fetchRes.arrayBuffer();
    res.end(Buffer.from(resBody));
  } catch (e) {
    console.error("[hono] Request xatosi:", e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Internal Server Error" }));
  }
}

/**
 * Production: Hono serve + static files
 */
export function serveStaticFiles(app: Hono) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    log(`Build directory topilmadi: ${distPath}. Dev rejimda bo'lishingiz mumkin.`, "server");
    return;
  }

  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".webmanifest": "application/manifest+json",
  };

  // Static files middleware
  app.use("/*", async (c, next) => {
    const url = new URL(c.req.url);
    if (url.pathname.startsWith("/api")) return next();
    
    const filePath = path.join(distPath, url.pathname);
    
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        return c.body(content, 200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable"
        });
      }
    } catch (e) {
      // Ignore errors and fall through
    }
    
    return next();
  });

  // SPA fallback
  app.get("*", (c) => {
    if (c.req.path.startsWith("/api")) return new Response("Not Found", { status: 404 });
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, "utf-8"));
    }
    return c.text("Not Found", 404);
  });
}
