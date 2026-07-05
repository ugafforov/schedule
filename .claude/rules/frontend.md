---
paths:
  - "client/**/*.{ts,tsx}"
---

# Frontend qoidalari

## API soʻrovlar
Faqat `apiRequest` (`@/lib/queryClient`) — toʻgʻridan-toʻgʻri `fetch()` emas (token qoʻshilmaydi):
```typescript
useQuery({ queryKey: ["/api/teachers"] });                 // oddiy GET
queryFn: async () => {                                     // parametrli GET
  const res = await apiRequest("GET", `/api/schedule-entries?weekStart=${weekStart}`);
  return res.json();
}
await apiRequest("POST", "/api/rooms", data);              // mutatsiya
```

## Routing — Wouter (React Router emas)
```typescript
import { useLocation } from "wouter";
const [, setLocation] = useLocation();
setLocation("/teachers");
```

## UI
- shadcn/ui komponentlar: `@/components/ui/*`; Tailwind + `cn()` (`@/lib/utils`)
- Sahifalar: `client/src/pages/`, layout: `components/layout/`
- Import alias: `@/` → `client/src/`, `@shared/` → `shared/`
- Foydalanuvchiga koʻrinadigan barcha matnlar oʻzbek tilida

## Ehtiyot
`timetables.tsx` (~2300 satr) va `assignments.tsx` (~1600 satr) juda katta — toʻliq oʻqimasdan Grep bilan kerakli funksiyani toping. UI oʻzgarishini Playwright MCP skrinshoti bilan tekshiring (`/verify-ui`).
