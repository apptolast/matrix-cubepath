# Matrix — Projects Management System

## Quick Reference

- **Package manager**: pnpm (never npm/yarn)
- **Start**: `pnpm start` (launches Electron + Express on :3939 + React UI)
- **Test**: `pnpm test`
- **DB**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)

## Architecture

- `src/backend/` — Electron main process: Express server, DB, engines
- `src/frontend/` — React renderer: Tailwind, Zustand, React Query
- Express runs embedded on localhost:3939, accessed via fetch from renderer
- Preload script exposes `window.matrix.apiBase` via contextBridge

## Conventions

- Routes: `src/backend/routes/*.routes.ts` — only routing, delegates to controllers
- Controllers: `src/backend/controllers/*.controller.ts` — business logic
- Repositories: `src/backend/repositories/*.repository.ts` — Drizzle queries only
- DB schema: `src/backend/db/schema.ts` (Drizzle ORM, SQLite)
- Frontend hooks: `src/frontend/hooks/use*.ts` (React Query wrappers)
- Frontend views: `src/frontend/components/{domain}/{Domain}View.tsx`
- Stores: `src/frontend/stores/*.store.ts` (Zustand)
- API calls: `src/frontend/lib/api.ts` → `apiFetch<T>(path, options)`

## Data Hierarchy

Mission → Objectives → Plans → Tasks

## Polymorphic Links

- `project_links` table: links projects to any entity (mission, objective, plan, task)
- `linkable_type` + `linkable_id` pattern

## Sidebar Tabs

Overview | Projects | Tasks | Ideas | Passwords (coming soon) | Settings

## i18n

- Simple dictionary in `src/frontend/lib/i18n.ts` (EN/ES)
- Language preference stored in settings table

## Stack

Electron Forge (Vite) | React 18 | Tailwind CSS 3.4 | Zustand | Drizzle ORM | Express 4 | Zod | Vitest

## Key Decisions

- Vite over Webpack (better DX, faster builds)
- Tailwind v3.4 (not v4)
- Drizzle over Prisma (cleaner Electron packaging)
- better-sqlite3 for native SQLite (WAL mode)
- Vite externals: better-sqlite3 + express in rollupOptions.external
- AutoUnpackNativesPlugin for .node files in asar
- Tables created via raw SQL in migrate.ts (no drizzle-kit at runtime)
- pnpm requires `node-linker=hoisted` in .npmrc (Electron Forge requirement)
- Globals: `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME`

## Progress

- Phase 0 (Infrastructure + DB): DONE
