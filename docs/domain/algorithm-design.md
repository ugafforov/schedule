# Dars Jadvali Tuzish Algoritmi — Toʻliq Dizayn Hujjati

**Loyiha:** Oʻzbekiston umumtaʼlim maktablari uchun haftalik dars jadvali generatori
**Manba:** SanPiN №0341-16, DTS 2025-2026 (121-son buyruq), I.G.Sivkov shkalasi
**Kodda joylashuvi:** `server/services/schedule.service.ts`, `server/services/schedule-optimizer.ts`
**Yordamchi modullar:** `shared/constants.ts` (murakkablik, SanPiN), `shared/teacher-matching.ts`

---

## 1. MASALA MODELI (CSP formalizatsiyasi)

### 1.1. Oʻzgaruvchilar (Variables)

Har bir **dars talabi** (LessonRequirement) bitta oʻzgaruvchi:

```
Xᵢ = (timeSlotId, roomId)
```

Dars talabi `class_subjects` jadvalidan olinadi:
- `classId` — sinf
- `subjectId` — fan
- `teacherId` — oʻqituvchi (oldindan tayinlangan)
- `weeklyHours` — haftalik soat (masalan 3.5 → 3 ta "always" + 1 ta "surat/mahraj")
- `weekType` — "always" | "surat" | "mahraj"

**Jami oʻzgaruvchilar soni:** Oʻrtacha maktab uchun:
- 30 sinf × oʻrtacha 10 fan × oʻrtacha 3 soat = ~900 dars talabi
- Har biri uchun domen: 30 slot (6 kun × 5 dars) × 15 xona = ~450 variant

### 1.2. Domenlar (Domains)

```
Dᵢ = { (s, r) | s ∈ ActiveSlots, r ∈ SuitableRooms(subjectᵢ) }
```

Qayerda:
- `ActiveSlots` = `time_slots` jadvalidagi `isBreak=false` slotlar
- `SuitableRooms(subject)` = xona turi fanga mos (`requiredRoomType` → `roomType`) VA sig'imi yetarli

### 1.3. Qatʼiy cheklovlar (Hard Constraints) — BUZILISHI MUMKIN EMAS

| # | Cheklov | Formulasi | Kodda |
|---|---------|-----------|-------|
| H1 | Oʻqituvchi ziddiyatsizligi | ∀i≠j: teacherᵢ = teacherⱼ → slotᵢ ≠ slotⱼ (weekType mos kelsa) | `teacherBusy` Set |
| H2 | Sinf ziddiyatsizligi | ∀i≠j: classᵢ = classⱼ → slotᵢ ≠ slotⱼ (weekType mos kelsa) | `classBusy` Set |
| H3 | Xona ziddiyatsizligi | ∀i≠j: roomᵢ = roomⱼ → slotᵢ ≠ slotⱼ (weekType mos kelsa) | `roomBusy` Set |
| H4 | Oʻqituvchi bandligi | teacherᵢ BAND(kun, dars) → slot(kun, dars)ga qoʻyilmaydi | `unavailSet` |
| H5 | Haftalik soat aniqlik | Har fan uchun joylashtirilgan soatlar = weeklyHours | Greedy loop |
| H6 | Xona turi mosligi | subject.requiredRoomType ∈ {"any", room.roomType} | `roomsByType` Map |
| H7 | Kunlik max dars | sinf.grade boʻyicha kunlik dars soni ≤ SanPiN limiti | `getMaxHoursPerDay()` |
| H8 | Oʻquv kunlari | Dars faqat sinf oʻqiydigan kunlarga (studyDays) qoʻyiladi | `classStudyDays` |

**WeekType ziddiyat qoidasi** (H1-H3 uchun):
```
conflict(a, b) = (a="always" ∨ b="always" ∨ a=b)
```
Ya'ni: "surat" va "mahraj" bir-biriga zid KELMAYDI (turli haftalarda).

### 1.4. Yumshoq cheklovlar (Soft Constraints) — Vaznli penalti

| # | Cheklov | Vazn | Formulasi |
|---|---------|------|-----------|
| S1 | Murakkablik-dars joylashuvi (SanPiN) | 10 | "mental" fanlar 5-6-darsda → penalty; "dynamic" fanlar 1-3-darsda → penalty |
| S2 | Kunlik murakkablik chegarasi | 5×oshgan_ball | Σcomplexity(kun) > getMaxDailyComplexity(grade, day) |
| S3 | Bir kunda bir fan takrorlanishi | 30 | Bir fandan 1 kunda > maxSameSubject(=2) dars |
| S4 | Spacing effect (interval taʼlimi) | 15 | Fan ketma-ket kunlarga (Du-Se) qoʻyilsa, kunora (Du-Ch) emas |
| S5 | Kunlik dars soni oshishi | 50 | classDailyCount > maxDaily (SanPiN) |
| S6 | "Oyna" minimizatsiyasi (sinf) | **20** | Sinf jadvalida kun ichida boʻsh slot (gap) |
| S7 | "Oyna" minimizatsiyasi (oʻqituvchi) | **15** | Oʻqituvchi jadvalida kun ichida boʻsh slot (gap) |
| S8 | Oʻqituvchi afzal vaqtlari | **10** | Oʻqituvchining preferred soatlaridan tashqarida |
| S9 | Oʻqituvchi kunlarini toʻplash | **8** | Darslarni imkon qadar kamroq kunga joylash |
| S10 | Xona barqarorligi | 5 | Oʻqituvchi shu kuni boshqa xonada → penalty |
| S11 | Haftalik murakkablik balansi | **12** | Bir kunga ogʻir fanlar toʻplanishi, boshqalari yengil |

