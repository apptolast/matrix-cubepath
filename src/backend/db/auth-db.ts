import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || './data';

let authDb: Database.Database | undefined;

function db(): Database.Database {
  if (!authDb) throw new Error('Auth DB not initialized. Call initAuthDb() first.');
  return authDb;
}

export function initAuthDb(): void {
  const dataDir = path.resolve(DATA_DIR);
  fs.mkdirSync(dataDir, { recursive: true });

  authDb = new Database(path.join(dataDir, 'auth.db'));
  authDb.pragma('journal_mode = WAL');
  authDb.pragma('foreign_keys = ON');

  authDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function createUser(username: string, password: string): void {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  db()
    .prepare(`INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)`)
    .run(username, hash, salt, new Date().toISOString());
}

export function verifyUser(username: string, password: string): boolean {
  const user = db().prepare(`SELECT password_hash, salt FROM users WHERE username = ? COLLATE NOCASE`).get(username) as
    | { password_hash: string; salt: string }
    | undefined;

  if (!user) {
    // Always run the hash to prevent username enumeration via timing attack
    crypto.scryptSync(password, 'dummy_salt_constant', 64);
    return false;
  }

  const hash = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.password_hash));
}

export function userExists(username: string): boolean {
  return !!db().prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`).get(username);
}
