# Matrix — Roadmap

> Sistema de gestión personal: Misiones → Objetivos → Planes → Tareas, con ideas, passwords, pomodoro y actividad.
> Desplegado en CubePath VPS para la Hackatón CubePath 2026 (deadline: 31 mar 2026).

---

## Stack

- **Backend**: Node.js + Express + Drizzle ORM + SQLite (better-sqlite3, WAL mode)
- **Frontend**: React 18 + Vite + Tailwind CSS 3.4 + Zustand + React Query
- **Auth**: Sesiones con express-session + bcrypt
- **Infra**: Docker multi-stage + Caddy (HTTPS automático) + CubePath VPS
- **CI/CD**: GitHub Actions → SSH deploy en CubePath

---

## Implementado ✅

### Infraestructura

- [x] Migración de Electron → web app standalone (sin `window.matrix.*`)
- [x] Entry point `src/backend/start.ts` (Node puro, sin Electron)
- [x] DB SQLite en `DATA_DIR` configurable por env var
- [x] Dockerfile multi-stage (deps → build → production)
- [x] `docker-compose.yml` con app + Caddy (HTTPS automático)
- [x] Caddyfile con reverse proxy y TLS

### Demo & seguridad

- [x] Usuario demo con mock data completo (`DEMO_USER` env var)
- [x] Reset de datos demo en cada startup + endpoint `POST /api/demo/reset`
- [x] Rate limiter global 300 req/min por IP en todos los endpoints API (React Query hace ~30-50 en carga inicial)
- [x] Rate limiter específico en `/auth/login` y `/auth/register` (10/15min)

### Autenticación

- [x] Registro y login con bcrypt
- [x] Sesiones con express-session
- [x] Middleware de auth en rutas protegidas
- [x] Contexto de usuario en DB (multi-user ready)
- [x] Rate limiting en `/auth/login` y `/auth/register` (10 intentos / 15 min)
- [x] Límite máximo de password 128 chars (previene bcrypt DoS)
- [x] Validación client-side en LoginPage antes de hacer fetch

### Backend API

- [x] CRUD completo: misiones, objetivos, planes, tareas
- [x] Ideas con evaluación y estados (pipeline)
- [x] Passwords vault (cifrado)
- [x] Projects con scanner y polymorphic links
- [x] Activity log con métricas (diarias, semanales, streak)
- [x] Settings por usuario
- [x] Local settings (basePath)
- [x] Logs API (`GET /api/logs`, `POST /api/logs/clear`)
- [x] Stats y deadlines

### Frontend

- [x] Sidebar con tabs: Overview, Projects, Tasks, Ideas, Passwords, Settings
- [x] TaskBoard con prioridades, deadlines, Calendar picker, estados kanban
- [x] IdeasView con modal de creación/edición y pipeline
- [x] RightPanel: métricas de actividad, pomodoro timer, top ideas
- [x] PasswordsView con `<input type="file">` para import CSV
- [x] SettingsView con logs viewer y config de paths
- [x] Auth views (login/registro)
- [x] i18n EN/ES
- [x] Tema dark/light (Zustand + matchMedia)
- [x] Hooks: `useActivityMetrics`, `useIdeasPipeline`, `useDeadlines`, `useTasks`
- [x] Store: `pomodoro.store`

---

## Pendiente 🔲

### CI/CD — GitHub Actions → CubePath VPS

- [x] `ci.yml`: typecheck en cada push/PR
- [x] `release.yml`: en push a `main`, SSH al VPS → backup automático → `git pull` + `docker compose up --build -d`
- [x] Backup automático pre-deploy: `/backups/matrix/{timestamp}/data/` (últimos 7)
- [x] Estrategia: deploy directo SSH (simple para VPS nano)
- [ ] Añadir secrets en GitHub (`Settings → Secrets and variables → Actions`): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

**Restaurar backup en el VPS:**
```bash
docker compose cp /backups/matrix/{timestamp}/data app:/data
docker compose restart app
```

### Despliegue inicial en CubePath

- [ ] Crear servidor VPS en CubePath (nano, Ubuntu 24.04)
- [ ] Instalar Docker + Docker Compose en el VPS
- [ ] Clonar repo en VPS y configurar `.env` con `SESSION_SECRET`
- [ ] Apuntar dominio/subdominio al VPS (o usar IP directa para demo)
- [ ] Primer `docker compose up -d` manual
- [ ] Verificar HTTPS automático con Caddy

### Hackathon requirements

- [ ] README.md con descripción, demo link, screenshots/GIFs, cómo se usa CubePath
- [ ] Repo público
- [ ] Demo funcional accesible públicamente
- [ ] Registrar participación creando issue en el repo de la hackathon

### GitHub API Integration

Reemplazar el scanner de filesystem local por llamadas a la GitHub API, para que los proyectos funcionen en cualquier máquina (incluido el VPS desplegado). Plan detallado en [`githubAPI.md`](./githubAPI.md).

- [ ] **`src/backend/engines/github-scanner.ts`** — nuevo engine con llamadas paralelas: lenguajes, commits, árbol de archivos, README/ROADMAP/TODO, dependencias
- [ ] **Settings backend** — guardar/recuperar `github_token` en tabla `settings` por usuario
- [ ] **`GET /api/settings/github-status`** — verificar token contra `GET https://api.github.com/user`
- [ ] **Settings frontend** — sección "GitHub Integration" con input de PAT + estado de conexión (reemplaza "Base Path")
- [ ] **`POST /api/projects/:id/sync-github`** — endpoint que llama al engine y guarda resultado en `scan` + `tech_stats`
- [ ] **Project create** — aceptar URL de GitHub (`https://github.com/owner/repo` o `owner/repo`) en vez de path local
- [ ] **Project detail** — botón "Sync from GitHub" (visible cuando el proyecto tiene `url` configurada)
- [ ] **Tests** — mockear `fetch` para las llamadas a la GitHub API

### Funcionalidades pendientes

- [ ] Overview view (página de inicio con resumen)
- [ ] Notificaciones de deadlines próximos
- [ ] Export de datos (JSON/CSV)
- [ ] Modo offline / PWA (nice to have)

### Problemas a revisar

- [ ] React Query lanza todas las queries en paralelo al montar una vista.

---

## Decisiones clave

| Decisión              | Elección               | Razón                                                     |
| --------------------- | ---------------------- | --------------------------------------------------------- |
| Reverse proxy         | Caddy                  | HTTPS automático sin configuración extra                  |
| Deploy CI/CD          | SSH directo            | Más simple que registry para VPS nano con 2GB RAM         |
| BD                    | SQLite                 | Suficiente para demo single-instance, sin servicios extra |
| Contenedores          | 1 app + 1 Caddy        | Separa concerns sin añadir complejidad                    |
| Import CSV passwords  | `<input type="file">`  | API nativa del browser, sin dependencias Electron         |
| Rutas API en frontend | Relativas (`/api/...`) | Caddy hace proxy, no se hardcodea host                    |
