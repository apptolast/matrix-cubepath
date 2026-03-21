import { eq, count } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { objectives } from '../db/schema';

const now = () => new Date().toISOString();

export const objectivesRepo = {
  findAll() {
    return getDb().select().from(objectives).all();
  },

  findByMissionId(missionId: number) {
    return getDb().select().from(objectives).where(eq(objectives.missionId, missionId)).all();
  },

  findById(id: number) {
    return getDb().select().from(objectives).where(eq(objectives.id, id)).get();
  },

  countByMissionId(missionId: number) {
    const result = getDb().select({ count: count() }).from(objectives).where(eq(objectives.missionId, missionId)).get();
    return result?.count ?? 0;
  },

  create(data: { missionId: number; title: string; description?: string; sortOrder?: number }) {
    return getDb()
      .insert(objectives)
      .values({ ...data, createdAt: now(), updatedAt: now() })
      .returning()
      .get();
  },

  update(
    id: number,
    data: Partial<{ title: string; description: string; status: string; sortOrder: number; missionId: number }>,
  ) {
    return getDb()
      .update(objectives)
      .set({ ...data, updatedAt: now() })
      .where(eq(objectives.id, id))
      .returning()
      .get();
  },

  reassignToMission(ids: number[], newMissionId: number) {
    for (const id of ids) {
      getDb().update(objectives).set({ missionId: newMissionId, updatedAt: now() }).where(eq(objectives.id, id)).run();
    }
  },

  delete(id: number) {
    return getDb().delete(objectives).where(eq(objectives.id, id)).run();
  },
};
