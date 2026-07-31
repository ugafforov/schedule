/**
 * Hill-Climbing va Simulated Annealing Global Optimallashtirgich
 * 
 * Bu modul terilgan dars jadvalining har bir sinfi va o'qituvchisi uchun:
 * 1. Barcha juft dars almashtirishlarini (Pairwise Swaps)
 * 2. Barcha yakka dars ko'chirishlarini (Single Moves / Relocations)
 * 3. Barcha oyna yopish ixchamlashtirishlarini (Gap Compactions)
 * sistemali ravishda sinab ko'radi va jarima ballini (Penalty) minimal darajaga tushiradi.
 */

import { getSubjectCategory, getSubjectComplexity, getMaxDailyComplexity, getMaxHoursPerDay, parseGrade, SubjectCategory } from "../../shared/constants";
import { OptimizerScheduleEntry } from "./schedule-optimizer";

export interface HillClimbContext {
  schedule: OptimizerScheduleEntry[];
  activeSlots: Array<{ id: number; dayOfWeek: number; periodNumber: number }>;
  slotMap: Map<number, { id: number; dayOfWeek: number; periodNumber: number }>;
  unavailSet: Set<string>;
  protectedIndices: Set<number>;
  classGrades: Map<number, string>;
  classStudyDays: Map<number, number[]>;
  subjectMap: Map<number, { id: number; name: string; requiredRoomType?: string | null }>;
  allRooms: Array<{ id: number; name: string; roomType: string; capacity: number; isActive: boolean }>;
  /**
   * Sinfning "uy" xonasi (`classes.defaultRoomId`). Maxsus xona talab qilmaydigan
   * darslar shu xonada o'tishi kerak — o'quvchilar har darsda ko'chib yurmasin.
   */
  classHomeRooms?: Map<number, number>;
  mode?: "greedy" | "annealing";
  maxIterations?: number;
  /**
   * Qat'iy vaqt chegarasi (`Date.now()` shkalasida). Berilgan bo'lsa, optimizatsiya shu
   * vaqtdan keyin darhol to'xtaydi va shu paytgacha topilgan eng yaxshi holatni qaytaradi.
   *
   * Zarur, chunki bitta iteratsiya har bir nomzod ko'chirish uchun butun jadval jarimasini
   * qaytadan hisoblaydi (`evaluateSchedulePenalty`) — 11 sinf miqyosida bu iteratsiyasiga
   * ~1 soniya turadi va budjetsiz butun generatsiya soatlab cho'ziladi.
   */
  deadline?: number;
  /**
   * `${classId}_${subjectId}` -> shu fanning haftalik yuklamasi (surat/mahraj = 0.5).
   * Ko'chirishlar faqat slot/xonani o'zgartiradi, shuning uchun bu qiymat butun
   * optimizatsiya davomida o'zgarmaydi va bir marta hisoblab keshlanadi
   * (`ensureSubjectWeeklyLoad`). Kunlik takror chegarasi shundan kelib chiqadi.
   */
  subjectWeeklyLoad?: Map<string, number>;
}

type WkType = "always" | "surat" | "mahraj";

const MAX_DAY = 7;

/**
 * JARIMA IERARXIYASI — tartib muhim.
 *
 * Qat'iy shartlar (bir vaqtda ikki dars, o'qituvchi band vaqti) har qanday yumshoq
 * jarimadan **kattaliklar bo'yicha** ustun turishi shart. Aks holda optimizator
 * arifmetik jihatdan to'g'ri, lekin amalda yaroqsiz qaror qabul qiladi: masalan
 * to'qnashuv 1000, sinf oynasi 6000 bo'lganda oynani yopish uchun to'qnashuvni
 * saqlab qolish "foydali" bo'lib chiqadi (bu 44 sinfli maktabda aynan shunday
 * bo'lgan — jadvalda 4 ta sinf to'qnashuvi qolib ketgan).
 *
 * Tartib: qat'iy to'qnashuv > oyna > kech tugash > fan takrori > uy xonasi > balans.
 */
const HARD_CONFLICT_PENALTY = 100_000;
const TEACHER_UNAVAILABLE_PENALTY = 100_000;

/**
 * O'qituvchining kun ichidagi oynasi (bo'sh soat) — amalda o'qituvchilarning eng ko'p
 * shikoyati. Sinf oynasidan (6000) va fan takroridan (3000) past turishi shart:
 * aks holda optimizator o'qituvchi oynasini yopish uchun bir fanni kunda ikki marta
 * qo'yishni "foydali" deb hisoblaydi (o'lchandi: 22 sinfda 8 ta ortiqcha takror).
 */
const TEACHER_GAP_PENALTY = 1200;

/**
 * Bir kunda bitta fandan ruxsat etilganidan ortiq qo'yilgan har bir dars uchun jarima.
 * Sinf oynasidan (6000) past — oynani yopish uchun takrorga yo'l qo'yish mumkin, ammo
 * o'qituvchi oynasi (1200) va kunlik nomutanosiblikdan (~120) yuqori.
 */
const SAME_SUBJECT_PER_DAY_PENALTY = 3000;

/**
 * SanPiN №0341-16 kunlik dars soni chegarasidan (`getMaxHoursPerDay`: 1-4-sinf 5 soat,
 * 5-11-sinf 7 soat) oshgan har bir dars uchun jarima.
 *
 * Bu norma — qat'iy talab, shuning uchun barcha sifat hadlaridan (eng kattasi sinf oynasi,
 * 6000) yuqori turadi, lekin to'qnashuvdan (100 000) past: o'quv reja kunlarga sig'masa
 * (masalan 5 kunlik haftada 26 dars) optimizator ortiqchani minimallashtiradi, jadvalni
 * buzib tashlamaydi. Dastlabki joylashtirish bu chegarani hisobga olardi, hill-climber
 * esa yo'q — natijada u dars ko'chirib chegarani jimgina buzardi (o'lchandi: 2-A payshanba 6 dars).
 */
const DAILY_LESSON_CAP_PENALTY = 20_000;

/**
 * SanPiN №0341-16 kunlik aqliy zo'riqish chegarasidan (`getMaxDailyComplexity`) oshgan
 * HAR BIR murakkablik birligi uchun jarima.
 *
 * Nega kerak: dastlabki joylashtirish (`schedule.service.ts`) bu chegarani hisobga oladi,
 * hill-climber esa avval umuman hisobga olmasdi — natijada u oyna/takror yutug'i evaziga
 * kunlik zo'riqishni bemalol buzardi (o'lchandi: 11 sinfda 62 kundan 34 tasi chegaradan
 * oshgan). Bir kunning oshib ketishi odatda 5-15 birlik, ya'ni 1000-3000 ball —
 * sinf oynasidan (6000) past, o'qituvchi oynasidan (1200) yuqori.
 *
 * NEGA CHIZIQLI (kvadratik emas): DTS o'quv rejasi ba'zi sinflarda (2-4, 7-9) SanPiN
 * haftalik byudjetidan 11-17% og'ir — u yerda barcha kunlar chegaradan oshadi va chiziqli
 * jarima tekislash uchun yo'nalish bermaydi. Kvadratik had (`excess^2 * 40`) shu kamchilikni
 * yopadi, ammo amalda O'LCHANGANDA butun jadvalni yomonlashtirdi: og'ir kunlar shu qadar
 * qimmatlashdiki, qidiruv spacing va oynani sotib yubordi (spacing ortiqchasi 17 -> 36,
 * sinf oynasi 0 -> 1, ball 88 -> 85). Shuning uchun chiziqli variant saqlanadi.
 */
const DAILY_COMPLEXITY_PENALTY = 200;

