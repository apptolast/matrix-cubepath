import { Request, Response } from 'express';
import { z } from 'zod';
import { missionRepo } from '../repositories/mission.repository';
import { objectivesRepo } from '../repositories/objectives.repository';
import { plansRepo } from '../repositories/plans.repository';
import { tasksRepo } from '../repositories/tasks.repository';
import { projectsRepo } from '../repositories/projects.repository';
import { activityRepo } from '../repositories/activity.repository';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
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

function avgProgress(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function calcPlanProgress(planId: number): number {
  const planTasks = tasksRepo.findByPlanId(planId);
  return avgProgress(planTasks.map((t) => taskProgress(t.status)));
}

function calcObjectiveProgress(objectiveId: number): number {
  const objPlans = plansRepo.findByObjectiveId(objectiveId);
  return avgProgress(objPlans.map((p) => calcPlanProgress(p.id)));
}

function calcMissionProgress(missionId: number): number {
  const objs = objectivesRepo.findByMissionId(missionId);
  return avgProgress(objs.map((o) => calcObjectiveProgress(o.id)));
}

export const missionController = {
  getAll(_req: Request, res: Response) {
    const missions = missionRepo.findAll();
    const result = missions.map((m) => ({ ...m, progress: calcMissionProgress(m.id) }));
    res.json(result);
  },

  getById(req: Request, res: Response) {
    const m = missionRepo.findById(Number(req.params.id));
    if (!m) return res.status(404).json({ error: 'Mission not found' });
    res.json({ ...m, progress: calcMissionProgress(m.id) });
  },

  create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const existing = missionRepo.findAll();
    if (existing.length > 0) return res.status(409).json({ error: 'Only one active mission allowed' });

    const m = missionRepo.create(parsed.data);
    res.status(201).json(m);
  },

  update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const m = missionRepo.update(Number(req.params.id), parsed.data);
    if (!m) return res.status(404).json({ error: 'Mission not found' });
    res.json({ ...m, progress: calcMissionProgress(m.id) });
  },

  delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const m = missionRepo.findById(id);
    if (!m) return res.status(404).json({ error: 'Mission not found' });

    const children = objectivesRepo.findByMissionId(id);
    if (children.length > 0) {
      const parsed = deleteSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.action) {
        return res.status(400).json({ error: 'Mission has objectives. Provide action: "cascade" to delete all.' });
      }
      if (parsed.data.action === 'cascade') {
        for (const obj of children) {
          const objPlans = plansRepo.findByObjectiveId(obj.id);
          for (const plan of objPlans) {
            const planTasks = tasksRepo.findByPlanId(plan.id);
            for (const task of planTasks) {
              projectsRepo.removeLinksByEntity('task', task.id);
              tasksRepo.delete(task.id);
            }
            projectsRepo.removeLinksByEntity('plan', plan.id);
            plansRepo.delete(plan.id);
          }
          projectsRepo.removeLinksByEntity('objective', obj.id);
          objectivesRepo.delete(obj.id);
        }
      }
    }

    projectsRepo.removeLinksByEntity('mission', id);
    activityRepo.log('deleted', 'mission', id, `Deleted mission: ${m.title}`);
    missionRepo.delete(id);
    res.status(204).send();
  },
};
