import { describe, it, expect } from "vitest";
import { computeRoomRecommendations, type RoomRecommendationInput } from "./room-recommendation";

// Real maktab holatiga yaqin fixture: 11 sinf (25 o'quvchi), 6 kun x 7 dars = 42 slot.
// 7-11 sinflarda Fizika (2s), Kimyo (2s), Biologiya (2s) — uchalasi ham "lab" turida,
// ammo har biri ALOHIDA jihozlangan laboratoriya talab qiladi.
function baseInput(overrides: Partial<RoomRecommendationInput> = {}): RoomRecommendationInput {
  const classes = Array.from({ length: 11 }, (_, i) => ({
    id: i + 1,
    name: `${i + 1}-A`,
    grade: String(i + 1),
    totalStudents: 25,
    isActive: true,
  }));
  const upper = classes.slice(6); // 7-11 sinflar
  return {
    classes,
    subjects: [
      { id: 1, name: "Matematika", requiredRoomType: "classroom" },
      { id: 2, name: "Fizika", requiredRoomType: "lab" },
      { id: 3, name: "Kimyo", requiredRoomType: "lab" },
      { id: 4, name: "Biologiya", requiredRoomType: "lab" },
    ],
    classSubjects: [
      ...classes.map(c => ({ classId: c.id, subjectId: 1, teacherId: 100 + c.id, weeklyHours: 5 })),
      ...upper.map(c => ({ classId: c.id, subjectId: 2, teacherId: 201, weeklyHours: 2 })),
      ...upper.map(c => ({ classId: c.id, subjectId: 3, teacherId: 202, weeklyHours: 2 })),
      ...upper.map(c => ({ classId: c.id, subjectId: 4, teacherId: 203, weeklyHours: 2 })),
    ],
    rooms: [
      ...Array.from({ length: 13 }, (_, i) => ({
        id: i + 1, name: `Xona ${101 + i}`, roomNumber: String(101 + i),
        capacity: 30, roomType: "classroom", isActive: true,
      })),
      { id: 46, name: "Laboratoriya 401", roomNumber: "401", capacity: 24, roomType: "lab", isActive: true },
    ],
    activeSlotsPerWeek: 42,
    shifts: 1,
    reservePercent: 15,
    ...overrides,
  };
}

const byType = (r: ReturnType<typeof computeRoomRecommendations>, t: string) =>
  r.recommendations.find(x => x.roomType === t)!;

