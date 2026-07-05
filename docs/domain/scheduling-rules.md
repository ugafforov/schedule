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
- **Resurslar mavjudligi:** laboratoriya (Kimyo, Fizika), sport zali va kompyuter xonalari faqat oʻz ixtisosligidagi fanlar uchun va boʻsh vaqtida taqsimlanadi.
- **Mehnat shartnomasi meʼyorlari:** oʻqituvchining haftalik maksimal yuklamasi (stavkasi) va metodik kunlari qatʼiy saqlanadi.
- **Sinf sigʻimi:** xonadagi oʻquvchilar soni uning fizik sigʻimidan oshmaydi.

## 2. Pedagogik va fiziologik tavsiyalar

### A. Kognitiv yuklamani boshqarish (Circadian Rhythms)
- **Ertalabki ustuvorlik:** miya eng faol vaqtda (2, 3, 4-soatlar) "ogʻir" fanlar (Matematika, Fizika, Chet tili).
- **Tushdan keyin:** energiya pasayganda (5-soatdan keyin) amaliy/ijodiy fanlar (Jismoniy tarbiya, Musiqa, Sanʼat).
- **Fanlar almashinuvi:** ketma-ket ikkita aqliy zoʻriqishli fandan soʻng bitta "yengil"/dinamik fan.

### B. "Spacing Effect" (interval taʼlimi)
- Haftasiga 3 soatlik fan ketma-ket kunlarga emas (Du-Se-Ch), kunora (Du-Ch-Ju) qoʻyiladi — xotirada saqlash ~25% yaxshilanadi.
- **Juft darslar (double periods):** boshlangʻich sinflarda taqiqlanadi; yuqori sinflarda faqat laboratoriya/insho uchun (≤90 daqiqa).

## 3. Yumshoq cheklovlar (Soft Constraints)
- **Zichlik (Compactness):** oʻquvchi va oʻqituvchi jadvalida kun oʻrtasida "oʻlik soat"lar (windows) boʻlmasin.
- **Xona barqarorligi:** oʻqituvchi imkon qadar bitta xonada qolsin, sinflar koʻchishi kamaytirilsin.
- **Kafedra hamkorligi:** bir kafedra oʻqituvchilariga haftada kamida bir marta bir vaqtda boʻsh soat.

## 4. Tanaffuslar standarti
- Kichik tanaffus: kamida 10 daqiqa.
- Katta (tushlik) tanaffus: 2- yoki 3-darsdan keyin 20-30 daqiqa.

## 5. Maktab tuzilmasi va dars strukturasi (DTS 2025-2026)

- **Boshlangʻich:** 1-4 sinf (7-10 yosh) · **Asosiy:** 5-9 sinf (11-15 yosh) · **Yuqori:** 10-11 sinf (16-18 yosh). Jami 11 yillik majburiy taʼlim.
- Dars davomiyligi: 45 daqiqa. Boshlanish: 08:00 yoki 09:00.
- Kunlik dars soni: 1-4 sinf — 4-5; 5-9 sinf — 5-6; 10-11 sinf — 6-7.
- Oʻqituvchi haftalik yuklamasi: 18-24 dars; bir kunda maksimal 6-7 dars.

### Fanlar boʻyicha
- **1-4 sinf majburiy:** Ona tili, Matematika, Oʻqish savodxonligi (1-2), Tarbiya, Sinf soati, Jismoniy tarbiya, Tasviriy sanʼat, Musiqa madaniyati.
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
