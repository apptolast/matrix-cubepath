import { Request, Response } from 'express';
import { z } from 'zod';
import nodePath from 'path';
import { projectsRepo } from '../repositories/projects.repository';
import { scanProject, collectTechStats } from '../engines/scanner';
import { normalizeGitHubRepo, syncFromGitHub } from '../engines/github-scanner';
import { activityRepo } from '../repositories/activity.repository';
import { localSettings } from '../lib/localSettings';
import { settingsRepo } from '../repositories/settings.repository';

// Detect Windows absolute path (e.g. C:\Users\...) even when running on Linux
function isAbsoluteAnyPlatform(p: string): boolean {
  if (nodePath.isAbsolute(p)) return true;
  // Windows-style absolute path: drive letter + colon + backslash or forward slash
  return /^[A-Za-z]:[/\\]/.test(p);
}

// Normalize path separators to current OS convention
function normalizeSeparators(p: string): string {
  return p.replace(/[\\/]/g, nodePath.sep);
}

// If storedPath is relative, join with projects_base_path. Otherwise return as-is.
function resolvePath(storedPath: string): string {
  // If it's an absolute path from another OS, return as-is (stale cross-platform path)
  if (isAbsoluteAnyPlatform(storedPath)) return storedPath;
  const base = localSettings.get('projects_base_path');
  if (!base) return storedPath;
  return nodePath.join(base, storedPath);
}

// If absolutePath starts with base, return the relative portion. Otherwise return as-is.
// Handles cross-platform paths (Windows paths on Linux and vice versa).
function toRelativePath(absolutePath: string): string {
  const base = localSettings.get('projects_base_path');
  if (!base) return absolutePath;
  // Normalize both paths to current OS separators for comparison
  const normalBase = nodePath.normalize(normalizeSeparators(base));
  const normalAbs = nodePath.normalize(normalizeSeparators(absolutePath));
  if (normalAbs.startsWith(normalBase + nodePath.sep)) {
    return normalAbs.slice(normalBase.length + nodePath.sep.length);
  }
  // Also try: the stored path might be a foreign absolute path — extract just the last folder name
  // e.g. "C:\Users\dz\projects\Four-Points" → "Four-Points" if base is configured
  if (isAbsoluteAnyPlatform(absolutePath) && base) {
    // Get the last path component regardless of separator style
    const parts = absolutePath.split(/[\\/]/).filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart) return lastPart;
  }
  return absolutePath;
}

const createSchema = z.object({
  name: z.string().min(1),
  path: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
});

