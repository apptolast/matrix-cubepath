import { Request, Response } from 'express';
import { z } from 'zod';
import { ideasRepo } from '../repositories/ideas.repository';
import { tasksRepo } from '../repositories/tasks.repository';
import { activityRepo } from '../repositories/activity.repository';
import { getDb } from '../db/connection';
import { plans, objectives, projects, ideas, ideaEvaluations } from '../db/schema';
import { eq, count, desc, sql } from 'drizzle-orm';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetType: z.enum(['mission', 'objective', 'plan', 'task']).optional(),
  targetId: z.number().optional(),
  projectId: z.number().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'evaluating', 'approved', 'rejected', 'promoted']).optional(),
  targetType: z.enum(['mission', 'objective', 'plan', 'task']).nullable().optional(),
  targetId: z.number().nullable().optional(),
  projectId: z.number().nullable().optional(),
});

const evaluateSchema = z.object({
  alignmentScore: z.number().min(1).max(10),
  impactScore: z.number().min(1).max(10),
  costScore: z.number().min(1).max(10),
  riskScore: z.number().min(1).max(10),
  reasoning: z.string().optional(),
});

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

const promoteSchema = z.object({
  type: z.enum(['task', 'plan', 'objective', 'project']),
  parentId: z.number().optional(),
});

function calcTotalScore(a: number, i: number, c: number, r: number): number {
  return Math.round((a * 0.4 + i * 0.3 + (10 - c) * 0.15 + (10 - r) * 0.15) * 100) / 100;
}

const now = () => new Date().toISOString();

export const ideasController = {
  getAll(req: Request, res: Response) {
    const status = req.query.status ? String(req.query.status) : undefined;
    const result = status ? ideasRepo.findByStatus(status) : ideasRepo.findAll();
    res.json(result);
  },

  getById(req: Request, res: Response) {
    const idea = ideasRepo.findById(Number(req.params.id));
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    res.json(idea);
  },

  create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const idea = ideasRepo.create(parsed.data);
    activityRepo.log('created', 'idea', idea.id, `Created idea: ${idea.title}`);
    res.status(201).json(idea);
  },

  update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const idea = ideasRepo.update(Number(req.params.id), parsed.data as Parameters<typeof ideasRepo.update>[1]);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    res.json(idea);
  },

  delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const idea = ideasRepo.findById(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    activityRepo.log('deleted', 'idea', id, `Deleted idea: ${idea.title}`);
    ideasRepo.delete(id);
    res.status(204).send();
  },

  evaluate(req: Request, res: Response) {
    const id = Number(req.params.id);
    const idea = ideasRepo.findById(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { alignmentScore, impactScore, costScore, riskScore, reasoning } = parsed.data;
    const totalScore = calcTotalScore(alignmentScore, impactScore, costScore, riskScore);

    const evaluation = ideasRepo.upsertEvaluation(id, {
      alignmentScore,
      impactScore,
      costScore,
      riskScore,
      totalScore,
      reasoning,
    });

    // Move idea to evaluating if still pending
    if (idea.status === 'pending') {
      ideasRepo.update(id, { status: 'evaluating' });
    }

    res.json(evaluation);
  },

  getEvaluation(req: Request, res: Response) {
    const evaluation = ideasRepo.findEvaluation(Number(req.params.id));
    if (!evaluation) return res.status(404).json({ error: 'No evaluation found' });
    res.json(evaluation);
  },

  decide(req: Request, res: Response) {
    const id = Number(req.params.id);
    const idea = ideasRepo.findById(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const parsed = decideSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { decision } = parsed.data;
    ideasRepo.updateEvaluationDecision(id, decision);
    const updated = ideasRepo.update(id, { status: decision });
    activityRepo.log('decided', 'idea', id, `Decided idea "${idea.title}": ${decision}`);
    res.json(updated);
  },

  promote(req: Request, res: Response) {
    const id = Number(req.params.id);
    const idea = ideasRepo.findById(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { type, parentId } = parsed.data;
    const db = getDb();
    let createdId: number;

    switch (type) {
      case 'task': {
        if (!parentId) return res.status(400).json({ error: 'parentId required for task (plan id)' });
        const task = tasksRepo.create({
          planId: parentId,
          title: idea.title,
          description: idea.description ?? undefined,
        });
        createdId = task.id;
        break;
      }
      case 'plan': {
        if (!parentId) return res.status(400).json({ error: 'parentId required for plan (objective id)' });
        const plan = db
          .insert(plans)
          .values({
            objectiveId: parentId,
            title: idea.title,
            description: idea.description,
            createdAt: now(),
            updatedAt: now(),
          })
          .returning()
          .get();
        createdId = plan.id;
        break;
      }
      case 'objective': {
        if (!parentId) return res.status(400).json({ error: 'parentId required for objective (mission id)' });
        const obj = db
          .insert(objectives)
          .values({
            missionId: parentId,
            title: idea.title,
            description: idea.description,
            createdAt: now(),
            updatedAt: now(),
          })
          .returning()
          .get();
        createdId = obj.id;
        break;
      }
      case 'project': {
        const proj = db
          .insert(projects)
          .values({ name: idea.title, description: idea.description, createdAt: now(), updatedAt: now() })
          .returning()
          .get();
        createdId = proj.id;
        break;
      }
    }

    const updated = ideasRepo.update(id, { status: 'promoted', promotedToType: type, promotedToId: createdId! });
    activityRepo.log('promoted', 'idea', id, `Promoted idea "${idea.title}" to ${type}`);
    res.json({ idea: updated, created: { type, id: createdId! } });
  },

  getTopScored(_req: Request, res: Response) {
    try {
      const db = getDb();
      const rows = db
        .select({
          id: ideas.id,
          title: ideas.title,
          status: ideas.status,
          totalScore: sql<number>`CAST(${ideaEvaluations.totalScore} AS REAL) / 10.0`,
        })
        .from(ideas)
        .innerJoin(ideaEvaluations, eq(ideaEvaluations.ideaId, ideas.id))
        .orderBy(desc(ideaEvaluations.totalScore))
        .limit(5)
        .all();
      res.json(rows);
    } catch (err) {
      console.error('[ideas/top-scored]', err);
      res.json([]);
    }
  },

  getFunnel(_req: Request, res: Response) {
    try {
      const db = getDb();
      const rows = db.select({ status: ideas.status, cnt: count() }).from(ideas).groupBy(ideas.status).all();
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status] = r.cnt;
      res.json({
        pending: counts['pending'] || 0,
        evaluating: counts['evaluating'] || 0,
        approved: counts['approved'] || 0,
        promoted: counts['promoted'] || 0,
        rejected: counts['rejected'] || 0,
      });
    } catch (err) {
      console.error('[ideas/funnel]', err);
      res.json({ pending: 0, evaluating: 0, approved: 0, promoted: 0, rejected: 0 });
    }
  },
};
