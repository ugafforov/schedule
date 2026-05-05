import { Hono } from "hono";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";

export const dashboardRoutes = new Hono()
  .use(authMiddleware)

  .get("/stats", async (c) => {
    const stats = await storage.getDashboardStats();
    return c.json(stats);
  });
