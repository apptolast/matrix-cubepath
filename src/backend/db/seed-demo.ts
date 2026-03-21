/**
 * Demo user seed — creates the demo account and fills their isolated DB
 * with realistic mock data so visitors can explore the app immediately.
 *
 * Safe to call multiple times: wipes and re-creates all demo data.
 * Activated at startup when DEMO_USER env var is set (default: "demo").
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createUser, userExists } from './auth-db';
import { getUserDbPath, closeUserDb, openUserDb } from './user-db';
import { userDbContext } from './context';
import { runMigrations } from './migrate';
import { encrypt, deriveEncryptionKey, generateEncSalt } from '../engines/crypto';
import { logger } from '../lib/logger';

export const DEMO_USERNAME = process.env.DEMO_USER || 'demo';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

function encryptDemo(plain: string): string {
  const salt = generateEncSalt();
  const key = deriveEncryptionKey('demo-vault', salt);
  return `${salt}:${encrypt(plain, key)}`;
}

function dt(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function ds(offsetDays = 0): string {
  return dt(offsetDays).split('T')[0];
}

// Fixed deadline dates (hackathon window)
const D3 = '2026-04-03';
const D4 = '2026-04-04';
const D5 = '2026-04-05';
const D6 = '2026-04-06';

export function seedDemoUser(): void {
  // 1. Ensure demo user exists in auth.db
  if (!userExists(DEMO_USERNAME)) {
    createUser(DEMO_USERNAME, DEMO_PASSWORD);
  }

  // 2. Wipe demo DB file so we start completely fresh
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

  // 4. Seed raw data directly via better-sqlite3 for simplicity
  populate(sqlite);
  sqlite.close();

  // 5. Re-open via the normal cache so subsequent requests work
  openUserDb(DEMO_USERNAME);

  logger.info('seed-demo', `Demo user "${DEMO_USERNAME}" seeded`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ins(db: Database.Database, table: string, cols: string[], vals: unknown[]): number {
  const placeholders = cols.map(() => '?').join(', ');
  const result = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
  return result.lastInsertRowid as number;
}

// ── Data ──────────────────────────────────────────────────────────────────────

function populate(db: Database.Database): void {
  // Mission
  const missionId = ins(db, 'mission',
    ['title', 'description', 'status', 'created_at', 'updated_at'],
    ['Launch Matrix to Production',
      'Build and ship a personal management system to CubePath VPS before the hackathon deadline.',
      'in_progress', dt(-20), dt(-1)]);

  // Objectives
  const obj1 = ins(db, 'objectives',
    ['mission_id', 'title', 'description', 'sort_order', 'status', 'created_at', 'updated_at'],
    [missionId, 'Backend API & Auth', 'Secure Express API with per-user SQLite and session auth.', 0, 'completed', dt(-18), dt(-5)]);
  const obj2 = ins(db, 'objectives',
    ['mission_id', 'title', 'description', 'sort_order', 'status', 'created_at', 'updated_at'],
    [missionId, 'Frontend UI', 'React SPA: tasks, ideas, passwords, settings.', 1, 'in_progress', dt(-15), dt(-1)]);
  const obj3 = ins(db, 'objectives',
    ['mission_id', 'title', 'description', 'sort_order', 'status', 'created_at', 'updated_at'],
    [missionId, 'Deploy to CubePath', 'Docker + Caddy reverse proxy with auto HTTPS.', 2, 'in_progress', dt(-10), dt(-1)]);

  // Plans
  const plan1 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj1, 'Database Architecture', 'Per-user SQLite schema with Drizzle ORM.', 0, 'completed', ds(-10), dt(-18), dt(-12)]);
  const plan2 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj1, 'Auth System', 'scrypt + HMAC tokens, rate limiting, timing-safe comparisons.', 1, 'completed', ds(-8), dt(-14), dt(-6)]);
  const plan3 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj2, 'Task Board', 'Kanban with priorities, deadlines and calendar picker.', 0, 'in_progress', D4, dt(-12), dt(-1)]);
  const plan4 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj2, 'Ideas Pipeline', 'Capture ideas with evaluation scores and funnel view.', 1, 'in_progress', D5, dt(-8), dt(-1)]);
  const plan5 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj3, 'Docker & Caddy', 'Multi-stage Dockerfile with Caddy for TLS.', 0, 'completed', ds(-3), dt(-7), dt(-2)]);
  const plan6 = ins(db, 'plans',
    ['objective_id', 'title', 'description', 'sort_order', 'status', 'deadline', 'created_at', 'updated_at'],
    [obj3, 'CI/CD Pipeline', 'GitHub Actions → SSH deploy on push to main.', 1, 'in_progress', D6, dt(-5), dt(-1)]);

  // Tasks
  type TaskRow = [number, string, string | null, string, string, number, string | null, string | null, string, string];
  const tasks: TaskRow[] = [
    // plan1 - completed
    [plan1, 'Design mission hierarchy schema', 'mission → objectives → plans → tasks', 'done', 'high', 0, ds(-16), dt(-16), dt(-18), dt(-16)],
    [plan1, 'Implement Drizzle ORM migrations', null, 'done', 'medium', 1, ds(-14), dt(-14), dt(-17), dt(-14)],
    [plan1, 'Enable WAL mode + foreign keys', 'Better concurrent read performance', 'done', 'medium', 2, ds(-13), dt(-13), dt(-16), dt(-13)],
    // plan2 - completed
    [plan2, 'Implement scrypt password hashing', 'crypto.scryptSync, 64-byte key', 'done', 'urgent', 0, ds(-12), dt(-10), dt(-14), dt(-10)],
    [plan2, 'Build HMAC session tokens', 'httpOnly + secure cookies', 'done', 'high', 1, ds(-10), dt(-9), dt(-13), dt(-9)],
    [plan2, 'Rate limiting on auth routes', '10 attempts / 15 min per IP', 'done', 'high', 2, ds(-8), dt(-7), dt(-12), dt(-7)],
    [plan2, 'Prevent timing attacks on login', 'Always run hash for unknown users', 'done', 'medium', 3, null, dt(-6), dt(-11), dt(-6)],
    // plan3 - in progress
    [plan3, 'Kanban columns (pending / in_progress / done)', null, 'done', 'high', 0, ds(-2), dt(-5), dt(-12), dt(-5)],
    [plan3, 'Priority dots with cycle on click', 'low → medium → high → urgent', 'done', 'medium', 1, null, dt(-3), dt(-10), dt(-3)],
    [plan3, 'Deadline badge with color coding', 'Red=overdue, amber=today, green=soon', 'in_progress', 'high', 2, D3, null, dt(-8), dt(-1)],
    [plan3, 'Calendar date picker integration', null, 'in_progress', 'medium', 3, D4, null, dt(-6), dt(-1)],
    [plan3, 'Drag and drop between columns', null, 'pending', 'low', 4, D6, null, dt(-4), dt(-4)],
    // plan4 - in progress
    [plan4, 'Idea capture form with target linking', null, 'done', 'high', 0, ds(-1), dt(-2), dt(-8), dt(-2)],
    [plan4, 'Evaluation scores UI', 'alignment, impact, cost, risk sliders', 'in_progress', 'high', 1, D4, null, dt(-6), dt(-1)],
    [plan4, 'Funnel view by status', 'pending → evaluated → approved/rejected', 'pending', 'medium', 2, D5, null, dt(-5), dt(-5)],
    // plan5 - completed
    [plan5, 'Multi-stage Dockerfile', 'deps → builder → production', 'done', 'high', 0, ds(-5), dt(-4), dt(-7), dt(-4)],
    [plan5, 'Caddyfile with TLS + reverse proxy', null, 'done', 'high', 1, ds(-4), dt(-3), dt(-6), dt(-3)],
    [plan5, 'docker-compose with matrix_data volume', null, 'done', 'medium', 2, ds(-3), dt(-2), dt(-5), dt(-2)],
    // plan6 - in progress
    [plan6, 'CI workflow — typecheck on PR', null, 'done', 'medium', 0, null, dt(-1), dt(-5), dt(-1)],
    [plan6, 'Deploy workflow — SSH on push to main', null, 'in_progress', 'high', 1, D5, null, dt(-4), dt(-1)],
    [plan6, 'Add VPS secrets to GitHub repo', 'VPS_HOST, VPS_USER, VPS_SSH_KEY', 'pending', 'urgent', 2, D6, null, dt(-3), dt(-3)],
    [plan6, 'First manual SSH deploy test', null, 'pending', 'high', 3, D6, null, dt(-2), dt(-2)],
  ];

  const taskStmt = db.prepare(
    `INSERT INTO tasks (plan_id, title, description, status, priority, sort_order, deadline, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of tasks) taskStmt.run(...t);

  // Projects
  const proj1 = ins(db, 'projects',
    ['name', 'path', 'description', 'url', 'status', 'tags', 'created_at', 'updated_at'],
    ['matrix-cubepath', null, 'This app — deployed on CubePath for the hackathon.',
      'bpstack/matrix-cubepath', 'active', JSON.stringify(['typescript', 'react', 'sqlite', 'docker']), dt(-20), dt(-1)]);
  const proj2 = ins(db, 'projects',
    ['name', 'path', 'description', 'url', 'status', 'tags', 'created_at', 'updated_at'],
    ['matrix', null, 'Original Electron desktop version — free your mind.',
      'bpstack/matrix', 'active', JSON.stringify(['electron', 'typescript', 'react']), dt(-90), dt(-15)]);
  ins(db, 'projects',
    ['name', 'path', 'description', 'url', 'status', 'tags', 'created_at', 'updated_at'],
    ['weather-bp', null, 'OpenMeteo Weather Buddy.',
      'bpstack/weather-bp', 'active', JSON.stringify(['typescript', 'openmeteo']), dt(-120), dt(-20)]);

  // Project links
  const linkStmt = db.prepare(`INSERT INTO project_links (project_id, linkable_type, linkable_id, created_at) VALUES (?, ?, ?, ?)`);
  linkStmt.run(proj1, 'mission', missionId, dt(-19));
  linkStmt.run(proj1, 'objective', obj3, dt(-10));
  linkStmt.run(proj2, 'objective', obj2, dt(-12));

  // Ideas
  type IdeaRow = [string, string | null, string, string | null, number | null, number | null, string, string];
  const ideas: IdeaRow[] = [
    ['Add AI-powered task suggestions', 'Use Claude API to suggest next actions based on current objectives and activity.', 'approved', 'objective', obj2, proj1, dt(-14), dt(-5)],
    ['Recurring tasks', 'Allow tasks to repeat daily/weekly/monthly with auto-reset.', 'evaluated', 'objective', obj2, null, dt(-10), dt(-3)],
    ['Mobile PWA mode', 'Service worker + manifest for offline-capable mobile experience.', 'pending', null, null, null, dt(-7), dt(-7)],
    ['Team workspaces', 'Multiple users sharing a mission — invite via link.', 'rejected', null, null, null, dt(-12), dt(-4)],
    ['Export data as JSON/CSV', 'Full export of all user data for backup or migration.', 'pending', null, null, null, dt(-5), dt(-5)],
    ['Pomodoro timer in RightPanel', 'Visible countdown tied to the current in-progress task.', 'approved', 'objective', obj2, proj1, dt(-8), dt(-2)],
    ['Calendar view for deadlines', 'Monthly calendar showing all task and plan deadlines.', 'evaluated', 'objective', obj2, null, dt(-6), dt(-2)],
  ];

  const ideaStmt = db.prepare(
    `INSERT INTO ideas (title, description, status, target_type, target_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ideaIds: number[] = [];
  for (const i of ideas) ideaIds.push(ins(db, 'ideas',
    ['title', 'description', 'status', 'target_type', 'target_id', 'project_id', 'created_at', 'updated_at'], i));

  void ideaStmt;

  // Idea evaluations (for ideas that are evaluated/approved/rejected)
  type EvalRow = [number, number, number, number, number, number, string, string, string | null, string];
  const evals: EvalRow[] = [
    [ideaIds[0], 9, 8, 5, 4, 78, 'Strong alignment with mission. High impact, manageable cost. Schedule post-MVP.', 'approved', dt(-5), dt(-10)],
    [ideaIds[1], 7, 7, 6, 3, 72, 'Adds schema complexity. Good feature for v1.1.', 'pending', null, dt(-8)],
    [ideaIds[3], 4, 9, 2, 8, 45, 'Multi-tenancy complexity too high for hackathon scope.', 'rejected', dt(-4), dt(-9)],
    [ideaIds[5], 10, 7, 8, 2, 82, 'Already in RightPanel. High alignment, quick win.', 'approved', dt(-2), dt(-6)],
    [ideaIds[6], 8, 6, 6, 3, 69, 'Useful but non-critical. Post-launch candidate.', 'pending', null, dt(-4)],
  ];

  const evalStmt = db.prepare(
    `INSERT INTO idea_evaluations (idea_id, alignment_score, impact_score, cost_score, risk_score, total_score, reasoning, decision, decided_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of evals) evalStmt.run(...e);

  // Activity log — spread across past 20 days
  const act = db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?)`);
  act.run('created', 'mission', missionId, 'Created mission: Launch Matrix to Production', dt(-20));
  act.run('created', 'objective', obj1, 'Created objective: Backend API & Auth', dt(-18));
  act.run('created', 'objective', obj2, 'Created objective: Frontend UI', dt(-15));
  act.run('completed', 'task', 1, 'Completed task: Design mission hierarchy schema', dt(-16));
  act.run('completed', 'task', 2, 'Completed task: Implement Drizzle ORM migrations', dt(-14));
  act.run('completed', 'task', 4, 'Completed task: Implement scrypt password hashing', dt(-10));
  act.run('completed', 'task', 5, 'Completed task: Build HMAC session tokens', dt(-9));
  act.run('completed', 'task', 6, 'Completed task: Rate limiting on auth routes', dt(-7));
  act.run('created', 'objective', obj3, 'Created objective: Deploy to CubePath', dt(-10));
  act.run('created', 'idea', ideaIds[0], 'Created idea: Add AI-powered task suggestions', dt(-14));
  act.run('created', 'idea', ideaIds[5], 'Created idea: Pomodoro timer in RightPanel', dt(-8));
  act.run('completed', 'task', 8, 'Completed task: Kanban columns', dt(-5));
  act.run('completed', 'task', 9, 'Completed task: Priority dots with cycle on click', dt(-3));
  act.run('completed', 'task', 16, 'Completed task: Multi-stage Dockerfile', dt(-4));
  act.run('completed', 'task', 17, 'Completed task: Caddyfile with TLS + reverse proxy', dt(-3));
  act.run('completed', 'task', 18, 'Completed task: docker-compose with volume', dt(-2));
  act.run('completed', 'task', 19, 'Completed task: CI workflow — typecheck on PR', dt(-1));
  act.run('created', 'idea', ideaIds[4], 'Created idea: Export data as JSON/CSV', dt(-5));

  // Settings
  const set = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`);
  set.run('language', 'en', dt(-20));
  set.run('theme', 'dark', dt(-20));

  // Passwords (encrypted with demo-vault master password)
  type PwRow = [string, string | null, string | null, string, string, number, string | null, string, string];
  const pws: PwRow[] = [
    ['GitHub', 'github.com', 'dz_dev', encryptDemo('gh_pat_demo_1234'), 'development', 1, 'Personal GitHub account', dt(-30), dt(-5)],
    ['CubePath VPS', 'cubepath.com', 'admin', encryptDemo('cubepath_demo!'), 'server', 1, 'Hackathon VPS instance', dt(-10), dt(-2)],
    ['Vercel', 'vercel.com', 'dz@example.com', encryptDemo('vercel_demo_xyz'), 'development', 0, null, dt(-25), dt(-10)],
    ['Linear', 'linear.app', 'dz@example.com', encryptDemo('linear_pw_demo'), 'productivity', 0, 'Project tracking', dt(-20), dt(-8)],
    ['Figma', 'figma.com', 'dz@example.com', encryptDemo('figma_demo_pass'), 'design', 0, null, dt(-15), dt(-15)],
  ];

  const pwStmt = db.prepare(
    `INSERT INTO passwords (label, domain, username, encrypted_password, category, favorite, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of pws) pwStmt.run(...p);
}
