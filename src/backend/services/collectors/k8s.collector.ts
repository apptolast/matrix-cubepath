import { coreV1Api, appsV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus, AlertSeverity } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'k8s-collector';

async function collectNodes(): Promise<void> {
  if (!coreV1Api) return;

  const nodeList = await coreV1Api.listNode();
  for (const node of nodeList.items) {
    const name = node.metadata?.name ?? 'unknown';
    const conditions = node.status?.conditions ?? [];
    const readyCondition = conditions.find((c) => c.type === 'Ready');
    const isReady = readyCondition?.status === 'True';

    const capacity = node.status?.capacity ?? {};
    const allocatable = node.status?.allocatable ?? {};

    const status: ResourceStatus = isReady ? 'healthy' : 'critical';

    monitoringRepo.insertSnapshot(
      'k8s',
      'node',
      name,
      null,
      status,
      JSON.stringify({
        ready: isReady,
        conditions: conditions.map((c) => ({ type: c.type, status: c.status, reason: c.reason })),
        capacity: { cpu: capacity.cpu, memory: capacity.memory },
        allocatable: { cpu: allocatable.cpu, memory: allocatable.memory },
      }),
    );
  }
}

async function collectPods(): Promise<void> {
  if (!coreV1Api) return;

  const podList = await coreV1Api.listPodForAllNamespaces();
  for (const pod of podList.items) {
    const name = pod.metadata?.name ?? 'unknown';
    const namespace = pod.metadata?.namespace ?? 'default';
    const phase = pod.status?.phase ?? 'Unknown';
    const containerStatuses = pod.status?.containerStatuses ?? [];

    const restartCount = containerStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0);
    const allReady = containerStatuses.length > 0 && containerStatuses.every((cs) => cs.ready);

    const hasCrashLoop = containerStatuses.some(
      (cs) => cs.state?.waiting?.reason === 'CrashLoopBackOff',
    );

    let status: ResourceStatus = 'unknown';
    if (phase === 'Failed' || hasCrashLoop) {
      status = 'critical';
    } else if (phase === 'Running' && allReady) {
      status = 'healthy';
    } else if (phase === 'Pending' || restartCount > 5) {
      status = 'warning';
    } else if (phase === 'Succeeded') {
      status = 'healthy';
    } else {
      status = 'warning';
    }

    monitoringRepo.insertSnapshot(
      'k8s',
      'pod',
      name,
      namespace,
      status,
      JSON.stringify({
        phase,
        restartCount,
        containers: containerStatuses.map((cs) => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          state: cs.state,
        })),
      }),
    );
  }
}

async function collectDeployments(): Promise<void> {
  if (!appsV1Api) return;

  const depList = await appsV1Api.listDeploymentForAllNamespaces();
  for (const dep of depList.items) {
    const name = dep.metadata?.name ?? 'unknown';
    const namespace = dep.metadata?.namespace ?? 'default';
    const desired = dep.spec?.replicas ?? 0;
    const ready = dep.status?.readyReplicas ?? 0;
    const conditions = dep.status?.conditions ?? [];

    let status: ResourceStatus;
    if (ready === 0 && desired > 0) {
      status = 'critical';
    } else if (ready < desired) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    monitoringRepo.insertSnapshot(
      'k8s',
      'deployment',
      name,
      namespace,
      status,
      JSON.stringify({
        desiredReplicas: desired,
        readyReplicas: ready,
        conditions: conditions.map((c) => ({ type: c.type, status: c.status, reason: c.reason })),
      }),
    );
  }
}

async function collectServices(): Promise<void> {
  if (!coreV1Api) return;

  const svcList = await coreV1Api.listServiceForAllNamespaces();
  for (const svc of svcList.items) {
    const name = svc.metadata?.name ?? 'unknown';
    const namespace = svc.metadata?.namespace ?? 'default';
    const svcType = svc.spec?.type ?? 'ClusterIP';
    const clusterIP = svc.spec?.clusterIP ?? '';
    const ports = (svc.spec?.ports ?? []).map((p) => ({
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol,
      name: p.name,
    }));

    monitoringRepo.insertSnapshot(
      'k8s',
      'service',
      name,
      namespace,
      'healthy',
      JSON.stringify({ type: svcType, clusterIP, ports }),
    );
  }
}

async function collectEvents(): Promise<void> {
  if (!coreV1Api) return;

  const eventList = await coreV1Api.listEventForAllNamespaces();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const event of eventList.items) {
    if (event.type !== 'Warning') continue;

    const eventTime = event.lastTimestamp
      ? new Date(event.lastTimestamp as unknown as string)
      : event.eventTime
        ? new Date(event.eventTime as unknown as string)
        : null;

    if (!eventTime || eventTime < oneHourAgo) continue;

    const resourceName = event.involvedObject?.name ?? 'unknown';
    const namespace = event.involvedObject?.namespace ?? '';
    const reason = event.reason ?? '';
    const message = event.message ?? '';

    const severity: AlertSeverity = reason === 'BackOff' || reason === 'Failed' || reason === 'OOMKilling'
      ? 'critical'
      : 'warning';

    monitoringRepo.insertAlert(
      'k8s',
      `${namespace}/${resourceName}`,
      severity,
      `[${reason}] ${message}`,
    );

    monitoringRepo.insertSnapshot(
      'k8s',
      'event',
      `${namespace}/${resourceName}`,
      namespace || null,
      severity === 'critical' ? 'critical' : 'warning',
      JSON.stringify({
        type: 'Warning',
        reason,
        message,
        resourceName,
        namespace,
        eventTime: eventTime ? eventTime.toISOString() : null,
      }),
    );
  }
}

async function collectNamespaces(): Promise<void> {
  if (!coreV1Api) return;

  const nsList = await coreV1Api.listNamespace();
  for (const ns of nsList.items) {
    const name = ns.metadata?.name ?? 'unknown';
    const phase = ns.status?.phase ?? 'Unknown';

    const status: ResourceStatus = phase === 'Active' ? 'healthy' : 'warning';

    monitoringRepo.insertSnapshot(
      'k8s',
      'namespace',
      name,
      null,
      status,
      JSON.stringify({ phase }),
    );
  }
}

export async function collectKubernetes(): Promise<void> {
  if (!isK8sAvailable()) {
    logger.warn(CTX, 'Kubernetes not available, skipping collection');
    return;
  }

  const collectors = [
    { name: 'nodes', fn: collectNodes },
    { name: 'pods', fn: collectPods },
    { name: 'deployments', fn: collectDeployments },
    { name: 'services', fn: collectServices },
    { name: 'events', fn: collectEvents },
    { name: 'namespaces', fn: collectNamespaces },
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
