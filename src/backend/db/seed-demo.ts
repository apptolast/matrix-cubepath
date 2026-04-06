/**
 * Demo user seed — creates the demo account and fills their isolated DB
 * with realistic mock data so visitors can explore the app immediately.
 *
 * Safe to call multiple times: wipes and re-creates all demo data.
 * Activated at startup when DEMO_USER env var is set (default: "demo").
 *
 * Architecture:
 *   - Locale strings   → seed-locales/{en,es}.json
 *   - Structural data   → seed-data.ts
 *   - Seeding logic     → this file
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createUser, userExists, deleteUserByEmail } from './auth-db';
import { getUserDbPath, closeUserDb, openUserDb } from './user-db';
import { userDbContext } from './context';
import { runMigrations } from './migrate';
import { encrypt, deriveEncryptionKey, generateEncSalt, deriveAuthHash } from '../engines/crypto';
import { logger } from '../lib/logger';

import enLocale from './seed-locales/en.json';
import esLocale from './seed-locales/es.json';
import type { SeedLocale } from './seed-data';
import {
  SEED_OBJECTIVES,
  SEED_PLANS,
  SEED_TASKS,
  SEED_PROJECTS,
  SEED_PROJECT_LINKS,
  SEED_IDEAS,
  SEED_EVALUATIONS,
  SEED_ACTIVITIES,
  SEED_PASSWORDS,
} from './seed-data';

// ── Docs content ─────────────────────────────────────────────────────────────

const DOC_SYSTEM_DESIGN = `# System Design

## Overview
Matrix is a self-hosted productivity platform built as a single-container web app. Each user gets their own isolated SQLite database — no shared state, no multi-tenant complexity.

## Stack
- **Backend**: Node.js + Express + Drizzle ORM
- **Frontend**: React 18 + Vite + TailwindCSS
- **Database**: SQLite (better-sqlite3) — one file per user
- **Auth**: scrypt + HMAC session tokens (httpOnly cookies)
- **Deploy**: Docker multi-stage + Dokploy on CubePath VPS

## Data Model
\`\`\`
mission → objectives → plans → tasks
                             ↘ ideas (linked to objectives or plans)
projects (linked to missions/objectives/plans)
passwords (vault, AES-256 encrypted)
docs (folder tree + markdown files)
\`\`\`

## Per-User Isolation
Every authenticated request runs inside an AsyncLocalStorage context (\`userDbContext\`) that injects the user's SQLite DB. Repositories call \`getDb()\` which reads from this context — no user ID needed in queries.

## Request Flow
\`\`\`
Browser → Traefik → Express → requireAuth → userDbContext.run(db, next) → Router → Controller → Repository → SQLite
\`\`\``;

const DOC_API_REFERENCE = `# API Reference

All routes are prefixed with \`/api\`. Protected routes require an active session cookie.

## Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | \`/auth/register\` | Create account |
| POST | \`/auth/login\` | Start session |
| POST | \`/auth/logout\` | End session |

## Docs
| Method | Route | Description |
|--------|-------|-------------|
| GET | \`/docs/tree\` | Full folder + file tree (no content) |
| GET | \`/docs/search?q=\` | Search file names and content |
| POST | \`/docs/folders\` | Create folder |
| PATCH | \`/docs/folders/:id\` | Rename folder |
| PATCH | \`/docs/folders/:id/sort\` | Update sort order |
| DELETE | \`/docs/folders/:id\` | Delete folder (recursive) |
| GET | \`/docs/files/:id\` | Get file with content |
| POST | \`/docs/files\` | Create file |
| PATCH | \`/docs/files/:id\` | Update name / content / sort |
| DELETE | \`/docs/files/:id\` | Delete file |

## Tasks
| Method | Route | Description |
|--------|-------|-------------|
| GET | \`/tasks\` | All tasks (optional \`?planId=\`) |
| POST | \`/tasks\` | Create task |
| PATCH | \`/tasks/:id\` | Update task |
| DELETE | \`/tasks/:id\` | Delete task |`;

const DOC_DEPLOY = `# Deployment Guide

## Prerequisites
- CubePath VPS with Dokploy installed
- GitHub repository connected to Dokploy
- Domain configured in Traefik

## Environment Variables
\`\`\`env
SESSION_SECRET=<random 32+ char string>
DATA_DIR=/data
NODE_ENV=production
PORT=3939
SECURE_COOKIE=true
DEMO_USER=demo
DEMO_PASSWORD=demo1234
ALLOW_REGISTRATION=false
\`\`\`

## Docker Volume
The app stores all SQLite databases under \`DATA_DIR\`. The Docker Compose file mounts a named volume:
\`\`\`yaml
volumes:
  - matrix_data:/data
\`\`\`
**Never delete this volume** — it contains all user data.

## Deploy Steps
1. Push to \`main\` branch
2. Dokploy auto-detects the push via webhook
3. Multi-stage build: \`deps → builder → production\`
4. Container restarts with new image
5. Migrations run on first request per user (idempotent)

## Rollback
In Dokploy → Deployments → select a previous build → Redeploy.`;

const DOC_GIT_WORKFLOW = `# Git Workflow

## Branches
- \`main\` — production branch, auto-deploys via Dokploy
- \`feature/*\` — feature branches, merge via PR
- Never force-push to \`main\`

## Commit Convention
\`\`\`
type: short description

fix: correct session token validation
feat: add docs module
chore: update dependencies
docs: add API reference
\`\`\`

## CI Checks
Every PR runs:
1. \`pnpm typecheck\` — TypeScript strict mode
2. \`pnpm lint\` — ESLint
3. \`pnpm format:check\` — Prettier

All three must pass before merge.

## Release Flow
1. Create PR from \`feature/\` → \`main\`
2. CI passes ✓
3. Merge → Dokploy auto-deploys
4. Verify at matrix.stackbp.es`;

const DOC_SPRINT_NOTES = `# Sprint Notes

## Week 3 — Final Push

### Done
- ✅ Auth: email login + password reset (server-log flow, no SMTP required)
- ✅ Docs module: folder tree + markdown editor with syntax highlighting
- ✅ Demo seed: full mock data across all modules
- ✅ CI/CD: GitHub Actions typecheck + Dokploy auto-deploy

### In Progress
- 🔄 PWA: workbox-build schema bug blocking SW generation — tracking upstream fix
- 🔄 Mobile polish: settings page overflow on small screens

### Blocked
- ⛔ SMTP integration: waiting for VPS firewall rules

## Week 2 — Core Features

All core modules shipped:
- Tasks (Kanban + priorities + deadlines)
- Projects (scan + GitHub sync)
- Ideas (pipeline + AI evaluation)
- Passwords (AES-256 vault)
- Overview (stats + activity + widgets)

## Week 1 — Foundation

- Per-user SQLite architecture ✓
- Docker multi-stage build ✓
- Dokploy deployment ✓
- Traefik HTTPS ✓`;

export const DEMO_USERNAME = process.env.DEMO_USER || 'demo';
export const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@demo.stackbp';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

export type SeedLang = 'en' | 'es';

const locales: Record<SeedLang, SeedLocale> = { en: enLocale, es: esLocale };

// ── Helpers ──────────────────────────────────────────────────────────────────

// Vault key is set once per seed call and reused for all passwords
let _demoVaultKey: Buffer | null = null;
function setDemoVaultKey(key: Buffer) {
  _demoVaultKey = key;
}
function encryptDemo(plain: string): string {
  if (!_demoVaultKey) throw new Error('Demo vault key not initialised');
  return encrypt(plain, _demoVaultKey);
}

function dt(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function ds(offsetDays = 0): string {
  return dt(offsetDays).split('T')[0];
}

function ins(db: Database.Database, table: string, cols: string[], vals: unknown[]): number {
  const placeholders = cols.map(() => '?').join(', ');
  const result = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
  return result.lastInsertRowid as number;
}

/** Resolve a deadline offset: number → computed date string, string → literal, null → null */
function deadline(offset: number | string | null): string | null {
  if (offset === null) return null;
  if (typeof offset === 'string') return offset;
  return ds(offset);
}