/**
 * Bitta fan ketma-ket kunlarga tushgani uchun jarima (takrorlash oralig'i / spacing effect).
 * Faqat MUQARRAR bo'lmagan qo'shnilik jazolanadi — 5 kunlik haftada 5 soatlik fan
 * baribir har kuni bo'ladi, buning uchun jarima yozish qidiruvni chalg'itardi
 * (`subjectSpacingPenalty` shuning uchun "ruxsat etilgan" qo'shniliklar sonini ayiradi).
 *
 * Takror jarimasidan (3000) past: fanni ikkinchi kunga surish uchun uni bir kunda
 * ikki marta qo'yish hech qachon foydali bo'lmasligi kerak.
 */
const SUBJECT_ADJACENT_DAY_PENALTY = 800;

/** Shu qiymatdan og'ir fan (matematika, fizika, ona tili...) "aqliy zo'riqish" hisoblanadi. */
const HEAVY_SUBJECT_COMPLEXITY = 9;

/** Og'ir fan kunning OXIRGI darsiga tushgani uchun jarima (charchagan paytdagi eng og'ir dars). */
const HEAVY_SUBJECT_LAST_PERIOD_PENALTY = 400;

/**
 * Maxsus xona talab qilmaydigan dars sinfning uy xonasidan tashqarida o'tsa.
 *
 * Spacing jarimasidan (800) yuqori: butun sinfning har hafta boshqa xonaga ko'chishi
 * 30 o'quvchiga tegadi, bitta fanning ketma-ket kunga tushishi esa faqat o'sha fanning
 * sur'atiga. Avval bu qiymat 300 edi va u yagona quyi darajali had bo'lgani uchun
 * yetarli edi; spacing va kunlik zo'riqish hadlari qo'shilgach optimizator uy xonasini
 * ular evaziga sotib yubordi (22 sinfli testda 99% -> 93%).
 */
const AWAY_FROM_HOME_ROOM_PENALTY = 1000;

function isWkConflict(a: string, b: string): boolean {
  if (a === "always" || b === "always") return true;
  return a === b;
}

/** Darsning haftalik "og'irligi": surat/mahraj darslar haftada bir marta o'tadi. */
function lessonLoad(entry: OptimizerScheduleEntry): number {
  return (entry.weekType || "always") === "always" ? 1 : 0.5;
}

/**
 * `${classId}_${subjectId}` -> haftalik yuklamani bir marta hisoblab, kontekstda keshlaydi.
 * Ko'chirishlar dars sonini o'zgartirmaydi, shuning uchun kesh butun run davomida haqiqiy.
 */
function ensureSubjectWeeklyLoad(ctx: HillClimbContext): Map<string, number> {
  if (ctx.subjectWeeklyLoad) return ctx.subjectWeeklyLoad;
  const map = new Map<string, number>();
  for (const e of ctx.schedule) {
    if (e.isActive === false) continue;
    const key = `${e.classId}_${e.subjectId}`;
    map.set(key, (map.get(key) ?? 0) + lessonLoad(e));
  }
  ctx.subjectWeeklyLoad = map;
  return map;
}

/**
 * Bir kunda bitta fandan nechta dars bo'lishi mumkin
 * (`docs/domain/scheduling-rules.md` §2.B).
 *
 * Qoida: **bir kunda bitta fan — bitta dars**. Ikkinchi dars faqat MAJBURIY bo'lganda,
 * ya'ni fanning haftalik soati o'quv kunlaridan ko'p bo'lgandagina ruxsat etiladi
 * (masalan 6 soatlik matematika 5 kunlik haftada).
 *
 * Nega "laboratoriya fani = 2 ta" qoidasi olib tashlandi: u fizika/kimyoga haftalik soati
 * 2 bo'lsa ham bir kunga ikkita dars qo'yishga ruxsat berardi (o'lchandi: 11-A da fizikaning
 * ikkala soati bitta kunga tushib qolgan). DTS bo'yicha 2 soatlik fan haftaga taqsimlanadi;
 * juft dars — haftalik soat kunlardan oshgandagina asosli.
 */
function sameSubjectDayLimit(classId: number, subjectId: number, ctx: HillClimbContext): number {
  const weekly = ensureSubjectWeeklyLoad(ctx).get(`${classId}_${subjectId}`) ?? 0;
  const studyDays = (ctx.classStudyDays.get(classId) || [1, 2, 3, 4, 5]).length || 1;
  if (weekly <= studyDays) return 1;
  return Math.ceil(weekly / studyDays);
}

/**
 * Fanning ketma-ket kunlarga tushishi uchun jarima (spacing effect).
 *
 * `byDay[d]` — shu kundagi yuklama. `S` kunlik haftaga `k` kun joylashtirilganda qo'shni
 * juftliklarning MINIMAL soni `max(0, 2k - S - 1)` ga teng (5 kunlik haftada 3 kun —
 * 0 ta qo'shni, 4 kun — 2 ta, 5 kun — 4 ta). Shu minimum jarimadan chegiriladi:
 * 5 kunlik haftadagi 5 soatlik matematika baribir har kuni bo'ladi va buning uchun
 * jarima yozish qidiruvni chalg'itardi — faqat oldini olish MUMKIN bo'lgan
 * qo'shniliklar jazolanadi.
 */
function subjectSpacingPenalty(byDay: number[], studyDayCount: number): number {
  let usedDays = 0;
  let adjacent = 0;
  for (let d = 1; d <= MAX_DAY; d++) {
    if (byDay[d] <= 0) continue;
    usedDays++;
    if (d > 1 && byDay[d - 1] > 0) adjacent++;
  }
  const unavoidable = Math.max(0, 2 * usedDays - Math.max(1, studyDayCount) - 1);
  const excess = adjacent - unavoidable;
  return excess > 0 ? excess * SUBJECT_ADJACENT_DAY_PENALTY : 0;
}

/** Kunlik aqliy zo'riqish chegarasidan oshgani uchun jarima. */
function dailyComplexityPenalty(daySum: number, maxAllowed: number): number {
  const excess = daySum - maxAllowed;
  return excess > 0 ? Math.round(excess * DAILY_COMPLEXITY_PENALTY) : 0;
}

/** Kunlik dars soni chegarasidan oshgani uchun jarima. */
function dailyLessonCapPenalty(dayLoad: number, maxLessons: number): number {
  const excess = dayLoad - maxLessons;
  return excess > 0 ? Math.round(excess * DAILY_LESSON_CAP_PENALTY) : 0;
}

/** Bitta (kun, fan) juftligi uchun takror jarimasi. */
function duplicatePenalty(load: number, limit: number): number {
  const excess = load - limit;
  return excess > 0 ? Math.round(excess * SAME_SUBJECT_PER_DAY_PENALTY) : 0;
}

/** Dars shu xonaga tushishi mumkinmi (turi bo'yicha mos nomzodlar ro'yxati bo'yicha). */
function isRoomAllowed(entry: OptimizerScheduleEntry, roomId: number): boolean {
  const cands = entry.roomCandidates;
  return !cands || cands.length === 0 || cands.includes(roomId);
}

/** Bitta dars uchun o'qituvchi bandligi (unavailability) jarimasi. */
function entryUnavailPenalty(entry: OptimizerScheduleEntry, ctx: HillClimbContext): number {
  const slot = ctx.slotMap.get(entry.timeSlotId);
  if (slot && ctx.unavailSet.has(`${entry.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`)) return TEACHER_UNAVAILABLE_PENALTY;
  return 0;
}

