// Xonalar ehtiyoji tavsiyasi.
//
// Maqsad: mavjud ma'lumot (sinflar va o'quvchilar soni, fanlar va ular talab qiladigan
// xona turi, haftalik soatlar, biriktirilgan o'qituvchilar, dars slotlari, mavjud xonalar)
// asosida NECHTA xona va QANDAY SIG'IM bilan kerakligini zaxira (reserve) bilan aniqlaydi.
//
// Ikki muhim qoida:
//  1) Solver xonani faqat `capacity >= sinf o'quvchilari soni` bo'lganda tanlaydi
//     (schedule.service.ts). Shuning uchun sig'imi yetmagan xona "mavjud" deb sanaladi,
//     lekin "yaroqli" (usable) deb sanalmaydi — aks holda tavsiya "yetarli" deb ko'rsatib,
//     jadvalda dars joylashmay qoladi (real holat: lab sig'imi 24, sinfda 25 o'quvchi).
//  2) Maxsus jihozlangan xonalar FANGA atalgan bo'ladi: Fizika va Kimyo ikkalasi ham
//     roomType="lab", ammo ular alohida laboratoriyalar. Shuning uchun lab/kompyuter/
//     musiqa/rasm turlari fan bo'yicha alohida-alohida hisoblanadi va xonalar fan nomi
//     bilan ("Fizika laboratoriyasi") tavsiya qilinadi — solver ham shu nom bo'yicha
//     fanni o'z xonasiga joylaydi (roomMatchesSubject, shared/constants.ts).

import { ROOM_TYPE_LABELS, roomMatchesSubject, subjectRoomName } from "@shared/constants";

export interface RoomRecoClass {
  id: number;
  name: string;
  grade: string;
  totalStudents: number | null;
  isActive?: boolean | null;
}

export interface RoomRecoClassSubject {
  classId: number;
  subjectId: number;
  teacherId: number | null;
  teacherId2?: number | null;
  roomId?: number | null;
  weeklyHours: number;
}

export interface RoomRecoSubject {
  id: number;
  name: string;
  requiredRoomType: string | null;
}

export interface RoomRecoRoom {
  id: number;
  name: string;
  roomNumber: string;
  capacity: number;
  roomType: string;
  isActive?: boolean | null;
}

export interface SuggestedRoom {
  name: string;
  roomNumber: string;
  roomType: string;
  capacity: number;
  building: string;
  floor: string;
  /** Qaysi fan uchun (maxsus xonalarda) */
  subjectId?: number;
  subjectName?: string;
}

export interface CapacityUpgrade {
  roomId: number;
  roomName: string;
  roomType: string;
  currentCapacity: number;
  suggestedCapacity: number;
  reason: string;
}

/** Umumiy (fanga atalmagan) maxsus xonani fanga biriktirish — yangi xona qurishdan tejamli. */
export interface RoomRename {
  roomId: number;
  currentName: string;
  suggestedName: string;
  subjectId: number;
  subjectName: string;
  roomType: string;
  currentCapacity: number;
  suggestedCapacity: number;
  reason: string;
}

export interface SubjectRoomNeed {
  subjectId: number;
  subjectName: string;
  requiredHours: number;
  requiredCapacity: number;
  classCount: number;
  teacherCount: number;
  /** Shu fanga atalgan mavjud xonalar */
  ownRooms: Array<{ id: number; name: string; capacity: number; usable: boolean }>;
  needed: number;
  usable: number;
  shortage: number;
  utilizationPct: number;
  notes: string[];
}

export interface RoomTypeRecommendation {
  roomType: string;
  label: string;
  requiredHours: number;
  requiredCapacity: number;
  /** Mavjud (aktiv) xonalar — sig'imidan qat'i nazar */
  available: number;
  /** Sig'imi yetarli va (maxsus turlarda) fanga atalgan xonalar */
  usable: number;
  undersized: Array<{ id: number; name: string; capacity: number }>;
  needed: number;
  shortage: number;
  utilizationPct: number;
  concurrencyCap: number;
  notes: string[];
  suggestedRooms: SuggestedRoom[];
  /** Maxsus turlarda — fan bo'yicha taqsimot (lab: Fizika, Kimyo, Biologiya...) */
  subjects: SubjectRoomNeed[];
}