> **Qalin** belgilangan (S6-S9, S11) — hozirgi kodda MAVJUD EMAS, qoʻshilishi kerak.

---

## 2. OLDINDAN TEKSHIRUV (Feasibility Pre-Check)

Jadval generatsiyasidan **OLDIN** resurslarga talab sig'ishini tekshirish — sig'masa, generatsiyani boshlamasdan aynan qayerda yetishmaslik borligini xabar berish.

### 2.1. Algoritm

```
FUNCTION feasibilityCheck(classes, classSubjects, teachers, rooms, slots, unavailability):
  errors = []
  warnings = []
  
  // === A. Umumiy slot yetarliligi ===
  FOR EACH class IN classes:
    studyDays = class.studyDays.split(",")
    maxSlotsPerDay = getMaxHoursPerDay(class.grade)
    totalAvailableSlots = |studyDays| × maxSlotsPerDay
    totalRequired = SUM(cs.weeklyHours FOR cs IN classSubjects WHERE cs.classId = class.id)
    
    IF totalRequired > totalAvailableSlots:
      errors.push("❌ {class.name}: {totalRequired} soat kerak, lekin {totalAvailableSlots} slot mavjud")
  
  // === B. Oʻqituvchi yuklamasi yetarliligi ===
  teacherDemand = MAP<teacherId, totalHours>   // barcha class_subjects dan
  FOR EACH teacherId IN teacherDemand:
    teacher = teachers.find(t => t.id == teacherId)
    demand = teacherDemand[teacherId]
    maxCapacity = teacher.maxHoursPerWeek
    unavailCount = |unavailability.filter(u => u.teacherId == teacherId)|
    realCapacity = MIN(maxCapacity, totalActiveSlots - unavailCount)
    
    IF demand > realCapacity:
      errors.push("❌ {teacher.name}: {demand} soat talab, lekin {realCapacity} slot mavjud")
    ELIF demand > realCapacity × 0.85:
      warnings.push("⚠️ {teacher.name}: yuklamasi yuqori ({demand}/{realCapacity})")
  
  // === C. Maxsus xona yetarliligi ===
  FOR EACH roomType IN ["lab", "computer", "gym", "music", "art"]:
    roomCount = |rooms.filter(r => r.roomType == roomType)|
    IF roomCount == 0: CONTINUE
    
    // Bu turdagi xona talab qiladigan barcha darslar
    demandSlots = SUM(cs.weeklyHours 
                      FOR cs IN classSubjects 
                      WHERE subjects[cs.subjectId].requiredRoomType == roomType)
    supplySlots = roomCount × |activeSlotsPerDay| × |studyDays|  // oddiy hisobda
    
    IF demandSlots > supplySlots:
      errors.push("❌ {roomType}: {demandSlots} soat kerak, {roomCount} xona × {slotsPerWeek} = {supplySlots} slot")
    ELIF demandSlots > supplySlots × 0.80:
      warnings.push("⚠️ {roomType} xonasi sig'imi: {demandSlots}/{supplySlots} (80%+)")
  
  // === D. Biriktirilmagan fanlar ===
  unassigned = classSubjects.filter(cs => cs.teacherId == null)
  IF |unassigned| > 0:
    warnings.push("⚠️ {|unassigned|} ta fan-sinf juftligiga oʻqituvchi biriktirilmagan")
  
  RETURN { feasible: errors.length == 0, errors, warnings }
```

### 2.2. Qaytariladigan natija

```typescript
interface FeasibilityResult {
  feasible: boolean;           // qat'iy xatolar yo'q — generatsiya boshlanishi mumkin
  errors: string[];            // qat'iy yetishmasliklar (generatsiya 100% coverage bera olmaydi)
  warnings: string[];          // ehtiyot choralar (coverage past bo'lishi mumkin)
  stats: {
    totalLessons: number;      // jami dars talablari
    totalSlots: number;        // jami mavjud slotlar
    utilizationPercent: number; // slots ishlatilishi foizi (talab/taklif)
  };
}
```

---

## 3. ASOSIY ALGORITM

### 3.1. Umumiy yondashuv: Greedy Constructive + Local Search

**Tanlov asoslash:** Toʻliq CSP backtracking (MRV + forward checking) 900+ oʻzgaruvchi va 450+ domenli masalada oʻrtacha maktab uchun sekundalab ishlaydi, lekin worst-case eksponensial. Greedy heuristik + local search kombinatsiyasi:
- Deterministik va qayta ishlab chiqariladigan (seed-based)
- O(n × m) murakkablik (n=darslar, m=slotlar) — 900 × 180 = ~162,000 operatsiya
- Amalda <500ms (hozirgi implementatsiya 30 sinf uchun ~200ms)
- Qisman yechim berishi mumkin (backtracking esa faqat "yechim bor/yoʻq" deydi)

