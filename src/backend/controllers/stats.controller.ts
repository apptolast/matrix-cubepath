import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { tasks, plans, ideas } from '../db/schema';
import { eq, count } from 'drizzle-orm';

export const statsController = {
  get(_req: Request, res: Response) {
    const db = getDb();
    const totalTasks = db.select({ count: count() }).from(tasks).get()!.count;
    const completedTasks = db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'done')).get()!.count;
    const activePlans = db.select({ count: count() }).from(plans).where(eq(plans.status, 'in_progress')).get()!.count;
    const pendingIdeas = db.select({ count: count() }).from(ideas).where(eq(ideas.status, 'pending')).get()!.count;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({ totalTasks, completedTasks, completionRate, activePlans, pendingIdeas });
  },
};
