import { Request, Response } from 'express';
import { logger } from '../lib/logger';
import { passwordsRepo, NewPassword } from '../repositories/passwords.repository';
import { settingsRepo } from '../repositories/settings.repository';
import { activityRepo } from '../repositories/activity.repository';
import {
  deriveAuthHash,
  verifyAuthHash,
  generateEncSalt,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  isEncrypted,
  generateSecurePassword,
  isLegacyAuth,
} from '../engines/crypto';
import { parseImportContent } from '../engines/import-parser';
import { DEMO_USERNAME } from '../db/seed-demo';

let encryptionKey: Buffer | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

// Rate limiting for unlock attempts
let failedAttempts = 0;
let lockoutUntil = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

const IMPORT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (!encryptionKey) return;
  const setting = settingsRepo.findByKey('vault_auto_lock');
  const value = setting?.value ?? '5';
  if (value === 'never') return;
  // Supported values: '5' → 5 min, '30' → 30 min. Any other value defaults to 5 min.
  // If adding new values, update this line and the UI options in SettingsView.tsx.
  const ms = value === '30' ? 30 * 60 * 1000 : 5 * 60 * 1000;
  inactivityTimer = setTimeout(() => lockVault(), ms);
}

function lockVault() {
  if (encryptionKey) encryptionKey.fill(0);
  encryptionKey = null;
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function checkRateLimit(res: Response): boolean {
  if (Date.now() < lockoutUntil) {
    const wait = Math.ceil((lockoutUntil - Date.now()) / 1000);
    res.status(429).json({ error: `Too many attempts. Try again in ${wait}s` });
    return false;
  }
  return true;
}

function recordFailedAttempt() {
  failedAttempts++;
  if (failedAttempts >= MAX_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_MS;
    failedAttempts = 0;
  }
}

function resetAttempts() {
  failedAttempts = 0;
  lockoutUntil = 0;
}

function parseId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ID' });
    return null;
  }
  return id;
}

function decryptNotes(notes: string | null | undefined, key: Buffer): string {
  if (!notes) return '';
  if (isEncrypted(notes)) {
    try {
      return decrypt(notes, key);
    } catch {
      return notes;
    }
  }
  if (notes.split(':').length >= 3) {
    try {
      return decrypt(notes, key);
    } catch {
      return notes;
    }
  }
  return notes;
}