**3 fazali arxitektura:**

```
┌─────────────────────────────────────────────────────────┐
│  FAZA 0: Feasibility Pre-Check                          │
│  Sig'masa → xato ro'yxati; sig'sa → davom et            │
├─────────────────────────────────────────────────────────┤
│  FAZA 1: Greedy Constructive Heuristic                  │
│  Darslarni tartiblash → har biriga eng kam penaltili     │
│  slotni tanlash → joylash yoki skip                     │
├─────────────────────────────────────────────────────────┤
│  FAZA 2: Local Search / Repair                          │
│  Skip qilingan darslar uchun: blocker ko'chirish,       │
│  "oyna" minimizatsiyasi uchun: swap juftliklarini sinash │
├─────────────────────────────────────────────────────────┤
│  FAZA 3: Post-Validation                                │
│  Barcha H1-H8 qat'iy shartlarni tekshirish              │
│  Sifat metrikalari hisoblash (S1-S11)                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2. FAZA 1 — Greedy Constructive Heuristic

#### 3.2.1. Darslarni tartiblash (Variable Ordering)

Qiyinroq joylashtiradigan darslarni AVVAL joylashtirish — bu domen qisqarishi (slot toʻlib qolishi) muammosini kamaytiradi.

```
FUNCTION sortLessons(lessons):
  FOR EACH lesson:
    lesson.priority = 
      lesson.grade × 10                           // yuqori sinf avval
      + lesson.complexity × 5                      // og'ir fan avval
      + (lesson.isJoint ? 200 : 0)                // joint darslar avval (ko'p cheklov)
      + (lesson.teacherId2 ? 100 : 0)             // split darslar avval
      + (lesson.requiredRoomType != "any" ? 50 : 0) // maxsus xona talab qiluvchilar avval
      + constraintTightness(lesson) × 20           // eng cheklangan avval (MRV heuristika)
  
  SORT lessons BY priority DESC
```

`constraintTightness` — oʻqituvchining nechta sloti band ekaniga qarab (ko'p band = ko'p cheklangan):

```
FUNCTION constraintTightness(lesson):
  totalSlots = |activeSlots.filter(s => studyDays.includes(s.dayOfWeek))|
  unavailSlots = |unavailability.filter(u => u.teacherId == lesson.teacherId)|
  RETURN unavailSlots / totalSlots   // 0.0 — erkin, 1.0 — deyarli toʻliq band
```

#### 3.2.2. Slot tanlash (Value Ordering — eng kam penalti)

Har bir dars uchun barcha mumkin slotlarni koʻrib chiqib, eng kam **jarimali** slotni tanlash:

```
FUNCTION findBestSlot(lesson, state):
  bestSlot = null
  bestRoom = null
  bestPenalty = +∞
  
  FOR EACH slot IN activeSlots:
    // ─── Qatʼiy shartlar filtri (H1-H8) ───
    IF NOT hardConstraintsSatisfied(lesson, slot, state):
      CONTINUE
    
    // ─── Xona tanlash ───
    room = findBestRoom(lesson, slot, state)
    IF room == null: CONTINUE
    
    // ─── Yumshoq shartlar penaltisi (S1-S11) ───
    penalty = computeFullPenalty(lesson, slot, room, state)
    
    IF penalty < bestPenalty:
      bestPenalty = penalty
      bestSlot = slot
      bestRoom = room
    
    IF bestPenalty == 0: BREAK   // mukammal joy topildi
  
  RETURN (bestSlot, bestRoom, bestPenalty)
```

#### 3.2.3. Qatʼiy shartlarni tekshirish

```
FUNCTION hardConstraintsSatisfied(lesson, slot, state):
  day = slot.dayOfWeek
  period = slot.periodNumber
  wt = lesson.weekType
  classIds = lesson.isJoint ? lesson.classIds : [lesson.classId]
  
  // H8: Oʻquv kuni
  FOR EACH cid IN classIds:
    IF day NOT IN getStudyDays(cid): RETURN false
  
  // H2: Sinf band
  FOR EACH cid IN classIds:
    IF isEntityBusy(classBusy, cid, slot.id, wt): RETURN false
  
  // H1: Oʻqituvchi band
  FOR EACH tid IN getAllTeacherIds(lesson):
    IF isEntityBusy(teacherBusy, tid, slot.id, wt): RETURN false
  
  // H4: Oʻqituvchi shaxsiy bandligi
  FOR EACH tid IN getAllTeacherIds(lesson):
    IF unavailSet.has("{tid}_{day}_{period}"): RETURN false
  
  RETURN true
