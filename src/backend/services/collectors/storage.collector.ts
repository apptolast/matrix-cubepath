import { coreV1Api, customObjectsApi, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'storage-collector';

async function collectPVCs(): Promise<void> {
  if (!coreV1Api) return;

  const result = await coreV1Api.listPersistentVolumeClaimForAllNamespaces();
  for (const pvc of result.items) {
    const name = pvc.metadata?.name ?? 'unknown';
    const namespace = pvc.metadata?.namespace ?? 'default';
    const phase = pvc.status?.phase ?? 'Unknown';
    const capacity = pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage ?? '';
    const storageClassName = pvc.spec?.storageClassName ?? '';
    const volumeName = pvc.spec?.volumeName ?? '';

    let status: ResourceStatus;
    if (phase === 'Bound') {
      status = 'healthy';
    } else if (phase === 'Pending') {
      status = 'warning';
    } else if (phase === 'Lost') {
      status = 'critical';
    } else {
      status = 'unknown';
    }

    // Note: K8s PVC API does not expose actual disk usage (only allocated capacity).
    // Real usage metrics come from kubelet or Longhorn, not PVC status.

    monitoringRepo.insertSnapshot(
      'storage',
      'pvc',
      name,
      namespace,
      status,
      JSON.stringify({ phase, capacity, storageClassName, volumeName }),
    );
  }
}

async function collectLonghornVolumes(): Promise<void> {
  if (!customObjectsApi) return;

  try {
    const result = await customObjectsApi.listClusterCustomObject({
      group: 'longhorn.io',
      version: 'v1beta2',
      plural: 'volumes',
    });

    const items = (result as { items?: unknown[] }).items ?? [];
    for (const vol of items as Record<string, unknown>[]) {
      const meta = vol.metadata as Record<string, string> | undefined;
      const spec = vol.spec as Record<string, unknown> | undefined;
      const statusObj = vol.status as Record<string, unknown> | undefined;
      const name = meta?.name ?? 'unknown';
      const namespace = meta?.namespace ?? null;

      const state = (statusObj?.state as string) ?? 'unknown';
      const robustness = (statusObj?.robustness as string) ?? 'unknown';
      const actualSize = (statusObj?.actualSize as string) ?? '';
      const size = (spec?.size as string) ?? '';
      const numberOfReplicas = (spec?.numberOfReplicas as number) ?? 0;

      let status: ResourceStatus;
      if (state === 'attached' || state === 'detached') {
        status = robustness === 'healthy' ? 'healthy' : robustness === 'degraded' ? 'warning' : 'critical';
      } else if (state === 'creating' || state === 'attaching' || state === 'detaching') {
        status = 'warning';
      } else {
        status = 'critical';
      }

      monitoringRepo.insertSnapshot(
        'storage',
        'longhorn_volume',
        name,
        namespace,
        status,
        JSON.stringify({ state, robustness, size, actualSize, numberOfReplicas }),
      );
    }

    logger.info(CTX, `Collected ${items.length} Longhorn volumes`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect Longhorn volumes', err);
  }
}

export async function collectStorage(): Promise<void> {
  if (!isK8sAvailable()) {
    logger.warn(CTX, 'Kubernetes not available, skipping storage collection');
    return;
  }

  const collectors = [
    { name: 'pvcs', fn: collectPVCs },
    { name: 'longhorn', fn: collectLonghornVolumes },
  ];

  for (const collector of collectors) {
    try {
      await collector.fn();
      logger.info(CTX, `Collected ${collector.name}`);
    } catch (err) {
      logger.error(CTX, `Failed to collect ${collector.name}`, err);
    }
  }
}
