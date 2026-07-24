@AGENTS.md

## Claude Code uchun qoʻshimchalar

- Path-scoped qoidalar: `.claude/rules/` (frontend, backend, database) — mos fayllarga tegilganda avtomatik yuklanadi.
- Skilllar: `/verify-ui` (UI oʻzgarishini brauzerda vizual tekshirish — default Chrome tool, maxsus hollarda Playwright MCP), `/db-change` (schema oʻzgartirish tartibi).
- UI oʻzgartirgach oʻzingiz tasdiqlamang — `verify-ui` skill tartibida skrinshot bilan tekshiring.
- Turn oxirida Stop hook `npm run check`ni ishga tushiradi; TypeScript xatosi boʻlsa turn tugamaydi — xatoni tuzating, bostirmang.
- Solver/taqsimlash logikasiga tegishdan oldin `docs/domain/scheduling-rules.md`ni oʻqing.