/**
 * Dars qaysi xonada o'tishi kerakligi: avval fanga biriktirilgan xona, keyin sinfning
 * uy xonasi. Maxsus xona (sport zali, laboratoriya...) talab qiladigan fanlar uchun
 * sinf uy xonasi qo'llanmaydi — ular fanga atalgan xonada qoladi.
 */
function preferredRoomOf(entry: OptimizerScheduleEntry, ctx: HillClimbContext): number | undefined {
  if (entry.preferredRoomId !== undefined) return entry.preferredRoomId;
  const home = ctx.classHomeRooms?.get(entry.classId);
  if (home === undefined) return undefined;
  const req = ctx.subjectMap.get(entry.subjectId)?.requiredRoomType;
  if (req && req !== "any" && req !== "classroom") return undefined;
  return home;
}

/** Dars afzal xonasidan tashqarida o'tayotgani uchun jarima. */
function entryHomeRoomPenalty(entry: OptimizerScheduleEntry, ctx: HillClimbContext): number {
  const home = preferredRoomOf(entry, ctx);
  if (home === undefined || entry.roomId === home) return 0;
  if (!isRoomAllowed(entry, home)) return 0;
  return AWAY_FROM_HOME_ROOM_PENALTY;
}

/** Bitta darsning faqat o'ziga bog'liq (guruh va sinfdan mustaqil) jarimasi. */
function entryOwnPenalty(entry: OptimizerScheduleEntry, ctx: HillClimbContext): number {
  return entryUnavailPenalty(entry, ctx) + entryHomeRoomPenalty(entry, ctx);
}

/**
 * Bitta (resurs, slot) guruhi ichidagi qat'iy to'qnashuv jarimasi — bir xil
 * o'qituvchi/sinf/xona bitta slotda bir nechta darsga tushib qolgan holat.
 */
function groupPairPenalty(schedule: OptimizerScheduleEntry[], idxs: number[]): number {
  if (idxs.length < 2) return 0;
  let penalty = 0;
  for (let i = 0; i < idxs.length; i++) {
    const e1 = schedule[idxs[i]];
    for (let j = i + 1; j < idxs.length; j++) {
      const e2 = schedule[idxs[j]];
      if (e1.jointLessonId && e2.jointLessonId && e1.jointLessonId === e2.jointLessonId) continue;
      if (isWkConflict(e1.weekType || "always", e2.weekType || "always")) penalty += HARD_CONFLICT_PENALTY;
    }
  }
  return penalty;
}

interface SoftStats {
  classGaps: number;
  dayImbalances: number;
  lateEndings: number;
  complexityViolations: number;
  /** Bir kunda bir fandan ruxsat etilganidan ortiq qo'yilgan darslar soni. */
  sameSubjectDays: number;
  /** Sababsiz begona xonada o'tayotgan darslar soni. */
  awayFromHomeRoom: number;
  /** O'qituvchilarning kun ichidagi bo'sh soatlari (oynalar). */
  teacherGaps: number;
  /** SanPiN kunlik zo'riqish chegarasidan oshgan sinf-kunlar soni. */
  dailyComplexityDays: number;
  /** Fanning ortiqcha (oldini olish mumkin bo'lgan) ketma-ket kunga tushishlari soni. */
  adjacentDaySubjects: number;
  /** Kunning oxirgi darsiga tushgan og'ir fanlar soni. */
  heavyLastPeriods: number;
  /** SanPiN kunlik dars soni chegarasidan oshgan sinf-kunlar soni. */
  dailyCapDays: number;
}

/**
 * Bitta sinfning "yumshoq" (sifat) jarimasi: oynalar, kunlararo nomutanosiblik,
 * kech tugash va SanPiN murakkablik buzilishlari.
 *
 * MUHIM: bu qiymat FAQAT shu sinfning darslariga bog'liq. Aynan shu xossa
 * `PenaltyTracker`ga bitta ko'chirishdan keyin butun jadvalni emas, faqat bitta
 * sinfni qayta hisoblash imkonini beradi.
 */
function classSoftPenalty(
  schedule: OptimizerScheduleEntry[],
  indices: number[],
  classId: number,
  ctx: HillClimbContext,
  stats?: SoftStats,
): number {
  const { slotMap, classStudyDays, subjectMap } = ctx;
  let totalPenalty = 0;

  const studyDays = classStudyDays.get(classId) || [1, 2, 3, 4, 5];
  const totalLessons = indices.length;
  const targetDaily = totalLessons / Math.max(1, studyDays.length);

  const grade = parseGrade(ctx.classGrades.get(classId));

  // Day -> Array of periodNumbers
  const dayPeriodsMap = new Map<number, number[]>();
  for (const d of studyDays) dayPeriodsMap.set(d, []);
  // fanId -> kun -> shu kundagi yuklama (takror va spacing jarimalari uchun)
  const subjectDayLoad = new Map<number, number[]>();
  // kun -> SanPiN aqliy zo'riqish yig'indisi
  const dayComplexity = new Array(MAX_DAY + 1).fill(0);
  // kun -> haftalik og'irlik bilan o'lchangan dars soni (surat/mahraj = 0.5)
  const dayLoad = new Array(MAX_DAY + 1).fill(0);
  const maxLessonsPerDay = getMaxHoursPerDay(grade);
  // `${kun}_${dars}` -> shu soatdagi og'ir fanlar soni (kun oxiri tekshiruvi uchun)
  const heavyAt = new Map<string, number>();

  for (const idx of indices) {
    const e = schedule[idx];
    const slot = slotMap.get(e.timeSlotId);
    if (!slot) continue;
    const d = slot.dayOfWeek;
    const p = slot.periodNumber;
    if (!dayPeriodsMap.has(d)) dayPeriodsMap.set(d, []);
    dayPeriodsMap.get(d)!.push(p);

    const sub = subjectMap.get(e.subjectId);
    const raw = sub ? getSubjectComplexity(sub.name || "") : 0;

    if (d >= 1 && d <= MAX_DAY) {
      let byDay = subjectDayLoad.get(e.subjectId);
      if (!byDay) subjectDayLoad.set(e.subjectId, (byDay = new Array(MAX_DAY + 1).fill(0)));
      byDay[d] += lessonLoad(e);

      dayComplexity[d] += raw * lessonLoad(e);
      dayLoad[d] += lessonLoad(e);
      if (raw >= HEAVY_SUBJECT_COMPLEXITY) {
        const hk = `${d}_${p}`;
        heavyAt.set(hk, (heavyAt.get(hk) ?? 0) + 1);
      }
    }

    // Complexity penalty
    if (sub) {
      const cat = getSubjectCategory(sub.name || "");
      if (cat === "dynamic" && p <= 3) {
        if (stats) stats.complexityViolations++;
        totalPenalty += (4 - p) * 10;
      }
      if (cat === "mental" && p >= 5) {
        if (stats) stats.complexityViolations++;
        totalPenalty += (p - 4) * 15;
      }
    }
  }

  // Day Imbalance & Gap evaluation
  for (const [day, periods] of dayPeriodsMap.entries()) {
    const count = periods.length;
    const diff = Math.abs(count - targetDaily);
    if (diff > 0.5) {
      if (stats) stats.dayImbalances++;
      totalPenalty += Math.round(diff * diff * 120);
    }

    // SanPiN kunlik dars soni va aqliy zo'riqish chegaralari
    if (day >= 1 && day <= MAX_DAY) {
      const cap = dailyLessonCapPenalty(dayLoad[day], maxLessonsPerDay);
      if (cap > 0) {
        if (stats) stats.dailyCapDays++;
        totalPenalty += cap;
      }
      const cx = dailyComplexityPenalty(dayComplexity[day], getMaxDailyComplexity(grade, day));
      if (cx > 0) {
        if (stats) stats.dailyComplexityDays++;
        totalPenalty += cx;
      }
    }

    if (count === 0) continue;
    periods.sort((a, b) => a - b);
    const minP = periods[0];
    const maxP = periods[periods.length - 1];

    // Front gap (dars 1-soatdan emas 2-3 soatdan boshlansa)
    if (minP > 1) {
      const frontGap = minP - 1;
      if (stats) stats.classGaps += frontGap;
      totalPenalty += frontGap * 5000;
    }

    // Middle gaps (darslar orasidagi oyna / okno)
    for (let i = 1; i < periods.length; i++) {
      const g = periods[i] - periods[i - 1] - 1;
      if (g > 0) {
        if (stats) stats.classGaps += g;
        totalPenalty += g * 6000;
      }
    }

    // Og'ir fan kunning oxirgi darsida (charchagan paytdagi eng qiyin dars)
    if (day >= 1 && day <= MAX_DAY && (heavyAt.get(`${day}_${maxP}`) ?? 0) > 0) {
      if (stats) stats.heavyLastPeriods++;
      totalPenalty += HEAVY_SUBJECT_LAST_PERIOD_PENALTY;
    }

    // Late ending penalty (6-dars yoki undan kechi, ayniqsa boshqa kunda 5 tadan kam dars bo'lsa)
    if (maxP >= 6) {
      const hasUnderloadedDay = Array.from(dayPeriodsMap.values()).some((pList) => pList.length < 5);
      if (stats) stats.lateEndings++;
      totalPenalty += (maxP - 5) * (hasUnderloadedDay ? 2000 : 200);
    }
  }

  // Bir kunda bir fan takrorlanishi (juft dars qoidasi) va kunlararo tarqoqlik (spacing)
  for (const [subjectId, byDay] of subjectDayLoad.entries()) {
    const limit = sameSubjectDayLimit(classId, subjectId, ctx);
    for (let d = 1; d <= MAX_DAY; d++) {
      const p = duplicatePenalty(byDay[d], limit);
      if (p > 0) {
        if (stats) stats.sameSubjectDays += Math.ceil(byDay[d] - limit);
        totalPenalty += p;
      }
    }
    const sp = subjectSpacingPenalty(byDay, studyDays.length);
    if (sp > 0) {
      if (stats) stats.adjacentDaySubjects += sp / SUBJECT_ADJACENT_DAY_PENALTY;
      totalPenalty += sp;
    }
  }

  return totalPenalty;
}

