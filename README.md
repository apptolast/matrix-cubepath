# Matrix — Personal Management System

<p align="center">
  <strong>Self-hosted productivity system for developers — Missions → Objectives → Plans → Tasks</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#demo">Demo</a> •
  <a href="#tech-stack">Stack</a>
</p>

---

## The Problem

You have ideas scattered across `.txt` files. Projects without clear priorities. Tasks that feel disconnected from any bigger goal. Credentials buried in random places.

Questions that keep appearing:

- What's the actual plan right now?
- Which task actually moves the needle today?
- What's the status of all my side projects?
- Where did I put that API key?

**Matrix** answers all of these in one place — and since it's self-hosted, your data stays yours.

---

## Features

### Mission Control
Structured top-down planning: **Mission → Objectives → Plans → Tasks**. Progress rolls up automatically at each level so you always know where you stand.

### Task Board
Kanban-style board with priorities (critical / high / medium / low), deadlines, and status tracking (Todo → In Progress → Done). Calendar date picker for deadlines.

### Project Tracker
Track your GitHub repos and local projects. Each project scans for:
- Language breakdown (TypeScript, Python, Rust, Go…)
- Last commit, active branch, dirty state
- Dependency count
- Test coverage detection, CI/CD presence
- README / ROADMAP / TODO status

Projects can be linked to any entity in the mission hierarchy (polymorphic links).

### Ideas Pipeline
Capture raw ideas, score them across dimensions (alignment, impact, cost, risk), and move them through: `draft → evaluating → approved → in_progress → done / discarded`.

### Password Vault
Encrypted password storage with categories, notes, and CSV import.

### Activity & Analytics
Every action is logged automatically. The right panel shows:
- Daily/weekly activity heatmap
- Task completion trends
- Ideas pipeline distribution
- Pomodoro timer + session tracking
- Streak counter

### Multi-user
Each user gets their own isolated SQLite database. Register as many accounts as you need.

### i18n
English and Spanish supported. Preference stored per user.

---

## Demo

A live demo is available at **[your-domain.com](https://your-domain.com)** (CubePath Hackathon 2026).

Login with: `demo / demo1234`

The demo account resets automatically on each server restart with pre-populated mock data.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)

### Local Development

```bash
git clone https://github.com/bpstack/matrix-cubepath.git
cd matrix-cubepath

pnpm install

cp .env.example .env
# Edit .env — set SESSION_SECRET to any random string

pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs on `:3939`.

### Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start backend + frontend in watch mode |
| `pnpm build` | Build for production |
| `pnpm start:prod` | Run production build |
| `pnpm test` | Run tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript typecheck |

---

## Deployment

Production stack: **Node.js app + Caddy** running in Docker, deployed on a CubePath VPS.

### 1. Server setup (Ubuntu 24.04)

```bash
apt update && apt install -y docker.io docker-compose-plugin git
```

### 2. Clone and configure

```bash
git clone https://github.com/bpstack/matrix-cubepath.git
cd matrix-cubepath

cp .env.example .env
nano .env  # Set SESSION_SECRET, DATA_DIR, optionally DEMO_USER
```

### 3. Configure domain

Edit `Caddyfile` and replace `localhost` with your domain:

```
your-domain.com {
    reverse_proxy app:3939
}
```

### 4. Launch

```bash
docker compose up -d
```

Caddy provisions a TLS certificate automatically via Let's Encrypt.

### Architecture

```
┌─── VPS CubePath ─────────────────────────────────┐
│                                                   │
│  ┌── Container: app ──────────────────────────┐   │
│  │  Node.js (Express + static frontend)       │   │
│  │  Port 3939 (internal)                      │   │
│  └────────────────┬───────────────────────────┘   │
│                   │ reads/writes                   │
│  ┌── Volume: matrix_data (/data) ─────────────┐   │
│  │  auth.db            ← users & sessions     │   │
│  │  users/demo.db      ← demo user data       │   │
│  │  users/bpstack.db   ← personal data        │   │
│  │  matrix.log                                │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  ┌── Container: caddy ────────────────────────┐   │
│  │  Auto HTTPS (Let's Encrypt)                │   │
│  │  Ports 80/443 → reverse proxy to app:3939  │   │
│  └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

- Each user gets an **isolated SQLite database** (`data/users/{username}.db`)
- Databases are created automatically on user registration
- The Docker volume `matrix_data` persists data across rebuilds and restarts
- **Backup**: `docker compose cp app:/data ./backup-data`
- **Shell access**: `docker compose exec app sh` → `ls /data/users/`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | ✅ | Random string for signing session tokens (32+ chars) |
| `DATA_DIR` | ✅ | Directory to store SQLite databases (e.g. `/data`) |
| `PORT` | — | Server port (default: `3939`) |
| `NODE_ENV` | — | Set to `production` for hardened cookies |
| `DEMO_USER` | — | Username for the auto-seeded demo account |
| `DEMO_PASSWORD` | — | Password for the demo account (default: `demo1234`) |

### CI/CD

Pushing to `main` triggers GitHub Actions:
1. TypeScript typecheck
2. SSH into the CubePath VPS → `git pull` + `docker compose up --build -d`

Required GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express 4 + Drizzle ORM |
| Database | SQLite via better-sqlite3 (WAL mode) — one DB per user |
| Frontend | React 18 + Vite + Tailwind CSS 3.4 |
| State | Zustand + React Query |
| Auth | scrypt password hashing + HMAC session tokens + httpOnly cookies |
| Validation | Zod (backend) + client-side validation |
| Infra | Docker multi-stage + Caddy (auto HTTPS) |
| CI/CD | GitHub Actions → SSH deploy |
| Testing | Vitest |

---

## Project Structure

```
src/
├── backend/
│   ├── controllers/     # Business logic, one per domain
│   ├── db/              # Schema (Drizzle), migrations, demo seed
│   ├── engines/         # Project scanner (filesystem + GitHub API)
│   ├── lib/             # Logger, local settings, session helpers
│   ├── middleware/       # Auth guard
│   ├── repositories/    # Drizzle queries, one per domain
│   ├── routes/          # Express routers (thin, delegate to controllers)
│   └── start.ts         # Entry point
├── frontend/
│   ├── components/      # React views and UI components, organized by domain
│   ├── hooks/           # React Query wrappers
│   ├── lib/             # API client (apiFetch), i18n dictionary
│   └── stores/          # Zustand stores (theme, pomodoro, dialog)
└── types.d.ts
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full feature list and pending work.

Next up: [GitHub API integration](./githubAPI.md) to sync project stats from GitHub repos without needing local filesystem access.

---

## License

MIT — built by [bpstack](https://github.com/bpstack)