export const projectsController = {
  getAll(_req: Request, res: Response) {
    const all = projectsRepo.findAll();
    const result = all.map((p) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      techStats: p.techStats ? JSON.parse(p.techStats) : null,
      scan: projectsRepo.getLatestScan(p.id) || null,
      resolvedPath: p.path ? resolvePath(p.path) : null,
    }));
    res.json(result);
  },

  getById(req: Request, res: Response) {
    const p = projectsRepo.findById(Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      techStats: p.techStats ? JSON.parse(p.techStats) : null,
      scan: projectsRepo.getLatestScan(p.id) || null,
      links: projectsRepo.getLinks(p.id),
      resolvedPath: p.path ? resolvePath(p.path) : null,
    });
  },

  create(req: Request, res: Response) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { tags, path: rawPath, url: rawUrl, ...rest } = parsed.data;
    // Auto-convert absolute path to relative if base path is configured
    const storedPath = rawPath ? toRelativePath(rawPath) : rawPath;
    const defaultOwner = settingsRepo.findByKey('github_default_owner')?.value;
    let normalizedUrl: string | undefined;
    try {
      normalizedUrl = rawUrl ? normalizeGitHubRepo(rawUrl, defaultOwner) : undefined;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid GitHub repository format';
      return res.status(400).json({ error: message });
    }
    const p = projectsRepo.create({
      ...rest,
      path: storedPath,
      url: normalizedUrl,
      tags: tags ? JSON.stringify(tags) : undefined,
    });

    const respond = (row = p) =>
      res.status(201).json({
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
        techStats: row.techStats ? JSON.parse(row.techStats) : null,
        scan: projectsRepo.getLatestScan(row.id) || null,
        resolvedPath: row.path ? resolvePath(row.path) : null,
      });

    // GitHub-first: if URL provided, sync from GitHub automatically.
    if (normalizedUrl) {
      const token = settingsRepo.findByKey('github_token')?.value || null;

      syncFromGitHub(token, normalizedUrl)
        .then(({ scan, techStats }) => {
          projectsRepo.update(p.id, { url: normalizedUrl, techStats: JSON.stringify(techStats) });
          const totalPhases = scan.roadmap.totalPhases || 0;
          const completedPhases = scan.roadmap.completedPhases || 0;
          projectsRepo.upsertScan(p.id, {
            totalTasks: totalPhases,
            completedTasks: completedPhases,
            blockers: 0,
            wipItems: 0,
            progressPercent: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
            rawData: JSON.stringify(scan),
          });
          const fresh = projectsRepo.findById(p.id) || p;
          activityRepo.log('synced', 'project', p.id, `Synced project from GitHub: ${p.name}`);
          activityRepo.log('created', 'project', p.id, `Created project: ${p.name}`);
          respond(fresh);
        })
        .catch(() => {
          // Fallback: keep project created even if sync fails.
          activityRepo.log('created', 'project', p.id, `Created project: ${p.name}`);
          respond();
        });
      return;
    }

    // Local fallback: path scan for non-GitHub projects.
    if (p.path) {
      const techStats = collectTechStats(resolvePath(p.path));
      projectsRepo.update(p.id, { techStats: JSON.stringify(techStats) });
    }

    activityRepo.log('created', 'project', p.id, `Created project: ${p.name}`);
    respond(projectsRepo.findById(p.id) || p);
  },

  update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { tags, path: rawPath, url: rawUrl, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (tags !== undefined) data.tags = JSON.stringify(tags);
    // Auto-convert absolute path to relative if base path is configured
    if (rawPath !== undefined) data.path = toRelativePath(rawPath);
    if (rawUrl !== undefined) {
      const defaultOwner = settingsRepo.findByKey('github_default_owner')?.value;
      try {
        data.url = rawUrl ? normalizeGitHubRepo(rawUrl, defaultOwner) : rawUrl;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid GitHub repository format';
        return res.status(400).json({ error: message });
      }
    }

    const p = projectsRepo.update(Number(req.params.id), data as Parameters<typeof projectsRepo.update>[1]);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      techStats: p.techStats ? JSON.parse(p.techStats) : null,
      resolvedPath: p.path ? resolvePath(p.path) : null,
    });
  },

  delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const p = projectsRepo.findById(id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    activityRepo.log('deleted', 'project', id, `Deleted project: ${p.name}`);
    projectsRepo.delete(id);
    res.status(204).send();
  },

  scan(req: Request, res: Response) {
    const id = Number(req.params.id);
    const p = projectsRepo.findById(id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    if (!p.path) return res.status(400).json({ error: 'Project has no path configured' });
    const absolutePath = resolvePath(p.path);

    try {
      // Run scan using resolved absolute path
      const scanResult = scanProject(absolutePath);

      // Calculate totals from roadmap only
      const totalPhases = scanResult.roadmap.totalPhases || 0;
      const completedPhases = scanResult.roadmap.completedPhases || 0;

      const scan = projectsRepo.upsertScan(id, {
        totalTasks: totalPhases,
        completedTasks: completedPhases,
        blockers: 0,
        wipItems: 0,
        progressPercent: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
        rawData: JSON.stringify(scanResult),
      });

      // Also refresh tech stats
      const techStats = collectTechStats(absolutePath);
      projectsRepo.update(id, { techStats: JSON.stringify(techStats) });

      activityRepo.log('scanned', 'project', id, `Scanned project: ${p.name}`);
      res.json({ scan, techStats });
    } catch (err) {
      console.error(`[scan] Error scanning project ${id} at path "${p.path}":`, err);
      res.status(500).json({ error: 'Scan failed', detail: String(err) });
    }
  },

  async syncGitHub(req: Request, res: Response) {
    const id = Number(req.params.id);
    const p = projectsRepo.findById(id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    if (!p.url) return res.status(400).json({ error: 'Project has no GitHub URL' });

    const token = settingsRepo.findByKey('github_token')?.value || null;

    try {
      const { normalizedRepo, scan, techStats } = await syncFromGitHub(token, p.url);
      projectsRepo.update(id, { url: normalizedRepo, techStats: JSON.stringify(techStats) });

      const totalPhases = scan.roadmap.totalPhases || 0;
      const completedPhases = scan.roadmap.completedPhases || 0;
      const scanRow = projectsRepo.upsertScan(id, {
        totalTasks: totalPhases,
        completedTasks: completedPhases,
        blockers: 0,
        wipItems: 0,
        progressPercent: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
        rawData: JSON.stringify(scan),
      });

      activityRepo.log('synced', 'project', id, `Synced project from GitHub: ${p.name}`);
      res.json({ scan: scanRow, techStats });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GitHub sync failed';
      res.status(502).json({ error: message });
    }
  },

  // Links
  addLink(req: Request, res: Response) {
    const id = Number(req.params.id);
    const p = projectsRepo.findById(id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const schema = z.object({
      linkableType: z.enum(['mission', 'objective', 'plan', 'task']),
      linkableId: z.number(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    try {
      const link = projectsRepo.addLink(id, parsed.data.linkableType, parsed.data.linkableId);
      res.status(201).json(link);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Link already exists' });
      }
      throw err;
    }
  },

  removeLink(req: Request, res: Response) {
    const linkId = Number(req.params.linkId);
    projectsRepo.removeLink(linkId);
    res.status(204).send();
  },

  // Re-normalize all project paths: convert absolute/cross-platform paths to relative
  normalizePaths(_req: Request, res: Response) {
    const base = localSettings.get('projects_base_path');
    if (!base) return res.status(400).json({ error: 'No projects_base_path configured' });

    const all = projectsRepo.findAll();
    let updated = 0;
    for (const p of all) {
      if (!p.path) continue;
      const relative = toRelativePath(p.path);
      if (relative !== p.path) {
        projectsRepo.update(p.id, { path: relative } as Parameters<typeof projectsRepo.update>[1]);
        updated++;
      }
    }
    res.json({ updated, total: all.length });
  },
};
