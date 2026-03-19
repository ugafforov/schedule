import { db } from "./db";
import { accessCodes } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEMO_CODES = [
  { code: "ADMIN2024", ownerName: "Administrator", role: "admin", isActive: true },
  { code: "TEACHER001", ownerName: "O'qituvchi", role: "teacher", isActive: true },
  { code: "SCHOOL123", ownerName: "Maktab Rahbari", role: "admin", isActive: true },
];

export async function seedAccessCodes() {
  try {
    for (const codeData of DEMO_CODES) {
      const existing = await db.select().from(accessCodes).where(eq(accessCodes.code, codeData.code));
      if (existing.length === 0) {
        await db.insert(accessCodes).values(codeData);
        console.log(`[seed] Access code yaratildi: ${codeData.code}`);
      }
    }
    console.log("[seed] Demo kirish kodlari tayyor.");
  } catch (error) {
    console.error("[seed] Kirish kodlarini yaratishda xatolik:", error);
  }
}
