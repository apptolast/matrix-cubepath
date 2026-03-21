import { initAuthDb } from './db/auth-db';
import { expressApp } from './server';
import { API_PORT } from './config/constants';
import { logger } from './lib/logger';

process.on('uncaughtException', (err) => {
  logger.error('main', 'Uncaught exception', { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled rejection', { reason: String(reason) });
});

initAuthDb();

// Seed demo user if DEMO_USER env var is set
if (process.env.DEMO_USER) {
  const { seedDemoUser } = require('./db/seed-demo') as typeof import('./db/seed-demo');
  seedDemoUser();
}

const server = expressApp.listen(API_PORT, () => {
  logger.info('main', `Matrix server running on port ${API_PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('main', 'SIGTERM received, shutting down');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('main', 'SIGINT received, shutting down');
  server.close();
  process.exit(0);
});
