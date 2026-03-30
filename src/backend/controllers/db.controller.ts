import { Request, Response } from 'express';
import fs from 'fs';
import { closeUserDb, getUserDbPath, openUserDb } from '../db/user-db';
import { runMigrations } from '../db/migrate';
import { userDbContext } from '../db/context';
import { logger } from '../lib/logger';
import { DEMO_USERNAME } from '../db/seed-demo';

type AuthenticatedRequest = Request & {
  matrixUser?: string;
};

export const dbController = {
  reset(req: Request, res: Response) {
    const username = (req as AuthenticatedRequest).matrixUser;
    if (!username) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const dbPath = getUserDbPath(username);
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';

      closeUserDb(username);

      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

      // Reopen fresh DB and run migrations
      const freshDb = openUserDb(username);
      userDbContext.run(freshDb, () => runMigrations());

      res.json({ success: true, message: 'Database reset complete' });
    } catch (error) {
      logger.error('db', 'Database reset failed', error);
      res.status(500).json({ error: 'Failed to reset database' });
    }
  },

  download(req: Request, res: Response) {
    const username = (req as AuthenticatedRequest).matrixUser;
    if (!username) return res.status(401).json({ error: 'Unauthorized' });

    if (username === DEMO_USERNAME) {
      return res.status(403).json({ error: 'Not available for demo account' });
    }

    try {
      const dbPath = getUserDbPath(username);
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'Database file not found' });
      }
      res.download(dbPath, 'matrix-cubepath.db');
    } catch (error) {
      logger.error('db', 'Database download failed', error);
      res.status(500).json({ error: 'Failed to download database' });
    }
  },
};
