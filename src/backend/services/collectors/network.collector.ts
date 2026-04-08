import dns from 'node:dns/promises';
import { customObjectsApi, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'network-collector';

const CRITICAL_DOMAINS = [
  'apptolast.com',
  'matrix.stackbp.es',
  'n8n.apptolast.com',
  'rancher.apptolast.com',
];

const CERT_EXPIRY_WARNING_DAYS = 14;

async function collectTraefikRoutes(): Promise<void> {
  if (!customObjectsApi) return;

  try {
    const result = await customObjectsApi.listClusterCustomObject({
      group: 'traefik.io',
      version: 'v1alpha1',
      plural: 'ingressroutes',
    });

    const items = (result as { items?: unknown[] }).items ?? [];
    for (const route of items as Record<string, unknown>[]) {
      const meta = route.metadata as Record<string, string> | undefined;
      const spec = route.spec as Record<string, unknown> | undefined;
      const name = meta?.name ?? 'unknown';
      const namespace = meta?.namespace ?? 'default';

      const routes = (spec?.routes as Record<string, unknown>[] | undefined) ?? [];
      const hosts: string[] = [];
      const matchRules: string[] = [];

      for (const r of routes) {
        const match = (r.match as string) ?? '';
        matchRules.push(match);
        const hostMatch = match.match(/Host\(`([^`]+)`\)/g);
        if (hostMatch) {
          for (const h of hostMatch) {
            const extracted = h.match(/Host\(`([^`]+)`\)/);
            if (extracted?.[1]) hosts.push(extracted[1]);
          }
        }
      }

      monitoringRepo.insertSnapshot(
        'network',
        'ingress',
        name,
        namespace,
        'healthy',
        JSON.stringify({ hosts, matchRules, entryPoints: spec?.entryPoints }),
      );
    }

    logger.info(CTX, `Collected ${items.length} Traefik IngressRoutes`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect Traefik routes', err);
  }
}

async function collectCertificates(): Promise<void> {
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

        if (daysUntilExpiry < CERT_EXPIRY_WARNING_DAYS) {
          status = daysUntilExpiry < 7 ? 'critical' : 'warning';
          monitoringRepo.insertAlert(
            'network',
            `${namespace}/${name}`,
            daysUntilExpiry < 7 ? 'critical' : 'warning',
            `Certificate expires in ${daysUntilExpiry} days (${notAfter})`,
          );
        }
      }

      monitoringRepo.insertSnapshot(
        'network',
        'certificate',
        name,
        namespace,
        status,
        JSON.stringify({ secretName, dnsNames, notAfter, daysUntilExpiry, ready: isReady }),
      );
    }

    logger.info(CTX, `Collected ${items.length} certificates`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect certificates', err);
  }
}

async function collectMetalLB(): Promise<void> {
  if (!customObjectsApi) return;

  try {
    const result = await customObjectsApi.listClusterCustomObject({
      group: 'metallb.io',
      version: 'v1beta1',
      plural: 'ipaddresspools',
    });

    const items = (result as { items?: unknown[] }).items ?? [];
    for (const pool of items as Record<string, unknown>[]) {
      const meta = pool.metadata as Record<string, string> | undefined;
      const spec = pool.spec as Record<string, unknown> | undefined;
      const name = meta?.name ?? 'unknown';
      const namespace = meta?.namespace ?? null;

      const addresses = (spec?.addresses as string[]) ?? [];

      monitoringRepo.insertSnapshot(
        'network',
        'loadbalancer',
        name,
        namespace,
        'healthy',
        JSON.stringify({ addresses, autoAssign: spec?.autoAssign }),
      );
    }

    logger.info(CTX, `Collected ${items.length} MetalLB IP pools`);
  } catch (err) {
    logger.error(CTX, 'Failed to collect MetalLB pools', err);
  }
}

async function collectDNS(): Promise<void> {
  for (const domain of CRITICAL_DOMAINS) {
    try {
      const addresses = await dns.resolve4(domain);
      monitoringRepo.insertSnapshot(
        'network',
        'dns',
        domain,
        null,
        'healthy',
        JSON.stringify({ addresses, resolvedAt: new Date().toISOString() }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      monitoringRepo.insertSnapshot(
        'network',
        'dns',
        domain,
        null,
        'critical',
        JSON.stringify({ error: message, resolvedAt: new Date().toISOString() }),
      );
      monitoringRepo.insertAlert(
        'network',
        domain,
        'critical',
        `DNS resolution failed for ${domain}: ${message}`,
      );
      logger.warn(CTX, `DNS resolution failed for ${domain}`, err);
    }
  }

  logger.info(CTX, `DNS checks completed for ${CRITICAL_DOMAINS.length} domains`);
}

export async function collectNetwork(): Promise<void> {
  const k8s = isK8sAvailable();

  if (k8s) {
    const collectors = [
      { name: 'traefik', fn: collectTraefikRoutes },
      { name: 'certificates', fn: collectCertificates },
      { name: 'metallb', fn: collectMetalLB },
    ];

    for (const collector of collectors) {
      try {
        await collector.fn();
      } catch (err) {
        logger.error(CTX, `Failed to collect ${collector.name}`, err);
      }
    }
  } else {
    logger.warn(CTX, 'Kubernetes not available, skipping CRD queries');
  }

  // DNS checks always run regardless of K8s availability
  try {
    await collectDNS();
  } catch (err) {
    logger.error(CTX, 'Failed to collect DNS', err);
  }
}