describe("computeRoomRecommendations — fanga xos maxsus xonalar", () => {
  it("har bir lab fani uchun alohida xona hisoblaydi (Fizika, Kimyo, Biologiya)", () => {
    const lab = byType(computeRoomRecommendations(baseInput()), "lab");
    const names = lab.subjects.map(s => s.subjectName).sort();
    expect(names).toEqual(["Biologiya", "Fizika", "Kimyo"]);
    for (const s of lab.subjects) {
      expect(s.needed).toBe(1); // har biriga 1 tadan
    }
    expect(lab.needed).toBe(3); // jami 3 ta laboratoriya
  });

  it("tavsiya etilgan xonalar fan nomi bilan ataladi", () => {
    const result = computeRoomRecommendations(baseInput());
    const labRooms = result.allSuggestedRooms.filter(r => r.roomType === "lab");
    const names = labRooms.map(r => r.name).sort();
    // Mavjud umumiy "Laboratoriya 401" eng katta talabli fanga biriktiriladi,
    // qolgan ikki fanga yangi xona yaratiladi
    expect(names).toHaveLength(2);
    for (const r of labRooms) {
      expect(r.name).toMatch(/laboratoriyasi$/);
      expect(r.subjectName).toBeTruthy();
      expect(r.capacity).toBeGreaterThanOrEqual(25);
    }
  });

  it("fanga atalmagan umumiy laboratoriyani fanga biriktirishni taklif qiladi (yangi qurishdan tejamli)", () => {
    const result = computeRoomRecommendations(baseInput());
    expect(result.roomRenames).toHaveLength(1);
    expect(result.roomRenames[0]).toMatchObject({
      roomId: 46,
      currentName: "Laboratoriya 401",
      currentCapacity: 24,
    });
    expect(result.roomRenames[0].suggestedName).toMatch(/laboratoriyasi$/);
    // Sig'imi ham 25 o'quvchiga yetadigan qilib oshiriladi
    expect(result.roomRenames[0].suggestedCapacity).toBeGreaterThanOrEqual(25);
  });

  it("nomi fanga mos xonani o'sha fanning xonasi deb taniydi", () => {
    const input = baseInput();
    input.rooms.push(
      { id: 47, name: "Fizika laboratoriyasi", roomNumber: "402", capacity: 30, roomType: "lab", isActive: true },
      { id: 48, name: "Kimyo laboratoriyasi", roomNumber: "403", capacity: 30, roomType: "lab", isActive: true },
    );
    const lab = byType(computeRoomRecommendations(input), "lab");
    const fizika = lab.subjects.find(s => s.subjectName === "Fizika")!;
    const kimyo = lab.subjects.find(s => s.subjectName === "Kimyo")!;
    const bio = lab.subjects.find(s => s.subjectName === "Biologiya")!;

    expect(fizika.ownRooms.map(r => r.name)).toEqual(["Fizika laboratoriyasi"]);
    expect(fizika.shortage).toBe(0);
    expect(kimyo.ownRooms.map(r => r.name)).toEqual(["Kimyo laboratoriyasi"]);
    expect(kimyo.shortage).toBe(0);
    // Biologiyaga xona yo'q — umumiy "Laboratoriya 401" unga biriktiriladi
    expect(bio.shortage).toBe(0);
    expect(computeRoomRecommendations(input).roomRenames[0].subjectName).toBe("Biologiya");
  });

  it("sig'imi yetmagan fan xonasini kengaytirishni tavsiya qiladi", () => {
    const input = baseInput();
    input.rooms.push({
      id: 47, name: "Fizika laboratoriyasi", roomNumber: "402", capacity: 20, roomType: "lab", isActive: true,
    });
    const result = computeRoomRecommendations(input);
    const upgrade = result.capacityUpgrades.find(u => u.roomId === 47)!;
    expect(upgrade).toBeDefined();
    expect(upgrade.currentCapacity).toBe(20);
    expect(upgrade.suggestedCapacity).toBeGreaterThanOrEqual(25);

    const fizika = byType(result, "lab").subjects.find(s => s.subjectName === "Fizika")!;
    expect(fizika.ownRooms[0].usable).toBe(false); // sig'imi yetmaydi — solver ishlatmaydi
  });

  it("bitta fanda yuklama katta bo'lsa, o'sha fanga bir nechta xona tavsiya qiladi", () => {
    const input = baseInput();
    // Fizika: 5 sinf x 10 soat = 50 soat, har sinfda alohida o'qituvchi
    input.classSubjects = [
      ...input.classSubjects.filter(cs => cs.subjectId !== 2),
      ...input.classes.slice(6).map((c, i) => ({
        classId: c.id, subjectId: 2, teacherId: 300 + i, weeklyHours: 10,
      })),
    ];
    const fizika = byType(computeRoomRecommendations(input), "lab").subjects.find(s => s.subjectName === "Fizika")!;
    expect(fizika.needed).toBe(2); // 50 soat / 42 slot * 1.15 → 2
  });

  it("bir vaqtda ishlatib bo'lmaydigan xonani tavsiya qilmaydi (o'qituvchi cheklovi)", () => {
    const lab = byType(computeRoomRecommendations(baseInput()), "lab");
    const fizika = lab.subjects.find(s => s.subjectName === "Fizika")!;
    expect(fizika.teacherCount).toBe(1);
    expect(fizika.needed).toBe(1); // bitta o'qituvchi — ikkinchi lab behuda
  });

  it("bir nechta fan bir xil turdagi xonani (masalan Sport zali) ishlatganda, nomi mos xona qayta rename bo'lib qolmaydi", () => {
    const input = baseInput();
    input.subjects.push(
      { id: 10, name: "Jismoniy tarbiya", requiredRoomType: "gym" },
      { id: 11, name: "Chaqiruvga qadar boshlang'ich tayyorgarlik", requiredRoomType: "gym" },
    );
    input.classSubjects.push(
      { classId: 1, subjectId: 10, teacherId: 600, weeklyHours: 2 },
      { classId: 1, subjectId: 11, teacherId: 601, weeklyHours: 1 },
    );
    input.rooms.push(
      { id: 91, name: "Sport zali", roomNumber: "301", capacity: 50, roomType: "gym", isActive: true },
      { id: 92, name: "Sport zali", roomNumber: "302", capacity: 50, roomType: "gym", isActive: true },
    );
    const result = computeRoomRecommendations(input);
    // Nomi allaqachon "Sport zali" bo'lgan xonalarga "Sport zali -> Sport zali" kabi befoyda rename taklif qilinmasligi kerak
    const gymRenames = result.roomRenames.filter(r => r.roomType === "gym");
    expect(gymRenames).toHaveLength(0);
  });

  it("Astronomiya fani alohida laboratoriya xonasi talab qilmaydi (oddiy sinf / Fizika xonasi)", () => {
    const input = baseInput();
    input.subjects.push({ id: 50, name: "Astronomiya", requiredRoomType: "lab" });
    input.classSubjects.push({ classId: 11, subjectId: 50, teacherId: 400, weeklyHours: 1 });
    const result = computeRoomRecommendations(input);
    const labRec = byType(result, "lab");
    const astroLab = labRec.subjects.find(s => s.subjectName === "Astronomiya");
    expect(astroLab).toBeUndefined(); // lab fanlari ro'yxatida Astronomiya alohida xona da'vo qilmaydi
  });
});

