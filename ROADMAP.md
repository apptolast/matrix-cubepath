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

## Implemented

### Infrastructure

- [x] Migration from Electron → standalone web app (removed `window.matrix.*`, IPC, preload)
- [x] Entry point `src/backend/start.ts` (pure Node.js, no Electron)
- [x] SQLite database in `DATA_DIR` configurable via env var
- [x] Dockerfile multi-stage (deps → build → production)
- [x] `docker-compose.yml` with app container
- [x] `trust proxy` for reverse proxy compatibility (Traefik)
- [x] `SECURE_COOKIE` env var for HTTPS-only cookie control

### Deployment

- [x] CubePath VPS provisioned (Ubuntu, Docker pre-installed)
- [x] Dokploy installed and configured as deployment manager
- [x] Traefik reverse proxy with auto HTTPS (Let's Encrypt)
- [x] Domain configured: `matrix.stackbp.es`
- [x] Auto-deploy on push to `main` via Dokploy
- [x] Docker volume `matrix_data` for persistent data

### Demo & Security

- [x] Demo user with full mock data (`DEMO_USER` env var)
- [x] Demo data reset on each startup + endpoint `POST /api/demo/reset`
- [x] Global rate limiter: 300 req/min per IP on all API endpoints
- [x] Auth rate limiter: 10 req/15min on `/auth/login` and `/auth/register`

### Authentication

- [x] Registration and login with scrypt password hashing (`crypto.scryptSync`, 64-byte key)
- [x] HMAC session tokens with `SESSION_SECRET` (no express-session dependency)
- [x] httpOnly + secure cookies with configurable `SECURE_COOKIE` flag
- [x] Auth middleware on all protected routes (`requireAuth`)
- [x] Per-user database context via `AsyncLocalStorage` (multi-user isolation)
- [x] Rate limiting on `/auth/login` and `/auth/register` (10 attempts / 15 min)
- [x] Max password length 128 chars (prevents hash DoS)
- [x] Timing-safe comparison — always runs hash for unknown users
- [x] Client-side validation in LoginPage before fetch

### Backend API

- [x] Full CRUD: missions, objectives, plans, tasks
- [x] Ideas with evaluation and status pipeline
- [x] Password vault (encrypted with per-user keys)
- [x] Projects with GitHub scanner and polymorphic links
- [x] Activity log with metrics (daily, weekly, streak)
- [x] Per-user settings
- [x] Local settings (basePath)
- [x] Logs API (`GET /api/logs`, `POST /api/logs/clear`)
- [x] Stats and deadlines endpoints

### GitHub API Integration

- [x] `src/backend/engines/github-scanner.ts` — GitHub API calls: languages, commits, file tree, README/ROADMAP/TODO detection
- [x] Settings backend — store/retrieve `github_token` in `settings` table per user
- [x] `GET /api/settings/github-status` — verify token against GitHub API
- [x] Settings frontend — "GitHub Integration" section with PAT input + connection status
- [x] `POST /api/projects/:id/sync-github` — endpoint that calls scanner and saves results to `scan` + `tech_stats`
- [x] Project create — accepts GitHub URL (`https://github.com/owner/repo` or `owner/repo`)
- [x] Project detail — "Sync from GitHub" button (visible when project has `url` configured)

### Frontend

- [x] Sidebar with tabs: Overview, Projects, Tasks, Ideas, Passwords, Settings
- [x] OverviewView — home page with summary dashboard
- [x] TaskBoard with priorities, deadlines, calendar picker, kanban columns
- [x] IdeasView with creation/editing modal and pipeline
- [x] RightPanel: activity metrics, pomodoro timer, top ideas
- [x] PasswordsView with CSV/TXT import via `<input type="file">`
- [x] SettingsView with logs viewer and GitHub config
- [x] Auth views (login / register)
- [x] i18n EN/ES
- [x] Dark/light theme (Zustand + matchMedia)
- [x] Hooks: `useActivityMetrics`, `useIdeasPipeline`, `useDeadlines`, `useTasks`
- [x] Store: `pomodoro.store`, `dialog.store`

### CI/CD

- [x] `ci.yml`: TypeScript typecheck on every push/PR to `main`
- [x] ~~`release.yml`: SSH deploy to VPS~~ — removed in favor of Dokploy auto-deploy

### Hackathon Requirements

- [x] README.md with description, demo link, and deployment instructions
- [x] Public repository
- [x] Live demo accessible at [matrix.stackbp.es](https://matrix.stackbp.es)
- [x] Participation registered via issue in hackathon repo

---

## Pending

### Issues to Investigate

- [ ] React Query fires all queries in parallel on view mount — review if this causes excessive load or race conditions

### Features

- [ ] Notifications for upcoming deadlines
- [ ] Data export (JSON/CSV)
- [ ] Offline mode / PWA (nice to have)

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

### Migration Gaps (Electron → Web)

See [Migration section in README](./README.md#migration-from-matrix-electron) for context.

- [ ] Deepen local filesystem project scanning for self-hosted instances (Electron scanned directories, git info, line counts)
- [ ] Port remaining Electron-specific UX patterns to web equivalents

---

## Key Decisions

| Decision          | Choice                      | Reason                                                    |
| ----------------- | --------------------------- | --------------------------------------------------------- |
| Reverse proxy     | Traefik (via Dokploy)       | Auto HTTPS + web UI for deployment management             |
| Deploy            | Dokploy auto-deploy on push | No SSH keys needed, web dashboard, rollback support       |
| Database          | SQLite (per-user)           | Sufficient for self-hosted, no external services required  |
| Containers        | Single app container        | Traefik provided by Dokploy, no need for separate proxy   |
| Password hashing  | scrypt (Node.js native)     | No external dependency, resistant to brute-force attacks   |
| Session tokens    | HMAC cookies                | Stateless, no session store needed, httpOnly + secure     |
| API routes        | Relative (`/api/...`)       | Reverse proxy handles routing, no hardcoded host          |
| CSV import        | `<input type="file">`       | Native browser API, no Electron dependency                |
