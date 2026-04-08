import * as k8s from '@kubernetes/client-node';
import { logger } from '../lib/logger';

let kubeConfig: k8s.KubeConfig | null = null;
let coreV1Api: k8s.CoreV1Api | null = null;
let appsV1Api: k8s.AppsV1Api | null = null;
let networkingV1Api: k8s.NetworkingV1Api | null = null;
let batchV1Api: k8s.BatchV1Api | null = null;
let customObjectsApi: k8s.CustomObjectsApi | null = null;
let storageV1Api: k8s.StorageV1Api | null = null;
let k8sAvailable = false;

function initialize(): void {
  const kc = new k8s.KubeConfig();

  try {
    kc.loadFromCluster();
    logger.info('k8s-client', 'Loaded kubeconfig from in-cluster ServiceAccount');
  } catch {
    try {
      kc.loadFromDefault();
      logger.info('k8s-client', 'Loaded kubeconfig from default location');
    } catch (err) {
      logger.warn('k8s-client', 'Kubernetes not available — both in-cluster and default config failed', err);
      return;
    }
  }

  try {
    kubeConfig = kc;
    coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
    appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
    networkingV1Api = kc.makeApiClient(k8s.NetworkingV1Api);
    batchV1Api = kc.makeApiClient(k8s.BatchV1Api);
    customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    storageV1Api = kc.makeApiClient(k8s.StorageV1Api);
    k8sAvailable = true;
    logger.info('k8s-client', 'Kubernetes API clients initialized successfully');
  } catch (err) {
    logger.warn('k8s-client', 'Failed to create Kubernetes API clients', err);
  }
}

// Initialize on import
initialize();

export function isK8sAvailable(): boolean {
  return k8sAvailable;
}

export function getKubeConfig(): k8s.KubeConfig | null {
  return kubeConfig;
}

export {
  coreV1Api,
  appsV1Api,
  networkingV1Api,
  batchV1Api,
  customObjectsApi,
  storageV1Api,
};
