# Collector: Kubernetes

**Archivo**: `src/backend/services/collectors/k8s.collector.ts`
**Categoría**: `k8s`
**Intervalo**: 60 segundos
**Dependencia**: Kubernetes API (via `@kubernetes/client-node`)

## Recursos recopilados

El collector de Kubernetes ejecuta 6 sub-collectors secuencialmente:

### 1. Nodes

**API**: `coreV1Api.listNode()`
**Tipo de recurso**: `node`

| Dato | Origen |
|------|--------|
| Nombre | `node.metadata.name` |
| Estado Ready | `conditions.find(c => c.type === 'Ready').status` |
| CPU Capacity | `node.status.capacity.cpu` |
| Memory Capacity | `node.status.capacity.memory` |
| CPU Allocatable | `node.status.allocatable.cpu` |
| Memory Allocatable | `node.status.allocatable.memory` |
| Conditions | Lista de todas las conditions |

**Lógica de estado:**

- Ready = True → `healthy`
- Ready != True → `critical`

### 2. Pods

**API**: `coreV1Api.listPodForAllNamespaces()`
**Tipo de recurso**: `pod`

| Dato | Origen |
|------|--------|
| Nombre | `pod.metadata.name` |
| Namespace | `pod.metadata.namespace` |
| Phase | `pod.status.phase` |
| Restart count | Suma de `restartCount` de todos los containers |
| Container states | Estado de cada contenedor |
| CrashLoopBackOff | Detección de `state.waiting.reason === 'CrashLoopBackOff'` |

**Lógica de estado:**

| Condición | Estado |
|-----------|--------|
| Phase=Failed o CrashLoopBackOff | `critical` |
| Phase=Running y todos los containers ready | `healthy` |
| Phase=Pending o restarts>5 | `warning` |
| Phase=Succeeded | `healthy` |
| Cualquier otro caso | `warning` |

### 3. Deployments

**API**: `appsV1Api.listDeploymentForAllNamespaces()`
**Tipo de recurso**: `deployment`

| Dato | Origen |
|------|--------|
| Nombre | `dep.metadata.name` |
| Namespace | `dep.metadata.namespace` |
| Desired replicas | `dep.spec.replicas` |
| Ready replicas | `dep.status.readyReplicas` |
| Conditions | Lista de conditions del deployment |

**Lógica de estado:**

| Condición | Estado |
|-----------|--------|
| ready=0 y desired>0 | `critical` |
| ready < desired | `warning` |
| ready = desired | `healthy` |

### 4. Services

**API**: `coreV1Api.listServiceForAllNamespaces()`
**Tipo de recurso**: `service`

| Dato | Origen |
|------|--------|
| Nombre | `svc.metadata.name` |
| Namespace | `svc.metadata.namespace` |
| Type | `svc.spec.type` (ClusterIP, NodePort, etc.) |
| ClusterIP | `svc.spec.clusterIP` |
| Ports | Lista de puertos (port, targetPort, protocol, name) |

Todos los services se registran con estado `healthy`.

### 5. Events

**API**: `coreV1Api.listEventForAllNamespaces()`
**Tipo de recurso**: `event`

Solo se procesan eventos de tipo **Warning** de la **última hora**.

| Dato | Origen |
|------|--------|
| Resource name | `event.involvedObject.name` |
| Namespace | `event.involvedObject.namespace` |
| Reason | `event.reason` |
| Message | `event.message` |
| Event time | `event.lastTimestamp` o `event.eventTime` |

**Alertas generadas:**

| Reason | Severidad |
|--------|-----------|
| BackOff, Failed, OOMKilling | `critical` |
| Cualquier otro Warning | `warning` |

### 6. Namespaces

**API**: `coreV1Api.listNamespace()`
**Tipo de recurso**: `namespace`

| Dato | Origen |
|------|--------|
| Nombre | `ns.metadata.name` |
| Phase | `ns.status.phase` |

**Lógica de estado:**

- Phase = Active → `healthy`
- Otro → `warning`

## Manejo de errores

Cada sub-collector se ejecuta de forma independiente dentro de un try/catch. Si uno falla (por ejemplo, la API de deployments no responde), los demás continúan ejecutándose normalmente.

Si la API de Kubernetes no está disponible (`isK8sAvailable() === false`), todo el collector se salta con un mensaje de warning en los logs.
