---
paths:
  - "client/**/*.{ts,tsx}"
---

# Frontend qoidalari

## API soʻrovlar va Routing
`apiRequest()` qoidasi: AGENTS.md ("Muhim qoidalar" #1). Routing — Wouter (`useLocation`), React Router emas.

## UI
- shadcn/ui komponentlar: `@/components/ui/*`; Tailwind + `cn()` (`@/lib/utils`)
- Sahifalar: `client/src/pages/`, layout: `components/layout/`
- Import alias: `@/` → `client/src/`, `@shared/` → `shared/`
- Foydalanuvchiga koʻrinadigan barcha matnlar oʻzbek tilida

## Ehtiyot
`timetables.tsx` va `assignments.tsx` juda katta — toʻliq oʻqimasdan Grep bilan kerakli funksiyani toping. UI oʻzgarishini brauzer skrinshoti bilan tekshiring — `/verify-ui` tartibi (default — Chrome tool, maxsus hollarda Playwright MCP).
