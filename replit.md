# Maktab Dars Jadvali — School Schedule Master

## Overview
A full-stack school timetable management system built with React + Express + PostgreSQL. All UI is in Uzbek language. Features research-based scheduling algorithm (CSP-inspired) with hard/soft constraints.

## Architecture
- **Frontend**: React + Wouter (routing) + TanStack Query v5 + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Access-code based JWT (no passwords). JWT stored in localStorage. `window.fetch` patched in `use-auth.tsx` to inject `Authorization: Bearer <token>` for all `/api/*` requests.

## Key Files
- `shared/schema.ts` — All Drizzle models, insert schemas, TypeScript types, ROOM_TYPE_LABELS export
- `server/storage.ts` — DatabaseStorage class with all CRUD methods incl. teacher unavailability
- `server/routes.ts` — All API routes + improved schedule generator algorithm
- `server/seed.ts` — Seeds demo access codes on startup
- `client/src/hooks/use-auth.tsx` — Auth context + fetch interceptor
- `client/src/App.tsx` — Router + ProtectedLayout with mobile sidebar

## Pages
- `/` — Dashboard with real stats, quick actions, setup guide
- `/timetables` — Full schedule grid (5 days × 6 periods), week navigation, auto-generator with result stats, class view + teacher view toggle
- `/teachers` — CRUD + subject multi-select + unavailability 5×6 grid tab (band vaqtlar)
- `/classes` — CRUD + tabbed dialog for subject→teacher assignment
- `/subjects` — CRUD with color picker, weekly hours, required room type selector
- `/rooms` — CRUD with typed room icons, room type summary pills
- `/settings` — Access code management + system info

## Database Schema
Tables: `access_codes`, `subjects` (with `required_room_type`), `teachers`, `teacher_unavailability` (teacherId, dayOfWeek, periodNumber), `classes`, `rooms` (with `room_type`), `time_slots`, `teacher_subjects`, `class_subjects`, `schedule_entries`, `schedule_conflicts`

### Room Types
`classroom | lab | gym | computer | music | art | any` — used on both `subjects.required_room_type` and `rooms.room_type` for matching during schedule generation.

## API Endpoints
- POST `/api/auth/login` — returns JWT token
- GET `/api/auth/me` — returns current user
- GET/POST/PATCH/DELETE `/api/subjects`, `/api/teachers`, `/api/classes`, `/api/rooms`
- GET/PUT `/api/teachers/:id/subjects` — teacher's assigned subjects
- GET/PUT `/api/teachers/:id/unavailability` — teacher's blocked time slots
- GET `/api/classes/:id/subjects` — class subject+teacher assignments
- GET `/api/time-slots` — auto-creates 6×5=30 slots on first call
- GET `/api/schedule-entries?weekStart=<ISO>[&classId=N][&teacherId=N]` — filtered entries
- POST `/api/generate-schedule` — improved algorithm (returns coverage%, classResults[], warnings[])
- DELETE `/api/schedule-entries?weekStart=<ISO>` — clear week schedule
- GET `/api/schedule-conflicts` — unresolved conflicts
- GET `/api/dashboard/stats` — 6 aggregate counts

## Demo Access Codes
- `ADMIN2024` — Administrator
- `TEACHER001` — Teacher
- `SCHOOL123` — School

## Schedule Generation Algorithm (improved)
`POST /api/generate-schedule` `{weekStart, classIds?, clearExisting}`:
1. Sort classSubjects by `weeklyHours DESC` (harder-to-schedule subjects first)
2. For each class→subject combo, spread `weeklyHours` lessons across Mon–Fri
3. **Hard constraints**: teacher not busy, class not busy, room not busy, teacher unavailability blocked
4. **Soft constraints**: room type matching (`subject.requiredRoomType` vs `room.roomType`), room capacity ≥ class.totalStudents, teacher maxHoursPerWeek, max 6 lessons/class/day, max same-subject-per-day limit
5. Room selection priority: type+capacity > type only > capacity only > any available
6. Returns `{count, coverage%, classResults[], warnings[]}`

## Time Slots
Auto-generated: 1–6 dars (08:00–13:45), Mon–Fri = 30 slots total
