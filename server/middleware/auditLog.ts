import { createMiddleware } from "hono/factory";
import { db } from "../db";
import { auditLogs } from "@shared/schema";

export const auditLogMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now();
  
  await next();
  
  // Faqat write operatsiyalarini log qilish
  const method = c.req.method;
  if (method === "GET" || method === "OPTIONS") return;
  
  const user = c.get("user") as { id?: string } | undefined;
  const path = c.req.path;
  
  // Muhim endpointlarni aniqlash
  let action = "unknown";
  if (path.includes("/teachers")) action = "teacher_operation";
  else if (path.includes("/classes")) action = "class_operation";
  else if (path.includes("/schedule")) action = "schedule_operation";
  else if (path.includes("/subjects")) action = "subject_operation";
  else if (path.includes("/rooms")) action = "room_operation";
  
  try {
    const details = `Status: ${c.res.status}, Time: ${Date.now() - startTime}ms`;
    
    // Bazaga saqlash
    await db.insert(auditLogs).values({
      userId: user?.id,
      action,
      method,
      path,
      details,
    });
    
    console.log(`[AUDIT] ${new Date().toISOString()} | ${method} ${path} | User: ${user?.id || "anon"} | ${action}`);
  } catch (err) {
    console.error("[AUDIT ERROR]", err);
  }
});
