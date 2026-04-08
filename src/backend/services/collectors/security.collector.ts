import { coreV1Api, customObjectsApi, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'security-collector';

const CERT_CRITICAL_DAYS = 7;
const CERT_WARNING_DAYS = 14;

async function collectTLSCertificates(): Promise<void> {
  if (!customObjectsApi) return;

  try {
    const result = await customObjectsApi.listClusterCustomObject({
      group: 'cert-manager.io',
      version: 'v1',
      plural: 'certificates',
    });

    const items = (result as { items?: unknown[] }).items ?? [];
    for (const cert of items as Record<string, unknown>[]) {
      const meta = cert.metadata as Record<string, string> | undefined;
      const spec = cert.spec as Record<string, unknown> | undefined;
      const statusObj = cert.status as Record<string, unknown> | undefined;
      const name = meta?.name ?? 'unknown';
      const namespace = meta?.namespace ?? 'default';

      const secretName = (spec?.secretName as string) ?? '';
      const dnsNames = (spec?.dnsNames as string[]) ?? [];
      const notAfter = (statusObj?.notAfter as string) ?? '';
      const conditions = (statusObj?.conditions as Record<string, string>[]) ?? [];
      const readyCondition = conditions.find((c) => c.type === 'Ready');
      const isReady = readyCondition?.status === 'True';

      let status: ResourceStatus = isReady ? 'healthy' : 'warning';
      let daysUntilExpiry: number | null = null;

      if (notAfter) {
        const expiryDate = new Date(notAfter);
        const now = new Date();
        daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < CERT_CRITICAL_DAYS) {
          status = 'critical';
          monitoringRepo.insertAlert(
            'security',
            `${namespace}/${name}`,
            'critical',
            `TLS certificate expires in ${daysUntilExpiry} days (${notAfter})`,
          );
        } else if (daysUntilExpiry < CERT_WARNING_DAYS) {
          status = 'warning';
          monitoringRepo.insertAlert(
            'security',
            `${namespace}/${name}`,
            'warning',
            `TLS certificate expires in ${daysUntilExpiry} days (${notAfter})`,
          );
        }
      }

      monitoringRepo.insertSnapshot(
        'security',
        'certificate',
        name,
        namespace,
        status,
        JSON.stringify({ secretName, dnsNames, notAfter, daysUntilExpiry, ready: isReady }),
      );
    }

    logger.info(CTX, `Collected ${items.length} TLS certificates`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect TLS certificates', err);
  }
}

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
    { name: 'tls-certificates', fn: collectTLSCertificates },
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
