# Dars jadvali tuzish qoidalari (domen bilimi)

Bu hujjat jadval tuzish algoritmi va UI qarorlariga asos boʻladigan pedagogik, fiziologik va huquqiy qoidalarni jamlaydi. Manbalar: DTS 2025-2026 (121-son buyruq, 10.04.2025), SanPiN №0341-16, UNESCO GEM Report, xalqaro tajriba (Finlandiya, Singapur, AQSh).

Kodda qoʻllanish joylari:
- Fan murakkabligi/kategoriya, SanPiN limitlari: `shared/constants.ts`
- Oʻquv reja soatlari: `shared/curriculum.ts`, `shared/dts-curriculum.ts`
- Solver: `server/services/schedule.service.ts`

---

## 1. Qatʼiy cheklovlar (Hard Constraints)

Tizim tomonidan buzilishi mumkin boʻlmagan qoidalar:

- **Ziddiyatlarning yoʻqligi (Clash-Free):** bir vaqtda bitta oʻqituvchi, bitta sinf yoki bitta xona ikki joyda boʻlolmaydi.
- **Mehnat shartnomasi meʼyorlari:** oʻqituvchining haftalik maksimal yuklamasi (stavkasi) va metodik kunlari qatʼiy saqlanadi.
- **SanPiN kunlik dars limiti:** `getMaxHoursPerDay` (1-4 sinf — 5, 5-11 sinf — 7) qatʼiy shart: limit toʻlgan kunga dars qoʻyilmaydi (post-processing/gap optimizatsiyasi ham buni buzolmaydi).
- **Sinf soati (Kelajak soati):** har bir sinfda haftasiga 1 soat, faqat sinf rahbari oʻtadi, `classHourSlot` sozlamasidagi vaqtga (default: dushanba 1-dars) mahkamlanadi (pinned) va hech qanday optimizatsiya uni koʻchira olmaydi. **Sinfning oʻquv soatiga ham, oʻqituvchining dars yuklamasiga ham hisoblanmaydi** (`isClassHourSubject`, `shared/constants.ts`). "Tarbiya" — alohida oddiy DTS fani, sinf soati EMAS.

**Murosa qilinadigan (soft) resurs cheklovlari** — dars yoʻqolmasligi uchun:
- **Xona turi va sigʻimi:** laboratoriya/sport zali/kompyuter xonasi afzal koʻriladi, ammo boʻsh yoki sigʻimi yetarli xona topilmasa dars tashlab ketilmaydi — boshqa xonaga qoʻyiladi va sabab `room_capacity` / `room_type` ziddiyati sifatida qayd etiladi (masalan: yagona laboratoriya sigʻimi 24, sinfda 25 oʻquvchi).

## 2. Pedagogik va fiziologik tavsiyalar

### A. Kognitiv yuklamani boshqarish (Circadian Rhythms)
- **Ertalabki ustuvorlik:** miya eng faol vaqtda (2, 3, 4-soatlar) "ogʻir" fanlar (Matematika, Fizika, Chet tili).
- **Tushdan keyin:** energiya pasayganda (5-soatdan keyin) amaliy/ijodiy fanlar (Jismoniy tarbiya, Musiqa, Sanʼat).
- **Fanlar almashinuvi:** ketma-ket ikkita aqliy zoʻriqishli fandan soʻng bitta "yengil"/dinamik fan.

### B. "Spacing Effect" (interval taʼlimi)
- Haftasiga 3 soatlik fan ketma-ket kunlarga emas (Du-Se-Ch), kunora (Du-Ch-Ju) qoʻyiladi — xotirada saqlash ~25% yaxshilanadi.
- **Juft darslar (double periods):** bir kunda bir fandan bitta dars. Ikkinchisi faqat fanning haftalik soati oʻquv kunlaridan koʻp boʻlgandagina (masalan 6 soatlik matematika 5 kunlik haftada) — tafsilot §3.1 da.

## 3. Yumshoq cheklovlar (Soft Constraints)
- **Zichlik (Compactness):** oʻquvchi va oʻqituvchi jadvalida kun oʻrtasida "oʻlik soat"lar (windows) boʻlmasin.
- **Xona barqarorligi:** oʻqituvchi imkon qadar bitta xonada qolsin, sinflar koʻchishi kamaytirilsin.
- **Kafedra hamkorligi:** bir kafedra oʻqituvchilariga haftada kamida bir marta bir vaqtda boʻsh soat.

## 3.1. Jarima ierarxiyasi (optimizator qanday qaror qabul qiladi)