/**
 * Bitta (o'qituvchi, kun) uchun oyna jarimasi. `periodCount[p] > 0` — shu soatda darsi bor.
 *
 * Sinf oynasidan farqi: o'qituvchi kunni kechroq boshlashi mumkin (bu kamchilik emas),
 * shuning uchun faqat darslar ORASIDAGI bo'shliq hisoblanadi.
 */
function teacherDayGapPenalty(periodCount: number[]): number {
  let prev = -1;
  let gaps = 0;
  for (let p = 1; p < periodCount.length; p++) {
    if (periodCount[p] <= 0) continue;
    if (prev >= 0) gaps += p - prev - 1;
    prev = p;
  }
  return gaps * TEACHER_GAP_PENALTY;
}

/** Jadvaldagi eng katta dars raqami (kunlik soatlar soni). */
function maxPeriodOf(ctx: HillClimbContext): number {
  let maxPeriod = 1;
  for (const s of ctx.activeSlots) if (s.periodNumber > maxPeriod) maxPeriod = s.periodNumber;
  return maxPeriod;
}

function pushInto<K>(map: Map<K, number[]>, key: K, value: number): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

/**
 * Berilgan jadval holati uchun to'liq jarimani hisoblaydi (butun jadval bo'ylab, O(N)).
 *
 * Qidiruv siklida bu funksiya ISHLATILMAYDI — u yerda `PenaltyTracker` inkremental
 * hisoblaydi. To'liq hisob boshlang'ich holat, yakuniy hisobot va testlar uchun kerak.
 */
export function evaluateSchedulePenalty(
  schedule: OptimizerScheduleEntry[],
  ctx: HillClimbContext
): { totalPenalty: number } & SoftStats {
  const stats: SoftStats = {
    classGaps: 0, dayImbalances: 0, lateEndings: 0, complexityViolations: 0,
    sameSubjectDays: 0, awayFromHomeRoom: 0, teacherGaps: 0,
    dailyComplexityDays: 0, adjacentDaySubjects: 0, heavyLastPeriods: 0, dailyCapDays: 0,
  };
  let totalPenalty = 0;

  const classEntriesMap = new Map<number, number[]>();
  const teacherSlotMap = new Map<string, number[]>();
  const classSlotMap = new Map<string, number[]>();
  const roomSlotMap = new Map<string, number[]>();
  const teacherDayPeriods = new Map<string, number[]>();
  const maxPeriod = maxPeriodOf(ctx);

  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    if (entry.isActive === false) continue;

    pushInto(classEntriesMap, entry.classId, i);
    pushInto(teacherSlotMap, `${entry.teacherId}_${entry.timeSlotId}`, i);
    pushInto(classSlotMap, `${entry.classId}_${entry.timeSlotId}`, i);
    pushInto(roomSlotMap, `${entry.roomId}_${entry.timeSlotId}`, i);

    const slot = ctx.slotMap.get(entry.timeSlotId);
    if (slot && slot.periodNumber >= 1 && slot.periodNumber <= maxPeriod) {
      const key = `${entry.teacherId}_${slot.dayOfWeek}`;
      let periods = teacherDayPeriods.get(key);
      if (!periods) teacherDayPeriods.set(key, (periods = new Array(maxPeriod + 1).fill(0)));
      periods[slot.periodNumber]++;
    }

    totalPenalty += entryUnavailPenalty(entry, ctx);
    const homePenalty = entryHomeRoomPenalty(entry, ctx);
    if (homePenalty > 0) stats.awayFromHomeRoom++;
    totalPenalty += homePenalty;
  }

  for (const periods of teacherDayPeriods.values()) {
    const p = teacherDayGapPenalty(periods);
    stats.teacherGaps += p / TEACHER_GAP_PENALTY;
    totalPenalty += p;
  }

  for (const group of teacherSlotMap.values()) totalPenalty += groupPairPenalty(schedule, group);
  for (const group of classSlotMap.values()) totalPenalty += groupPairPenalty(schedule, group);
  for (const group of roomSlotMap.values()) totalPenalty += groupPairPenalty(schedule, group);

  for (const [classId, indices] of classEntriesMap.entries()) {
    totalPenalty += classSoftPenalty(schedule, indices, classId, ctx, stats);
  }

  return { totalPenalty, ...stats };
}

/** Bitta darsning SanPiN murakkablik jarimasi (fan turi + dars raqamiga bog'liq). */
function lessonComplexityPenalty(
  entry: OptimizerScheduleEntry,
  period: number,
  ctx: HillClimbContext,
): number {
  const sub = ctx.subjectMap.get(entry.subjectId);
  if (!sub) return 0;
  const cat = getSubjectCategory(sub.name || "");
  if (cat === "dynamic" && period <= 3) return (4 - period) * 10;
  if (cat === "mental" && period >= 5) return (period - 4) * 15;
  return 0;
}

/**
 * Bitta sinfning yumshoq jarimasini KUN darajasida inkremental saqlaydi.
 *
 * `classSoftPenalty()` bilan aynan bir xil natija beradi (buni
 * `schedule-hill-climber.test.ts` har ko'chirishda tekshiradi), ammo dars ko'chganda
 * butun sinfni emas, faqat tegilgan ikkita kunni qayta hisoblaydi va hech qanday
 * Map/massiv ajratmaydi — qidiruv sikli uchun hal qiluvchi farq shu.
 */
