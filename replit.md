# Maktab Dars Jadvali — School Schedule Master

## Overview
A full-stack school timetable management system built with React + Express + PostgreSQL. All UI is in Uzbek language.

## Architecture
- **Frontend**: React + Wouter (routing) + TanStack Query v5 + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Access-code based JWT (no passwords). JWT stored in localStorage. `window.fetch` patched in `use-auth.tsx` to inject `Authorization: Bearer <token>` header for all `/api/*` requests.

## Key Files
- `shared/schema.ts` — All Drizzle models, insert schemas, and TypeScript types
- `server/storage.ts` — DatabaseStorage class with all CRUD methods
- `server/routes.ts` — All API routes + schedule generator algorithm
- `server/seed.ts` — Seeds demo access codes on startup
- `client/src/hooks/use-auth.tsx` — Auth context + fetch interceptor
- `client/src/App.tsx` — Router + ProtectedLayout with mobile sidebar state

## Pages
- `/` — Dashboard with real stats, quick actions, setup guide
- `/timetables` — Full schedule grid (5 days × 6 periods), week navigation, auto-generator, edit/delete per cell
- `/teachers` — CRUD + subject multi-select assignment
- `/classes` — CRUD + tabbed dialog for subject→teacher assignment
- `/subjects` — CRUD with color picker and weekly hours
- `/rooms` — CRUD with room type selection
- `/settings` — Access code management + system info

## Database Schema
Tables: `access_codes`, `subjects`, `teachers`, `classes`, `rooms`, `time_slots`, `teacher_subjects`, `class_subjects`, `schedule_entries`, `schedule_conflicts`

## API Endpoints
- POST `/api/auth/login` — returns JWT token
- GET `/api/auth/me` — returns current user
- GET/POST/PATCH/DELETE `/api/subjects`, `/api/teachers`, `/api/classes`, `/api/rooms`
- GET `/api/teachers/:id/subjects` — teacher's assigned subjects
- GET `/api/classes/:id/subjects` — class's subject+teacher assignments
- GET `/api/time-slots` — auto-creates 6×5=30 slots on first call
- GET `/api/schedule-entries?weekStart=<ISO>` — week's schedule
- POST `/api/generate-schedule` — algorithm: distributes classSubjects across Mon-Fri slots, avoids teacher/room/class conflicts
- DELETE `/api/schedule-entries?weekStart=<ISO>` — clear week's schedule
- GET `/api/schedule-conflicts` — unresolved conflicts
- GET/POST/DELETE `/api/access-codes` — manage login codes
- GET `/api/dashboard/stats` — returns 6 aggregate counts

## Demo Access Codes
- `ADMIN2024` — Administrator
- `TEACHER001` — Teacher
- `SCHOOL123` — School

## Time Slots
Auto-generated on first `/api/time-slots` call:
- 1-dars: 08:00–08:45
- 2-dars: 09:00–09:45
- 3-dars: 10:00–10:45
- 4-dars: 11:00–11:45
- 5-dars: 12:00–12:45
- 6-dars: 13:00–13:45

## Schedule Generation Logic
`POST /api/generate-schedule` with `{weekStart, classIds?, clearExisting}`:
1. Loads all classSubjects (class→subject→teacher→weeklyHours)
2. For each class/subject combo, tries to place `weeklyHours` lessons
3. Spreads across days: iterates [1,2,3,4,5,1,2,3,4,5,1,2,3,4,5] order
4. Checks `teacherBusy`, `classBusy`, `roomBusy` Sets to avoid conflicts
5. Bulk inserts all valid entries

## Mobile Support
- Sidebar is hidden on mobile (`hidden lg:flex`)
- Hamburger menu button in Header triggers `sidebarOpen` state in ProtectedLayout
- Mobile drawer slides in with overlay backdrop
- All modals/dialogs are scrollable with `max-h-[90vh] overflow-y-auto`
