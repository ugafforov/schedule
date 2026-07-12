---
name: verify-ui
description: UI oʻzgarishini brauzerda vizual tekshirish (default — Chrome tool, maxsus hollarda Playwright MCP). Har qanday frontend (client/) oʻzgarishidan soʻng, ish tugadi deyishdan oldin ishlating.
---

# UI tekshirish tartibi

**Tool tanlash** (global qoida bilan bir xil):
- **Default — Chrome tool** (`claude-in-chrome` MCP): foydalanuvchining haqiqiy sessiyasi va loginidan foydalanadi, login bosqichi odatda kerak emas.
- **Playwright MCP** faqat quyidagilarda: toza/izolyatsiyalangan sessiya kerak (login oqimi, birinchi tashrif, boshqa rol), oqimda `confirm()`/`alert()` dialoglari bor (Chrome tool dialogda qotib qoladi), yoki foydalanuvchi brauzeriga xalaqit bermaslik kerak boʻlgan uzun avtomatlashtirish.

**Tartib:**

1. **Dev server ishlayotganini tekshiring:** `http://localhost:5001` ochilishini sinang. Ishlamasa, `npm run dev`ni background'da ishga tushiring va `http://localhost:5001` tayyor boʻlishini kuting.
2. **Sahifani oching:** Chrome tool'da `tabs_context_mcp` → yangi tab → `navigate` bilan `http://localhost:5001`. (Playwright'da: `browser_navigate`; login sahifasi chiqsa test admin hisobiga kiring.)
3. **Oʻzgargan sahifaga oʻting** (masalan `/timetables`, `/assignments`) va tegishli amalni bajaring: tugma bosish, drag-drop, forma toʻldirish.
4. **Skrinshot oling** va vizual tekshiring:
   - Oʻzgarish kutilgandek koʻrinadimi?
   - Layout buzilmaganmi (overflow, ustma-ust tushish)?
   - Matnlar oʻzbek tilida va toʻgʻrimi?
   - Dark mode'da ham tekshiring (Settings sahifasida almashtirish bor).
5. **Konsolni tekshiring:** Chrome tool'da `read_console_messages`, Playwright'da `browser_console_messages` — yangi error/warning boʻlmasin.
6. **Natijani xulosada dalil bilan bildiring:** qaysi sahifa, nima tekshirildi, skrinshot xulosasi. Muammo topilsa — tuzatib, qayta tekshiring.
