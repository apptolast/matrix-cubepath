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
import { createUser, userExists } from './auth-db';
import { getUserDbPath, closeUserDb, openUserDb } from './user-db';
import { userDbContext } from './context';
import { runMigrations } from './migrate';
import { encrypt, deriveEncryptionKey, generateEncSalt } from '../engines/crypto';
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

export const DEMO_USERNAME = process.env.DEMO_USER || 'demo';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

export type SeedLang = 'en' | 'es';

const locales: Record<SeedLang, SeedLocale> = { en: enLocale, es: esLocale };

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export function seedDemoUser(lang: SeedLang = 'es'): void {
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

  // Settings
  const setStmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`);
  setStmt.run('language', lang, dt(-20));
  setStmt.run('theme', 'dark', dt(-20));
  setStmt.run('deadlineAlerts', 'true', dt(-10));

  // Passwords (encrypted with demo-vault master password — all data is fictional)
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
