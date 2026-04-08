# Collector: Almacenamiento

**Archivo**: `src/backend/services/collectors/storage.collector.ts`
**Categoría**: `storage`
**Intervalo**: 300 segundos (5 minutos)
**Dependencias**: Kubernetes API (Core + Custom Resources)

## Sub-collectors

### 1. Persistent Volume Claims (PVCs)

**API**: `coreV1Api.listPersistentVolumeClaimForAllNamespaces()`
**Tipo de recurso**: `pvc`

| Dato | Origen |
|------|--------|
| Nombre | `pvc.metadata.name` |
| Namespace | `pvc.metadata.namespace` |
| Phase | `pvc.status.phase` |
| Capacity | `pvc.status.capacity.storage` o `pvc.spec.resources.requests.storage` |
| Storage class | `pvc.spec.storageClassName` |
| Volume name | `pvc.spec.volumeName` |

**Lógica de estado:**

| Phase | Estado |
|-------|--------|
| `Bound` | `healthy` |
| `Pending` | `warning` |
| `Lost` | `critical` |
| Otro | `unknown` |

**Alerta de uso:**

Si se puede calcular el ratio de uso (capacidad spec vs capacidad real):

- Uso > 90% → estado cambia a `warning` + alerta `warning`: "PVC usage is at X% of capacity"

**Parser de tamaños:**

El collector soporta todas las unidades de Kubernetes:

| Unidad | Multiplicador |
|--------|--------------|
| Ki | 1024 |
| Mi | 1024^2 |
| Gi | 1024^3 |
| Ti | 1024^4 |
| k | 1000 |
| M | 1000^2 |
| G | 1000^3 |

### 2. Longhorn Volumes

**API**: Custom Resource `longhorn.io/v1beta2/volumes`
**Tipo de recurso**: `longhorn_volume`

| Dato | Origen |
|------|--------|
| Nombre | `vol.metadata.name` |
| State | `vol.status.state` |
| Robustness | `vol.status.robustness` |
| Actual size | `vol.status.actualSize` |
| Size | `vol.spec.size` |
| Number of replicas | `vol.spec.numberOfReplicas` |

**Lógica de estado:**

| State | Robustness | Estado |
|-------|-----------|--------|
| attached / detached | healthy | `healthy` |
| attached / detached | degraded | `warning` |
| attached / detached | otro | `critical` |
| creating / attaching / detaching | cualquier | `warning` |
| otro | cualquier | `critical` |

## Datos almacenados

### PVC
```json
{
  "phase": "Bound",
  "capacity": "10Gi",
  "storageClassName": "longhorn",
  "volumeName": "pvc-abc123"
}
```

### Longhorn Volume
```json
{
  "state": "attached",
  "robustness": "healthy",
  "size": "10737418240",
  "actualSize": "5368709120",
  "numberOfReplicas": 3
}
```
