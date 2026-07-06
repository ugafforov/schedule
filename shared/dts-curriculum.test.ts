import { describe, it, expect } from "vitest";
import {
  DTS_CURRICULUM_2025, RUSSIAN_DTS_CURRICULUM_2025,
  DTS_CURRICULUM_2026, RUSSIAN_DTS_CURRICULUM_2026,
  type DtsCurriculumEntry,
} from "./dts-curriculum";

// Fayl boshidagi izohda e'lon qilingan rasmiy jami haftalik soatlar (121-son buyruq, 10.04.2025)
const EXPECTED_TOTALS: Record<number, number> = {
  1: 21, 2: 24, 3: 24, 4: 24, 5: 29, 6: 30, 7: 35, 8: 33, 9: 34, 10: 31, 11: 31,
};

function totalHoursForGrade(entries: DtsCurriculumEntry[], grade: number): number {
  return entries.reduce((sum, e) => sum + (e.hours[grade] ?? 0), 0);
}

describe("DTS_CURRICULUM_2025 (o'zbek) — ichki konsistentlik", () => {
  for (const [grade, expected] of Object.entries(EXPECTED_TOTALS)) {
    it(`${grade}-sinf jami haftalik soat = ${expected}`, () => {
      expect(totalHoursForGrade(DTS_CURRICULUM_2025, Number(grade))).toBe(expected);
    });
  }
});

describe("RUSSIAN_DTS_CURRICULUM_2025 (rus) — ichki konsistentlik", () => {
  // Faza 2'da tuzatildi: avval "O'zbekiston tarixi", "Jahon tarixi", "Davlat va huquq
  // asoslari", "Tarixdan hikoyalar", "Qadimgi dunyo tarixi" fanlari bu massivda umuman
  // yo'q edi (yozishda unutilgan) — endi qo'shildi, jami soatlar rasmiy jadvalga mos.
  for (const [grade, expected] of Object.entries(EXPECTED_TOTALS)) {
    it(`${grade}-sinf jami haftalik soat = ${expected}`, () => {
      expect(totalHoursForGrade(RUSSIAN_DTS_CURRICULUM_2025, Number(grade))).toBe(expected);
    });
  }

  it("7-11 sinflarda 'O'zbekiston tarixi' fani mavjud", () => {
    for (const grade of [7, 8, 9, 10, 11]) {
      const hasHistory = RUSSIAN_DTS_CURRICULUM_2025.some(
        (e) => e.name === "O'zbekiston tarixi" && grade in e.hours
      );
      expect(hasHistory).toBe(true);
    }
  });
});

describe("DTS_CURRICULUM_2026 (o'zbek, 133-son buyruq 10.04.2026) — ichki konsistentlik", () => {
  for (const [grade, expected] of Object.entries(EXPECTED_TOTALS)) {
    it(`${grade}-sinf jami haftalik soat = ${expected}`, () => {
      expect(totalHoursForGrade(DTS_CURRICULUM_2026, Number(grade))).toBe(expected);
    });
  }

  it("4-sinfda Informatika joriy etilgan (1 soat) va Tabiiy fanlar 1 soatga kamaygan", () => {
    const informatika = DTS_CURRICULUM_2026.find((e) => e.name === "Informatika va axborot texnologiyalari")!;
    const tabiiyFan = DTS_CURRICULUM_2026.find((e) => e.name === "Tabiiy fanlar (Science)")!;
    expect(informatika.hours[4]).toBe(1);
    expect(tabiiyFan.hours[4]).toBe(1);
  });
});

describe("RUSSIAN_DTS_CURRICULUM_2026 (rus, 133-son buyruq 10.04.2026) — ichki konsistentlik", () => {
  for (const [grade, expected] of Object.entries(EXPECTED_TOTALS)) {
    it(`${grade}-sinf jami haftalik soat = ${expected}`, () => {
      expect(totalHoursForGrade(RUSSIAN_DTS_CURRICULUM_2026, Number(grade))).toBe(expected);
    });
  }

  it("4-sinfda Informatika joriy etilgan (1 soat) va Tabiiy fanlar 1 soatga kamaygan", () => {
    const informatika = RUSSIAN_DTS_CURRICULUM_2026.find((e) => e.name === "Informatika va axborot texnologiyalari")!;
    const tabiiyFan = RUSSIAN_DTS_CURRICULUM_2026.find((e) => e.name === "Tabiiy fanlar (Science)")!;
    expect(informatika.hours[4]).toBe(1);
    expect(tabiiyFan.hours[4]).toBe(1);
  });
});
