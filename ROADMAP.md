# Matrix — Roadmap

> Projects management system: Mission → Objectives → Plans → Tasks, with ideas, passwords, pomodoro, and activity analytics.
> Deployed on CubePath VPS via Dokploy for the CubePath Hackathon 2026 (deadline: 31 Mar 2026).

---

## Stack

- **Backend**: Node.js + Express + Drizzle ORM + SQLite (better-sqlite3, WAL mode)
- **Frontend**: React 18 + Vite + Tailwind CSS 3.4 + Zustand + React Query
- **Auth**: scrypt password hashing + HMAC session tokens (httpOnly cookies)
- **Infra**: Docker multi-stage + Dokploy + Traefik (auto HTTPS) + CubePath VPS
- **CI/CD**: GitHub Actions (typecheck) + Dokploy auto-deploy on push

---

## Implemented ✅

### Infrastructure ✅

- [x] Migration from Electron → standalone web app (removed `window.matrix.*`, IPC, preload)
- [x] Entry point `src/backend/start.ts` (pure Node.js, no Electron)
- [x] SQLite database in `DATA_DIR` configurable via env var
- [x] Dockerfile multi-stage (deps → build → production)
- [x] Dockerfile hardening: non-root user (`matrix`), `HEALTHCHECK` directive, `docker-entrypoint.sh`
- [x] `docker-compose.yml` with app container
- [x] `trust proxy` for reverse proxy compatibility (Traefik)
- [x] `SECURE_COOKIE` env var for HTTPS-only cookie control
- [x] Graceful shutdown — `SIGTERM`/`SIGINT` handlers call `server.close()` with 5s timeout fallback
- [x] LF line endings enforced for shell scripts (`.gitattributes` + Dockerfile `sed` strip)
- [x] Foreign key indexes on all commonly queried FK columns (`migrate.ts`)
- [x] Health endpoint (`GET /api/health`) mounted before `requireAuth` for monitoring/load balancer access

### Deployment ✅

