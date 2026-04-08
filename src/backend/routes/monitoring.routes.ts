import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { validate } from '../middleware/validate.middleware';
import {
  kubernetesDetailParamsSchema,
  alertIdParamsSchema,
  historyQuerySchema,
  configBodySchema,
} from '../validations/monitoring.validation';

export const monitoringRouter = Router();

// Dashboard
monitoringRouter.get('/monitoring/dashboard', monitoringController.getDashboard);

// Category endpoints
monitoringRouter.get('/monitoring/kubernetes', monitoringController.getKubernetes);
monitoringRouter.get(
  '/monitoring/kubernetes/:resourceType/:name',
  validate({ params: kubernetesDetailParamsSchema }),
  monitoringController.getKubernetesDetail,
);
monitoringRouter.get('/monitoring/databases', monitoringController.getDatabases);
monitoringRouter.get('/monitoring/applications', monitoringController.getApplications);
monitoringRouter.get('/monitoring/network', monitoringController.getNetwork);
monitoringRouter.get('/monitoring/storage', monitoringController.getStorage);
monitoringRouter.get('/monitoring/docker', monitoringController.getDocker);
monitoringRouter.get('/monitoring/security', monitoringController.getSecurity);
monitoringRouter.get('/monitoring/backups', monitoringController.getBackups);
monitoringRouter.get('/monitoring/iot', monitoringController.getIoT);

// Alerts
monitoringRouter.get('/monitoring/alerts', monitoringController.getAlerts);
monitoringRouter.patch(
  '/monitoring/alerts/:id/acknowledge',
  validate({ params: alertIdParamsSchema }),
  monitoringController.acknowledgeAlert,
);

// History
monitoringRouter.get('/monitoring/history', validate({ query: historyQuerySchema }), monitoringController.getHistory);

// Config
monitoringRouter.get('/monitoring/config', monitoringController.getConfig);
monitoringRouter.put('/monitoring/config', validate({ body: configBodySchema }), monitoringController.updateConfig);

// Refresh
monitoringRouter.post('/monitoring/refresh', monitoringController.refresh);
