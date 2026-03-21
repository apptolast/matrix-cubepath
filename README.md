# Matrix — Projects Management System

<p align="center">
  <strong>Define your mission. Break it into objectives. Plan. Execute. Track every project, capture every idea, and keep your credentials safe — all from one self-hosted dashboard.</strong>
</p>

<p align="center">
  Matrix is a full-stack productivity platform built for developers who juggle multiple projects at once. It connects your high-level mission to daily tasks through a clear hierarchy (<strong>Mission → Objectives → Plans → Tasks</strong>), tracks your GitHub repos, evaluates ideas before you commit to them, stores passwords securely, and gives you metrics, streaks, and a daily focus view so nothing falls through the cracks.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#tech-stack">Stack</a> •
  <a href="#migration-from-matrix-electron">Migration</a>
</p>

---

## Migration from Matrix (Electron)

Matrix-CubePath is the web evolution of [Matrix](https://github.com/bpstack/matrix), originally built as an Electron desktop app. The core mission hierarchy and task management remain the same, but the migration brought fundamental changes:

| | Matrix (Electron) | Matrix-CubePath (Web) |
|---|---|---|
| **Runtime** | Desktop app (.exe / .dmg) | Web app — accessible from any browser |
| **Users** | Single user, no authentication | Multi-user with registration, login, and rate limiting |
| **Database** | One shared SQLite file | Auth DB + isolated per-user SQLite databases |
| **Project Scanning** | Local filesystem (reads directories, git info, file stats) | GitHub API (repos, languages, commits, README detection) |
| **File Access** | Native dialogs via Electron IPC | Form inputs (no filesystem access) |
| **Deployment** | Packaged binary with auto-updates | Docker container on any VPS or cloud provider |

The most visible change is the **Projects module**: the Electron version scanned your local machine for repos, reading the file tree, running git commands, and counting lines of code. The web version pulls this information from the GitHub API instead — fetching languages, commits, CI/CD status, and documentation presence without needing local access.

See [ROADMAP.md](./ROADMAP.md) for planned work on deepening this migration.

---

## The Problem

You have ideas scattered across `.txt` files. Projects without clear priorities. Tasks that feel disconnected from any bigger goal. Credentials buried in random places.

Questions that keep appearing:

- What's the actual plan right now?
- Which task actually moves the needle today?
- What's the status of all my side projects?
- Where did I put that API key?

**Matrix** brings all of this into one self-hosted platform — your data, your server, your rules.

---

## Features

### Mission Control

Structured top-down planning: **Mission → Objectives → Plans → Tasks**. Progress rolls up automatically at each level so you always know where you stand.

### Task Board

Kanban-style board with priorities (critical / high / medium / low), deadlines, and status tracking (Todo → In Progress → Done). Calendar date picker for deadlines.

### Project Tracker

Track your GitHub repos. Each project syncs:

- Language breakdown (TypeScript, Python, Rust, Go...)
- Last commit, active branch
- Dependency count
- Test coverage detection, CI/CD presence
- README / ROADMAP / TODO status

Projects can be linked to any entity in the mission hierarchy (polymorphic links).

### Ideas Pipeline

Capture raw ideas, score them across dimensions (alignment, impact, cost, risk), and move them through: `draft → evaluating → approved → in_progress → done / discarded`.

### Password Vault

Encrypted password storage with categories, notes, and search.

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

A live demo is available at **[matrix.stackbp.es](https://matrix.stackbp.es)**

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

| Command           | Description                            |
| ----------------- | -------------------------------------- |
| `pnpm dev`        | Start backend + frontend in watch mode |
| `pnpm build`      | Build for production                   |
| `pnpm start:prod` | Run production build                   |
| `pnpm test`       | Run tests (Vitest)                     |
| `pnpm lint`       | ESLint                                 |
| `pnpm typecheck`  | TypeScript typecheck                   |

---

## Deployment

### Option A: Dokploy (Recommended)

[Dokploy](https://dokploy.com) provides a web UI for managing Docker deployments with automatic HTTPS via Traefik.

**1. Install Dokploy on your VPS:**

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

**2. Open the Dokploy panel** at `http://your-vps-ip:3000` and create an admin account.

**3. Create a new project** → add a **Compose** service:

- **Provider**: GitHub
- **Repository**: `bpstack/matrix-cubepath`
- **Branch**: `main`
- **Compose Path**: `./docker-compose.yml`

**4. Configure environment variables** in the Environment tab:

```
NODE_ENV=production
PORT=3939
DATA_DIR=/data
SESSION_SECRET=your-random-secret-string-here
DEMO_USER=demo
DEMO_PASSWORD=demo1234
```

**5. Configure your domain** in the Domains tab:

- **Host**: `your-domain.com`
- **Container Port**: `3939`
- **HTTPS**: enabled (auto-provisions Let's Encrypt certificate)

**6. Deploy.** Dokploy supports auto-deploy on push — every push to `main` triggers a rebuild automatically.

### Option B: Docker Compose (Manual)

For a standalone deployment without Dokploy:

**1. Server setup (Ubuntu 24.04):**

```bash
apt update && apt install -y docker.io docker-compose-plugin git
```

**2. Clone and configure:**

```bash
git clone https://github.com/bpstack/matrix-cubepath.git
cd matrix-cubepath

cp .env.example .env
nano .env  # Set SESSION_SECRET, DATA_DIR, optionally DEMO_USER
```

**3. Configure reverse proxy:**

Edit `Caddyfile` and replace `localhost` with your domain, then restore the Caddy service in `docker-compose.yml`.

**4. Launch:**

```bash
docker compose up -d
```

### Architecture

```
┌─── VPS (CubePath / any provider) ────────────────┐
│                                                   │
│  ┌── Traefik (Dokploy) ────────────────────────┐  │
│  │  Auto HTTPS (Let's Encrypt)                 │  │
│  │  Ports 80/443 → reverse proxy to app:3939   │  │
│  └──────────────┬──────────────────────────────┘  │
│                 │                                  │
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
└───────────────────────────────────────────────────┘
```

- Each user gets an **isolated SQLite database** (`data/users/{username}.db`)
- Databases are created automatically on user registration
- The Docker volume `matrix_data` persists data across rebuilds and restarts
- **Backup**: `docker compose cp app:/data ./backup-data`
- **Shell access**: `docker compose exec app sh` → `ls /data/users/`

### Environment Variables

| Variable         | Required | Description                                          |
| ---------------- | -------- | ---------------------------------------------------- |
| `SESSION_SECRET` | Yes      | Random string for signing session tokens (32+ chars) |
| `DATA_DIR`       | Yes      | Directory to store SQLite databases (e.g. `/data`)   |
| `PORT`           | —        | Server port (default: `3939`)                        |
| `NODE_ENV`       | —        | Set to `production` for static file serving          |
| `SECURE_COOKIE`  | —        | Set to `true` for HTTPS-only cookies (recommended)   |
| `DEMO_USER`      | —        | Username for the auto-seeded demo account            |
| `DEMO_PASSWORD`  | —        | Password for the demo account (default: `demo1234`)  |

### CI/CD

Pushing to `main` or opening a pull request triggers GitHub Actions:

- TypeScript typecheck (`pnpm typecheck`)

Deployment is handled by Dokploy's auto-deploy on push — no SSH keys or deploy workflows required.

---

## Tech Stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Backend    | Node.js + Express 4 + Drizzle ORM                                |
| Database   | SQLite via better-sqlite3 (WAL mode) — one DB per user           |
| Frontend   | React 18 + Vite + Tailwind CSS 3.4                               |
| State      | Zustand + React Query                                            |
| Auth       | scrypt password hashing + HMAC session tokens + httpOnly cookies |
| Validation | Zod (backend) + client-side validation                           |
| Infra      | Docker multi-stage + Dokploy + Traefik (auto HTTPS)              |
| CI/CD      | GitHub Actions (typecheck) + Dokploy auto-deploy                 |
| Testing    | Vitest                                                           |

---

## Project Structure

```
src/
├── backend/
│   ├── controllers/     # Business logic, one per domain
│   ├── db/              # Schema (Drizzle), migrations, per-user DB, demo seed
│   ├── engines/         # Project scanner (GitHub API + local filesystem)
│   ├── lib/             # Logger, local settings, session helpers
│   ├── middleware/       # Auth guard, rate limiting
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

---

## License

MIT — built by [bpstack](https://github.com/bpstack)