/** Bitta darsning sinf jarimasiga qo'shadigan barcha ma'lumoti. */
interface LessonFacts {
  day: number;
  period: number;
  complexity: number;
  subjectId: number;
  load: number;
  /** Shu fandan bir kunda ruxsat etilgan dars soni. */
  limit: number;
  /** Fanning xom SanPiN murakkabligi (kunlik zo'riqish yig'indisi uchun). */
  rawComplexity: number;
}

function lessonFacts(
  entry: OptimizerScheduleEntry,
  slot: { dayOfWeek: number; periodNumber: number },
  ctx: HillClimbContext,
): LessonFacts {
  const sub = ctx.subjectMap.get(entry.subjectId);
  return {
    day: slot.dayOfWeek,
    period: slot.periodNumber,
    complexity: lessonComplexityPenalty(entry, slot.periodNumber, ctx),
    subjectId: entry.subjectId,
    load: lessonLoad(entry),
    limit: sameSubjectDayLimit(entry.classId, entry.subjectId, ctx),
    rawComplexity: sub ? getSubjectComplexity(sub.name || "") : 0,
  };
}

class ClassSoftState {
  private readonly targetDaily: number;
  private readonly isStudyDay: boolean[] = new Array(MAX_DAY + 1).fill(false);
  /** kun -> shu kundagi darslar soni */
  private readonly dayCount: number[] = new Array(MAX_DAY + 1).fill(0);
  /** kun -> dars raqami -> nechta dars (surat/mahraj tufayli 1 dan ko'p bo'lishi mumkin) */
  private readonly periodCount: number[][];
  /** kun -> nomutanosiblik + oyna jarimasi */
  private readonly dayBase: number[] = new Array(MAX_DAY + 1).fill(0);
  /** kun -> kech tugash "birligi" (maxP - 5), koeffitsient kunlararo bog'liq */
  private readonly dayLateUnits: number[] = new Array(MAX_DAY + 1).fill(0);
  /** fanId -> kun -> shu kundagi yuklama; takror va spacing jarimalari uchun */
  private readonly subjectDayLoad = new Map<number, number[]>();
  /** kun -> SanPiN aqliy zo'riqish yig'indisi */
  private readonly dayComplexitySum: number[] = new Array(MAX_DAY + 1).fill(0);
  /** kun -> haftalik og'irlik bilan o'lchangan dars soni (surat/mahraj = 0.5) */
  private readonly dayLoad: number[] = new Array(MAX_DAY + 1).fill(0);
  private readonly maxLessonsPerDay: number;
  /** kun -> shu kun uchun ruxsat etilgan maksimal zo'riqish (grade + SanPiN koeffitsienti) */
  private readonly maxDayComplexity: number[] = new Array(MAX_DAY + 1).fill(0);
  /** kun -> dars raqami -> shu soatdagi og'ir fanlar soni */
  private readonly heavyCount: number[][];
  private complexity = 0;
  private duplicates = 0;
  private spacing = 0;

  total = 0;

  constructor(
    private readonly maxPeriod: number,
    private readonly studyDays: number[],
    lessonCount: number,
    grade: number,
  ) {
    this.targetDaily = lessonCount / Math.max(1, studyDays.length);
    for (const d of studyDays) {
      if (d >= 1 && d <= MAX_DAY) this.isStudyDay[d] = true;
    }
    for (let d = 1; d <= MAX_DAY; d++) this.maxDayComplexity[d] = getMaxDailyComplexity(grade, d);
    this.maxLessonsPerDay = getMaxHoursPerDay(grade);
    this.periodCount = Array.from({ length: MAX_DAY + 1 }, () => new Array(this.maxPeriod + 1).fill(0));
    this.heavyCount = Array.from({ length: MAX_DAY + 1 }, () => new Array(this.maxPeriod + 1).fill(0));
  }

  addLesson(f: LessonFacts): void {
    this.complexity += f.complexity;
    this.applyLoad(f, +f.load);
    if (f.day < 1 || f.day > MAX_DAY || f.period < 1 || f.period > this.maxPeriod) return;
    this.dayCount[f.day]++;
    this.periodCount[f.day][f.period]++;
    if (f.rawComplexity >= HEAVY_SUBJECT_COMPLEXITY) this.heavyCount[f.day][f.period]++;
  }

  removeLesson(f: LessonFacts): void {
    this.complexity -= f.complexity;
    this.applyLoad(f, -f.load);
    if (f.day < 1 || f.day > MAX_DAY || f.period < 1 || f.period > this.maxPeriod) return;
    this.dayCount[f.day]--;
    this.periodCount[f.day][f.period]--;
    if (f.rawComplexity >= HEAVY_SUBJECT_COMPLEXITY) this.heavyCount[f.day][f.period]--;
  }

  /**
   * (kun, fan) yuklamasini o'zgartirib, takror va spacing jarimalarini shu joyning
   * o'zida yangilaydi. Kunlik zo'riqish yig'indisi ham shu yerda yuritiladi —
   * `classSoftPenalty` bilan bir xil chegara (faqat kun oralig'i) tekshiriladi.
   */
  private applyLoad(f: LessonFacts, delta: number): void {
    if (f.day < 1 || f.day > MAX_DAY) return;
    let byDay = this.subjectDayLoad.get(f.subjectId);
    if (!byDay) {
      byDay = new Array(MAX_DAY + 1).fill(0);
      this.subjectDayLoad.set(f.subjectId, byDay);
    }
    this.duplicates -= duplicatePenalty(byDay[f.day], f.limit);
    this.spacing -= subjectSpacingPenalty(byDay, this.studyDays.length);
    byDay[f.day] += delta;
    this.duplicates += duplicatePenalty(byDay[f.day], f.limit);
    this.spacing += subjectSpacingPenalty(byDay, this.studyDays.length);

    this.dayComplexitySum[f.day] += f.rawComplexity * delta;
    this.dayLoad[f.day] += delta;
  }

  /** Bitta kunning jarima qismlarini qayta hisoblaydi (O(dars raqamlari soni)). */
  recomputeDay(day: number): void {
    if (day < 1 || day > MAX_DAY) return;
    const count = this.dayCount[day];
    // Darsi ham yo'q, o'quv kuni ham emas — bunday kun umuman hisobga olinmaydi.
    if (count === 0 && !this.isStudyDay[day]) {
      this.dayBase[day] = 0;
      this.dayLateUnits[day] = 0;
      return;
    }

    let base = 0;
    const diff = Math.abs(count - this.targetDaily);
    if (diff > 0.5) base += Math.round(diff * diff * 120);

    base += dailyLessonCapPenalty(this.dayLoad[day], this.maxLessonsPerDay);
    base += dailyComplexityPenalty(this.dayComplexitySum[day], this.maxDayComplexity[day]);

    let lateUnits = 0;
    if (count > 0) {
      const periods = this.periodCount[day];
      let minP = -1;
      let maxP = -1;
      let gaps = 0;
      for (let pr = 1; pr <= this.maxPeriod; pr++) {
        if (periods[pr] <= 0) continue;
        if (minP < 0) minP = pr;
        else gaps += pr - maxP - 1;
        maxP = pr;
      }
      if (minP > 1) base += (minP - 1) * 5000;
      base += gaps * 6000;
      if (maxP >= 1 && this.heavyCount[day][maxP] > 0) base += HEAVY_SUBJECT_LAST_PERIOD_PENALTY;
      if (maxP >= 6) lateUnits = maxP - 5;
    }

    this.dayBase[day] = base;
    this.dayLateUnits[day] = lateUnits;
  }

