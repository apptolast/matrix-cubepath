import { Request, Response } from 'express';
import { z } from 'zod';
import { tasksRepo } from '../repositories/tasks.repository';
import { activityRepo } from '../repositories/activity.repository';
import { projectsRepo } from '../repositories/projects.repository';

const createSchema = z.object({
  planId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  sortOrder: z.number().optional(),
  deadline: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  sortOrder: z.number().optional(),
  planId: z.number().optional(),
  deadline: z.string().nullable().optional(),
});

export const tasksController = {
  getAll(req: Request, res: Response) {
    const filters: { planId?: number; status?: string } = {};
    if (req.query.plan_id) filters.planId = Number(req.query.plan_id);
    if (req.query.status) filters.status = String(req.query.status);
    res.json(tasksRepo.findFiltered(filters));
  },

  getDeadlines(req: Request, res: Response) {
    const allTasks = tasksRepo.findAll();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const isValidDate = (d: string | null | undefined): d is string => {
      if (!d) return false;
      const date = new Date(d);
      return !Number.isNaN(date.getTime());
    };

    const pending = allTasks.filter((t) => t.status !== 'done' && isValidDate(t.deadline));

    const overdue = pending.filter((t) => {
      const d = new Date(t.deadline!);
      return d < today;
    });

    const dueToday = pending.filter((t) => {
      const d = new Date(t.deadline!);
      const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return taskDay.getTime() === today.getTime();
    });

    const dueSoon = pending.filter((t) => {
      const d = new Date(t.deadline!);
      const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return taskDay > today && taskDay <= soon;
    });

    res.json({
      overdue,
      dueToday,
      dueSoon,
      total: overdue.length + dueToday.length + dueSoon.length,
    });
  },

  getById(req: Request, res: Response) {
    const t = tasksRepo.findById(Number(req.params.id));
    if (!t) return res.status(404).json({ error: 'Task not found' });
    res.json(t);
  },

  create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const t = tasksRepo.create(parsed.data);
    activityRepo.log('created', 'task', t.id, `Created task: ${t.title}`);
    res.status(201).json(t);
  },

  update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const data: Record<string, unknown> = { ...parsed.data };
    const status = parsed.data.status;

    // Handle empty string deadline as null (to clear it)
    if (data.deadline === '') {
      data.deadline = null;
    }

    if (status === 'done') {
      data.completedAt = new Date().toISOString();
    } else if (status) {
      data.completedAt = null;
    }

    const t = tasksRepo.update(Number(req.params.id), data as Parameters<typeof tasksRepo.update>[1]);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    if (status === 'done') activityRepo.log('completed', 'task', t.id, `Completed task: ${t.title}`);
    res.json(t);
  },

  delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const t = tasksRepo.findById(id);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    projectsRepo.removeLinksByEntity('task', id);
    activityRepo.log('deleted', 'task', id, `Deleted task: ${t.title}`);
    tasksRepo.delete(id);
    res.status(204).send();
  },
};
