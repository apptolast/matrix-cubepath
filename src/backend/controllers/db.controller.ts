import { Request, Response } from 'express';
import fs from 'fs';
import { closeUserDb, getUserDbPath, openUserDb } from '../db/user-db';
import { runMigrations } from '../db/migrate';
import { userDbContext } from '../db/context';

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
      console.error('Database reset failed:', error);
      res.status(500).json({ error: 'Failed to reset database' });
    }
  },
};
