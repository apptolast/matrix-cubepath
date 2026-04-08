import { batchV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'backup-collector';

const HEALTHY_THRESHOLD_HOURS = 26;
const CRITICAL_THRESHOLD_HOURS = 48;

async function collectCronJobs(): Promise<void> {
  if (!batchV1Api) return;

  const result = await batchV1Api.listCronJobForAllNamespaces();

  for (const cronJob of result.items) {
    const name = cronJob.metadata?.name ?? 'unknown';
    const namespace = cronJob.metadata?.namespace ?? 'default';
    const schedule = cronJob.spec?.schedule ?? '';
    const suspend = cronJob.spec?.suspend ?? false;
    const lastScheduleTime = cronJob.status?.lastScheduleTime
      ? new Date(cronJob.status.lastScheduleTime).toISOString()
      : null;
    const lastSuccessfulTime = cronJob.status?.lastSuccessfulTime
      ? new Date(cronJob.status.lastSuccessfulTime).toISOString()
      : null;
    const activeJobs = cronJob.status?.active?.length ?? 0;

    let status: ResourceStatus = 'healthy';

    if (suspend) {
      status = 'critical';
      monitoringRepo.insertAlert(
        'backup',
        `${namespace}/${name}`,
        'critical',
        `CronJob ${name} is suspended`,
      );
    } else if (lastSuccessfulTime) {
      const lastSuccess = new Date(lastSuccessfulTime);
      const hoursSinceSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSuccess > CRITICAL_THRESHOLD_HOURS) {
        status = 'critical';
        monitoringRepo.insertAlert(
          'backup',
          `${namespace}/${name}`,
          'critical',
          `CronJob ${name} last succeeded ${Math.round(hoursSinceSuccess)}h ago (>${CRITICAL_THRESHOLD_HOURS}h)`,
        );
      } else if (hoursSinceSuccess > HEALTHY_THRESHOLD_HOURS) {
        status = 'warning';
        monitoringRepo.insertAlert(
          'backup',
          `${namespace}/${name}`,
          'warning',
          `CronJob ${name} last succeeded ${Math.round(hoursSinceSuccess)}h ago (>${HEALTHY_THRESHOLD_HOURS}h)`,
        );
      }
    } else if (lastScheduleTime) {
      // Scheduled but never succeeded — the job runs but always fails
      const lastSchedule = new Date(lastScheduleTime);
      const hoursSinceSchedule = (Date.now() - lastSchedule.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSchedule > CRITICAL_THRESHOLD_HOURS) {
        status = 'critical';
        monitoringRepo.insertAlert(
          'backup',
          `${namespace}/${name}`,
          'critical',
          `CronJob ${name} has been scheduled but never succeeded (last schedule ${Math.round(hoursSinceSchedule)}h ago)`,
        );
      } else {
        status = 'warning';
      }
    } else {
      // Never scheduled and never succeeded
      status = 'warning';
    }

    // Special focus on postgres-backup in n8n namespace
    const isPostgresBackup = name === 'postgres-backup' && namespace === 'n8n';

    monitoringRepo.insertSnapshot(
      'backup',
      'cronjob',
      name,
      namespace,
      status,
      JSON.stringify({
        schedule,
        suspend,
        lastScheduleTime,
        lastSuccessfulTime,
        activeJobs,
        isPostgresBackup,
      }),
    );
  }
}

export async function collectBackups(): Promise<void> {
  if (!isK8sAvailable()) {
    logger.warn(CTX, 'Kubernetes not available, skipping backup collection');
    return;
  }

  try {
    await collectCronJobs();
    logger.info(CTX, 'Collected backup CronJobs');
  } catch (err) {
    logger.error(CTX, 'Failed to collect backup CronJobs', err);
  }
}
