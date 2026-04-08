import { Request, Response } from 'express';
import { monitoringRepo, MonitoringCategory } from '../repositories/monitoring.repository';
import { getLatestResults, isMonitoringEnabled, runCollectorsManually } from '../services/monitoring-manager';
import { logger } from '../lib/logger';

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export const monitoringController = {
  getDashboard(_req: Request, res: Response) {
    try {
      const enabled = isMonitoringEnabled();
      const summary = monitoringRepo.getCategorySummary();
      const activeAlerts = monitoringRepo.findActiveAlerts();
      res.json({
        enabled,
        summary,
        activeAlerts,
        lastUpdate: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('monitoring', 'getDashboard error', err);
      res.status(500).json({ error: 'Failed to get monitoring dashboard' });
    }
  },

  getKubernetes(_req: Request, res: Response) {
    try {
      const data = monitoringRepo.getLatestByCategory('k8s');
      res.json(data.length ? data : getLatestResults('k8s'));
    } catch (err) {
      logger.error('monitoring', 'getKubernetes error', err);
      res.status(500).json({ error: 'Failed to get Kubernetes data' });
    }
  },

  getKubernetesDetail(req: Request, res: Response) {
    try {
      const { resourceType, name } = req.params;
      const all = monitoringRepo.getLatestByCategory('k8s');
      const filtered = all.filter(
        (s) => s.resource_type === resourceType && s.resource_name === name,
      );
      res.json(filtered);
    } catch (err) {
      logger.error('monitoring', 'getKubernetesDetail error', err);
      res.status(500).json({ error: 'Failed to get Kubernetes detail' });
    }
  },

  getDatabases(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('database'));
    } catch (err) {
      logger.error('monitoring', 'getDatabases error', err);
      res.status(500).json({ error: 'Failed to get database data' });
    }
  },

  getApplications(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('app'));
    } catch (err) {
      logger.error('monitoring', 'getApplications error', err);
      res.status(500).json({ error: 'Failed to get application data' });
    }
  },

  getNetwork(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('network'));
    } catch (err) {
      logger.error('monitoring', 'getNetwork error', err);
      res.status(500).json({ error: 'Failed to get network data' });
    }
  },

  getStorage(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('storage'));
    } catch (err) {
      logger.error('monitoring', 'getStorage error', err);
      res.status(500).json({ error: 'Failed to get storage data' });
    }
  },

  getDocker(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('docker'));
    } catch (err) {
      logger.error('monitoring', 'getDocker error', err);
      res.status(500).json({ error: 'Failed to get Docker data' });
    }
  },

  getSecurity(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('security'));
    } catch (err) {
      logger.error('monitoring', 'getSecurity error', err);
      res.status(500).json({ error: 'Failed to get security data' });
    }
  },

  getBackups(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('backup'));
    } catch (err) {
      logger.error('monitoring', 'getBackups error', err);
      res.status(500).json({ error: 'Failed to get backup data' });
    }
  },

  getIoT(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getLatestByCategory('iot'));
    } catch (err) {
      logger.error('monitoring', 'getIoT error', err);
      res.status(500).json({ error: 'Failed to get IoT data' });
    }
  },

  getAlerts(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      res.json(monitoringRepo.findAllAlerts(limit));
    } catch (err) {
      logger.error('monitoring', 'getAlerts error', err);
      res.status(500).json({ error: 'Failed to get alerts' });
    }
  },

  acknowledgeAlert(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = monitoringRepo.acknowledgeAlert(id);
      if (!updated) {
        res.status(404).json({ error: 'Alert not found or already acknowledged' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error('monitoring', 'acknowledgeAlert error', err);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  },

  getHistory(req: Request, res: Response) {
    try {
      const range = (req.query.range as string) || '24h';
      const category = req.query.category as MonitoringCategory | undefined;
      const resource = req.query.resource as string | undefined;

      const now = new Date();
      const ms = RANGE_MS[range] || RANGE_MS['24h'];
      const fromTime = new Date(now.getTime() - ms).toISOString();
      const toTime = now.toISOString();

      if (resource) {
        res.json(monitoringRepo.getHistory(resource, fromTime, toTime));
      } else if (category) {
        res.json(monitoringRepo.getHistoryByCategory(category, fromTime, toTime));
      } else {
        res.status(400).json({ error: 'Either resource or category must be provided' });
        return;
      }
    } catch (err) {
      logger.error('monitoring', 'getHistory error', err);
      res.status(500).json({ error: 'Failed to get history' });
    }
  },

  getConfig(_req: Request, res: Response) {
    try {
      res.json(monitoringRepo.getAllConfig());
    } catch (err) {
      logger.error('monitoring', 'getConfig error', err);
      res.status(500).json({ error: 'Failed to get config' });
    }
  },

  updateConfig(req: Request, res: Response) {
    try {
      const { key, value } = req.body as { key: string; value: string };
      monitoringRepo.setConfig(key, value);
      res.json({ ok: true });
    } catch (err) {
      logger.error('monitoring', 'updateConfig error', err);
      res.status(500).json({ error: 'Failed to update config' });
    }
  },

  async refresh(_req: Request, res: Response) {
    try {
      await runCollectorsManually();
      res.json({ ok: true, refreshedAt: new Date().toISOString() });
    } catch (err) {
      logger.error('monitoring', 'refresh error', err);
      res.status(500).json({ error: 'Failed to refresh monitoring data' });
    }
  },
};
