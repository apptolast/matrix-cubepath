import { Request, Response } from 'express';
import { z } from 'zod';
import { plansRepo } from '../repositories/plans.repository';
import { activityRepo } from '../repositories/activity.repository';
import { tasksRepo } from '../repositories/tasks.repository';
import { projectsRepo } from '../repositories/projects.repository';

const createSchema = z.object({
  objectiveId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  deadline: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
  sortOrder: z.number().optional(),
  objectiveId: z.number().optional(),
  deadline: z.string().optional(),
});

const deleteSchema = z.object({
  action: z.enum(['reassign', 'cascade']).optional(),
  newParentId: z.number().optional(),
});

function taskProgress(status: string): number {
  switch (status) {
    case 'done':
      return 100;
    case 'in_progress':
      return 50;
    default:
      return 0;
  }
}

function calcPlanProgress(planId: number): number {
  const planTasks = tasksRepo.findByPlanId(planId);
  if (planTasks.length === 0) return 0;
  return Math.round(planTasks.reduce((sum, t) => sum + taskProgress(t.status), 0) / planTasks.length);
}

export const plansController = {
  getAll(req: Request, res: Response) {
    const objectiveId = req.query.objective_id ? Number(req.query.objective_id) : undefined;
    const result = objectiveId ? plansRepo.findByObjectiveId(objectiveId) : plansRepo.findAll();
    res.json(result.map((p) => ({ ...p, progress: calcPlanProgress(p.id) })));
  },

  getById(req: Request, res: Response) {
    const p = plansRepo.findById(Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ...p, progress: calcPlanProgress(p.id) });
  },

  create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const p = plansRepo.create(parsed.data);
    activityRepo.log('created', 'plan', p.id, `Created plan: ${p.title}`);
    res.status(201).json(p);
  },

  update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const p = plansRepo.update(Number(req.params.id), parsed.data);
    if (!p) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ...p, progress: calcPlanProgress(p.id) });
  },

  delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const p = plansRepo.findById(id);
    if (!p) return res.status(404).json({ error: 'Plan not found' });

    const children = tasksRepo.findByPlanId(id);
    if (children.length > 0) {
      const parsed = deleteSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.action) {
        return res
          .status(400)
          .json({ error: 'Plan has tasks. Provide action: "reassign" with newParentId or "cascade".' });
      }
      if (parsed.data.action === 'reassign') {
        if (!parsed.data.newParentId) return res.status(400).json({ error: 'newParentId required for reassign' });
        tasksRepo.reassignToPlan(
          children.map((c) => c.id),
          parsed.data.newParentId,
        );
      } else {
        for (const task of children) {
          projectsRepo.removeLinksByEntity('task', task.id);
          tasksRepo.delete(task.id);
        }
      }
    }

    projectsRepo.removeLinksByEntity('plan', id);
    activityRepo.log('deleted', 'plan', id, `Deleted plan: ${p.title}`);
    plansRepo.delete(id);
    res.status(204).send();
  },
};
