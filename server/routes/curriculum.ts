import { Hono } from "hono";
import { insertCurriculumPlanSchema, insertCurriculumEntrySchema, curriculumEntries } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { getAutoAssignments } from "../services/curriculum.service";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { UZBEK_CURRICULUM, RUSSIAN_CURRICULUM, getSpecialty } from "@shared/curriculum";

export const curriculumRoutes = new Hono()
  .use(authMiddleware)

  // Barcha planlar (admin curriculum boshqaruv sahifasi uchun)
  .get("/plans", async (c) => c.json(await storage.getCurriculumPlans()))

  // Xavfsizlik: yangi plan har doim NOFAOL yaratiladi (isActive so'rovda yuborilgan
  // bo'lsa ham e'tiborga olinmaydi) — faollashtirish faqat /activate orqali, u boshqa
  // planlarni avtomatik faolsizlantiradi. Aks holda bir tilda ikkita faol plan paydo
  // bo'lishi mumkin edi (getActiveCurriculumPlan noaniq natija qaytarardi).
  .post("/plans", requireAdmin, async (c) => {
    const data = insertCurriculumPlanSchema.parse(await c.req.json());
    return c.json(await storage.createCurriculumPlan({ ...data, isActive: false }), 201);
  })

  // Bitta til uchun faol planni faollashtirish (eskisi avtomatik faolsizlanadi)
  .post("/plans/:id/activate", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const result = await storage.activateCurriculumPlan(id);
    if (!result) return c.json({ message: "Plan topilmadi" }, 404);
    return c.json(result);
  })

  // Bitta plan ichidagi barcha fan yozuvlari
  .get("/plans/:id/entries", async (c) => {
    const planId = parseInt(c.req.param("id"));
    return c.json(await storage.getCurriculumEntries(planId));
  })

  // Mavjud plandan nusxa olib yangi versiya yaratish (DTS yangilanganda: nusxalab,
  // farqlarini tahrirlab, keyin faollashtirish uchun)
  .post("/plans/:id/clone", requireAdmin, async (c) => {
    const sourceId = parseInt(c.req.param("id"));
    const { year, orderNumber } = await c.req.json();
    const sourcePlan = (await storage.getCurriculumPlans()).find((p) => p.id === sourceId);
    if (!sourcePlan) return c.json({ message: "Manba plan topilmadi" }, 404);

    const newPlan = await storage.createCurriculumPlan({
      year: year || sourcePlan.year,
      orderNumber: orderNumber || sourcePlan.orderNumber,
      language: sourcePlan.language,
      isActive: false,
    });

    const sourceEntries = await storage.getCurriculumEntries(sourceId);
    for (const e of sourceEntries) {
      await storage.createCurriculumEntry({
        planId: newPlan.id,
        grade: e.grade,
        subjectName: e.subjectName,
        codes: e.codes,
        keywords: e.keywords,
        weeklyHours: e.weeklyHours,
        recommendedSpecialty: e.recommendedSpecialty,
      });
    }

    return c.json(newPlan, 201);
  })

  .post("/entries", requireAdmin, async (c) => {
    const data = insertCurriculumEntrySchema.parse(await c.req.json());
    return c.json(await storage.createCurriculumEntry(data), 201);
  })

  .patch("/entries/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = insertCurriculumEntrySchema.partial().parse(await c.req.json());
    const result = await storage.updateCurriculumEntry(id, data);
    if (!result) return c.json({ message: "Yozuv topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/entries/:id", requireAdmin, async (c) => {
    await storage.deleteCurriculumEntry(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Berilgan sinf/til uchun DTS bo'yicha avtomatik moslashtirish önizleme (assignments.tsx "DTS
  // bo'yicha biriktirish" dialogida ishlatiladi) — mavjud subjectlar ro'yxati bilan moslashtiradi.
  .post("/auto-assignments", async (c) => {
    const body = await c.req.json();
    const { grade, language, subjects } = body;
    if (!grade || !Array.isArray(subjects)) {
      return c.json({ message: "grade va subjects kiritilishi shart" }, 400);
    }
    const result = await getAutoAssignments(grade, subjects, language || "uz");
    return c.json(result);
  })

  // Berilgan sinf uchun o'quv rejasini DTS bo'yicha tiklash
  .post("/plans/:id/entries/reset-grade", requireAdmin, async (c) => {
    const planId = parseInt(c.req.param("id"));
    const { grade } = await c.req.json();
    if (!grade) {
      return c.json({ message: "Sinf (grade) kiritilishi shart" }, 400);
    }

    const plan = (await storage.getCurriculumPlans()).find((p) => p.id === planId);
    if (!plan) return c.json({ message: "Plan topilmadi" }, 404);

    const std = plan.language === "ru" ? RUSSIAN_CURRICULUM : UZBEK_CURRICULUM;
    const standardCurriculum = std[grade.toString()];
    if (!standardCurriculum) {
      return c.json({ message: "Ushbu sinf uchun DTS standarti topilmadi" }, 400);
    }

    // Delete existing entries for this plan and grade
    await db.delete(curriculumEntries)
      .where(
        and(
          eq(curriculumEntries.planId, planId),
          eq(curriculumEntries.grade, grade)
        )
      );

    // Insert DTS standard entries
    for (const [subjectName, hours] of Object.entries(standardCurriculum)) {
      await storage.createCurriculumEntry({
        planId,
        grade: Number(grade),
        subjectName,
        weeklyHours: Number(hours),
        codes: [],
        keywords: [subjectName.toLowerCase()],
        recommendedSpecialty: getSpecialty(subjectName, grade.toString(), plan.language),
      });
    }

    return c.json({ message: "Sinf o'quv rejasi DTS bo'yicha muvaffaqiyatli tiklandi" });
  });