describe("computeRoomRecommendations — oddiy xonalar", () => {
  it("sinf xonalari kamida sinflar soniga teng (bir vaqtda har sinfga bitta xona)", () => {
    const classroom = byType(computeRoomRecommendations(baseInput({ reservePercent: 0 })), "classroom");
    expect(classroom.needed).toBeGreaterThanOrEqual(11);
  });

  it("zaxira foizi sinf xonalari tavsiyasini oshiradi", () => {
    const zero = byType(computeRoomRecommendations(baseInput({ reservePercent: 0 })), "classroom");
    const twenty = byType(computeRoomRecommendations(baseInput({ reservePercent: 20 })), "classroom");
    expect(twenty.needed).toBeGreaterThan(zero.needed);
  });

  it("talab ham, xona ham yo'q turni umuman ko'rsatmaydi", () => {
    const result = computeRoomRecommendations(baseInput());
    expect(result.recommendations.find(r => r.roomType === "music")).toBeUndefined();
  });

  it("guruhga bo'lingan dars (2 o'qituvchi) uchun sig'im yarmi yetadi", () => {
    const input = baseInput();
    input.subjects.push({ id: 5, name: "Informatika", requiredRoomType: "computer" });
    input.classSubjects.push({
      classId: 1, subjectId: 5, teacherId: 500, teacherId2: 501, weeklyHours: 2,
    });
    const computer = byType(computeRoomRecommendations(input), "computer");
    expect(computer.subjects[0].requiredCapacity).toBe(13); // ceil(25 / 2)
    expect(computer.suggestedRooms[0].name).toBe("Informatika xonasi");
  });

  it("tavsiya etilgan xona raqamlari mavjudlari bilan to'qnashmaydi", () => {
    const result = computeRoomRecommendations(baseInput());
    const existing = new Set(baseInput().rooms.map(r => r.roomNumber));
    const suggested = result.allSuggestedRooms.map(r => r.roomNumber);
    for (const num of suggested) expect(existing.has(num)).toBe(false);
    expect(new Set(suggested).size).toBe(suggested.length); // o'zaro ham takrorlanmaydi
  });
});