- [x] CubePath VPS provisioned (Ubuntu, Docker pre-installed)
- [x] Dokploy installed and configured as deployment manager
- [x] Traefik reverse proxy with auto HTTPS (Let's Encrypt)
- [x] Domain configured: `matrix.stackbp.es`
- [x] Auto-deploy on push to `main` via Dokploy
- [x] Docker volume `matrix_data` for persistent data

### Demo & Security ✅

- [x] Demo user with full mock data (`DEMO_USER` env var)
- [x] Demo data reset on each startup + endpoint `POST /api/demo/reset`
- [x] Demo reset auth-gated by `req.matrixUser` — returns 403 for non-demo users (no env var dependency at runtime)
- [x] Demo login button (`$ access --demo`) with animated cursor typing in LoginPage
- [x] Demo restore button in Settings — calls `/api/demo/reset`, hides danger zone for demo users
- [x] `DEMO_USERNAME` constant centralized in `seed-demo.ts` — no hardcoded `'demo'` strings
- [x] Global rate limiter: 300 req/min per IP on all API endpoints
- [x] Auth rate limiter: 10 req/15min on `/auth/login` and `/auth/register`
- [x] Registration gating — `ALLOW_REGISTRATION=true` env var required to enable signup (currently disabled); `GET /api/auth/info` exposes flag to frontend
- [x] HTTP security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection`, `Permissions-Policy`
- [x] `Strict-Transport-Security` (HSTS) with 2-year max-age, includeSubDomains, preload (production only)
- [x] `Content-Security-Policy` (CSP) — restricts scripts, styles, connections to self + Google Analytics (production only)
- [x] `x-powered-by` header disabled — prevents Express fingerprinting
- [x] `/.well-known/security.txt` served with contact info for vulnerability reporting
- [x] `/robots.txt` — blocks `/api/` crawling, allows public pages
- [x] Internal error messages hidden in production (generic `Internal server error` in global error handler)

### Authentication ✅

- [x] Registration and login with scrypt password hashing (`crypto.scryptSync`, 64-byte key)
- [x] HMAC session tokens with `SESSION_SECRET` (no express-session dependency)
- [x] httpOnly + secure cookies with configurable `SECURE_COOKIE` flag
- [x] Auth middleware on all protected routes (`requireAuth`)
- [x] Per-user database context via `AsyncLocalStorage` (multi-user isolation)
- [x] Rate limiting on `/auth/login` and `/auth/register` (10 attempts / 15 min)
- [x] Timing-safe comparison — always runs hash for unknown users
- [x] Client-side validation in LoginPage before fetch
- [x] **Auth upgrade — email as primary login identifier** (username optional, preserved as DB path key for backwards compatibility)
- [x] Auto-migration on startup: old `username-only` schema → `email + username` via SQL transaction (`auth-db.ts`)
- [x] `POST /auth/forgot-password` — always returns 200 (anti-enumeration), generates SHA-256 hashed token, 1h expiry, single-use
- [x] `POST /auth/reset-password` — consumes token, rehashes password with new salt via DB transaction
- [x] `sendPasswordResetEmail` via nodemailer SMTP (optional). Without SMTP → reset URL logged at INFO level (visible in Dokploy log panel)
- [x] `ResetPasswordPage` — SPA route `/reset-password?token=...` detected in `App.tsx`, no page reload
- [x] Dedicated rate limiter for password reset: 5 attempts / hour
- [x] `password_reset_tokens` table with `ON DELETE CASCADE`, purged on startup (tokens older than 24h)
- [x] Updated validation: username 3-20 chars `[a-z0-9_]` only, password 8-20 chars + special character (Zod backend + frontend)

### Password Vault — Hardening & Auto-lock ✅

- [x] Auto-lock configurable at runtime: `vault_auto_lock` setting read on each `resetInactivityTimer()` call — supports 5 min / 30 min / never
- [x] `POST /passwords/apply-auto-lock` — endpoint to refresh the inactivity timer when the setting changes
- [x] `changeMasterPassword` blocked for demo user (403)
- [x] Demo vault pre-configured during seed with `DEMO_PASSWORD` — visitors can unlock immediately with `demo1234`
- [x] Vault hint shown in LockScreen and Settings when `isDemo === true`

### System Status & External Services ✅

- [x] `GET /api/stats/system-status` — HTTP HEAD ping to Render backends (sleeping detection: 503 or >5s response), TCP check to external databases (MySQL/PostgreSQL). 2-min cache with lock-state invalidation. Fallback to cache on error.
- [x] `POST /api/stats/wake-service` — sends GET request with 30s timeout to wake sleeping Render services
- [x] `GET /api/settings/services` + `PUT /api/settings/services` — external services config stored encrypted with vault key (requires vault unlocked)
- [x] Background auto-poll every 10 min (`startStatusPolling` / `stopStatusPolling` integrated with graceful shutdown)
- [x] RightPanel System Status section consumes real API data; demo account uses static mock data
- [x] SettingsView — External Services section: expandable CRUD for Render backends and DB connection strings

### Database Backup ✅

- [x] `GET /api/db/download` — streams user's SQLite file via `res.download()`. Blocked for demo (403).
- [x] `BackupInfo` modal in SettingsView with details about the backup and vault encryption

### Backend API ✅

- [x] Full CRUD: missions, objectives, plans, tasks
- [x] Ideas with evaluation and status pipeline — `totalScore` stored as `real` (float precision)
- [x] Ideas controller: proper 500 error responses instead of silent empty fallbacks
- [x] Password vault (encrypted with per-user keys)
- [x] Projects with GitHub scanner and polymorphic links
- [x] Activity log with metrics (daily, weekly, streak)
- [x] Per-user settings
- [x] Local settings (basePath)
- [x] Logs API (`GET /api/logs`, `POST /api/logs/clear`)
- [x] Stats and deadlines endpoints
- [x] Daily Notes — `daily_notes` table, `GET /notes`, `GET /notes/:date`, `PUT /notes/:date`

### Validation ✅

- [x] Centralized `validate()` middleware (`src/backend/middleware/validate.middleware.ts`) — factory function that receives `{ body?, params?, query? }` Zod schemas, runs `safeParse`, returns 400 with `flatten().fieldErrors` on failure, and mutates `req` with transformed data
- [x] All Zod schemas extracted to `src/backend/validations/` (one file per domain: mission, objectives, plans, tasks, ideas, projects, passwords, settings, local-settings, auth, notes)
- [x] Shared schemas in `common.validation.ts`: `deadlineField` (YYYY-MM-DD + valid date), `cascadeDeleteBody` (action + newParentId for hierarchical deletes)
- [x] New validations added: deadline format on plans/tasks, auth register/login with Zod (replaces manual checks), URL format on projects (https or owner/repo)
- [x] Routes use `validate()` middleware before controller — controllers no longer import Zod or call `safeParse` for standard CRUD (only cascade delete logic remains inline)

### GitHub API Integration ✅

- [x] `src/backend/engines/github-scanner.ts` — GitHub API calls: languages, commits, file tree, README/ROADMAP/TODO detection
- [x] Settings backend — store/retrieve `github_token` in `settings` table per user
- [x] `GET /api/settings/github-status` — verify token against GitHub API
- [x] Settings frontend — "GitHub Integration" section with PAT input + connection status
- [x] `POST /api/projects/:id/sync-github` — endpoint that calls scanner and saves results to `scan` + `tech_stats`
- [x] Project create — accepts GitHub URL (`https://github.com/owner/repo` or `owner/repo`)
- [x] Project detail — "Sync from GitHub" button (visible when project has `url` configured)

### Frontend ✅

- [x] Sidebar with tabs: Overview, Projects, Tasks, Ideas, Passwords, Settings
- [x] OverviewView — home page with summary dashboard
- [x] TaskBoard with priorities, deadlines, calendar picker, kanban columns
- [x] IdeasView with creation/editing modal and pipeline
- [x] RightPanel: activity metrics, pomodoro timer, top ideas, daily thought, dev feed
- [x] Daily Thought — ZenQuotes API with 24h in-memory cache + local fallback quotes
- [x] Dev Feed — Hacker News top stories + GitHub trending repos (free APIs, no key required)
- [x] PasswordsView with CSV/TXT import via `<input type="file">`
- [x] SettingsView with logs viewer and GitHub config
- [x] Auth views (login / register) with theme and language toggles on login screen
- [x] i18n EN/ES — all auth strings localized (appSubtitle, signIn, register, error messages)
- [x] Dark/light theme (Zustand + matchMedia)
- [x] Hooks: `useActivityMetrics`, `useIdeasPipeline`, `useDeadlines`, `useTasks`
- [x] Store: `pomodoro.store`, `dialog.store`
- [x] Daily Notes — calendar-based notepad in Overview: inline calendar grid with dot indicators, date picker, plain text editor with debounce auto-save + manual save button, dirty flag prevents overwriting user input during query refetch
- [x] Responsive / mobile design — sidebar overlay with hamburger (`md:hidden`), kanban columns stack on mobile (`grid-cols-1`), inline status selector per task card (mobile-only), edit/delete buttons always visible, password table columns hide progressively, modals fit small screens, all views adapted with Tailwind breakpoints only

### CI/CD ✅

- [x] `ci.yml`: TypeScript typecheck on every push/PR to `main`
- [x] ~~`release.yml`: SSH deploy to VPS~~ — removed in favor of Dokploy auto-deploy

### Bilingual i18n System (EN/ES) with Demo Data Seeding ✅

- [x] **Seed data architecture refactored** — all translatable demo content extracted from `seed-demo.ts` into a declarative data layer (`seed-data.ts`) + JSON locale files (`seed-locales/en.json`, `seed-locales/es.json`). Structural data (statuses, priorities, scores, dates, sort orders) lives in TypeScript interfaces; human-readable text lives in locale JSON keyed by `SeedLocaleKey`.
- [x] **Language-aware demo re-seeding** — when the demo user changes language via Settings, the backend (`settings.controller.ts`) detects the `language` key update, checks if the user is the demo account, and calls `seedDemoUser(lang)` which drops and re-inserts all demo data (missions, objectives, plans, tasks, ideas, evaluations, projects, links, passwords, activity log, daily notes) using the selected locale. This means demo data is fully translated, not just the UI.
- [x] **`useLanguageSwitch()` hook** — centralised language switch logic: updates Zustand store → persists to backend → triggers demo re-seed if applicable → invalidates all React Query caches so every component refreshes with new data — all without a page reload. Shows loading/success/error toasts during the operation.
- [x] **`SettingsHydrator` component** — on login, reads persisted `language` and `theme` from backend settings and hydrates the Zustand store, ensuring the UI matches the user's last saved preferences regardless of browser locale or localStorage state.
- [x] **Skeleton loading state** — new `OverviewSkeleton` component shown during language switch to prevent flash of stale content while demo data is being re-seeded and queries are invalidating.
- [x] **`switchingLanguage` flag in UI store** — boolean flag set during the async language switch operation; `OverviewView` renders the skeleton when true, cards when false.
- [x] **Language toggle button in Overview header** — globe icon + `EN`/`ES` label, disabled during switch. Also available in Settings and LoginPage.
- [x] **New i18n keys** — added `strategicSchema`, `ideaTitle`, `descriptionOptional`, `objectivePlaceholder`, `planPlaceholder`, `taskPlaceholder`, `planTitle`, `yourStrategicMission`, `missionAimToAchieve`, `sampleData`, `allClear`, `toastLangSwitching`, `toastLangDone` in both EN and ES.
- [x] **Remaining hardcoded strings localised** — `StrategicSchemaSetup` placeholders, `inline-forms` placeholders, `DashboardCards` labels, `ChartCards` labels, `TreeView`/`RoadmapView`/`DashboardView` headings all now use `t()`.
- [x] **Default language changed** — store default set to `'es'` (Spanish) instead of browser detection, since `SettingsHydrator` overrides with the user's persisted preference on login.

### Hackathon Requirements ✅

- [x] README.md with description, demo link, and deployment instructions
- [x] Public repository
- [x] Live demo accessible at [matrix.stackbp.es](https://matrix.stackbp.es)
- [x] Participation registered via issue in hackathon repo

---

## Pending

### Web Check / Production Hardening

- [x] Security headers hardened (HSTS, CSP, X-XSS-Protection, Permissions-Policy)
- [x] `x-powered-by` disabled
- [x] `security.txt` and `robots.txt` served
- [ ] TLS cipher suites — configure Traefik for TLS 1.2+ only (Dokploy/Traefik config)
- [ ] DNSSEC — enable at DNS provider for stackbp.es
- [ ] Email auth (SPF/DKIM/DMARC) — add DNS TXT records via Resend dashboard
- [ ] Sitemap.xml (optional — SPA with login, low priority)

### Issues to Investigate

- [x] React Query fires all queries in parallel on view mount — reviewed: duplicate hook calls are auto-deduplicated by React Query (same key = 1 HTTP request). Fixed `refetchOnMount: 'always'` → default (`true`) to avoid unnecessary refetches on tab navigation

### Features

- [x] Notifications for upcoming deadlines (DeadlineBanner + UpcomingDeadlines widget + Settings toggle)
- [ ] Tech Radar & Dependencies Health dashboard (replace current mock data in RightPanel)
- [ ] Data export (JSON/CSV)
  - Backend: `GET /api/export` endpoint (auth required) that queries all user tables (missions, objectives, plans, tasks, ideas, idea_evaluations, projects, project_links, activity_log, settings) and returns a single JSON file with ISO timestamps
  - Backend: `GET /api/export?format=csv` variant that returns a ZIP with one CSV per table
  - Passwords excluded by default (security) — optional `includePasswords=true` flag exports them encrypted
  - Frontend: "Export my data" button in SettingsView → triggers download via `window.location` or Blob
  - Future: `POST /api/import` to restore from exported JSON (validate schema with Zod before inserting)
- [x] PWA support (manifest, service worker, install prompt, offline caching, update notification)

### Password Vault Security Hardening

- [ ] Encrypt metadata fields (domain, username) — currently stored in plaintext in the DB
- [ ] Add rate limiting on GET password endpoints (currently only unlock is rate-limited)
- [ ] Add CSRF token protection on state-changing operations
- [ ] Master password recovery mechanism (recovery phrase or backup key)
- [ ] Make `bulkDelete` transactional (currently not wrapped in a DB transaction)
- [ ] 2FA/TOTP support for vault unlock
- [ ] Encrypted vault backup/export
- [ ] Password breach detection (HaveIBeenPwned integration)
- [ ] Password quality analysis (reuse detection, strength scoring)
- [ ] Configurable password generator (custom length, character sets, exclude ambiguous chars)
- [ ] Vault unlock/access activity logging (timestamps, failed attempts)

### Migration Gaps (Electron → Web) ✅

See [Migration section in README](./README.md#migration-from-matrix-electron) for context.

- [x] Local filesystem scanner ported and functional (`POST /projects/:id/scan`)
- [x] GitHub scanner added as alternative (`POST /projects/:id/sync-github`)
- [x] All Electron-specific patterns removed (IPC, preload, native dialogs, BrowserWindow)
- [x] File dialogs replaced with text input / form-based UX

---

## Key Decisions

| Decision         | Choice                      | Reason                                                    |
| ---------------- | --------------------------- | --------------------------------------------------------- |
| Reverse proxy    | Traefik (via Dokploy)       | Auto HTTPS + web UI for deployment management             |
| Deploy           | Dokploy auto-deploy on push | No SSH keys needed, web dashboard, rollback support       |
| Database         | SQLite (per-user)           | Sufficient for self-hosted, no external services required |
| Containers       | Single app container        | Traefik provided by Dokploy, no need for separate proxy   |
| Password hashing | scrypt (Node.js native)     | No external dependency, resistant to brute-force attacks  |
| Session tokens   | HMAC cookies                | Stateless, no session store needed, httpOnly + secure     |
| API routes       | Relative (`/api/...`)       | Reverse proxy handles routing, no hardcoded host          |
| CSV import       | `<input type="file">`       | Native browser API, no Electron dependency                |
