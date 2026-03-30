import { Request, Response } from 'express';
import net from 'node:net';
import { getDb } from '../db/connection';
import { tasks, plans, ideas } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { settingsRepo } from '../repositories/settings.repository';
import { getEncryptionKey } from './passwords.controller';
import { decrypt, isEncrypted } from '../engines/crypto';
import { logger } from '../lib/logger';

/* ── System Status ── */
function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

interface ExternalServices {
  render: { name: string; url: string }[];
  databases: { name: string; type: string; connectionString: string }[];
}

function tcpConnect(host: string, port: number, timeoutMs = 5000): Promise<'online' | 'offline'> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    socket.once('connect', () => {
      socket.destroy();
      resolve('online');
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve('offline');
    });
    socket.once('error', () => {
      socket.destroy();
      resolve('offline');
    });
  });
}

function parseHostPort(connectionString: string): { host: string; port: number } | null {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = parseInt(url.port) || (url.protocol === 'mysql:' ? 3306 : 5432);
    if (host) return { host, port };
  } catch {
    /* not a URL */
  }
  const m = connectionString.match(/^([^:]+):(\d+)$/);
  if (m) return { host: m[1], port: Number(m[2]) };
  return null;
}

interface SystemStatusResult {
  api: { status: string };
  render: { name: string; url: string; status: string; responseTime?: number | null }[];
  databases: { name: string; type: string; status: string }[];
  vaultLocked: boolean;
  checkedAt: string;
}

let cachedStatus: SystemStatusResult | null = null;
let statusCheckRunning = false;

async function checkSystemStatus(): Promise<SystemStatusResult> {
  const key = getEncryptionKey();
  const vaultLocked = !key;

  let renderServices: { name: string; url: string }[] = [];
  let databases: { name: string; type: string; connectionString: string }[] = [];

  if (!vaultLocked) {
    try {
      const stored = settingsRepo.findByKey('external_services');
      if (stored) {
        const json = isEncrypted(stored.value) ? decrypt(stored.value, key!) : stored.value;
        const svc = JSON.parse(json) as ExternalServices;
        renderServices = svc.render ?? [];
        databases = svc.databases ?? [];
      }
    } catch {
      /* ignore decrypt errors */
    }
  }

  const renderChecks = renderServices.map(async (svc) => {
    const url = normalizeUrl(svc.url);
    try {
      const start = Date.now();
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      const elapsed = Date.now() - start;
      const status: 'online' | 'sleeping' | 'offline' =
        resp.status === 503 ? 'sleeping' : elapsed > 5000 ? 'sleeping' : 'online';
      logger.info('status', `Render ${svc.name}: HEAD ${url} → ${resp.status} ${elapsed}ms (${status})`);
      return { name: svc.name, url, status, responseTime: elapsed };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      const status = isTimeout ? ('sleeping' as const) : ('offline' as const);
      logger.info('status', `Render ${svc.name}: HEAD ${url} → ${isTimeout ? 'timeout' : 'error'} (${status})`);
      return { name: svc.name, url, status, responseTime: null };
    }
  });

  const dbChecks = databases.map(async (dbSvc) => {
    const parsed = parseHostPort(dbSvc.connectionString);
    if (!parsed) {
      logger.warn('status', `DB ${dbSvc.name}: invalid connection string`);
      return { name: dbSvc.name, type: dbSvc.type, status: 'offline' as const };
    }
    const status = await tcpConnect(parsed.host, parsed.port, 5000);
    logger.info('status', `DB ${dbSvc.name}: TCP ${parsed.host}:${parsed.port} → ${status}`);
    return { name: dbSvc.name, type: dbSvc.type, status };
  });

  const [renderResults, dbResults] = await Promise.all([
    Promise.allSettled(renderChecks),
    Promise.allSettled(dbChecks),
  ]);

  const renderStatuses = renderResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: renderServices[i].name, url: renderServices[i].url, status: 'offline' as const },
  );
  const dbStatuses = dbResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: databases[i].name, type: databases[i].type, status: 'offline' as const },
  );

  const result: SystemStatusResult = {
    api: { status: 'online' },
    render: renderStatuses,
    databases: dbStatuses,
    vaultLocked,
    checkedAt: new Date().toISOString(),
  };

  cachedStatus = result;
  return result;
}

/* ── Auto-poll: runs every 10 min in background ── */
const STATUS_POLL_INTERVAL = 10 * 60 * 1000; // 10 min
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function pollStatusQuietly() {
  if (statusCheckRunning) return;
  if (!getEncryptionKey()) {
    logger.info('status', 'Auto-poll skipped (vault locked)');
    return;
  }
  statusCheckRunning = true;
  try {
    await checkSystemStatus();
    logger.info('status', 'Auto-poll completed');
  } catch (err) {
    logger.warn('status', `Auto-poll failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    statusCheckRunning = false;
  }
}

export function startStatusPolling() {
  if (pollTimer) return;
  setTimeout(() => {
    pollStatusQuietly();
    pollTimer = setInterval(pollStatusQuietly, STATUS_POLL_INTERVAL);
  }, 30_000);
  logger.info('status', 'Status auto-polling scheduled (every 10 min)');
}

export function stopStatusPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export const statsController = {
  get(_req: Request, res: Response) {
    const db = getDb();
    const totalTasks = db.select({ count: count() }).from(tasks).get()!.count;
    const completedTasks = db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'done')).get()!.count;
    const activePlans = db.select({ count: count() }).from(plans).where(eq(plans.status, 'in_progress')).get()!.count;
    const pendingIdeas = db.select({ count: count() }).from(ideas).where(eq(ideas.status, 'pending')).get()!.count;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({ totalTasks, completedTasks, completionRate, activePlans, pendingIdeas });
  },

  async getSystemStatus(req: Request, res: Response) {
    try {
      const forceRefresh = req.query.refresh === '1';
      // If a check is already running, return cached to avoid concurrent HTTP calls
      if (!forceRefresh && statusCheckRunning && cachedStatus) {
        return res.json(cachedStatus);
      }
      if (!forceRefresh && cachedStatus) {
        const age = Date.now() - new Date(cachedStatus.checkedAt).getTime();
        const currentlyLocked = !getEncryptionKey();
        const lockStateChanged = cachedStatus.vaultLocked !== currentlyLocked;
        if (age < 2 * 60 * 1000 && !lockStateChanged) {
          return res.json(cachedStatus);
        }
      }
      const result = await checkSystemStatus();
      res.json(result);
    } catch (err) {
      logger.error('stats', 'getSystemStatus error', err);
      if (cachedStatus) return res.json(cachedStatus);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  },

  async wakeService(req: Request, res: Response) {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL required' });
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'URL must use http:// or https://' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL — must include protocol (https://)' });
    }
    logger.info('wake', `Sending wake request: GET ${url}`);
    try {
      const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(30_000) });
      logger.info('wake', `Wake response: ${url} → ${resp.status}`);
      return res.json({ status: 'awake', httpStatus: resp.status });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      logger.warn('wake', `Wake ${isTimeout ? 'timed out' : 'failed'}: ${url}`);
      return res.json({ status: isTimeout ? 'sleeping' : 'failed' });
    }
  },
};
