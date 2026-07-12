---
name: db-change
description: Database schema oʻzgartirish workflow (Drizzle + Supabase). Yangi jadval, ustun yoki index qoʻshishda ishlating.
---

# Schema oʻzgartirish tartibi

Yagona manba: **AGENTS.md → "Kritik tartiblar" boʻlimidagi "Schema oʻzgartirish"** — 5 qadamni oʻsha yerdan oʻqib, aynan shu tartibda bajaring. Shu yerda takrorlanmaydi.

Claude Code'ga xos qoʻshimchalar:
- 1-qadam (real bazani koʻrish) uchun Supabase MCP `list_tables`ni, yakuniy tekshiruv uchun `execute_sql`ni ishlating.
- Prod migrationda fayl mazmunini foydalanuvchiga koʻrsatib, keyin `npm run db:migrate` qiling.