  recomputeAllDays(): void {
    for (let d = 1; d <= MAX_DAY; d++) this.recomputeDay(d);
  }

  /** Kunlar bo'yicha yig'ib, sinfning to'liq yumshoq jarimasini yangilaydi. */
  refreshTotal(): void {
    let base = 0;
    let lateUnits = 0;
    let hasUnderloadedDay = false;
    for (let d = 1; d <= MAX_DAY; d++) {
      const count = this.dayCount[d];
      if (count === 0 && !this.isStudyDay[d]) continue;
      base += this.dayBase[d];
      lateUnits += this.dayLateUnits[d];
      if (count < 5) hasUnderloadedDay = true;
    }
    this.total = base + lateUnits * (hasUnderloadedDay ? 2000 : 200)
      + this.complexity + this.duplicates + this.spacing;
  }
}

/**
 * Jadval jarimasini INKREMENTAL kuzatuvchi.
 *
 * Nima uchun kerak: avval qidiruv sikli har bir sinov ko'chirishi uchun butun jadval
 * jarimasini qaytadan hisoblardi (O(N)) va bo'sh xonani ham butun jadvalni skanerlab
 * topardi (O(xonalar x N)). 11 sinf / ~370 dars miqyosida bu bitta iteratsiyaga ~3.8
 * soniya tushib, 300 iteratsiyalik optimizatsiya soatlab cho'zilardi.
 *
 * Bu klass jarimani uchta mustaqil qismga ajratadi:
 *   1. har bir darsning o'qituvchi bandligi jarimasi,
 *   2. (resurs, slot) guruhlaridagi qat'iy to'qnashuvlar,
 *   3. har bir sinfning yumshoq sifat jarimasi.
 * Bitta dars ko'chganda faqat tegilgan guruhlar va BITTA sinf qayta hisoblanadi —
 * natija `evaluateSchedulePenalty` bilan aynan bir xil, ammo narxi O(N) emas.
 */
export class PenaltyTracker {
  private readonly teacherGroups = new Map<string, number[]>();
  private readonly classGroups = new Map<string, number[]>();
  private readonly roomGroups = new Map<string, number[]>();
  private readonly groupPenalty = new Map<string, number>();
  private readonly classIndices = new Map<number, number[]>();
  private readonly classState = new Map<number, ClassSoftState>();
  /** Har bir darsning o'ziga bog'liq jarimasi: o'qituvchi bandligi + uy xonasi. */
  private readonly entryOwn: number[] = [];
  /** `${o'qituvchi}_${kun}` -> dars raqami bo'yicha darslar soni */
  private readonly teacherDayPeriods = new Map<string, number[]>();
  /** `${o'qituvchi}_${kun}` -> shu kunning oyna jarimasi */
  private readonly teacherDayPenalty = new Map<string, number>();
  private readonly maxPeriod: number;

  /** Joriy to'liq jarima — `evaluateSchedulePenalty(...).totalPenalty` bilan bir xil. */
  total = 0;

  constructor(
    private readonly schedule: OptimizerScheduleEntry[],
    private readonly ctx: HillClimbContext,
  ) {
    let maxPeriod = 1;
    for (const s of ctx.activeSlots) {
      if (s.periodNumber > maxPeriod) maxPeriod = s.periodNumber;
    }
    this.maxPeriod = maxPeriod;

    for (let i = 0; i < schedule.length; i++) {
      const e = schedule[i];
      this.entryOwn[i] = 0;
      if (e.isActive === false) continue;

      pushInto(this.classIndices, e.classId, i);
      pushInto(this.teacherGroups, `${e.teacherId}_${e.timeSlotId}`, i);
      pushInto(this.classGroups, `${e.classId}_${e.timeSlotId}`, i);
      pushInto(this.roomGroups, `${e.roomId}_${e.timeSlotId}`, i);

      const u = entryOwnPenalty(e, ctx);
      this.entryOwn[i] = u;
      this.total += u;

      this.applyTeacherDay(e, +1);
    }

    for (const [key, periods] of this.teacherDayPeriods.entries()) {
      const p = teacherDayGapPenalty(periods);
      this.teacherDayPenalty.set(key, p);
      this.total += p;
    }

    this.seedGroupPenalties("t", this.teacherGroups);
    this.seedGroupPenalties("c", this.classGroups);
    this.seedGroupPenalties("r", this.roomGroups);

    for (const [classId, indices] of this.classIndices.entries()) {
      const state = new ClassSoftState(
        this.maxPeriod,
        this.ctx.classStudyDays.get(classId) || [1, 2, 3, 4, 5],
        indices.length,
        parseGrade(this.ctx.classGrades.get(classId)),
      );
      for (const idx of indices) {
        const e = this.schedule[idx];
        const slot = this.ctx.slotMap.get(e.timeSlotId);
        if (!slot) continue;
        state.addLesson(lessonFacts(e, slot, this.ctx));
      }
      state.recomputeAllDays();
      state.refreshTotal();
      this.classState.set(classId, state);
      this.total += state.total;
    }
  }

  /**
   * O'qituvchining (kun, dars raqami) bandligini o'zgartiradi. `withPenalty=true` bo'lsa
   * shu kunning oyna jarimasini ham darhol qayta hisoblab, `total`ni yangilaydi
   * (konstruktorda jarimalar keyin bir marta yig'iladi, shuning uchun u yerda `false`).
   */
  private applyTeacherDay(entry: OptimizerScheduleEntry, delta: 1 | -1, withPenalty = false): void {
    const slot = this.ctx.slotMap.get(entry.timeSlotId);
    if (!slot || slot.periodNumber < 1 || slot.periodNumber > this.maxPeriod) return;
    const key = `${entry.teacherId}_${slot.dayOfWeek}`;
    let periods = this.teacherDayPeriods.get(key);
    if (!periods) this.teacherDayPeriods.set(key, (periods = new Array(this.maxPeriod + 1).fill(0)));

    if (!withPenalty) {
      periods[slot.periodNumber] += delta;
      return;
    }
    this.total -= this.teacherDayPenalty.get(key) ?? 0;
    periods[slot.periodNumber] += delta;
    const p = teacherDayGapPenalty(periods);
    this.teacherDayPenalty.set(key, p);
    this.total += p;
  }

  private seedGroupPenalties(prefix: string, groups: Map<string, number[]>): void {
    for (const [key, idxs] of groups.entries()) {
      const p = groupPairPenalty(this.schedule, idxs);
      this.groupPenalty.set(prefix + key, p);
      this.total += p;
    }
  }

  private updateGroup(
    groups: Map<string, number[]>,
    prefix: string,
    key: string,
    idx: number,
    add: boolean,
  ): void {
    const groupKey = prefix + key;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    this.total -= this.groupPenalty.get(groupKey) ?? 0;
    if (add) {
      arr.push(idx);
    } else {
      const pos = arr.indexOf(idx);
      if (pos >= 0) arr.splice(pos, 1);
    }
    const p = groupPairPenalty(this.schedule, arr);
    this.groupPenalty.set(groupKey, p);
    this.total += p;
  }



