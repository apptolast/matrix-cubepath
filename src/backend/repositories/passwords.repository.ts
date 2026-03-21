import { eq, like, or, and } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { passwords } from '../db/schema';

const now = () => new Date().toISOString();

export interface NewPassword {
  label: string;
  domain?: string;
  username?: string;
  encryptedPassword: string;
  category?: string;
  favorite?: number;
  notes?: string;
}

export const passwordsRepo = {
  findAll(category?: string) {
    if (category && category !== 'all') {
      return getDb().select().from(passwords).where(eq(passwords.category, category)).all();
    }
    return getDb().select().from(passwords).all();
  },

  findById(id: number) {
    return getDb().select().from(passwords).where(eq(passwords.id, id)).get();
  },

  search(query: string, category?: string) {
    const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
    const searchPattern = `%${escaped}%`;
    if (category && category !== 'all') {
      return getDb()
        .select()
        .from(passwords)
        .where(
          and(
            or(
              like(passwords.label, searchPattern),
              like(passwords.domain, searchPattern),
              like(passwords.username, searchPattern),
            ),
            eq(passwords.category, category),
          ),
        )
        .all();
    }
    return getDb()
      .select()
      .from(passwords)
      .where(
        or(
          like(passwords.label, searchPattern),
          like(passwords.domain, searchPattern),
          like(passwords.username, searchPattern),
        ),
      )
      .all();
  },

  findByDomainAndUsername(domain: string, username: string) {
    return getDb()
      .select()
      .from(passwords)
      .where(and(eq(passwords.domain, domain), eq(passwords.username, username)))
      .get();
  },

  create(data: NewPassword) {
    return getDb()
      .insert(passwords)
      .values({
        label: data.label,
        domain: data.domain,
        username: data.username,
        encryptedPassword: data.encryptedPassword,
        category: data.category || 'other',
        favorite: data.favorite || 0,
        notes: data.notes,
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
  },

  update(id: number, data: Partial<NewPassword>) {
    const updateData: Record<string, unknown> = { updatedAt: now() };
    if (data.label !== undefined) updateData.label = data.label;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.encryptedPassword !== undefined) updateData.encryptedPassword = data.encryptedPassword;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.favorite !== undefined) updateData.favorite = data.favorite;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return getDb().update(passwords).set(updateData).where(eq(passwords.id, id)).returning().get();
  },

  delete(id: number) {
    return getDb().delete(passwords).where(eq(passwords.id, id)).run();
  },

  bulkCreate(entries: NewPassword[]) {
    const nowStr = now();
    const db = getDb();
    let inserted = 0;
    db.transaction(() => {
      for (const e of entries) {
        db.insert(passwords)
          .values({
            label: e.label,
            domain: e.domain,
            username: e.username,
            encryptedPassword: e.encryptedPassword,
            category: e.category || 'other',
            favorite: e.favorite || 0,
            notes: e.notes,
            createdAt: nowStr,
            updatedAt: nowStr,
          })
          .run();
        inserted++;
      }
    });
    return { inserted };
  },

  count() {
    const result = getDb().select({ count: passwords.id }).from(passwords).all();
    return result.length;
  },

  getAllForRekey() {
    return getDb().select().from(passwords).all();
  },

  rekeyAll(updates: { id: number; encryptedPassword: string; notes?: string }[]) {
    const db = getDb();
    const nowStr = now();
    db.transaction(() => {
      for (const u of updates) {
        const data: Record<string, unknown> = { encryptedPassword: u.encryptedPassword, updatedAt: nowStr };
        if (u.notes !== undefined) data.notes = u.notes;
        db.update(passwords).set(data).where(eq(passwords.id, u.id)).run();
      }
    });
  },
};