```

#### 3.2.4. Toʻliq penalti hisoblash (S1-S11)

```
FUNCTION computeFullPenalty(lesson, slot, room, state):
  penalty = 0
  day = slot.dayOfWeek
  period = slot.periodNumber
  loadVal = (lesson.weekType == "always") ? 1 : 0.5
  classIds = lesson.isJoint ? lesson.classIds : [lesson.classId]
  
  FOR EACH cid IN classIds:
    // S5: Kunlik dars soni
    dailyCount = state.classDailyCount[cid][day] + loadVal
    IF dailyCount > lesson.maxDaily:
      penalty += 50
    
    // S3: Bir fandan bir kunda koʻp dars
    subjectDaily = state.subjectDailyCount[cid][lesson.subjectId][day] + loadVal
    IF subjectDaily > MAX_SAME_SUBJECT:
      penalty += 30
    
    // S2: Kunlik murakkablik chegarasi (SanPiN)
    newComplexity = state.classDailyComplexity[cid][day] + lesson.complexity × loadVal
    maxComp = getMaxDailyComplexity(lesson.grade, day)
    IF newComplexity > maxComp:
      penalty += (newComplexity - maxComp) × 5
    
    // S4: Spacing effect
    usedDays = state.subjectDaysUsed[cid][lesson.subjectId]
    IF usedDays.has(day-1) OR usedDays.has(day+1):
      penalty += 15
    
    // S6: Sinf "oyna"si (YANGI)
    IF wouldCreateClassGap(cid, day, period, state):
      penalty += 20
    
    // S11: Haftalik murakkablik balansi (YANGI)
    penalty += weeklyBalancePenalty(cid, lesson.complexity, day, state)
  
  // S1: Murakkablik-dars joylashuvi (SanPiN egri chizigʻi)
  IF lesson.category == "dynamic" AND period <= 3:
    penalty += (4 - period) × 10
  IF lesson.category == "mental" AND period >= 5:
    penalty += (period - 4) × 10
  
  // S7: Oʻqituvchi "oyna"si (YANGI)
  IF wouldCreateTeacherGap(lesson.teacherId, day, period, state):
    penalty += 15
  
  // S9: Oʻqituvchi kunlarini toʻplash (YANGI)
  penalty += teacherDaySpreadPenalty(lesson.teacherId, day, state)
  
  // S10: Xona barqarorligi
  preferredRoom = state.teacherDayRoom[lesson.teacherId][day]
  IF preferredRoom != null AND room.id != preferredRoom:
    penalty += 5
  
  RETURN penalty
```

#### 3.2.5. "Oyna" (gap) aniqlash algoritmi

Sinf yoki oʻqituvchi jadvalida kun ichida boʻsh slot mavjudligini aniqlash:

```
FUNCTION wouldCreateClassGap(classId, day, period, state):
  // Shu sinf shu kunda joylashtirilgan darslar period raqamlari
  periods = state.classPeriodsUsed[classId][day]   // Set<number>
  IF periods.size == 0: RETURN false
  
  // Yangi darsni qoʻshgandan keyin barcha periodlarni tekshir
  allPeriods = periods ∪ {period}
  minP = MIN(allPeriods)
  maxP = MAX(allPeriods)
  
  // min va max orasida boʻsh slot bormi?
  FOR p = minP+1 TO maxP-1:
    IF p NOT IN allPeriods: RETURN true   // gap mavjud
  
  RETURN false
```

Oʻqituvchi uchun ham xuddi shunday, faqat `teacherPeriodsUsed[teacherId][day]` bilan.

#### 3.2.6. Haftalik murakkablik balansi (S11)

```
FUNCTION weeklyBalancePenalty(classId, complexity, day, state):
  // Mavjud kunlik murakkablik yigʻindilari
  dailyTotals = [state.classDailyComplexity[classId][d] FOR d IN studyDays]
  currentDayTotal = dailyTotals[day] + complexity
  avgTotal = (SUM(dailyTotals) + complexity) / |studyDays|
  
  // Deviation — oʻrtachadan qanchalik uzoqlashsa, penalty shuncha koʻp
  deviation = |currentDayTotal - avgTotal|
  IF deviation > avgTotal × 0.3:   // 30% dan ortiq farq
    RETURN deviation × 2
  RETURN 0
```

#### 3.2.7. Oʻqituvchi kun toʻplash penaltisi (S9)

```
FUNCTION teacherDaySpreadPenalty(teacherId, day, state):
  // Oʻqituvchi hozir nechta turli kunda dars beradi
  teacherDays = state.teacherActiveDays[teacherId]   // Set<number>
  IF day IN teacherDays:
    RETURN 0   // allaqachon shu kunda darsi bor — yangi kun qoʻshilmaydi
  
  // Yangi kun qoʻshilishi kerak — bu yomon (agar boshqa kunlarda joy bo'lsa)
  totalRemaining = teacherRemainingLessons(teacherId)
  IF totalRemaining <= maxPeriodsPerDay:
    RETURN 8   // bitta kunga sig'adi, lekin ikkinchi kun ochilmoqda
  RETURN 3     // bir nechta kun muqarrar, lekin baribir kichik penalty
