import { Hono } from "hono";
import { authRoutes } from "./auth";
import { subjectRoutes } from "./subjects";
import { teacherRoutes, teacherLoadRoute, teacherRecommendationRoute } from "./teachers";
import { classRoutes } from "./classes";
import { roomRoutes } from "./rooms";
import { timeslotRoutes } from "./timeslots";
import {
  scheduleRoutes,
  generateScheduleRoute,
  scheduleConflictsRoute,
  classSubjectsRoute,
} from "./schedule";
import { dashboardRoutes } from "./dashboard";
import { jointLessonRoutes } from "./joint-lessons";
import { curriculumRoutes } from "./curriculum";
import { rateLimitMiddleware, strictRateLimit } from "../middleware/rateLimit";
import { auditLogMiddleware } from "../middleware/auditLog";

export function registerRoutes(app: Hono) {
  // Rate limiting va audit logging - barcha API larga
  app.use("/api/*", rateLimitMiddleware);
  app.use("/api/*", auditLogMiddleware);
  // ─── Auth (public) ─────────────────────────────────────────────────────────
  app.route("/api/auth", authRoutes);

  // ─── Resources ─────────────────────────────────────────────────────────────
  app.route("/api/subjects", subjectRoutes);
  app.route("/api/teachers", teacherRoutes);
  app.route("/api/classes", classRoutes);
  app.route("/api/rooms", roomRoutes);
  app.route("/api/time-slots", timeslotRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/joint-lessons", jointLessonRoutes);
  app.route("/api/curriculum", curriculumRoutes);

  // ─── Schedule ──────────────────────────────────────────────────────────────
  // Har bir frontend URL → to'g'ri backend route
  // /api/schedule-entries → GET/POST/PATCH/DELETE /
  app.route("/api/schedule-entries", scheduleRoutes);
  // /api/generate-schedule → POST /  (eng qimmat operatsiya — qat'iy limit)
  app.route("/api/generate-schedule", generateScheduleRoute);
  // /api/schedule-conflicts → GET /
  app.route("/api/schedule-conflicts", scheduleConflictsRoute);
  // /api/class-subjects → POST /auto-distribute-all, /bulk-assign
  app.route("/api/class-subjects", classSubjectsRoute);

  // ─── Teacher analytics ─────────────────────────────────────────────────────
  // Alohida routerlar — to'g'ri URL mapping
  // /api/teacher-load → GET /
  app.route("/api/teacher-load", teacherLoadRoute);
  // /api/teacher-recommendation → GET /
  app.route("/api/teacher-recommendation", teacherRecommendationRoute);
}
