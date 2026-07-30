import { describe, expect, it } from "vitest";
import {
  getMaxDailyComplexity,
  getMaxHoursPerDay,
  getSanPinDayMultiplier,
  getSubjectCategory,
  getSubjectComplexity,
  isPrimaryTeacherAllowedSubject,
  parseGrade,
  roomMatchesSubject,
  subjectRoomName,
} from "./constants";

describe("parseGrade", () => {
  it("oddiy raqamli qiymatlar", () => {
    expect(parseGrade("5")).toBe(5);
    expect(parseGrade(11)).toBe(11);
  });
  it("harfli qo'shimchalar bilan (masalan '5A', '5-A')", () => {
    expect(parseGrade("5A")).toBe(5);
    expect(parseGrade("10-B")).toBe(10);
  });
  it("noto'g'ri qiymatlarda 0 qaytaradi", () => {
    expect(parseGrade("")).toBe(0);
    expect(parseGrade(null)).toBe(0);
    expect(parseGrade(undefined)).toBe(0);
    expect(parseGrade("A5")).toBe(0);
  });
});

describe("isPrimaryTeacherAllowedSubject", () => {
  it("boshlang'ich o'qituvchiga ruxsat etilgan fanlarni qabul qiladi", () => {
    expect(isPrimaryTeacherAllowedSubject("Ona tili")).toBe(true);
    expect(isPrimaryTeacherAllowedSubject("Matematika")).toBe(true);
    expect(isPrimaryTeacherAllowedSubject("O'qish savodxonligi")).toBe(true);
    expect(isPrimaryTeacherAllowedSubject("Sinf soati")).toBe(true);
  });

  it("maxsus o'qituvchi talab qiladigan fanlarni rad etadi", () => {
    expect(isPrimaryTeacherAllowedSubject("Ingliz tili")).toBe(false);
    expect(isPrimaryTeacherAllowedSubject("Rus tili")).toBe(false);
    expect(isPrimaryTeacherAllowedSubject("Jismoniy tarbiya")).toBe(false);
    expect(isPrimaryTeacherAllowedSubject("Musiqa madaniyati")).toBe(false);
  });

  it("katta-kichik harfga sezgir emas", () => {
    expect(isPrimaryTeacherAllowedSubject("MATEMATIKA")).toBe(true);
  });

  it("133-son buyruq (2026-2027): Informatika 1-4-sinf boshlang'ich o'qituvchisiga ruxsat etiladi", () => {
    expect(isPrimaryTeacherAllowedSubject("Informatika va axborot texnologiyalari")).toBe(true);
  });
});

describe("getSubjectComplexity / getSubjectCategory (SanPiN)", () => {
  it("ma'lum fanlar uchun to'g'ri murakkablik qaytaradi", () => {
    expect(getSubjectComplexity("Matematika")).toBe(11);
    expect(getSubjectComplexity("Fizika")).toBe(9);
    expect(getSubjectComplexity("Musiqa madaniyati")).toBe(1);
  });

  it("noma'lum fan uchun o'rtacha 7 qaytaradi", () => {
    expect(getSubjectComplexity("Nomalum fan")).toBe(7);
  });

  it("kategoriyalarni to'g'ri aniqlaydi", () => {
    expect(getSubjectCategory("Algebra")).toBe("mental");
    expect(getSubjectCategory("Jismoniy tarbiya")).toBe("dynamic");
    expect(getSubjectCategory("Tarix")).toBe("humanitarian");
    expect(getSubjectCategory("Nomalum fan")).toBe("other");
  });
});

describe("getMaxHoursPerDay", () => {
  it("sinf bosqichiga qarab limit qaytaradi", () => {
    expect(getMaxHoursPerDay(1)).toBe(5);
    expect(getMaxHoursPerDay(4)).toBe(5);
    expect(getMaxHoursPerDay(5)).toBe(7);
    expect(getMaxHoursPerDay("11")).toBe(7);
  });
});

describe("getSanPinDayMultiplier / getMaxDailyComplexity", () => {
  it("seshanba-chorshanba eng yuqori, dushanba-juma past", () => {
    expect(getSanPinDayMultiplier(2)).toBe(1.2);
    expect(getSanPinDayMultiplier(3)).toBe(1.2);
    expect(getSanPinDayMultiplier(1)).toBe(0.8);
    expect(getSanPinDayMultiplier(5)).toBe(0.8);
  });

  it("kunlik murakkablik chegarasi sinfga va kunga bog'liq", () => {
    // 1-4 sinf: base 35; seshanba mult 1.2
    expect(getMaxDailyComplexity(2, 2)).toBeCloseTo(35 * 1.2);
    // 10-11 sinf: base 56; dushanba mult 0.8
    expect(getMaxDailyComplexity(10, 1)).toBeCloseTo(56 * 0.8);
  });
});

describe("roomMatchesSubject / subjectRoomName", () => {
  it("Fizika va Astronomiya fanlari Fizika laboratoriyasidan birgalikda foydalanadi", () => {
    expect(roomMatchesSubject("Fizika laboratoriyasi", "Astronomiya")).toBe(true);
    expect(roomMatchesSubject("Fizika laboratoriyasi", "Fizika")).toBe(true);
    expect(subjectRoomName("Astronomiya", "lab")).toBe("Fizika laboratoriyasi");
  });
});