```

### 3.3. FAZA 2 — Local Search / Repair

#### 3.3.1. Skip qilingan darslarni joylashtirish (mavjud: retry-with-relaxation)

Hozirgi kodda (`schedule-optimizer.ts`) faqat "oʻqituvchi band" turidagi toʻsiq uchun ishlaydi: blocker darsni boshqa boʻsh slotga koʻchirib, boʻshagan joyga skipped darsni qoʻyish. Bu saqlanadi, ammo kengaytiriladi:

```
FUNCTION repairSkippedLessons(skipped, placed, state):
  FOR EACH skip IN skipped:
    // 1-usul: Blocker ko'chirish (hozirgi — faqat teacherId bo'yicha)
    plan = attemptTeacherRelocation(skip, placed, state)
    IF plan: APPLY(plan); CONTINUE
    
    // 2-usul (YANGI): Xona almashish — xona band, lekin oʻqituvchi boʻsh
    plan = attemptRoomSwap(skip, placed, state)
    IF plan: APPLY(plan); CONTINUE
    
    // 3-usul (YANGI): Zanjirli koʻchirish (depth=2)
    plan = attemptChainRelocation(skip, placed, state, maxDepth=2)
    IF plan: APPLY(plan); CONTINUE
    
    // Yechim topilmadi — skip sifatida qoldiriladi
    reportSkipped(skip)
```

#### 3.3.2. "Oyna" minimizatsiyasi (YANGI — post-construction improvement)

Greedy bosqichdan keyin jadval tayyor boʻlgach, "oyna"larni kamaytirish uchun **juftlik swap**:

```
FUNCTION minimizeGaps(schedule, state, maxIterations=500):
  improved = true
  iteration = 0
  
  WHILE improved AND iteration < maxIterations:
    improved = false
    iteration++
    
    // Barcha sinf-kun juftliklari uchun "oyna" hisoblash
    FOR EACH (classId, day) WHERE hasGap(classId, day, state):
      gapPeriod = findGapPeriod(classId, day, state)
      
      // Shu sinf boshqa kundan darsni shu "oyna"ga koʻchirishga harakat
      FOR EACH otherDay IN studyDays WHERE otherDay != day:
        lastPeriod = getLastPeriod(classId, otherDay, state)
        IF lastPeriod == null: CONTINUE
        
        entry = getEntryAt(classId, otherDay, lastPeriod, state)
        IF canMoveTo(entry, day, gapPeriod, state):  // H1-H8 tekshir
          moveTo(entry, day, gapPeriod, state)
          improved = true
          BREAK
```

### 3.4. FAZA 3 — Post-Validation

Tayyor jadvalning barcha qatʼiy shartlarga mos kelishini mustaqil tekshirish (solver xatosini ushlab qolish uchun):

```
FUNCTION validateSchedule(entries, state):
  violations = []
  
  // H1: Oʻqituvchi ziddiyatlari
  teacherSlots = GROUP entries BY (teacherId, timeSlotId)
  FOR EACH group WHERE conflictingWeekTypes(group):
    violations.push({type: "teacher_clash", severity: "critical", ...})
  
  // H2: Sinf ziddiyatlari
  classSlots = GROUP entries BY (classId, timeSlotId)
  FOR EACH group WHERE conflictingWeekTypes(group):
    violations.push({type: "class_clash", severity: "critical", ...})
  
  // H3: Xona ziddiyatlari
  roomSlots = GROUP entries BY (roomId, timeSlotId)
  FOR EACH group WHERE conflictingWeekTypes(group):
    violations.push({type: "room_clash", severity: "critical", ...})
  
  // H5: Haftalik soat toʻliqligi
  FOR EACH classSubject:
    placed = countPlacedHours(classSubject)
    IF placed != classSubject.weeklyHours:
      violations.push({type: "hours_mismatch", severity: "high",
        detail: "{fan}: {placed}/{classSubject.weeklyHours} soat"})
  
  // H4: Oʻqituvchi bandlik
  FOR EACH entry:
    IF unavailSet.has("{entry.teacherId}_{slot.day}_{slot.period}"):
      violations.push({type: "unavail_violation", severity: "critical", ...})
  
  RETURN violations
```

---

## 4. KONFLIKT / SIGʻMASA BOSHQARISH MANTIQI

### 4.1. Bosqichma-bosqich chekinish tartibi (Relaxation Strategy)

Agar toʻliq jadval sig'masa, quyidagi tartibda yumshoq shartlar chekintiriladi (eng past vaznlisidan boshlab):

```
Chekinish darajasi 1 (penalty → 0):
  S10: Xona barqarorligi         (vazn 5 → 0)
  S9:  Oʻqituvchi kun toʻplash    (vazn 8 → 0)

Chekinish darajasi 2:
  S8:  Afzal vaqtlar              (vazn 10 → 0)
  S4:  Spacing effect             (vazn 15 → 0)

Chekinish darajasi 3:
  S6:  Sinf "oyna"lari            (vazn 20 → 0)
  S7:  Oʻqituvchi "oyna"lari      (vazn 15 → 0)
  S11: Haftalik balans             (vazn 12 → 0)

Chekinish darajasi 4:
  S1:  Murakkablik joylashuvi      (vazn 10 → 0)
  S3:  Bir fan takrorlanishi       (vazn 30 → 0)

HECH QACHON chekintirilmaydi:
  H1-H8 (qatʼiy shartlar)
  S2, S5 (SanPiN kunlik limitlari — qonunga asoslangan)
