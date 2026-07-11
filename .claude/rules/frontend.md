---
paths:
  - "client/**/*.{ts,tsx}"
---

# Frontend qoidalari

## API soʻrovlar va Routing
Qoidalar AGENTS.md ("Muhim qoidalar" #1-2) da — apiRequest() va Wouter. Shu yerda takrorlanmaydi.

## UI
- shadcn/ui komponentlar: `@/components/ui/*`; Tailwind + `cn()` (`@/lib/utils`)
- Sahifalar: `client/src/pages/`, layout: `components/layout/`
- Import alias: `@/` → `client/src/`, `@shared/` → `shared/`
- Foydalanuvchiga koʻrinadigan barcha matnlar oʻzbek tilida

## Ehtiyot
`timetables.tsx` va `assignments.tsx` juda katta — toʻliq oʻqimasdan Grep bilan kerakli funksiyani toping. UI oʻzgarishini Playwright MCP skrinshoti bilan tekshiring (`/verify-ui`).