Qoidalar bir-biriga zid kelganda tanlovni **jarima og'irligi** hal qiladi. Og'irliklar
`server/services/schedule-hill-climber.ts` boshida konstanta sifatida turadi. Tartib
buzilsa algoritm arifmetik jihatdan to'g'ri, ammo amalda yaroqsiz qaror qabul qiladi —
shuning uchun yangi jarima qo'shganda uni shu jadvalga joylashtiring.

| Jarima | Qiymat | Nima uchun shu o'rinda |
|---|---|---|
| Qat'iy to'qnashuv (sinf/o'qituvchi/xona bir vaqtda ikki darsda) | 100 000 | Jadvalni butunlay yaroqsiz qiladi — hamma narsadan ustun |
| O'qituvchi band vaqtiga qo'yilgan dars | 100 000 | Qat'iy shart |
| Jadvalga umuman tushmagan dars (nomzod tanlashda) | 50 000 | Qoplama — birinchi darajali sifat ko'rsatkichi |
| SanPiN kunlik dars soni chegarasidan oshish | 20 000 × ortiqcha | Qat'iy norma, lekin o'quv reja sig'masa jadval buzilmasin |
| Sinf oynasi (kun o'rtasida bo'sh soat) | 6 000 | O'quvchi maktabda bekor o'tiradi |
| Dars 1-soatdan kech boshlanishi | 5 000 | Xuddi shu sabab |
| Bir kunda bir fan takrori (limitdan ortiq) | 3 000 | Pedagogik zarar; o'qituvchi qulayligidan ustun |
| Kech tugash (6-darsdan keyin) | 2 000 / 200 | Kunlar notekis bo'lsa jarima 10 barobar og'ir |
| O'qituvchi oynasi | 1 200 | Amaldagi eng ko'p shikoyat, ammo yuqoridagilardan past |
| Uy xonasidan tashqarida o'tish | 1 000 | Butun sinf ko'chadi — spacing'dan ustun (avval 300 edi) |
| Fan ketma-ket kunlarda (oldini olish mumkin bo'lgani) | 800 | Spacing effect; takrordan (3 000) past bo'lishi shart |
| Og'ir fan (murakkablik ≥ 9) kunning oxirgi darsida | 400 | Charchagan paytdagi eng qiyin dars |
| SanPiN kunlik aqliy zo'riqish chegarasidan oshish | 200 × ortiqcha birlik | Odatda kuniga 1 000-3 000 ball |
| Kunlik yuklama nomutanosibligi | ~120 × farq² | Eng yumshoq — qolganlarini siqib chiqarmasligi kerak |

**Juft dars (bir kunda bir fandan 2 ta) qoidasi** — `sameSubjectDayLimit`: bir kunda bitta
fan bir marta. Ikkinchisi faqat MAJBURIY bo'lganda, ya'ni fanning haftalik soati o'quv
kunlaridan ko'p bo'lsa (6 soatlik matematika 5 kunlik haftada) ruxsat etiladi. Avvalgi
"laboratoriya fani = 2 tagacha" qoidasi olib tashlandi: u 2 soatlik fizikaning ikkala
soatini bir kunga qo'yishga yo'l qo'yardi. **Dastlabki joylashtirish
(`schedule.service.ts` — `maxSameSubject`) va hill-climber shu bitta qoidani ishlatishi
shart**, aks holda ikki bosqich bir-birining ishini buzadi.

**Spacing jarimasi muqarrar qo'shnilikni jazolamaydi:** `S` kunlik haftaga `k` kun
joylashtirilganda qo'shni juftliklarning minimal soni `max(0, 2k - S - 1)` va shu miqdor
jarimadan chegiriladi. Aks holda 5 kunlik haftadagi 5 soatlik matematika doimiy jarima
olardi va optimizator undan qutulish uchun darslarni bir kunga to'plashga urinardi.

**Kunlik zo'riqish jarimasi chiziqli, kvadratik emas.** Kvadratik variant (`ortiqcha² × 40`)
nazariy jihatdan yaxshiroq — DTS rejasi SanPiN byudjetidan og'ir bo'lgan sinflarda (2-4,
7-9 — 11-17% ortiq) chiziqli had tekislash uchun yo'nalish bermaydi. Ammo o'lchov teskarisini
ko'rsatdi: og'ir kunlar shu qadar qimmatlashadiki, qidiruv spacing va oynani sotib yuboradi
(spacing ortiqchasi 17 → 36, sinf oynasi 0 → 1, ball 88 → 85).

**Vaqt budjeti** maktab kattaligiga qarab hisoblanadi (`resolveTimeBudgetMs`): 50 ms × dars
soni, 25 s dan 120 s gacha. `SCHEDULE_TIME_BUDGET_MS` muhit o'zgaruvchisi bilan bekor
qilinadi. Budjet — yuqori chegara: qidiruv lokal optimumga yetsa o'zi to'xtaydi.

**Miqyos kafolati:** `server/services/schedule-scale.test.ts` 22 sinfli sintetik maktabda
qoplama 100%, qat'iy to'qnashuv 0, sinf oynasi 0 ekanini tekshiradi. Kattaroq o'lchamni
sinash uchun `buildSyntheticSchool({ parallelsPerGrade: 8 })` (88 sinf) ishlatiladi.

## 4. Tanaffuslar standarti
- Kichik tanaffus: kamida 10 daqiqa.
- Katta (tushlik) tanaffus: 2- yoki 3-darsdan keyin 20-30 daqiqa.

## 5. Maktab tuzilmasi va dars strukturasi (DTS 2025-2026)

- **Boshlangʻich:** 1-4 sinf (7-10 yosh) · **Asosiy:** 5-9 sinf (11-15 yosh) · **Yuqori:** 10-11 sinf (16-18 yosh). Jami 11 yillik majburiy taʼlim.
- Dars davomiyligi: 45 daqiqa. Boshlanish: 08:00 yoki 09:00.
- Kunlik dars soni: 1-4 sinf — 4-5; 5-9 sinf — 5-6; 10-11 sinf — 6-7.
- Oʻqituvchi haftalik yuklamasi: 18-24 dars; bir kunda maksimal 6-7 dars.

### Fanlar boʻyicha
- **1-4 sinf majburiy:** Ona tili, Matematika, Oʻqish savodxonligi (1-2), Tarbiya, Jismoniy tarbiya, Tasviriy sanʼat, Musiqa madaniyati. Bularga qoʻshimcha — Kelajak soati (sinf soati, oʻquv soatiga kirmaydi).
- **Boshlangʻich sinf oʻqituvchisi cheklovi:** gradeLevel="primary" oʻqituvchilar faqat `PRIMARY_TEACHER_ALLOWED_SUBJECTS` (`shared/constants.ts`) fanlariga va faqat oʻz sinfiga biriktiriladi. Rus tili, Ingliz tili, Musiqa, Jismoniy tarbiya — maxsus oʻqituvchilar.
- **5-9 sinf:** Ona tili, Matematika, tabiiy fanlar (Fizika, Kimyo, Biologiya, Geografiya), chet tillari, tarix/ijtimoiy fanlar, Jismoniy tarbiya, sanʼat fanlari, Informatika/Texnologiya.
- **10-11 sinf:** Matematika (Algebra, Geometriya), tabiiy fanlar, chet tillari, tarix/ijtimoiy, Jismoniy tarbiya, ixtiyoriy fanlar.
- Jismoniy tarbiya: haftada 2-3 dars. Musiqa/Tasviriy sanʼat: 1-2 dars. Informatika: 5-11 sinf. Chet tillari: 2-11 sinf majburiy.

## 6. Avtomatik taqsimlash tartibi
1. Asosiy darslar (Ona tili, Matematika) — ertalab.
2. Tabiiy fanlar — oʻrtada.
3. Jismoniy tarbiya, Musiqa, Sanʼat — oxirida.
4. Chet tillari — ertalab yoki oʻrtada.
5. Tanaffuslar — muntazam.

## 7. Zamonaviy tizim imkoniyatlari (roadmap gʻoyalari)
1. **Optimallashtiruvchi algoritm:** minglab variantdan eng kam "penalti" olganini tanlash.
2. **Gibrid boshqaruv:** avtomatik jadvalni drag-and-drop bilan oʻzgartirish, real vaqtda ziddiyat koʻrsatish.
3. **Mobil xabarnomalar:** jadval oʻzgarganda bildirishnoma.
4. **Oʻqituvchi kabineti:** metodik kunlar va cheklovlarni (unavailability) oʻzi kiritishi.
5. **Simulyatsiya:** "oʻqituvchi kasal boʻlsa jadval qanday oʻzgaradi?" — vaqtinchalik almashtirish.

---

**Manbalar:**
- [UNESCO Global Education Monitoring Report 2026 — Uzbekistan](https://www.unesco.org/gem-report/en/2026-gem-report-country-case-studies/uzbekistan)
- Oʻzbekiston Respublikasi Maktabgacha va maktab taʼlimi vazirligi, DTS 2025-2026
- SanPiN №0341-16 gigiyenik meʼyorlari
