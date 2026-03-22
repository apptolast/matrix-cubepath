import { Request, Response } from 'express';
import { settingsRepo } from '../repositories/settings.repository';
import { fetchGitHubUser } from '../engines/github-scanner';

export const settingsController = {
  getAll(_req: Request, res: Response) {
    res.json(settingsRepo.findAll());
  },

  getByKey(req: Request, res: Response) {
    const s = settingsRepo.findByKey(req.params.key);
    if (!s) return res.status(404).json({ error: 'Setting not found' });
    res.json(s);
  },

  upsert(req: Request, res: Response) {
    const s = settingsRepo.upsert(req.params.key, req.body.value);
    res.json(s);
  },

  delete(req: Request, res: Response) {
    settingsRepo.delete(req.params.key);
    res.json({ success: true });
  },

  async githubStatus(_req: Request, res: Response) {
    const token = settingsRepo.findByKey('github_token')?.value;
    if (!token) {
      return res.json({ configured: false, connected: false });
    }

    try {
      const user = await fetchGitHubUser(token);
      res.json({ configured: true, connected: true, username: user.login });
    } catch {
      res.json({ configured: true, connected: false });
    }
  },
};
