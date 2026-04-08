# Almacenamiento

Vista del estado del almacenamiento persistente del clúster: PVCs y volúmenes Longhorn.

**Componente**: `StorageView.tsx`
**Hook**: `useStorage()`
**Endpoint**: `GET /monitoring/storage`
**Auto-refresh**: cada 300 segundos (5 minutos)

## Secciones

### 1. Persistent Volume Claims (PVCs)

Tabla con todos los PVCs del clúster.

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del PVC |
| Namespace | Namespace de Kubernetes |
| Capacity | Capacidad asignada (ej: 10Gi) |
| Phase | Estado del PVC |
| Storage Class | Clase de almacenamiento (ej: longhorn) |
| Usage | Barra de uso con porcentaje (si hay datos disponibles) |
| Status | StatusBadge |

**Fases de un PVC:**

| Phase | Significado | Estado |
|-------|-------------|--------|
| `Bound` | PVC vinculado a un PV | `healthy` |
| `Pending` | Esperando vinculación | `warning` |
| `Lost` | PV asociado perdido | `critical` |
| Otro | Estado desconocido | `unknown` |

**Barra de uso:**

La barra de uso muestra el porcentaje de capacidad utilizada con código de color:

| Uso | Color |
|-----|-------|
| <70% | Verde |
| 70-90% | Amarillo |
| >90% | Rojo |

!!! warning "Alerta de uso"
    Se genera una alerta `warning` cuando el uso de un PVC supera el **90%** de su capacidad.

### 2. Longhorn Volumes

Tabla con los volúmenes gestionados por Longhorn (sistema de almacenamiento distribuido).

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del volumen Longhorn |
| Size | Tamaño del volumen |
| Replicas | Número de réplicas configuradas |
| Status | StatusBadge |

Los volúmenes se recopilan consultando los Custom Resources de Longhorn:
```
group: longhorn.io
version: v1beta2
plural: volumes
```

**Lógica de estado de volúmenes Longhorn:**

| State | Robustness | Estado resultante |
|-------|-----------|-------------------|
| attached/detached | healthy | `healthy` |
| attached/detached | degraded | `warning` |
| attached/detached | otro | `critical` |
| creating/attaching/detaching | cualquier | `warning` |
| otro | cualquier | `critical` |
