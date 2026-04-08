import { initAuthDb } from './db/auth-db';
import { initMonitoringDb, closeMonitoringDb } from './db/monitoring-db';
import { expressApp } from './server';
import { API_PORT } from './config/constants';
import { logger } from './lib/logger';
import { stopStatusPolling } from './controllers/stats.controller';
import { startMonitoring, stopMonitoring } from './services/monitoring-manager';

process.on('uncaughtException', (err) => {
  logger.error('main', 'Uncaught exception', { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled rejection', { reason: String(reason) });
});

initAuthDb();
initMonitoringDb();

// Seed demo user if DEMO_USER env var is set
if (process.env.DEMO_USER) {
  const { seedDemoUser } = require('./db/seed-demo') as typeof import('./db/seed-demo');
  seedDemoUser('es');
}

const server = expressApp.listen(API_PORT, () => {
  logger.info('main', `Matrix server running on port ${API_PORT}`);
});

startMonitoring();

function gracefulShutdown(signal: string) {
  logger.info('main', `${signal} received, shutting down`);
  stopStatusPolling();
  stopMonitoring();
  server.close(() => {
    logger.info('main', 'Server closed');
    closeMonitoringDb();
    process.exit(0);
  });
  // Force exit if close takes too long
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