// ── Seed entry point ─────────────────────────────────────────────────────────

// Known legacy demo emails that should be removed on startup to avoid orphaned logins
const LEGACY_DEMO_EMAILS = ['demo@demo.local'];

export function seedDemoUser(lang: SeedLang = 'es'): void {
  // 1. Clean up any legacy demo email rows (e.g. after email address changes)
  for (const old of LEGACY_DEMO_EMAILS) {
    if (old !== DEMO_EMAIL) deleteUserByEmail(old);
  }

  // 2. Ensure demo user exists in auth.db
  if (!userExists(DEMO_EMAIL)) {
    createUser(DEMO_EMAIL, DEMO_USERNAME, DEMO_PASSWORD);
  }

  // 3. Wipe demo DB file so we start completely fresh
  closeUserDb(DEMO_USERNAME);
  const dbPath = getUserDbPath(DEMO_USERNAME);
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // 3. Create and migrate a raw sqlite DB
  const usersDir = path.dirname(dbPath);
  fs.mkdirSync(usersDir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Run drizzle migrations via the context system
  const { drizzle } = require('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3');
  const schema = require('./schema') as typeof import('./schema');
  const db = drizzle(sqlite, { schema });
  userDbContext.run(db, () => runMigrations());

  // 4. Seed raw data directly via better-sqlite3
  populate(sqlite, lang);
  sqlite.close();

  // 5. Re-open via the pool so subsequent requests can use it
  openUserDb(DEMO_USERNAME);
  logger.info('seed', `Demo user "${DEMO_USERNAME}" seeded (${lang})`);
}

// ── Populate ─────────────────────────────────────────────────────────────────

function populate(db: Database.Database, lang: SeedLang): void {
  const L = locales[lang];

  // Mission
  const missionId = ins(
    db,
    'mission',
    ['title', 'description', 'status', 'created_at', 'updated_at'],
    [L.missionTitle, L.missionDesc, 'in_progress', dt(-20), dt(-1)],
  );

  // Objectives
  const objIds = SEED_OBJECTIVES.map((o) =>
    ins(
      db,
      'objectives',
      ['mission_id', 'title', 'description', 'sort_order', 'status', 'created_at', 'updated_at'],
      [missionId, L[o.titleKey], L[o.descKey], o.sortOrder, o.status, dt(o.createdOffset), dt(o.updatedOffset)],
    ),
  );

  // Plans
  const planIds = SEED_PLANS.map((p) =>
    ins(
      db,
      'plans',
      ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
      [
        objIds[p.objectiveIdx],
        L[p.titleKey],
        L[p.descKey],
        p.sortOrder,
        p.status,
        deadline(p.deadlineOffset),
        dt(p.createdOffset),
        dt(p.updatedOffset),
      ],
    ),
  );

  // Tasks
  const taskStmt = db.prepare(
    `INSERT INTO tasks (plan_id, title, description, status, priority, sort_order, deadline, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of SEED_TASKS) {
    taskStmt.run(
      planIds[t.planIdx],
      L[t.titleKey],
      t.descKey ? L[t.descKey] : null,
      t.status,
      t.priority,
      t.sortOrder,
      deadline(t.deadlineOffset),
      t.completedOffset !== null ? dt(t.completedOffset) : null,
      dt(t.createdOffset),
      dt(t.updatedOffset),
    );
  }

  // Projects
  const projIds = SEED_PROJECTS.map((p) =>
    ins(
      db,
      'projects',
      ['name', 'path', 'description', 'url', 'status', 'tags', 'created_at', 'updated_at'],
      [
        L[p.nameKey],
        null,
        L[p.descKey],
        p.url,
        p.status,
        JSON.stringify(p.tags),
        dt(p.createdOffset),
        dt(p.updatedOffset),
      ],
    ),
  );

  // Project links
  const linkStmt = db.prepare(
    `INSERT INTO project_links (project_id, linkable_type, linkable_id, created_at) VALUES (?, ?, ?, ?)`,
  );
  for (const pl of SEED_PROJECT_LINKS) {
    const targetId = pl.targetIdx === 'mission' ? missionId : objIds[pl.targetIdx];
    linkStmt.run(projIds[pl.projectIdx], pl.linkableType, targetId, dt(pl.createdOffset));
  }

  // Ideas
  const ideaIds: number[] = [];
  for (const idea of SEED_IDEAS) {
    ideaIds.push(
      ins(
        db,
        'ideas',
        ['title', 'description', 'status', 'target_type', 'target_id', 'project_id', 'created_at', 'updated_at'],
        [
          L[idea.titleKey],
          L[idea.descKey],
          idea.status,
          idea.targetType,
          idea.targetObjIdx !== null ? objIds[idea.targetObjIdx] : null,
          idea.projectIdx !== null ? projIds[idea.projectIdx] : null,
          dt(idea.createdOffset),
          dt(idea.updatedOffset),
        ],
      ),
    );
  }

  // Idea evaluations
  const evalStmt = db.prepare(
    `INSERT INTO idea_evaluations (idea_id, alignment_score, impact_score, cost_score, risk_score, total_score, reasoning, decision, decided_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of SEED_EVALUATIONS) {
    evalStmt.run(
      ideaIds[e.ideaIdx],
      e.alignment,
      e.impact,
      e.cost,
      e.risk,
      e.total,
      L[e.reasoningKey],
      e.decision,
      e.decidedOffset !== null ? dt(e.decidedOffset) : null,
      dt(e.createdOffset),
    );
  }

  // Activity log
  const actStmt = db.prepare(
    `INSERT INTO activity_log (action, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const a of SEED_ACTIVITIES) {
    let entityId: number;
    const ref = a.entityRef;
    if (ref.type === 'mission') entityId = missionId;
    else if (ref.type === 'objective') entityId = objIds[ref.idx];
    else if (ref.type === 'idea') entityId = ideaIds[ref.idx];
    else entityId = ref.n; // task — 1-based row number
    actStmt.run(a.action, a.entityType, entityId, L[a.descKey], dt(a.createdOffset));
  }

  // Docs — folders (root id=1 already seeded by migration)
  const archFolderId = ins(
    db,
    'doc_folders',
    ['parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    [1, L.docFolderArchitecture, 0, dt(-12), dt(-3)],
  );
  const procFolderId = ins(
    db,
    'doc_folders',
    ['parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    [1, L.docFolderProcesses, 1, dt(-12), dt(-4)],
  );
  const notesFolderId = ins(
    db,
    'doc_folders',
    ['parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    [1, L.docFolderNotes, 2, dt(-8), dt(-1)],
  );

  // Docs — files
  const docFileStmt = db.prepare(
    `INSERT INTO doc_files (folder_id, name, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  docFileStmt.run(archFolderId, L.docFileSystemDesign, DOC_SYSTEM_DESIGN, 0, dt(-11), dt(-3));
  docFileStmt.run(archFolderId, L.docFileApiRef, DOC_API_REFERENCE, 1, dt(-10), dt(-2));
  docFileStmt.run(procFolderId, L.docFileDeploy, DOC_DEPLOY, 0, dt(-9), dt(-4));
  docFileStmt.run(procFolderId, L.docFileGitWorkflow, DOC_GIT_WORKFLOW, 1, dt(-9), dt(-5));
  docFileStmt.run(notesFolderId, L.docFileSprintNotes, DOC_SPRINT_NOTES, 0, dt(-7), dt(-1));

  // Settings + Vault setup
  const setStmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`);
  setStmt.run('language', lang, dt(-20));
  setStmt.run('theme', 'dark', dt(-20));
  setStmt.run('deadlineAlerts', 'true', dt(-10));

  // Pre-configure vault with DEMO_PASSWORD so any visitor can unlock it
  const encSalt = generateEncSalt();
  const vaultKey = deriveEncryptionKey(DEMO_PASSWORD, encSalt);
  setDemoVaultKey(vaultKey);
  const authResult = deriveAuthHash(DEMO_PASSWORD);
  setStmt.run('passwords_auth_hash', authResult.hash, dt(-20));
  setStmt.run('passwords_salt_auth', authResult.salt, dt(-20));
  setStmt.run('passwords_salt_enc', encSalt, dt(-20));

  // Passwords (encrypted with DEMO_PASSWORD vault key)
  const pwStmt = db.prepare(
    `INSERT INTO passwords (label, domain, username, encrypted_password, category, favorite, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of SEED_PASSWORDS) {
    pwStmt.run(
      p.labelKey ? L[p.labelKey] : p.label,
      p.domain,
      p.username,
      encryptDemo(p.plainPassword),
      p.category,
      p.favorite,
      p.notesKey ? L[p.notesKey] : null,
      dt(p.createdOffset),
      dt(p.updatedOffset),
    );
  }
}