  /** Darsni yangi slot/xonaga ko'chiradi va jarimani inkremental yangilaydi. */
  moveEntry(idx: number, newSlotId: number, newRoomId: number): void {
    const e = this.schedule[idx];
    if (e.timeSlotId === newSlotId && e.roomId === newRoomId) return;

    const state = this.classState.get(e.classId);
    const oldSlot = this.ctx.slotMap.get(e.timeSlotId);
    const newSlot = this.ctx.slotMap.get(newSlotId);

    this.updateGroup(this.teacherGroups, "t", `${e.teacherId}_${e.timeSlotId}`, idx, false);
    this.updateGroup(this.classGroups, "c", `${e.classId}_${e.timeSlotId}`, idx, false);
    this.updateGroup(this.roomGroups, "r", `${e.roomId}_${e.timeSlotId}`, idx, false);
    this.total -= this.entryOwn[idx];

    if (state && oldSlot) {
      state.removeLesson(lessonFacts(e, oldSlot, this.ctx));
    }
    this.applyTeacherDay(e, -1, true);

    e.timeSlotId = newSlotId;
    e.roomId = newRoomId;

    this.applyTeacherDay(e, +1, true);

    this.updateGroup(this.teacherGroups, "t", `${e.teacherId}_${newSlotId}`, idx, true);
    this.updateGroup(this.classGroups, "c", `${e.classId}_${newSlotId}`, idx, true);
    this.updateGroup(this.roomGroups, "r", `${newRoomId}_${newSlotId}`, idx, true);

    const u = entryOwnPenalty(e, this.ctx);
    this.entryOwn[idx] = u;
    this.total += u;

    if (state) {
      this.total -= state.total;
      if (newSlot) {
        state.addLesson(lessonFacts(e, newSlot, this.ctx));
      }
      // Faqat tegilgan kunlar qayta hisoblanadi — qolgan kunlar o'zgarmaydi.
      if (oldSlot) state.recomputeDay(oldSlot.dayOfWeek);
      if (newSlot && (!oldSlot || newSlot.dayOfWeek !== oldSlot.dayOfWeek)) state.recomputeDay(newSlot.dayOfWeek);
      state.refreshTotal();
      this.total += state.total;
    }
  }

  /**
   * Berilgan slotda dars uchun bo'sh xona topadi (avval joriy xonani sinaydi).
   * Indeks tufayli butun jadvalni skanerlamaydi.
   */
  findFreeRoom(idx: number, targetSlotId: number): number | null {
    const entry = this.schedule[idx];
    const wt = entry.weekType || "always";

    const occupied = (roomId: number): boolean => {
      const arr = this.roomGroups.get(`${roomId}_${targetSlotId}`);
      if (!arr || arr.length === 0) return false;
      for (const other of arr) {
        if (other === idx) continue;
        if (isWkConflict(wt, this.schedule[other].weekType || "always")) return true;
      }
      return false;
    };

    // 1. Joriy xona bo'sh bo'lsa — tegmaymiz (sababsiz ko'chishning oldini oladi).
    if (!occupied(entry.roomId)) return entry.roomId;

    // 2. Darsning afzal xonasi — o'quvchilar imkon qadar o'z sinfida qolsin.
    const home = preferredRoomOf(entry, this.ctx);
    if (home !== undefined && isRoomAllowed(entry, home) && !occupied(home)) return home;

    // 3. Faqat turi mos keladigan xonalar (roomCandidates). Bu ro'yxat berilgan bo'lsa,
    //    undan tashqariga chiqmaymiz — aks holda kimyo darsi sport zaliga tushib qolardi.
    const candidates = entry.roomCandidates;
    if (candidates && candidates.length > 0) {
      for (const rid of candidates) {
        if (!occupied(rid)) return rid;
      }
      return null;
    }

    for (const r of this.ctx.allRooms) {
      if (!r.isActive) continue;
      if (!occupied(r.id)) return r.id;
    }
    return null;
  }

  /**
   * Darsni afzal xonasiga (fan xonasi yoki sinf uy xonasi) qaytarishga urinadi —
   * slot o'zgarmaydi. Jarima kamaymasa o'zgarish bekor qilinadi. `true` = qaytarildi.
   */
  tryMoveHome(idx: number): boolean {
    const e = this.schedule[idx];
    const home = preferredRoomOf(e, this.ctx);
    if (home === undefined || e.roomId === home || !isRoomAllowed(e, home)) return false;

    const oldRoom = e.roomId;
    const before = this.total;
    this.moveEntry(idx, e.timeSlotId, home);
    if (this.total < before) return true;
    this.moveEntry(idx, e.timeSlotId, oldRoom);
    return false;
  }
}

/**
 * Hill-Climbing Optimallashtirgich
 * Barcha sinflar uchun dars almashtirishlari (Swaps) va ko'chirishlarini (Moves)
 * qat'iy tekshiruvlar va penaltilar kamayishi asosida amalga oshiradi.
 *
 * `async` — chunki har sinf sikli oxirida event loop bo'shatiladi. Bu hisob-kitobni
 * sekinlashtirmaydi, ammo server optimizatsiya davomida ham boshqa so'rovlarga
 * (sahifani yangilash, GET /api/...) javob bera oladi: aks holda butun jadval terish
 * davomida brauzer "internet yo'q"dek muzlab qolardi.
 */