```

### 4.2. Sig'maslik xabari formati

```typescript
interface InfeasibilityReport {
  type: "resource_shortage" | "teacher_overload" | "room_shortage";
  entity: string;         // "Informatika xonasi" | "Karimova N." | "5-A sinf"
  demand: number;         // talab qilingan soat
  supply: number;         // mavjud slot
  gap: number;            // yetishmayotgan soat
  suggestions: string[];  // masalan: ["Qo'shimcha informatika xonasi ajrating",
                          //           "Informatika soatini 3→2 ga kamaytiring"]
}
```

### 4.3. Qisman yechim

Toʻliq sig'masa ham, sig'gan qismini berish va qolgan konfliktlar roʻyxatini alohida chiqarish:

```
FUNCTION generateWithPartialResult(options):
  feasibility = feasibilityCheck(...)
  IF NOT feasibility.feasible:
    // BARIBIR generatsiya qilish — lekin foydalanuvchiga ogohlantirish
    result = generateSchedule(options)
    result.feasibilityErrors = feasibility.errors
    result.feasibilityWarnings = feasibility.warnings
    RETURN result
```

---

## 5. SIFAT OʻLCHASH MEZONLARI

### 5.1. Asosiy metrikalar

```typescript
interface ScheduleQuality {
  // Qoplanish
  coverage: number;              // joylashtirilgan / jami × 100%
  skippedCount: number;          // joylashtirilmagan darslar soni
  
  // Qatʼiy shartlar
  hardViolations: number;        // 0 boʻlishi SHART (aks holda jadval yaroqsiz)
  
  // Yumshoq shartlar — har biri uchun buzilishlar soni
  softViolations: {
    complexityPlacement: number;  // S1: noto'g'ri vaqtga qoʻyilgan fanlar
    dailyOverload: number;        // S2+S5: SanPiN oshirishlari
    sameSubjectDaily: number;     // S3: bir kunda bir fan takrorlanishi
    spacingViolation: number;     // S4: ketma-ket kunlarga qoʻyilgan fanlar
    classGaps: number;            // S6: sinf "oyna"lari jami
    teacherGaps: number;          // S7: oʻqituvchi "oyna"lari jami
    preferenceViolation: number;  // S8: afzal vaqtdan tashqari
    teacherDaySpread: number;     // S9: oʻqituvchi kunlari soni
    roomInstability: number;      // S10: xona oʻzgarishlari
    weeklyImbalance: number;      // S11: haftalik murakkablik farqi
  };
  
  // Umumiy ball (100 = mukammal)
  totalScore: number;
  
  // Hisoblash vaqti
  timeMs: number;
}
```

### 5.2. Umumiy ball hisoblash

```
totalScore = 100 
  - (skippedCount × 10)                         // har bir skip = -10
  - (hardViolations × 50)                        // har bir qat'iy buzilish = -50
  - (classGaps × 2)                              // har bir oyna = -2
  - (teacherGaps × 1)                            // har bir o'qituvchi oynasi = -1
  - (complexityPlacement × 1.5)                  // har bir noto'g'ri joy = -1.5
  - (spacingViolation × 1)                       // har bir spacing buzilish = -1
  - (weeklyImbalance × 0.5)                      // har bir balans buzilish = -0.5
  
  // 0 dan past boʻlmasin
  totalScore = MAX(0, totalScore)