export interface RoomRecommendationInput {
  classes: RoomRecoClass[];
  classSubjects: RoomRecoClassSubject[];
  subjects: RoomRecoSubject[];
  rooms: RoomRecoRoom[];
  /** Tanaffus bo'lmagan, aktiv slotlar soni (butun hafta bo'yicha) */
  activeSlotsPerWeek: number;
  shifts?: number;
  reservePercent?: number;
}

export interface RoomRecommendationResult {
  shifts: number;
  reservePercent: number;
  totalCapacityPerRoom: number;
  recommendations: RoomTypeRecommendation[];
  capacityUpgrades: CapacityUpgrade[];
  roomRenames: RoomRename[];
  allSuggestedRooms: SuggestedRoom[];
}

const ROOM_TYPES = ["classroom", "computer", "lab", "gym", "music", "art"] as const;

/** Maxsus jihoz talab qiladigan, ya'ni fan bo'yicha alohida bo'lishi kerak turlar */
const SUBJECT_SPECIFIC_TYPES = new Set(["lab", "computer", "music", "art"]);

const FLOOR_PREFIX: Record<string, string> = {
  classroom: "1", computer: "2", gym: "3", lab: "4", music: "5", art: "6",
};

/** Sport zali odatda ikki sinfni sig'diradi; qolganlari sinf sig'imi + zaxira o'rin. */
function suggestCapacity(roomType: string, requiredCapacity: number): number {
  const base = Math.max(requiredCapacity, 1);
  if (roomType === "gym") return Math.max(50, base * 2);
  return Math.ceil((base * 1.1) / 5) * 5; // 10% zaxira, 5 taga yaxlitlash (25 → 30)
}

function normalizeType(t: string | null | undefined): string {
  const v = (t || "classroom").trim();
  return v === "any" || v === "" ? "classroom" : v; // "any" — amalda oddiy sinf xonasi
}

