import { coreV1Api, customObjectsApi, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'storage-collector';

const PVC_USAGE_WARNING_THRESHOLD = 0.9;

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

    // Check capacity usage if both spec and status capacity are available
    const specCapacity = pvc.spec?.resources?.requests?.storage;
    const actualCapacity = pvc.status?.capacity?.storage;
    if (specCapacity && actualCapacity) {
      const specBytes = parseStorageSize(specCapacity);
      const actualBytes = parseStorageSize(actualCapacity);
      if (specBytes > 0 && actualBytes > 0) {
        const usageRatio = actualBytes / specBytes;
        if (usageRatio > PVC_USAGE_WARNING_THRESHOLD) {
          status = 'warning';
          monitoringRepo.insertAlert(
            'storage',
            `${namespace}/${name}`,
            'warning',
            `PVC usage is at ${Math.round(usageRatio * 100)}% of capacity`,
          );
        }
      }
    }

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

function parseStorageSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] ?? '';

  const multipliers: Record<string, number> = {
    '': 1,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    k: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
  };

  return value * (multipliers[unit] ?? 1);
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