```

### 5.3. Hisobot namunasi

```
╔══════════════════════════════════════════════════════╗
║  JADVAL SIFATI HISOBOTI                              ║
╠══════════════════════════════════════════════════════╣
║  Qoplanish:    892/900 dars (99.1%)                  ║
║  Skip:         8 ta dars                             ║
║  Qatʼiy:       0 buzilish ✅                         ║
║  Umumiy ball:  74/100                                ║
╠──────────────────────────────────────────────────────╣
║  YUMSHOQ SHARTLAR TAFSILOTI                          ║
║  S1 Murakkablik joylashuvi:  12 buzilish (-18)       ║
║  S4 Spacing effect:          23 buzilish (-23)       ║
║  S6 Sinf "oyna"lari:        15 ta  (-30)             ║
║  S7 Oʻqituvchi "oyna"lari:   8 ta  (-8)              ║
║  S11 Haftalik balans:         5 buzilish (-2.5)      ║
╠──────────────────────────────────────────────────────╣
║  JOYLASHTIRILMAGAN DARSLAR                           ║
║  5-A  | Informatika | Barcha comp. xonalar band      ║
║  7-B  | Fizika      | O'qituvchi barcha slotda band   ║
║  ...                                                 ║
╚══════════════════════════════════════════════════════╝
```

---

## 6. YAKUNIY JADVAL NAMUNASI

### 6.1. Sinf jadvali (5-A sinf × hafta matritsasi)

```
           │ Dushanba     │ Seshanba     │ Chorshanba   │ Payshanba    │ Juma         │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 1-dars    │ Ona tili     │ Matematika   │ Ingliz tili  │ Ona tili     │ Tarix        │
 08:00     │ Karimova N.  │ Aliyev R.    │ Smith J.     │ Karimova N.  │ Yusupov T.   │
           │ [204-xona]   │ [205-xona]   │ [301-xona]   │ [204-xona]   │ [204-xona]   │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 2-dars    │ Matematika   │ Fizika       │ Matematika   │ Kimyo        │ Ona tili     │
 09:00     │ Aliyev R.    │ Toshev B.    │ Aliyev R.    │ Abdullayev S.│ Karimova N.  │
           │ [205-xona]   │ [Lab-1]      │ [205-xona]   │ [Lab-2]      │ [204-xona]   │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 3-dars    │ Ingliz tili  │ Ona tili     │ Fizika       │ Matematika   │ Geografiya   │
 10:00     │ Smith J.     │ Karimova N.  │ Toshev B.    │ Aliyev R.    │ Rajabova M.  │
           │ [301-xona]   │ [204-xona]   │ [Lab-1]      │ [205-xona]   │ [204-xona]   │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 TUSHLIK   │ 10:45-11:10  │ 10:45-11:10  │ 10:45-11:10  │ 10:45-11:10  │ 10:45-11:10  │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 4-dars    │ Biologiya    │ Rus tili     │ Tarix        │ Ingliz tili  │ Jism. tarb.  │
 11:10     │ Nazarov K.   │ Petrova A.   │ Yusupov T.   │ Smith J.     │ Qodirov I.   │
           │ [204-xona]   │ [302-xona]   │ [204-xona]   │ [301-xona]   │ [Sport zal]  │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 5-dars    │ Tarbiya      │ Informatika  │ Jism. tarb.  │ Tasviriy s.  │ Musiqa       │
 12:05     │ Karimova N.  │ Axmedov D.   │ Qodirov I.   │ Sobirova L.  │ Umarova G.   │
           │ [204-xona]   │ [Comp-1]     │ [Sport zal]  │ [Art-1]      │ [Musiqa x.]  │
───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
 6-dars    │              │ Texnologiya  │              │ Geografiya   │              │
 13:00     │              │ Rahimov F.   │              │ Rajabova M.  │              │
           │              │ [204-xona]   │              │ [204-xona]   │              │
