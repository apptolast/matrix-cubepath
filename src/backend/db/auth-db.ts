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

  // Detect if we need to migrate from the old username-only schema
  const tableExists =
    (
      authDb.prepare(`SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'`).get() as {
        cnt: number;
      }
    ).cnt > 0;

  const hasEmailCol = tableExists
    ? (
        authDb.prepare(`SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='email'`).get() as {
          cnt: number;
        }
      ).cnt > 0
    : false;

  if (tableExists && !hasEmailCol) {
    // Migrate: old schema had username NOT NULL UNIQUE — recreate with email as primary login
    authDb.exec(`
      BEGIN TRANSACTION;

      CREATE TABLE users_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        username     TEXT    COLLATE NOCASE,
        password_hash TEXT   NOT NULL,
        salt         TEXT    NOT NULL,
        created_at   TEXT    NOT NULL
      );

      INSERT INTO users_new (id, email, username, password_hash, salt, created_at)
        SELECT id,
               username || '@migrated.local',
               username,
               password_hash,
               salt,
               created_at
        FROM users;

      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;

      COMMIT;
    `);
  } else {
    authDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        username     TEXT    COLLATE NOCASE,
        password_hash TEXT   NOT NULL,
        salt         TEXT    NOT NULL,
        created_at   TEXT    NOT NULL
      )
    `);
  }

  authDb.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Purge expired/used tokens older than 24 h on startup
  authDb
    .prepare(`DELETE FROM password_reset_tokens WHERE expires_at < ?`)
    .run(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createUser(email: string, username: string | null, password: string): void {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  db()
    .prepare(`INSERT INTO users (email, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(email.toLowerCase().trim(), username?.trim() || null, hash, salt, new Date().toISOString());
}

/** Returns true if the email + password combination is valid. */
export function verifyUser(email: string, password: string): boolean {
  const user = db().prepare(`SELECT password_hash, salt FROM users WHERE email = ? COLLATE NOCASE`).get(email) as
    | { password_hash: string; salt: string }
    | undefined;

  if (!user) {
    // Always run the hash to prevent timing-based user enumeration
    crypto.scryptSync(password, 'dummy_salt_constant_for_timing', 64);
    return false;
  }

  const hash = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.password_hash));
}

export function userExists(email: string): boolean {
  return !!db().prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`).get(email);
}

/** Removes any users whose email matches the given address (case-insensitive). */
export function deleteUserByEmail(email: string): void {
  db().prepare(`DELETE FROM users WHERE email = ? COLLATE NOCASE`).run(email);
}

export function getUserByEmail(email: string): { id: number; email: string; username: string | null } | undefined {
  return db().prepare(`SELECT id, email, username FROM users WHERE email = ? COLLATE NOCASE`).get(email) as
    | { id: number; email: string; username: string | null }
    | undefined;
}

// ── Password reset ────────────────────────────────────────────────────────────

/**
 * Generates a reset token for the given email.
 * Returns the raw token (to include in the email link), or null if the email
 * is not registered — callers must NOT expose the null to the client.
 */
export function createResetToken(email: string): string | null {
  const user = getUserByEmail(email);
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex string
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Invalidate any previous tokens for this user
  db().prepare(`DELETE FROM password_reset_tokens WHERE user_id = ?`).run(user.id);

  db()
    .prepare(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
    .run(user.id, tokenHash, expiresAt);

  return rawToken;
}

/**
 * Validates the raw token, updates the user's password, and marks the token as used.
 * Returns false for invalid, expired, or already-used tokens.
 */
export function consumeResetToken(rawToken: string, newPassword: string): boolean {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const row = db()
    .prepare(`SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?`)
    .get(tokenHash) as { id: number; user_id: number; expires_at: string; used: number } | undefined;

  if (!row || row.used || new Date(row.expires_at) < new Date()) return false;

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);

  db().transaction(() => {
    db().prepare(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`).run(hash, salt, row.user_id);
    db().prepare(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`).run(row.id);
  })();

  return true;
}
