import { describe, it, expect } from "vitest";
import { UZBEK_CURRICULUM, RUSSIAN_CURRICULUM } from "./curriculum";
import { DTS_CURRICULUM_2026, RUSSIAN_DTS_CURRICULUM_2026, type DtsCurriculumEntry } from "./dts-curriculum";

/**
 * shared/curriculum.ts va shared/dts-curriculum.ts — bir xil DTS 2026-2026 o'quv rejasini
 * ikki mustaqil formatda saqlaydi (server/services/teacher.service.ts ikkalasini ham ishlatadi,
 * turli endpointlarda: /api/teachers/auto-generate vs /api/class-subjects/auto-assign-dts).
 * Bu test ikkalasi orasidagi farqni "muzlatib" qo'yadi — Faza 2 (curriculum DB'ga ko'chirilganda)
 * bu farqlar ongli ravishda hal qilinishi kerak, tasodifan paydo bo'lgan yangi farq esa testni
 * qizartirib, e'tiborni tortadi.
 */

interface GradeDiff {
  onlyInCurriculum: string[];
  onlyInDts: string[];
  hourMismatches: string[];
}

const NO_DIFF: GradeDiff = { onlyInCurriculum: [], onlyInDts: [], hourMismatches: [] };

function diffGrade(
  grade: number,
  curriculum: Record<string, Record<string, number>>,
  dts: DtsCurriculumEntry[]
): GradeDiff {
  const curr = curriculum[String(grade)] ?? {};
  const dtsMap = new Map<string, number>();
  for (const e of dts) if (grade in e.hours) dtsMap.set(e.name, e.hours[grade]);

  const onlyInCurriculum = Object.keys(curr)
    .filter((n) => !dtsMap.has(n))
    .sort();
  const onlyInDts = [...dtsMap.keys()].filter((n) => !(n in curr)).sort();
  const hourMismatches = Object.keys(curr)
    .filter((n) => dtsMap.has(n) && curr[n] !== dtsMap.get(n))
    .map((n) => `${n}: curriculum.ts=${curr[n]} dts=${dtsMap.get(n)}`)
    .sort();

  return { onlyInCurriculum, onlyInDts, hourMismatches };
}

describe("UZBEK_CURRICULUM vs DTS_CURRICULUM_2026 — farq hisoboti", () => {
  it("1,2,3,4,5,6,8-sinflarda farq yo'q", () => {
    for (const grade of [1, 2, 3, 4, 5, 6, 8]) {
      expect(diffGrade(grade, UZBEK_CURRICULUM, DTS_CURRICULUM_2026)).toEqual(NO_DIFF);
    }
  });

  it("BILINGAN FARQ — 7-sinf: curriculum.ts'da 'Chizmachilik' bor, DTS'da yo'q (DTS bo'yicha bu fan 8-9-sinfda)", () => {
    expect(diffGrade(7, UZBEK_CURRICULUM, DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: ["Chizmachilik"],
      onlyInDts: [],
      hourMismatches: [],
    });
  });

  it("BILINGAN FARQ — 9-sinf: DTS'da 'Chizmachilik' bor-u curriculum.ts'da yo'q, Informatika soati mos emas (1 vs 2)", () => {
    expect(diffGrade(9, UZBEK_CURRICULUM, DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: [],
      onlyInDts: ["Chizmachilik"],
      hourMismatches: ["Informatika va axborot texnologiyalari: curriculum.ts=1 dts=2"],
    });
  });

  it("BILINGAN FARQ — 10/11-sinf: 'Tadbirkorlik asoslari' curriculum.ts'da 10-sinfda, DTS'da 11-sinfda", () => {
    expect(diffGrade(10, UZBEK_CURRICULUM, DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: ["Tadbirkorlik asoslari"],
      onlyInDts: [],
      hourMismatches: [],
    });
    expect(diffGrade(11, UZBEK_CURRICULUM, DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: [],
      onlyInDts: ["Tadbirkorlik asoslari"],
      hourMismatches: [],
    });
  });
});

describe("RUSSIAN_CURRICULUM vs RUSSIAN_DTS_CURRICULUM_2026 — farq hisoboti", () => {
  it("1-6-sinflarda farq yo'q (Faza 2'da tarix fanlari qo'shilgach)", () => {
    for (const grade of [1, 2, 3, 4, 5, 6, 8]) {
      expect(diffGrade(grade, RUSSIAN_CURRICULUM, RUSSIAN_DTS_CURRICULUM_2026)).toEqual(NO_DIFF);
    }
  });

  it("BILINGAN FARQ — 7-sinf: curriculum.ts'da 'Chizmachilik' bor, DTS'da yo'q (UZ tomondagi bilan bir xil)", () => {
    expect(diffGrade(7, RUSSIAN_CURRICULUM, RUSSIAN_DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: ["Chizmachilik"],
      onlyInDts: [],
      hourMismatches: [],
    });
  });

  it("BILINGAN FARQ — 9-sinf: DTS'da 'Chizmachilik' bor-u curriculum.ts'da yo'q, Informatika soati mos emas", () => {
    expect(diffGrade(9, RUSSIAN_CURRICULUM, RUSSIAN_DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: [],
      onlyInDts: ["Chizmachilik"],
      hourMismatches: ["Informatika va axborot texnologiyalari: curriculum.ts=1 dts=2"],
    });
  });

  it("BILINGAN FARQ — 10/11-sinf: 'Tadbirkorlik asoslari' curriculum.ts'da 10-sinfda, DTS'da 11-sinfda", () => {
    expect(diffGrade(10, RUSSIAN_CURRICULUM, RUSSIAN_DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: ["Tadbirkorlik asoslari"],
      onlyInDts: [],
      hourMismatches: [],
    });
    expect(diffGrade(11, RUSSIAN_CURRICULUM, RUSSIAN_DTS_CURRICULUM_2026)).toEqual({
      onlyInCurriculum: [],
      onlyInDts: ["Tadbirkorlik asoslari"],
      hourMismatches: [],
    });
  });
});
