---
name: verify-ui
description: UI oʻzgarishini Playwright MCP orqali brauzerda vizual tekshirish. Har qanday frontend (client/) oʻzgarishidan soʻng, ish tugadi deyishdan oldin ishlating.
---

# UI tekshirish tartibi (Playwright MCP)

1. **Dev server ishlayotganini tekshiring:** `http://localhost:5001` ochilishini sinang. Ishlamasa, `npm run dev`ni background'da ishga tushiring va `http://localhost:5001` tayyor boʻlishini kuting.
2. **Login:** `browser_navigate` bilan `http://localhost:5001` ga oʻting. Login sahifasi chiqsa, `.env` yoki foydalanuvchidan olingan test admin hisobiga kiring (email + parol formasi). Sessiya saqlansa login shart emas.
3. **Oʻzgargan sahifaga oʻting** (masalan `/timetables`, `/assignments`) va tegishli amalni bajaring: tugma bosish, drag-drop, forma toʻldirish.
4. **Skrinshot oling** (`browser_take_screenshot`) va vizual tekshiring:
   - Oʻzgarish kutilgandek koʻrinadimi?
   - Layout buzilmaganmi (overflow, ustma-ust tushish)?
   - Matnlar oʻzbek tilida va toʻgʻrimi?
   - Dark mode'da ham tekshiring (Settings sahifasida almashtirish bor).
5. **Konsolni tekshiring:** `browser_console_messages` — yangi error/warning boʻlmasin.
6. **Natijani xulosada dalil bilan bildiring:** qaysi sahifa, nima tekshirildi, skrinshot xulosasi. Muammo topilsa — tuzatib, qayta tekshiring.