export async function hillClimbOptimize(ctx: HillClimbContext): Promise<{
  improved: boolean;
  initialPenalty: number;
  finalPenalty: number;
  totalSwaps: number;
  totalMoves: number;
  /** Sinfning uy xonasiga qaytarilgan darslar soni. */
  homeRoomFixes: number;
  iterations: number;
  timedOut: boolean;
}> {
  const {
    schedule,
    activeSlots,
    protectedIndices,
    classStudyDays,
    mode = "greedy",
    maxIterations = mode === "annealing" ? 600 : 350,
    deadline,
  } = ctx;

  // Vaqt tugadimi? Har sinf oldidan tekshiriladi — bitta iteratsiya butunlay tugashini
  // kutish uzoq (sekundlar), shuning uchun tekshiruv iteratsiya ichida ham kerak.
  const outOfTime = () => deadline !== undefined && Date.now() >= deadline;

  const slotByDayPeriod = new Map<string, number>();
  let maxPeriod = 1;
  for (const s of activeSlots) {
    slotByDayPeriod.set(`${s.dayOfWeek}_${s.periodNumber}`, s.id);
    if (s.periodNumber > maxPeriod) maxPeriod = s.periodNumber;
  }

  // Inkremental jarima kuzatuvchisi — har sinov ko'chirishida butun jadvalni qayta
  // hisoblamaydi, faqat tegilgan guruh va sinfni yangilaydi.
  const tracker = new PenaltyTracker(schedule, ctx);
  const initialPenalty = tracker.total;
  let currentPenalty = initialPenalty;

  let totalSwaps = 0;
  let totalMoves = 0;
  let homeRoomFixes = 0;

  let temperature = mode === "annealing" ? 150.0 : 0.0;
  const coolingRate = 0.985;

  let globalImproved = false;
  let iteration = 0;
  let timedOut = false;

  /**
   * Slotni o'zgartirmasdan, darslarni sinfning uy xonasiga qaytaradi. Asosiy qidiruv
   * sikli faqat vaqt (slot) bo'yicha ko'chiradi, shuning uchun teruvda begona xonaga
   * tushib qolgan dars o'z-o'zidan qaytmaydi — shu O(N) bosqich uni tuzatadi.
   */
  const repairHomeRooms = (): void => {
    if (!ctx.classHomeRooms || ctx.classHomeRooms.size === 0) return;
    for (let idx = 0; idx < schedule.length; idx++) {
      const e = schedule[idx];
      if (e.isActive === false || protectedIndices.has(idx) || e.jointLessonId) continue;
      if (tracker.tryMoveHome(idx)) {
        homeRoomFixes++;
        globalImproved = true;
      }
    }
    currentPenalty = tracker.total;
  };

  repairHomeRooms();

  // Sinf -> dars indekslari. Dars hech qachon sinfini o'zgartirmaydi, shuning uchun
  // bu indeks bir marta quriladi (ilgari har iteratsiyada qayta qurilardi).
  const classEntriesMap = new Map<number, number[]>();
  for (let i = 0; i < schedule.length; i++) {
    const e = schedule[i];
    if (e.isActive === false) continue;
    pushInto(classEntriesMap, e.classId, i);
  }

  // O'qituvchi -> u dars beradigan sinflar. Bir sinfdagi ko'chirish o'qituvchining
  // bandligini o'zgartiradi, ya'ni uning boshqa sinflari uchun yangi imkoniyat ochiladi.
  const classesByTeacher = new Map<number, Set<number>>();
  for (const e of schedule) {
    if (e.isActive === false) continue;
    let set = classesByTeacher.get(e.teacherId);
    if (!set) classesByTeacher.set(e.teacherId, (set = new Set()));
    set.add(e.classId);
  }

  /**
   * "Iflos" sinflar navbati — qayta ko'rib chiqish kerak bo'lganlari. Sinf bo'yicha
   * to'liq skanerlash yaxshilanish topmasa, u navbatdan chiqadi va faqat o'zi yoki
   * o'qituvchidosh sinfi o'zgargandagina qaytadi.
   *
   * Bu — katta maktablar uchun hal qiluvchi: 44 sinfli maktabda har iteratsiyada
   * hamma sinfni qayta skanerlash 140ms turadi va budjet lokal optimumga yetmasdan
   * tugaydi. Navbat bilan keyingi iteratsiyalar faqat o'zgargan sinflarni ko'radi.
   */
  const dirty = new Set<number>(classEntriesMap.keys());
  const touchTeacher = (teacherId: number): void => {
    const affected = classesByTeacher.get(teacherId);
    if (affected) for (const cid of affected) dirty.add(cid);
  };

  while (iteration < maxIterations && dirty.size > 0) {
    if (outOfTime()) { timedOut = true; break; }
    iteration++;
    let stepImproved = false;

    for (const classId of Array.from(dirty)) {
      if (outOfTime()) { timedOut = true; break; }
      // Har sinfdan keyin event loopni bo'shatamiz (~o'nlab ms) — server javob beruvchi qoladi.
      await new Promise<void>((resolve) => setImmediate(resolve));
      const indices = classEntriesMap.get(classId);
      if (!indices) { dirty.delete(classId); continue; }
      const studyDays = classStudyDays.get(classId) || [1, 2, 3, 4, 5, 6];
      // MUHIM: bayroq sinfga xos. Ilgari u butun iteratsiyaga umumiy edi va birinchi
      // sinf yaxshilanishi bilan qolgan barcha sinflar ko'chirish (relocation) bosqichini
      // butunlay o'tkazib yuborardi.
      let classImproved = false;

      // --- OPERATSIYA 1: PAIRWISE SWAPS (Bir sinf ichida 2 dars o'rnini almashtirish) ---
      for (let i = 0; i < indices.length && !classImproved; i++) {
        const idxA = indices[i];
        if (protectedIndices.has(idxA)) continue;
        const entryA = schedule[idxA];
        if (entryA.jointLessonId) continue; // Skip joint lessons for safety

        for (let j = i + 1; j < indices.length; j++) {
          const idxB = indices[j];
          if (protectedIndices.has(idxB)) continue;
          const entryB = schedule[idxB];
          if (entryB.jointLessonId) continue;
          if (entryA.timeSlotId === entryB.timeSlotId) continue;

          // Dynamic room resolving
          const oldSlotA = entryA.timeSlotId;
          const oldSlotB = entryB.timeSlotId;
          const oldRoomA = entryA.roomId;
          const oldRoomB = entryB.roomId;

          const newRoomA = tracker.findFreeRoom(idxA, oldSlotB);
          const newRoomB = tracker.findFreeRoom(idxB, oldSlotA);

          if (!newRoomA || !newRoomB) continue;

          tracker.moveEntry(idxA, oldSlotB, newRoomA);
          tracker.moveEntry(idxB, oldSlotA, newRoomB);

          const newPenalty = tracker.total;
          const delta = newPenalty - currentPenalty;

          let accept = false;
          if (delta < 0) {
            accept = true;
          } else if (mode === "annealing" && temperature > 0.1) {
            const prob = Math.exp(-delta / temperature);
            if (Math.random() < prob) accept = true;
          }

          if (accept) {
            currentPenalty = newPenalty;
            totalSwaps++;
            classImproved = true;
            stepImproved = true;
            globalImproved = true;
            touchTeacher(entryA.teacherId);
            touchTeacher(entryB.teacherId);
            break;
          } else {
            // Revert swap
            tracker.moveEntry(idxA, oldSlotA, oldRoomA);
            tracker.moveEntry(idxB, oldSlotB, oldRoomB);
          }
        }
      }

      // --- OPERATSIYA 2: SINGLE RELOCATIONS (Bitta darsni boshqa slotga ko'chirish) ---
      for (let i = 0; i < indices.length && !classImproved; i++) {
        const idx = indices[i];
        if (protectedIndices.has(idx)) continue;
        const entry = schedule[idx];
        if (entry.jointLessonId) continue;

        const currentSlotId = entry.timeSlotId;
        const currentRoomId = entry.roomId;

        // Try candidate slots on all study days
        for (const day of studyDays) {
          for (let period = 1; period <= maxPeriod; period++) {
            const targetSlotId = slotByDayPeriod.get(`${day}_${period}`);
            if (!targetSlotId || targetSlotId === currentSlotId) continue;

            const newRoom = tracker.findFreeRoom(idx, targetSlotId);
            if (!newRoom) continue;

            tracker.moveEntry(idx, targetSlotId, newRoom);

            const newPenalty = tracker.total;
            const delta = newPenalty - currentPenalty;

            let accept = false;
            if (delta < 0) {
              accept = true;
            } else if (mode === "annealing" && temperature > 0.1) {
              const prob = Math.exp(-delta / temperature);
              if (Math.random() < prob) accept = true;
            }

            if (accept) {
              currentPenalty = newPenalty;
              totalMoves++;
              classImproved = true;
              stepImproved = true;
              globalImproved = true;
              touchTeacher(entry.teacherId);
              break;
            } else {
              tracker.moveEntry(idx, currentSlotId, currentRoomId);
            }
          }
          if (classImproved) break;
        }
      }

      // Sinf bo'yicha hech narsa topilmadi — o'zi yoki o'qituvchidoshi o'zgarmaguncha
      // uni qaytadan skanerlashning ma'nosi yo'q.
      if (!classImproved) dirty.delete(classId);
    }

    if (timedOut) break;

    if (mode === "annealing") {
      temperature *= coolingRate;
      // Annealing tasodifiy yomonlashtiruvchi qadamlarni ham qabul qiladi, shuning uchun
      // "toza" sinf keyingi haroratda yana foydali bo'lishi mumkin — navbat to'ldiriladi.
      if (temperature > 0.1) for (const cid of classEntriesMap.keys()) dirty.add(cid);
    }

    if (!stepImproved && (mode !== "annealing" || temperature <= 0.1)) {
      break; // Local optimum reached
    }
  }

  // Qidiruv paytida xona band bo'lgani uchun ko'chgan darslarni uyiga qaytaramiz.
  repairHomeRooms();

  return {
    improved: globalImproved,
    initialPenalty,
    finalPenalty: currentPenalty,
    totalSwaps,
    totalMoves,
    homeRoomFixes,
    iterations: iteration,
    timedOut,
  };
}
