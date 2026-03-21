import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

export function createTestDb() {
  const sqliteDb = new Database(':memory:');
  sqliteDb.pragma('foreign_keys = ON');

  sqliteDb.exec(`
    CREATE TABLE mission (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER REFERENCES mission(id),
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id INTEGER REFERENCES objectives(id),
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER REFERENCES plans(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      sort_order INTEGER DEFAULT 0,
      deadline TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT,
      description TEXT,
      url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      tags TEXT,
      tech_stats TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE project_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      linkable_type TEXT NOT NULL,
      linkable_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      promoted_to_type TEXT,
      promoted_to_id INTEGER,
      target_type TEXT,
      target_id INTEGER,
      project_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE idea_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL UNIQUE,
      alignment_score INTEGER NOT NULL,
      impact_score INTEGER NOT NULL,
      cost_score INTEGER NOT NULL,
      risk_score INTEGER NOT NULL,
      total_score REAL NOT NULL,
      reasoning TEXT,
      decision TEXT NOT NULL DEFAULT 'pending',
      decided_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE project_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      blockers INTEGER NOT NULL DEFAULT 0,
      wip_items INTEGER NOT NULL DEFAULT 0,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      raw_data TEXT,
      scanned_at TEXT NOT NULL
    );

    CREATE TABLE activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      domain TEXT,
      username TEXT,
      encrypted_password TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      favorite INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return sqliteDb;
}

export function seedMission(db: Database.Database, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const mission = {
    title: overrides?.title ?? 'Test Mission',
    description: overrides?.description ?? 'Test Description',
    status: overrides?.status ?? 'in_progress',
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO mission (title, description, status, created_at, updated_at)
    VALUES (@title, @description, @status, @created_at, @updated_at)
  `);
  const result = stmt.run(mission);
  return { id: result.lastInsertRowid, ...mission };
}

export function seedObjective(db: Database.Database, missionId: number, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const objective = {
    mission_id: missionId,
    title: overrides?.title ?? 'Test Objective',
    description: overrides?.description ?? 'Test Description',
    sort_order: overrides?.sort_order ?? 0,
    status: overrides?.status ?? 'in_progress',
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO objectives (mission_id, title, description, sort_order, status, created_at, updated_at)
    VALUES (@mission_id, @title, @description, @sort_order, @status, @created_at, @updated_at)
  `);
  const result = stmt.run(objective);
  return { id: result.lastInsertRowid, ...objective };
}

export function seedPlan(db: Database.Database, objectiveId: number, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const plan = {
    objective_id: objectiveId,
    title: overrides?.title ?? 'Test Plan',
    description: overrides?.description ?? 'Test Description',
    sort_order: overrides?.sort_order ?? 0,
    status: overrides?.status ?? 'in_progress',
    deadline: overrides?.deadline ?? null,
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO plans (objective_id, title, description, sort_order, status, deadline, created_at, updated_at)
    VALUES (@objective_id, @title, @description, @sort_order, @status, @deadline, @created_at, @updated_at)
  `);
  const result = stmt.run(plan);
  return { id: result.lastInsertRowid, ...plan };
}

export function seedTask(db: Database.Database, planId: number, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const task = {
    plan_id: planId,
    title: overrides?.title ?? 'Test Task',
    description: overrides?.description ?? 'Test Description',
    status: overrides?.status ?? 'pending',
    priority: overrides?.priority ?? 'medium',
    sort_order: overrides?.sort_order ?? 0,
    deadline: overrides?.deadline ?? null,
    completed_at: overrides?.completed_at ?? null,
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO tasks (plan_id, title, description, status, priority, sort_order, deadline, completed_at, created_at, updated_at)
    VALUES (@plan_id, @title, @description, @status, @priority, @sort_order, @deadline, @completed_at, @created_at, @updated_at)
  `);
  const result = stmt.run(task);
  return { id: result.lastInsertRowid, ...task };
}

export function seedIdea(db: Database.Database, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const idea = {
    title: overrides?.title ?? 'Test Idea',
    description: overrides?.description ?? 'Test Description',
    status: overrides?.status ?? 'pending',
    promoted_to_type: overrides?.promoted_to_type ?? null,
    promoted_to_id: overrides?.promoted_to_id ?? null,
    target_type: overrides?.target_type ?? null,
    target_id: overrides?.target_id ?? null,
    project_id: overrides?.project_id ?? null,
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO ideas (title, description, status, promoted_to_type, promoted_to_id, target_type, target_id, project_id, created_at, updated_at)
    VALUES (@title, @description, @status, @promoted_to_type, @promoted_to_id, @target_type, @target_id, @project_id, @created_at, @updated_at)
  `);
  const result = stmt.run(idea);
  return { id: result.lastInsertRowid, ...idea };
}

export function seedProject(db: Database.Database, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const project = {
    name: overrides?.name ?? 'Test Project',
    path: overrides?.path ?? '/test/path',
    description: overrides?.description ?? 'Test Description',
    url: overrides?.url ?? null,
    status: overrides?.status ?? 'active',
    tags: overrides?.tags ?? null,
    tech_stats: overrides?.tech_stats ?? null,
    created_at: now,
    updated_at: now,
  };
  const stmt = db.prepare(`
    INSERT INTO projects (name, path, description, url, status, tags, tech_stats, created_at, updated_at)
    VALUES (@name, @path, @description, @url, @status, @tags, @tech_stats, @created_at, @updated_at)
  `);
  const result = stmt.run(project);
  return { id: result.lastInsertRowid, ...project };
}

const schema = {
  mission: sql`mission`,
  objectives: sql`objectives`,
  plans: sql`plans`,
  tasks: sql`tasks`,
  projects: sql`projects`,
  projectLinks: sql`project_links`,
  ideas: sql`ideas`,
  ideaEvaluations: sql`idea_evaluations`,
  projectScans: sql`project_scans`,
  activityLog: sql`activity_log`,
  settings: sql`settings`,
  passwords: sql`passwords`,
};

export function createTestDrizzle() {
  const sqliteDb = createTestDb();
  const db = drizzle(sqliteDb, { schema });
  return { db, sqliteDb };
}
