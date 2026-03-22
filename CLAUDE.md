# Matrix — Projects Management System

## Quick Reference

- **Package manager**: pnpm (never npm/yarn)
- **Dev**: `pnpm dev` (backend + frontend in parallel)
- **Typecheck**: `pnpm typecheck`
- **Test**: `pnpm test`
- **Production**: `pnpm start:prod` (Express serves built frontend)
- **DB**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)

## Architecture

- `src/backend/` — Express server, DB, engines (pure Node.js, no Electron)
- `src/frontend/` — React 18 + Vite + Tailwind CSS 3.4 + Zustand + React Query
- Entry point: `src/backend/start.ts`
- Frontend talks to backend via `apiFetch('/api/...')`
- Per-user SQLite databases via `AsyncLocalStorage`

## Deployment

- Docker multi-stage build → Dokploy → Traefik (auto HTTPS)
- Domain: `matrix.stackbp.es`
- Auto-deploy on push to `main`
- Env vars: `SESSION_SECRET`, `SECURE_COOKIE`, `DATA_DIR`, `DEMO_USER`

## Conventions

- Routes: `src/backend/routes/*.routes.ts` — only routing, delegates to controllers
- Controllers: `src/backend/controllers/*.controller.ts` — business logic
- Repositories: `src/backend/repositories/*.repository.ts` — Drizzle queries only
- DB schema: `src/backend/db/schema.ts` (Drizzle ORM, SQLite)
- Frontend hooks: `src/frontend/hooks/use*.ts` (React Query wrappers)
- Frontend views: `src/frontend/components/{domain}/{Domain}View.tsx`
- Stores: `src/frontend/stores/*.store.ts` (Zustand)
- API calls: `src/frontend/lib/api.ts` → `apiFetch<T>(path, options)`
- Logging: use `logger` from `src/backend/lib/logger.ts` (never `console.error`)

## Data Hierarchy

Mission → Objectives → Plans → Tasks

## Polymorphic Links

- `project_links` table: links projects to any entity (mission, objective, plan, task)
- `linkable_type` + `linkable_id` pattern

## Sidebar Tabs

Overview | Projects | Tasks | Ideas | Passwords | Settings

## i18n

- Simple dictionary in `src/frontend/lib/i18n.ts` (EN/ES)
- Language preference stored in settings table

## Stack

Node.js + Express 4 | React 18 | Vite | Tailwind CSS 3.4 | Zustand | React Query | Drizzle ORM | Zod | Vitest

## Key Decisions

- Vite for frontend bundling (fast HMR)
- Tailwind v3.4 (not v4)
- Drizzle over Prisma (lighter, better for SQLite)
- better-sqlite3 for native SQLite (WAL mode)
- Tables created via raw SQL in migrate.ts (no drizzle-kit at runtime)
- scrypt for password hashing (Node.js native, no bcrypt dependency)
- HMAC session tokens (stateless, no express-session)
- PWA via vite-plugin-pwa + workbox
