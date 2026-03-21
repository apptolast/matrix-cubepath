import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';
import { userDbContext, UserDb } from './context';
import { runMigrations } from './migrate';

const DATA_DIR = process.env.DATA_DIR || './data';

interface CacheEntry {
  db: UserDb;
  sqlite: Database.Database;
}

// Cache open DB connections by username (one per user, reused across requests)
const dbCache = new Map<string, CacheEntry>();

function safeName(username: string): string {
  return username.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getUserDbPath(username: string): string {
  const usersDir = path.join(path.resolve(DATA_DIR), 'users');
  return path.join(usersDir, `${safeName(username)}.db`);
}

export function openUserDb(username: string): UserDb {
  const cached = dbCache.get(username);
  if (cached) return cached.db;

  const usersDir = path.join(path.resolve(DATA_DIR), 'users');
  fs.mkdirSync(usersDir, { recursive: true });

  const dbPath = path.join(usersDir, `${safeName(username)}.db`);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  dbCache.set(username, { db, sqlite });

  // Run schema migrations for this user's DB using the context
  userDbContext.run(db, () => runMigrations());

  return db;
}

export function closeUserDb(username: string): void {
  const entry = dbCache.get(username);
  if (entry) {
    entry.sqlite.close();
    dbCache.delete(username);
  }
}
