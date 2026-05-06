import { createMiddleware } from "hono/factory";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

// Rate limiting disabled for development
export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  return next();
});