```

**Namunani tahlil qilish:**
- Ogʻir fanlar (Matematika=11, Ona tili=10, Fizika=9) 1-3 darslarda → S1 ✅
- Yengil fanlar (Jism. tarb.=5, Musiqa=1, Tasviriy s.=2) 4-5 darslarda → S1 ✅
- Matematika: Du, Ch, Pa — kunora → S4 ✅
- Seshanba (ish qobiliyati eng yuqori kun) eng koʻp dars (6 ta) → SanPiN ✅
- "Oyna" yoʻq — barcha darslar ketma-ket → S6 ✅
- Karimova N. (sinf rahbar) koʻp kuni bitta xonada (204) → S10 ✅

---

## 7. MURAKKABLIK VA MASSHTABLANISH

### 7.1. Vaqt murakkabligi

| Komponent | Murakkablik | Oʻrtacha maktab (900 dars, 180 slot, 15 xona) |
|-----------|------------|-----------------------------------------------|
| Feasibility pre-check | O(C + T + R) | ~100 operatsiya |
| Greedy (Faza 1) | O(L × S × R) | 900 × 180 × 15 = 2.4M |
| Local search repair | O(K × S²) | 50 × 180² = 1.6M |
| Gap minimization | O(I × C × D²) | 500 × 30 × 25 = 375K |
| Post-validation | O(E²) eng yomon | Amalda O(E) (hash-based) |
| **JAMI** | | **~5M operatsiya ≈ 300-800ms** |

### 7.2. Xotira

- Busy setlar: O(T×S + C×S + R×S) = ~50KB
- Daily counters: O(C×D) = ~1KB
- **Jami:** <1MB — xotira cheklovi yoʻq

### 7.3. Katta maktablar uchun (60+ sinf)

Agar greedy + local search yetarli sifat bermasa, ikki yoʻl:
1. **Parallel greedy:** Sinflarni guruhlarga boʻlib (1-4, 5-9, 10-11), parallel generatsiya qilish — oʻqituvchi/xona busy holatini shared qilish
2. **Simulated annealing:** Greedy natijasini boshlangʻich yechim sifatida olib, SA bilan yaxshilash (temperature cooling, neighbor = swap ikki darsning slotlarini) — bu roadmap uchun

---

## 8. OʻZBEKISTON NORMATIVLARI — RAQAMLAR

### 8.1. Sivkov murakkablik shkalasi (SanPiN №0341-16 adaptatsiyasi)

Tizimda (`shared/constants.ts:58-98`) qoʻllanilmoqda:

| Ball | Fanlar |
|------|--------|
| 11 | Matematika, Algebra, Geometriya, Informatika |
| 10 | Ona tili, Adabiyot, Ingliz/Rus/Nemis/Fransuz tili |
| 9 | Fizika, Kimyo, Astronomiya |
| 8 | Tarix, Huquq, Iqtisod |
| 7 | Tabiiy fanlar, Geografiya, Biologiya |
| 6 | Tarbiya, Sinf soati |
| 5 | Jismoniy tarbiya, ChQBT |
| 4 | Texnologiya |
| 3 | Chizmachilik |
| 2 | Tasviriy sanʼat |
| 1 | Musiqa |

> **Eslatma:** Bu ballar I.G.Sivkovning post-sovet mamlakatlarida keng qoʻllaniladigan shkalasiga asoslangan. Oʻzbekiston Respublikasining rasmiy SanPiN №0341-16 hujjatida aynan shu raqamlar keltirilganini **mustaqil tasdiqlab boʻlmadi** (hujjat ochiq raqamli shaklda internetda mavjud emas). Agar rasmiy raqamlar farq qilsa, `shared/constants.ts:SUBJECT_METADATA` ni yangilang.

### 8.2. Kunlik yuklamalar

| Sinf darajasi | Maks dars/kun | SanPiN manbasi |
|--------------|--------------|----------------|
| 1-2 sinf | 5 | SanPiN №0341-16 |
| 3-4 sinf | 5 | SanPiN №0341-16 |
| 5-7 sinf | 7 | SanPiN №0341-16 |
| 8-11 sinf | 7 | SanPiN №0341-16 |

### 8.3. Haftalik ish qobiliyati egri chizigʻi

Tizimda (`shared/constants.ts:138-148`) qoʻllanilmoqda:

| Kun | Multiplikator | Sabab |
|-----|--------------|-------|
| Dushanba (1) | 0.8 | Haftaning boshlanishi — adaptatsiya |
| **Seshanba (2)** | **1.2** | **Eng yuqori ish qobiliyati** |
| **Chorshanba (3)** | **1.2** | **Eng yuqori ish qobiliyati** |
| Payshanba (4) | 1.0 | Oʻrtacha |
| Juma (5) | 0.8 | Charchoq toʻplanishi |
| Shanba (6) | 0.7 | Minimal yuklamali |

---

## 9. IMPLEMENTATSIYA XARITASI (mavjud kodga nisbatan)

### 9.1. MAVJUD va toʻgʻri ishlayotgan qismlar

| Komponent | Fayl | Holati |
|-----------|------|--------|
| Greedy heuristik (H1-H8, S1-S5) | `schedule.service.ts` | ✅ Ishlaydi |
| WeekType (surat/mahraj) qoʻllab-quvvatlash | `schedule.service.ts:357-386` | ✅ Ishlaydi |
| Joint lesson generatsiyasi | `schedule.service.ts:477-710` | ✅ Ishlaydi |
| Retry-with-relocation (Faza 2) | `schedule-optimizer.ts` | ✅ Ishlaydi |
| SanPiN murakkablik bali | `constants.ts:58-98` | ✅ Ishlaydi |
| SanPiN kunlik limit | `constants.ts:123-130` | ✅ Ishlaydi |
| SanPiN kun multiplikatori | `constants.ts:138-148` | ✅ Ishlaydi |
| Xona barqarorligi (S10) | `schedule.service.ts:614` | ✅ Ishlaydi |
| Spacing effect (S4) | `schedule.service.ts:121-125` | ✅ Ishlaydi |
| DB-darajasida validatsiya | `check_schedule_conflicts()` | ⚠️ Joint lesson bug |

### 9.2. QOʻSHILISHI KERAK boʻlgan qismlar

| Komponent | Pseudocode boʻlimi | Muhimligi |
|-----------|---------------------|-----------|
| **Feasibility pre-check** | §2 | Yuqori |
| **S6: Sinf "oyna" penaltisi** | §3.2.5 | Yuqori |
| **S7: Oʻqituvchi "oyna" penaltisi** | §3.2.5 | Yuqori |
| **S11: Haftalik balans penaltisi** | §3.2.6 | Oʻrta |
| **S9: Oʻqituvchi kun toʻplash** | §3.2.7 | Past |
| **Gap minimization (Faza 2.2)** | §3.3.2 | Oʻrta |
| **Post-validation (Faza 3)** | §3.4 | Yuqori |
| **Sifat hisoboti** | §5 | Oʻrta |
| **Relaxation bosqichlari** | §4.1 | Past |
| **Dars tartiblash yaxshilash** | §3.2.1 | Oʻrta |

### 9.3. TUZATILISHI KERAK boʻlgan xato

**Migration 0005 regressiyasi:** `check_schedule_conflicts()` funksiyasi `joint_lesson_id` filtrini yo'qotgan (migration 0002da qoʻshilgan, 0005da tushib qolgan). Natijada bitta birlashtirilgan dars doirasidagi bir vaqtdagi yozuvlar (turli guruhlar, turli oʻqituvchi/xona) soxta teacher/room/class konflikt sifatida belgilanadi.

**Tuzatish:** `migrations/0005_scope_conflict_detection.sql` dagi har uch blokka quyidagi shartni qaytarish:
```sql
AND (se1.joint_lesson_id IS NULL OR se2.joint_lesson_id IS NULL 
     OR se1.joint_lesson_id != se2.joint_lesson_id)
```

---

**Hujjat yaratilgan sana:** 2026-07-07
**Asoslangan kodlar:** `schedule.service.ts` (949 qator), `schedule-optimizer.ts` (145 qator), `constants.ts` (167 qator)