export const passwordsController = {
  async isSetup(_req: Request, res: Response) {
    const authHash = settingsRepo.findByKey('passwords_auth_hash');
    res.json({ isSetup: !!authHash, isUnlocked: !!encryptionKey });
  },

  async setup(req: Request, res: Response) {
    if (!checkRateLimit(res)) return;

    const existing = settingsRepo.findByKey('passwords_auth_hash');
    if (existing) {
      return res.status(400).json({ error: 'Vault already setup' });
    }

    const { masterPassword } = req.body;
    const authResult = deriveAuthHash(masterPassword);
    const encSalt = generateEncSalt();

    settingsRepo.upsert('passwords_auth_hash', authResult.hash);
    settingsRepo.upsert('passwords_salt_auth', authResult.salt);
    settingsRepo.upsert('passwords_salt_enc', encSalt);

    encryptionKey = deriveEncryptionKey(masterPassword, encSalt);
    resetInactivityTimer();
    resetAttempts();

    res.json({ ok: true });
  },

  async unlock(req: Request, res: Response) {
    if (!checkRateLimit(res)) return;

    const { masterPassword } = req.body;
    const storedHash = settingsRepo.findByKey('passwords_auth_hash');
    const storedSalt = settingsRepo.findByKey('passwords_salt_auth');
    const encSalt = settingsRepo.findByKey('passwords_salt_enc');

    if (!storedHash || !storedSalt || !encSalt) {
      return res.status(400).json({ error: 'Vault not setup' });
    }

    const isValid = verifyAuthHash(masterPassword, storedSalt.value, storedHash.value);
    if (!isValid) {
      recordFailedAttempt();
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const legacy = isLegacyAuth(masterPassword, storedSalt.value, storedHash.value);
    encryptionKey = deriveEncryptionKey(masterPassword, encSalt.value, legacy);
    resetInactivityTimer();
    resetAttempts();

    res.json({ ok: true });
  },

  async lock(_req: Request, res: Response) {
    lockVault();
    res.json({ ok: true });
  },

  async getAll(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const { search, category } = req.query;
    let results;

    if (search && typeof search === 'string') {
      results = passwordsRepo.search(search, category as string);
    } else if (category && typeof category === 'string') {
      results = passwordsRepo.findAll(category);
    } else {
      results = passwordsRepo.findAll();
    }

    const formatted = results
      .sort((a, b) => {
        if (b.favorite !== a.favorite) return b.favorite - a.favorite;
        return a.label.localeCompare(b.label);
      })
      .map((p) => ({
        id: p.id,
        label: p.label,
        domain: p.domain,
        username: p.username,
        category: p.category,
        favorite: p.favorite,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

    res.json(formatted);
  },

  async getById(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const id = parseId(req, res);
    if (id === null) return;

    const entry = passwordsRepo.findById(id);
    if (!entry) return res.status(404).json({ error: 'Password not found' });

    let decryptedPassword = '';
    try {
      decryptedPassword = decrypt(entry.encryptedPassword, encryptionKey!);
    } catch {
      logger.error('passwords', 'Failed to decrypt password entry');
      return res.status(500).json({ error: 'Failed to decrypt password' });
    }

    res.json({
      id: entry.id,
      label: entry.label,
      domain: entry.domain,
      username: entry.username,
      password: decryptedPassword,
      category: entry.category,
      favorite: entry.favorite,
      notes: decryptNotes(entry.notes, encryptionKey!) || undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  },

  async create(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const { label, domain, username, password, category, favorite, notes } = req.body;
    const encryptedPassword = encrypt(password, encryptionKey!);
    const encryptedNotes = notes ? encrypt(notes, encryptionKey!) : undefined;

    const newEntry = passwordsRepo.create({
      label,
      domain,
      username,
      encryptedPassword,
      category,
      favorite,
      notes: encryptedNotes,
    });

    activityRepo.log('created', 'password', newEntry.id, `Created password: ${label}`);

    res.json({
      id: newEntry.id,
      label: newEntry.label,
      domain: newEntry.domain,
      username: newEntry.username,
      category: newEntry.category,
      favorite: newEntry.favorite,
      createdAt: newEntry.createdAt,
      updatedAt: newEntry.updatedAt,
    });
  },

  async update(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const id = parseId(req, res);
    if (id === null) return;

    const existing = passwordsRepo.findById(id);
    if (!existing) return res.status(404).json({ error: 'Password not found' });

    const { label, domain, username, password, category, favorite, notes } = req.body;
    const updateData: Partial<NewPassword> = {};

    if (label !== undefined) updateData.label = label;
    if (domain !== undefined) updateData.domain = domain;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.encryptedPassword = encrypt(password, encryptionKey!);
    if (category !== undefined) updateData.category = category;
    if (favorite !== undefined) updateData.favorite = favorite;
    if (notes !== undefined) updateData.notes = notes ? encrypt(notes, encryptionKey!) : undefined;

    const updated = passwordsRepo.update(id, updateData);
    activityRepo.log('updated', 'password', id, `Updated password: ${updated.label}`);

    res.json({
      id: updated.id,
      label: updated.label,
      domain: updated.domain,
      username: updated.username,
      category: updated.category,
      favorite: updated.favorite,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  },

  async delete(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const id = parseId(req, res);
    if (id === null) return;

    const existing = passwordsRepo.findById(id);
    if (!existing) return res.status(404).json({ error: 'Password not found' });

    const label = existing.label;
    passwordsRepo.delete(id);
    activityRepo.log('deleted', 'password', id, `Deleted password: ${label}`);

    res.json({ ok: true });
  },

  async bulkDelete(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    let deleted = 0;
    for (const id of req.body.ids) {
      const existing = passwordsRepo.findById(id);
      if (existing) {
        passwordsRepo.delete(id);
        deleted++;
      }
    }

    activityRepo.log('deleted', 'password', 0, `Bulk deleted ${deleted} passwords`);
    res.json({ deleted });
  },

  async toggleFavorite(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const id = parseId(req, res);
    if (id === null) return;

    const existing = passwordsRepo.findById(id);
    if (!existing) return res.status(404).json({ error: 'Password not found' });

    const newFavorite = existing.favorite === 1 ? 0 : 1;
    const updated = passwordsRepo.update(id, { favorite: newFavorite });

    res.json({ favorite: updated.favorite });
  },

  async parseImportFile(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.length > IMPORT_MAX_SIZE) {
      return res.status(400).json({ error: 'File too large (max 10 MB)' });
    }

    const result = parseImportContent(content);
    res.json(result);
  },

  async confirmImport(req: Request, res: Response) {
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    resetInactivityTimer();

    const { entries } = req.body;
    let skipped = 0;
    const newEntries: NewPassword[] = [];

    for (const entry of entries) {
      if (entry.domain && entry.username) {
        const existing = passwordsRepo.findByDomainAndUsername(entry.domain, entry.username);
        if (existing) {
          skipped++;
          continue;
        }
      }

      const encryptedPassword = encrypt(entry.password, encryptionKey!);
      const encryptedNotes = entry.notes ? encrypt(entry.notes, encryptionKey!) : undefined;

      newEntries.push({
        label: entry.label,
        domain: entry.domain,
        username: entry.username,
        encryptedPassword,
        category: entry.category,
        notes: encryptedNotes,
      });
    }

    let inserted = 0;
    if (newEntries.length > 0) {
      const result = passwordsRepo.bulkCreate(newEntries);
      inserted = result.inserted;
    }

    activityRepo.log('created', 'password', 0, `Imported ${inserted} passwords`);
    res.json({ inserted, skippedDuplicates: skipped });
  },

  async changeMasterPassword(req: Request, res: Response) {
    if (req.matrixUser === DEMO_USERNAME) {
      return res.status(403).json({ error: 'Cannot change vault password on demo account' });
    }
    if (!encryptionKey) return res.status(401).json({ error: 'Vault is locked' });
    if (!checkRateLimit(res)) return;
    resetInactivityTimer();

    const { currentPassword, newPassword } = req.body;
    const storedHash = settingsRepo.findByKey('passwords_auth_hash');
    const storedSalt = settingsRepo.findByKey('passwords_salt_auth');

    if (!storedHash || !storedSalt) {
      return res.status(400).json({ error: 'Vault not setup' });
    }

    const isValid = verifyAuthHash(currentPassword, storedSalt.value, storedHash.value);
    if (!isValid) {
      recordFailedAttempt();
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const allPasswords = passwordsRepo.getAllForRekey();
    const decryptedEntries: { id: number; password: string; notes?: string }[] = [];
    const failedIds: number[] = [];

    for (const p of allPasswords) {
      try {
        decryptedEntries.push({
          id: p.id,
          password: decrypt(p.encryptedPassword, encryptionKey!),
          notes: decryptNotes(p.notes, encryptionKey!) || undefined,
        });
      } catch {
        failedIds.push(p.id);
      }
    }

    if (failedIds.length > 0) {
      return res.status(500).json({
        error: `Cannot re-key: ${failedIds.length} entries failed to decrypt`,
        failedIds,
      });
    }

    const newAuthResult = deriveAuthHash(newPassword);
    const newEncSalt = generateEncSalt();
    const newEncryptionKey = deriveEncryptionKey(newPassword, newEncSalt);

    const rekeyUpdates = decryptedEntries.map((entry) => ({
      id: entry.id,
      encryptedPassword: encrypt(entry.password, newEncryptionKey),
      notes: entry.notes ? encrypt(entry.notes, newEncryptionKey) : undefined,
    }));

    passwordsRepo.rekeyAll(rekeyUpdates);
    settingsRepo.upsert('passwords_auth_hash', newAuthResult.hash);
    settingsRepo.upsert('passwords_salt_auth', newAuthResult.salt);
    settingsRepo.upsert('passwords_salt_enc', newEncSalt);

    encryptionKey.fill(0);
    encryptionKey = newEncryptionKey;
    resetInactivityTimer();
    resetAttempts();

    res.json({ ok: true, rekeyed: decryptedEntries.length });
  },

  generatePassword() {
    return generateSecurePassword(16);
  },

  applyAutoLock(_req: Request, res: Response) {
    resetInactivityTimer();
    res.json({ ok: true });
  },
};

export function getEncryptionKey(): Buffer | null {
  return encryptionKey;
}
