import net from 'node:net';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'iot-collector';

// ── Configuration ──────────────────────────────────────────────────────────

const EMQX_NAMESPACE = 'apptolast-invernadero-api';
const EMQX_SERVICE_HOST =
  process.env.EMQX_SERVICE_HOST ?? `mqttinvernaderoapi.${EMQX_NAMESPACE}.svc.cluster.local`;
const EMQX_DASHBOARD_PORT = 18083;
const EMQX_MQTT_PORT = 1883;

const EMQX_API_URL =
  process.env.EMQX_API_URL ?? `http://${EMQX_SERVICE_HOST}:${EMQX_DASHBOARD_PORT}`;

const EMQX_API_KEY = process.env.EMQX_API_KEY ?? '';

const FETCH_TIMEOUT_MS = 10000;

// ── Types ──────────────────────────────────────────────────────────────────

interface EmqxStats {
  'connections.count'?: number;
  'connections.max'?: number;
  'topics.count'?: number;
  'subscribers.count'?: number;
  'subscriptions.count'?: number;
  'messages.received'?: number;
  'messages.sent'?: number;
  'retained.count'?: number;
  'live_connections.count'?: number;
  [key: string]: number | undefined;
}

interface EmqxClient {
  clientid: string;
  username?: string;
  connected: boolean;
  ip_address?: string;
  keepalive?: number;
}

interface EmqxClientsResponse {
  data: EmqxClient[];
  meta?: { count?: number; page?: number; limit?: number };
}

interface IoTMetrics {
  up: boolean;
  connectedClients: number;
  maxConnections: number;
  subscriptionCount: number;
  topicCount: number;
  messagesReceived: number;
  messagesSent: number;
  retainedMessages: number;
  responseTimeMs: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (EMQX_API_KEY) {
    headers['Authorization'] = `Basic ${Buffer.from(EMQX_API_KEY).toString('base64')}`;
  }

  return headers;
}

async function emqxFetch<T>(path: string): Promise<T | null> {
  const url = `${EMQX_API_URL}${path}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: buildAuthHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(CTX, `EMQX API returned ${res.status} for ${path}`);
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
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

// ── Collection via EMQX Dashboard API ──────────────────────────────────────

async function collectEmqxApi(): Promise<IoTMetrics | null> {
  const start = Date.now();

  const stats = await emqxFetch<EmqxStats>('/api/v5/stats');
  if (!stats) return null;

  const elapsed = Date.now() - start;

  // Try to get clients count from dedicated endpoint for accuracy
  let clientCount = stats['live_connections.count'] ?? stats['connections.count'] ?? 0;

  try {
    const clientsResp = await emqxFetch<EmqxClientsResponse>('/api/v5/clients?limit=1');
    if (clientsResp?.meta?.count !== undefined) {
      clientCount = clientsResp.meta.count;
    }
  } catch {
    // Use stats-based count as fallback
  }

  return {
    up: true,
    connectedClients: clientCount,
    maxConnections: stats['connections.max'] ?? 0,
    subscriptionCount: stats['subscriptions.count'] ?? 0,
    topicCount: stats['topics.count'] ?? 0,
    messagesReceived: stats['messages.received'] ?? 0,
    messagesSent: stats['messages.sent'] ?? 0,
    retainedMessages: stats['retained.count'] ?? 0,
    responseTimeMs: elapsed,
  };
}

// ── Fallback TCP check ─────────────────────────────────────────────────────

async function collectEmqxTcp(): Promise<IoTMetrics> {
  const start = Date.now();
  const result = await tcpConnect(EMQX_SERVICE_HOST, EMQX_MQTT_PORT);
  const elapsed = Date.now() - start;

  return {
    up: result === 'online',
    connectedClients: 0,
    maxConnections: 0,
    subscriptionCount: 0,
    topicCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    retainedMessages: 0,
    responseTimeMs: elapsed,
  };
}

// ── Status determination ───────────────────────────────────────────────────

function determineStatus(metrics: IoTMetrics, source: string): ResourceStatus {
  if (!metrics.up) return 'critical';
  // Only warn about zero clients when we have real data from the API
  // TCP fallback returns synthetic zeros — we can't know the real client count
  if (source === 'api' && metrics.connectedClients === 0) return 'warning';
  return 'healthy';
}

// ── Main export ────────────────────────────────────────────────────────────

export async function collectIoT(): Promise<void> {
  logger.info(CTX, 'Starting IoT collection');

  let metrics: IoTMetrics;
  let source: string;

  // Phase 1: Try EMQX Dashboard API
  try {
    const apiMetrics = await collectEmqxApi();
    if (apiMetrics) {
      metrics = apiMetrics;
      source = 'api';
    } else {
      // Phase 2: Fall back to TCP check on MQTT port
      logger.warn(CTX, 'EMQX API not reachable, falling back to TCP check');
      metrics = await collectEmqxTcp();
      source = 'tcp';
    }
  } catch (err) {
    logger.error(CTX, 'EMQX API collection failed, falling back to TCP check', err);
    metrics = await collectEmqxTcp();
    source = 'tcp';
  }

  const status = determineStatus(metrics, source);

  monitoringRepo.insertSnapshot(
    'iot',
    'mqtt_broker',
    'emqx',
    EMQX_NAMESPACE,
    status,
    JSON.stringify({
      up: metrics.up,
      connections: metrics.connectedClients,
      maxConnections: metrics.maxConnections,
      subscriptionCount: metrics.subscriptionCount,
      topicCount: metrics.topicCount,
      messagesReceived: metrics.messagesReceived,
      messagesSent: metrics.messagesSent,
      retainedMessages: metrics.retainedMessages,
      responseTimeMs: metrics.responseTimeMs,
      source,
    }),
  );

  if (status === 'critical') {
    monitoringRepo.insertAlert(
      'iot',
      `${EMQX_NAMESPACE}/emqx`,
      'critical',
      'EMQX MQTT broker is unreachable',
    );
  } else {
    monitoringRepo.resolveAlert(
      `${EMQX_NAMESPACE}/emqx`,
      'EMQX MQTT broker is unreachable',
    );
  }

  if (status === 'warning') {
    monitoringRepo.insertAlert(
      'iot',
      `${EMQX_NAMESPACE}/emqx`,
      'warning',
      'EMQX MQTT broker has no connected clients',
    );
  } else if (metrics.connectedClients > 0) {
    monitoringRepo.resolveAlert(
      `${EMQX_NAMESPACE}/emqx`,
      'EMQX MQTT broker has no connected clients',
    );
  }

  logger.info(CTX, `IoT collection complete (source=${source}, status=${status}, clients=${metrics.connectedClients})`);
}
