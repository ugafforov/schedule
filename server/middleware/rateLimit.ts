import { createMiddleware } from "hono/factory";

/**
 * In-memory sliding-window rate limiter (per-IP).
 *
 * Hono 4.12 da built-in rate limiter yo'q va redis ham o'rnatilmagan,
 * shuning uchun process-xotira store ishlatamiz. Bir instance (single
 * server) uchun yetarli. Klasterlash kerak bo'lsa — redis'ga ko'chish kerak.
 *
 * Standartlar:
 *  - IP aniqlash: X-Forwarded-For → X-Real-IP → socket remoteAddress
 *  - Javob headerlari: RateLimit-Limit / -Remaining / -Reset (IETF draft)
 *  - Cheklash buzilsa: 429 + Retry-After
 */

interface WindowEntry {
  /** so'rov vaqt-belgilari (ms) — sliding window uchun */
  timestamps: number[];
}
interface RateLimitStore {
  [key: string]: WindowEntry;
}

const store: RateLimitStore = {};

/** Eksport qilinadigan konfiguratsiya — middleware factoryda ishlatiladi. */
interface RateLimitOptions {
  /** oyna hajmi (ms) — default 60_000 (1 daqiqa) */
  windowMs?: number;
  /** oynadagi maksimal so'rov soni — default 100 */
  max?: number;
  /** kalit prefiksi (bir nechta middleware uchun ajratish) */
  keyPrefix?: string;
}

/** Foydalanuvchi IP sini aniqlash (proxy-talab). */
function getClientIp(c: Parameters<Parameters<typeof createMiddleware>[0]>[0]): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = c.req.header("x-real-ip");
  if (real) return real.trim();
  // Hono Node.js adapter orqali socket ga kirish
  // @ts-expect-error — c.env Hono da turli xil, socket har doiz ham yo'q
  const remote = c.env?.incoming?.socket?.remoteAddress;
  return remote || "unknown";
}

/**
 * Sliding window log algoritmi: oyna ichidagi vaqt-belgilarni saqlaydi.
 * Lazily eskirgan kalitlarni tozalaydi (xotira oqishining oldini olish).
 */
function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 100;
  const keyPrefix = options.keyPrefix ?? "global";

  return createMiddleware(async (c, next) => {
    const t = Date.now();
    const ip = getClientIp(c);
    const key = `${keyPrefix}:${ip}`;
    const windowStart = t - windowMs;

    const entry = store[key] ?? { timestamps: [] };
    // Eski belgilarni tashlab qoldiramiz (sliding window)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= max) {
      // Eng eski belgi qachon oynadan chiqishini hisoblaymiz → Retry-After
      const oldest = entry.timestamps[0]!;
      const retryAfterSec = Math.ceil((oldest + windowMs - t) / 1000);
      c.header("RateLimit-Limit", String(max));
      c.header("RateLimit-Remaining", "0");
      c.header("RateLimit-Reset", String(Math.ceil((oldest + windowMs) / 1000)));
      c.header("Retry-After", String(Math.max(1, retryAfterSec)));
      return c.json(
        { message: "Juda ko'p so'rov. Iltimos, birozdan keyin urinib ko'ring." },
        429,
      );
    }

    entry.timestamps.push(t);
    store[key] = entry;

    // Lazily tozalash: 1% ehtimol bilan butun store'dagi eskirgan kalitlarni o'chiramiz.
    // Bu doimiy tozalashdan (har so'rovda O(n)) ko'ra tezroq.
    if (Math.random() < 0.01) {
      for (const k of Object.keys(store)) {
        const e = store[k];
        if (!e) continue;
        e.timestamps = e.timestamps.filter((ts) => ts > t - windowMs);
        if (e.timestamps.length === 0) delete store[k];
      }
    }

    await next();

    // Muvaffaqiyatli so'rovdan keyin headerlarni qo'shamiz
    const remaining = Math.max(0, max - entry.timestamps.length);
    c.header("RateLimit-Limit", String(max));
    c.header("RateLimit-Remaining", String(remaining));
  });
}

// Global API rate limit: 100 so'rov / daqiqa (barcha /api/* uchun)
export const rateLimitMiddleware = createRateLimiter({ max: 100, windowMs: 60_000, keyPrefix: "api" });

// Write-heavy / qimmat operatsiyalar uchun qat'iyroq: 20 so'rov / daqiqa
// (generate-schedule, clear-all, bulk*, auto-distribute)
export const strictRateLimit = createRateLimiter({ max: 20, windowMs: 60_000, keyPrefix: "strict" });