export function computeRoomRecommendations(input: RoomRecommendationInput): RoomRecommendationResult {
  const shifts = Math.max(1, input.shifts ?? 1);
  const reservePercent = Math.max(0, input.reservePercent ?? 15);
  const reserveFactor = 1 + reservePercent / 100;

  const activeClasses = input.classes.filter(c => c.isActive !== false);
  const classById = new Map(activeClasses.map(c => [c.id, c]));
  const subjectById = new Map(input.subjects.map(s => [s.id, s]));
  const activeRooms = input.rooms.filter(r => r.isActive !== false);
  const slotsPerRoom = Math.max(1, input.activeSlotsPerWeek) * shifts;

  // ── Fan bo'yicha talab ────────────────────────────────────────────────────
  interface Demand {
    subjectId: number; subjectName: string; roomType: string;
    hours: number; capacity: number;
    classes: Set<number>; teachers: Set<number>;
  }
  const demandBySubject = new Map<number, Demand>();

  for (const cs of input.classSubjects) {
    const cls = classById.get(cs.classId);
    const sub = subjectById.get(cs.subjectId);
    if (!cls || !sub) continue;

    const roomType = normalizeType(sub.requiredRoomType);
    const students = cls.totalStudents || 25;
    // Guruhga bo'lingan dars (2 o'qituvchi) — sinf ikkiga bo'linadi
    const needCapacity = cs.teacherId2 ? Math.ceil(students / 2) : students;

    let d = demandBySubject.get(cs.subjectId);
    if (!d) {
      d = {
        subjectId: cs.subjectId, subjectName: sub.name, roomType,
        hours: 0, capacity: 0, classes: new Set(), teachers: new Set(),
      };
      demandBySubject.set(cs.subjectId, d);
    }
    d.hours += cs.weeklyHours;
    d.capacity = Math.max(d.capacity, needCapacity);
    d.classes.add(cs.classId);
    if (cs.teacherId) d.teachers.add(cs.teacherId);
    if (cs.teacherId2) d.teachers.add(cs.teacherId2);
  }

  const totalClassesPerShift = Math.ceil(activeClasses.length / shifts);
  const capacityUpgrades: CapacityUpgrade[] = [];
  const roomRenames: RoomRename[] = [];
  const recommendations: RoomTypeRecommendation[] = [];
  const usedRoomNumbers = new Set(activeRooms.map(r => r.roomNumber.toLowerCase().trim()));
  // Bir umumiy xona faqat bitta fanga biriktiriladi
  const claimedRoomIds = new Set<number>();

  function nextRoomNumber(type: string): string {
    const prefix = FLOOR_PREFIX[type] || "9";
    for (let i = 1; i <= 999; i++) {
      const num = `${prefix}${String(i).padStart(2, "0")}`;
      if (!usedRoomNumbers.has(num.toLowerCase())) {
        usedRoomNumbers.add(num.toLowerCase());
        return num;
      }
    }
    return `${prefix}${Date.now().toString().slice(-3)}`;
  }

  function neededRooms(hours: number, cap: number): number {
    if (hours <= 0) return 0;
    const byLoad = Math.ceil((hours / slotsPerRoom) * reserveFactor);
    // Bir vaqtda ishlatib bo'lmaydigan xona ortiqcha xarajat
    return Math.max(1, Math.min(byLoad, Math.max(1, cap)));
  }

  for (const type of ROOM_TYPES) {
    const roomsOfType = activeRooms.filter(r => normalizeType(r.roomType) === type);
    const typeDemands = Array.from(demandBySubject.values()).filter(d => d.roomType === type);
    const requiredHours = typeDemands.reduce((s, d) => s + d.hours, 0);

    if (requiredHours === 0 && roomsOfType.length === 0) continue;

    const notes: string[] = [];
    const suggestedRooms: SuggestedRoom[] = [];
    const subjectNeeds: SubjectRoomNeed[] = [];

    if (SUBJECT_SPECIFIC_TYPES.has(type) && typeDemands.length > 0) {
      // ── Maxsus xonalar: har bir fan uchun alohida ─────────────────────────
      notes.push(
        `Maxsus jihozlangan xona — har bir fan uchun alohida: ` +
        typeDemands.map(d => d.subjectName).join(", ") + ".",
      );

      // Katta talabli fanlar avval xona da'vo qiladi
      const ordered = [...typeDemands].sort((a, b) => b.hours - a.hours);

      for (const d of ordered) {
        const concurrency = Math.max(1, Math.min(d.classes.size, d.teachers.size || d.classes.size));
        const need = neededRooms(d.hours, concurrency);

        // Fanga atalgan mavjud xonalar (nomi bo'yicha)
        const ownRooms = roomsOfType.filter(
          r => !claimedRoomIds.has(r.id) && roomMatchesSubject(r.name, d.subjectName),
        );
        for (const r of ownRooms) claimedRoomIds.add(r.id);

        const subjectNotes: string[] = [];
        let usable = ownRooms.filter(r => r.capacity >= d.capacity).length;

        for (const r of ownRooms) {
          if (r.capacity < d.capacity) {
            capacityUpgrades.push({
              roomId: r.id, roomName: r.name, roomType: type,
              currentCapacity: r.capacity,
              suggestedCapacity: suggestCapacity(type, d.capacity),
              reason: `${d.subjectName}: eng katta sinfda ${d.capacity} o'quvchi, xona sig'imi ${r.capacity}.`,
            });
          }
        }

        // Yetishmasa — avval umumiy (fanga atalmagan) bo'sh xonani shu fanga biriktiramiz
        let missing = Math.max(0, need - usable);
        while (missing > 0) {
          const generic = roomsOfType.find(r => !claimedRoomIds.has(r.id));
          if (!generic) break;
          claimedRoomIds.add(generic.id);
          const suggestedCapacity = generic.capacity >= d.capacity
            ? generic.capacity
            : suggestCapacity(type, d.capacity);
          roomRenames.push({
            roomId: generic.id,
            currentName: generic.name,
            suggestedName: subjectRoomName(d.subjectName, type),
            subjectId: d.subjectId,
            subjectName: d.subjectName,
            roomType: type,
            currentCapacity: generic.capacity,
            suggestedCapacity,
            reason: `"${generic.name}" hech bir fanga atalmagan — uni ${d.subjectName} fani xonasi qilib belgilash yangi xona qurishdan tejamli.`,
          });
          ownRooms.push({ ...generic, name: subjectRoomName(d.subjectName, type), capacity: suggestedCapacity });
          usable++;
          missing--;
        }

        // Qolgani — yangi xona
        for (let i = 0; i < missing; i++) {
          const roomNumber = nextRoomNumber(type);
          suggestedRooms.push({
            name: subjectRoomName(d.subjectName, type),
            roomNumber,
            roomType: type,
            capacity: suggestCapacity(type, d.capacity),
            building: "Asosiy bino",
            floor: FLOOR_PREFIX[type] || "9",
            subjectId: d.subjectId,
            subjectName: d.subjectName,
          });
        }

        if (missing > 0) {
          subjectNotes.push(`${missing} ta yangi "${subjectRoomName(d.subjectName, type)}" kerak.`);
        }
        if (usable === 0 && need > 0) {
          subjectNotes.push("Hozircha bu fan darslari boshqa xonaga majburan joylashtiriladi (ziddiyat qayd etiladi).");
        }
        const utilization = need > 0 ? Math.round((d.hours / (need * slotsPerRoom)) * 100) : 0;
        if (need > 0 && utilization < 15) {
          subjectNotes.push(
            `Bandligi juda past (${utilization}%) — xohlasangiz alohida xona qurmasdan, ` +
            `yaqin fan xonasidan (masalan Fizika laboratoriyasi) foydalanish mumkin.`,
          );
        }

        subjectNeeds.push({
          subjectId: d.subjectId,
          subjectName: d.subjectName,
          requiredHours: d.hours,
          requiredCapacity: d.capacity,
          classCount: d.classes.size,
          teacherCount: d.teachers.size,
          ownRooms: ownRooms.map(r => ({
            id: r.id, name: r.name, capacity: r.capacity, usable: r.capacity >= d.capacity,
          })),
          needed: need,
          usable,
          shortage: Math.max(0, need - usable),
          utilizationPct: utilization,
          notes: subjectNotes,
        });
      }
    } else {
      // ── Oddiy sinf xonasi / sport zali: fan bo'yicha bo'linmaydi ──────────
      const requiredCapacity = Math.max(
        0,
        ...typeDemands.map(d => d.capacity),
        ...(type === "classroom" ? activeClasses.map(c => c.totalStudents || 25) : [0]),
      );
      const usableRooms = roomsOfType.filter(r => r.capacity >= requiredCapacity);
      const undersizedRooms = roomsOfType.filter(r => r.capacity < requiredCapacity);

      const classCount = new Set(typeDemands.flatMap(d => Array.from(d.classes))).size;
      const teacherCount = new Set(typeDemands.flatMap(d => Array.from(d.teachers))).size;
      const concurrencyCap = Math.max(
        1,
        Math.min(classCount || totalClassesPerShift, teacherCount || classCount || totalClassesPerShift),
      );

      let needed = requiredHours > 0 ? Math.ceil((requiredHours / slotsPerRoom) * reserveFactor) : 0;

      if (type === "classroom" && activeClasses.length > 0) {
        // Bir vaqtda har bir sinfga alohida xona kerak; zaxira ham shu yerda mazmunli
        const baseline = Math.ceil(totalClassesPerShift * reserveFactor);
        if (baseline > needed) {
          notes.push(`Har bir sinfga bir vaqtda alohida xona kerak (${totalClassesPerShift} ta sinf${shifts > 1 ? `, ${shifts} smena` : ""}).`);
          needed = baseline;
        }
      } else if (needed > concurrencyCap && requiredHours > 0) {
        notes.push(
          `Bir vaqtda ko'pi bilan ${concurrencyCap} ta xona ishlatiladi ` +
          `(${classCount} ta sinf, ${teacherCount} ta o'qituvchi) — tavsiya shu chegara bilan cheklandi.`,
        );
        needed = concurrencyCap;
      }

      for (const r of undersizedRooms) {
        capacityUpgrades.push({
          roomId: r.id, roomName: r.name, roomType: type,
          currentCapacity: r.capacity,
          suggestedCapacity: suggestCapacity(type, requiredCapacity),
          reason: `${ROOM_TYPE_LABELS[type] || type}: eng katta sinfda ${requiredCapacity} o'quvchi, xona sig'imi ${r.capacity}.`,
        });
      }
      if (undersizedRooms.length > 0) {
        notes.push(`${undersizedRooms.length} ta xona sig'imi yetarli emas (kerak: ${requiredCapacity} o'rin) — jadval tuzishda ishlatilmaydi.`);
      }

      const shortage = Math.max(0, needed - usableRooms.length);
      for (let i = 0; i < shortage; i++) {
        const roomNumber = nextRoomNumber(type);
        suggestedRooms.push({
          name: type === "gym" ? `Sport zali ${roomNumber}` : `${ROOM_TYPE_LABELS[type] || type} ${roomNumber}`,
          roomNumber,
          roomType: type,
          capacity: suggestCapacity(type, requiredCapacity),
          building: "Asosiy bino",
          floor: FLOOR_PREFIX[type] || "9",
        });
      }

      recommendations.push({
        roomType: type,
        label: ROOM_TYPE_LABELS[type] || type,
        requiredHours,
        requiredCapacity,
        available: roomsOfType.length,
        usable: usableRooms.length,
        undersized: undersizedRooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })),
        needed,
        shortage,
        utilizationPct: needed > 0 ? Math.round((requiredHours / (needed * slotsPerRoom)) * 100) : 0,
        concurrencyCap,
        notes,
        suggestedRooms,
        subjects: [],
      });
      continue;
    }

    // Maxsus turlar uchun yig'ma ko'rsatkichlar
    const needed = subjectNeeds.reduce((s, x) => s + x.needed, 0);
    const usable = subjectNeeds.reduce((s, x) => s + x.usable, 0);
    const undersized = roomsOfType
      .filter(r => capacityUpgrades.some(u => u.roomId === r.id))
      .map(r => ({ id: r.id, name: r.name, capacity: r.capacity }));

    recommendations.push({
      roomType: type,
      label: ROOM_TYPE_LABELS[type] || type,
      requiredHours,
      requiredCapacity: Math.max(0, ...subjectNeeds.map(s => s.requiredCapacity)),
      available: roomsOfType.length,
      usable,
      undersized,
      needed,
      shortage: subjectNeeds.reduce((s, x) => s + x.shortage, 0),
      utilizationPct: needed > 0 ? Math.round((requiredHours / (needed * slotsPerRoom)) * 100) : 0,
      concurrencyCap: Math.max(1, ...subjectNeeds.map(s => Math.max(1, Math.min(s.classCount, s.teacherCount || s.classCount)))),
      notes,
      suggestedRooms,
      subjects: subjectNeeds,
    });
  }

  return {
    shifts,
    reservePercent,
    totalCapacityPerRoom: slotsPerRoom,
    recommendations,
    capacityUpgrades,
    roomRenames,
    allSuggestedRooms: recommendations.flatMap(r => r.suggestedRooms),
  };
}
