import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth.middleware';
import { authRouter } from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import { missionRouter } from './routes/mission.routes';
import { objectivesRouter } from './routes/objectives.routes';
import { plansRouter } from './routes/plans.routes';
import { tasksRouter } from './routes/tasks.routes';
import { settingsRouter } from './routes/settings.routes';
import { projectsRouter } from './routes/projects.routes';
import { ideasRouter } from './routes/ideas.routes';
import { activityRouter } from './routes/activity.routes';
import { statsRouter } from './routes/stats.routes';
import { passwordsRouter } from './routes/passwords.routes';
import { externalRouter } from './routes/external.routes';
import { localSettingsRouter } from './routes/local-settings.routes';
import { logsRouter } from './routes/logs.routes';

const app = express();

// Global rate limit — 300 requests per minute per IP
// (React Query + multiple views can easily do 30-50 on load)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});
app.use('/api', globalLimiter);

app.use(express.json());
app.use(cookieParser());

// CORS — only needed for dev (in prod, same origin via reverse proxy)
if (process.env.NODE_ENV !== 'production') {
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });
}

// Auth routes (public — no requireAuth guard)
app.use('/api', authRouter);

// Demo reset endpoint — only active when DEMO_USER is set
if (process.env.DEMO_USER) {
  app.post('/api/demo/reset', (_req, res) => {
    try {
      const { seedDemoUser } = require('./db/seed-demo') as typeof import('./db/seed-demo');
      seedDemoUser();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

// All other API routes require authentication
app.use('/api', requireAuth);

// Protected API routes
app.use('/api', healthRouter);
app.use('/api', missionRouter);
app.use('/api', objectivesRouter);
app.use('/api', plansRouter);
app.use('/api', tasksRouter);
app.use('/api', settingsRouter);
app.use('/api', projectsRouter);
app.use('/api', ideasRouter);
app.use('/api', activityRouter);
app.use('/api', statsRouter);
app.use('/api', passwordsRouter);
app.use('/api', externalRouter);
app.use('/api', localSettingsRouter);
app.use('/api', logsRouter);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendDir));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[Matrix API Error]', message);
  res.status(500).json({ error: message });
});

export { app as expressApp };
