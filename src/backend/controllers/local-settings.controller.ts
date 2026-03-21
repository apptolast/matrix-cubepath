import { Request, Response } from 'express';
import { z } from 'zod';
import { localSettings } from '../lib/localSettings';

export const localSettingsController = {
  getAll(_req: Request, res: Response) {
    res.json(localSettings.getAll());
  },

  getOne(req: Request, res: Response) {
    const value = localSettings.get(req.params.key);
    if (value === null) return res.status(404).json({ error: 'Not found' });
    res.json({ key: req.params.key, value });
  },

  set(req: Request, res: Response) {
    const parsed = z.object({ value: z.string() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    localSettings.set(req.params.key, parsed.data.value);
    res.json({ key: req.params.key, value: parsed.data.value });
  },

  delete(req: Request, res: Response) {
    localSettings.delete(req.params.key);
    res.status(204).send();
  },
};
