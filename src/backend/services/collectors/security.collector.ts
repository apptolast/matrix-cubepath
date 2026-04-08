import { coreV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'security-collector';

// Note: TLS certificate monitoring is handled by network.collector.ts to avoid duplicates

async function collectWireGuardVPN(): Promise<void> {
  if (!coreV1Api) return;

  try {
    const result = await coreV1Api.listNamespacedPod({ namespace: 'apptolast-wireguard' });
    const pods = result.items;

    let overallStatus: ResourceStatus = pods.length > 0 ? 'healthy' : 'critical';
    const podDetails: Record<string, unknown>[] = [];

    for (const pod of pods) {
      const name = pod.metadata?.name ?? 'unknown';
      const phase = pod.status?.phase ?? 'Unknown';
      const containerStatuses = pod.status?.containerStatuses ?? [];
      const allReady = containerStatuses.length > 0 && containerStatuses.every((cs) => cs.ready);

      if (phase !== 'Running' || !allReady) {
        overallStatus = phase === 'Failed' ? 'critical' : 'warning';
      }

      podDetails.push({
        name,
        phase,
        ready: allReady,
        containers: containerStatuses.map((cs) => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
        })),
      });
    }

    if (pods.length === 0) {
      monitoringRepo.insertAlert(
        'security',
        'wireguard-vpn',
        'critical',
        'No WireGuard VPN pods found in namespace apptolast-wireguard',
      );
    }

    monitoringRepo.insertSnapshot(
      'security',
      'vpn',
      'wireguard',
      'apptolast-wireguard',
      overallStatus,
      JSON.stringify({ podCount: pods.length, pods: podDetails }),
    );

    logger.info(CTX, `Collected WireGuard VPN status (${pods.length} pods)`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect WireGuard VPN status', err);
  }
}

async function collectPassbolt(): Promise<void> {
  if (!coreV1Api) return;

  try {
    const result = await coreV1Api.listNamespacedPod({ namespace: 'passbolt' });
    const pods = result.items;

    let overallStatus: ResourceStatus = pods.length > 0 ? 'healthy' : 'critical';
    const podDetails: Record<string, unknown>[] = [];

    for (const pod of pods) {
      const name = pod.metadata?.name ?? 'unknown';
      const phase = pod.status?.phase ?? 'Unknown';
      const containerStatuses = pod.status?.containerStatuses ?? [];
      const allReady = containerStatuses.length > 0 && containerStatuses.every((cs) => cs.ready);

      if (phase !== 'Running' || !allReady) {
        overallStatus = phase === 'Failed' ? 'critical' : 'warning';
      }

      podDetails.push({
        name,
        phase,
        ready: allReady,
        containers: containerStatuses.map((cs) => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
        })),
      });
    }

    if (pods.length === 0) {
      monitoringRepo.insertAlert(
        'security',
        'passbolt',
        'critical',
        'No Passbolt pods found in namespace passbolt',
      );
    }

    monitoringRepo.insertSnapshot(
      'security',
      'password_manager',
      'passbolt',
      'passbolt',
      overallStatus,
      JSON.stringify({ podCount: pods.length, pods: podDetails }),
    );

    logger.info(CTX, `Collected Passbolt status (${pods.length} pods)`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect Passbolt status', err);
  }
}

export async function collectSecurity(): Promise<void> {
  if (!isK8sAvailable()) {
    logger.warn(CTX, 'Kubernetes not available, skipping security collection');
    return;
  }

  const collectors = [
    { name: 'wireguard-vpn', fn: collectWireGuardVPN },
    { name: 'passbolt', fn: collectPassbolt },
  ];

  for (const collector of collectors) {
    try {
      await collector.fn();
    } catch (err) {
      logger.error(CTX, `Failed to collect ${collector.name}`, err);
    }
  }
}
