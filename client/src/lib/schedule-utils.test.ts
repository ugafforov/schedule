import { describe, expect, it } from "vitest";
import type { ScheduleEntry, TimeSlot } from "@shared/schema";
import {
  formatTime12Hour,
  generateTimeSlotKey,
  getWeekStartDate,
  validateScheduleEntry,
} from "./schedule-utils";

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: 1,
    classId: 1,
    subjectId: 1,
    teacherId: 1,
    roomId: 1,
    timeSlotId: 1,
    weekType: "always",
    ...overrides,
  } as ScheduleEntry;
}

const timeSlots = [
  { id: 1, dayOfWeek: 1, startTime: "08:00", endTime: "08:45", isBreak: false },
] as unknown as TimeSlot[];

describe("validateScheduleEntry", () => {
  it("bo'sh jadvalda ziddiyat yo'q", () => {
    const result = validateScheduleEntry(makeEntry(), [], timeSlots, [], [], []);
    expect(result.isValid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("bir xil slotdagi o'qituvchi/xona/sinf ziddiyatlarini topadi", () => {
    const existing = makeEntry({ id: 2 }); // hammasi bir xil, boshqa id
    const result = validateScheduleEntry(makeEntry(), [existing], timeSlots, [], [], []);
    expect(result.isValid).toBe(false);
    const types = result.conflicts.map(c => c.type).sort();
    expect(types).toEqual(["class", "room", "teacher"]);
  });

  it("har xil hafta turi (odd/even) ziddiyat emas", () => {
    const existing = makeEntry({ id: 2, weekType: "odd" });
    const entry = makeEntry({ weekType: "even" });
    const result = validateScheduleEntry(entry, [existing], timeSlots, [], [], []);
    expect(result.isValid).toBe(true);
  });

  it("'always' hafta turi odd/even bilan ziddiyatlanadi", () => {
    const existing = makeEntry({ id: 2, weekType: "odd" });
    const entry = makeEntry({ weekType: "always" });
    const result = validateScheduleEntry(entry, [existing], timeSlots, [], [], []);
    expect(result.isValid).toBe(false);
  });

  it("majburiy maydonlar bo'lmasa invalid", () => {
    const result = validateScheduleEntry({ classId: 1 }, [], timeSlots, [], [], []);
    expect(result.isValid).toBe(false);
  });
});

describe("generateTimeSlotKey", () => {
  it("kun nomi va vaqtdan kalit yasaydi", () => {
    expect(generateTimeSlotKey(1, "08:00")).toBe("monday-0800");
    expect(generateTimeSlotKey(5, "13:30")).toBe("friday-1330");
  });
});

describe("formatTime12Hour", () => {
  it("24 soatlik formatni 12 soatlikka o'giradi", () => {
    expect(formatTime12Hour("08:00")).toBe("8:00 AM");
    expect(formatTime12Hour("13:30")).toBe("1:30 PM");
    expect(formatTime12Hour("00:15")).toBe("12:15 AM");
    expect(formatTime12Hour("12:00")).toBe("12:00 PM");
  });
});

describe("getWeekStartDate", () => {
  it("istalgan kundan haftaning dushanbasini qaytaradi", () => {
    // 2026-07-01 — chorshanba; hafta boshi 2026-06-29 (dushanba)
    const monday = getWeekStartDate(new Date(2026, 6, 1));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(29);
  });

  it("yakshanba oldingi haftaning dushanbasiga tushadi", () => {
    // 2026-07-05 — yakshanba; hafta boshi 2026-06-29
    const monday = getWeekStartDate(new Date(2026, 6, 5));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(29);
  });
});
