# Backups

Vista del estado de los jobs de backup del clúster Kubernetes.

**Componente**: `BackupsView.tsx`
**Hook**: `useBackups()`
**Endpoint**: `GET /monitoring/backups`
**Auto-refresh**: no (datos bajo demanda)

## Secciones

### 1. Backup CronJobs

Tabla con todos los CronJobs de Kubernetes (detectados automáticamente en todos los namespaces).

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del CronJob |
| Schedule | Expresión cron (fuente monoespaciada, ej: `0 2 * * *`) |
| Last Success | Tiempo relativo desde la última ejecución exitosa (verde si reciente) |
| Last Failure | Tiempo relativo desde el último fallo (rojo si hay) |
| Status | StatusBadge |

**Lógica de estado:**

| Condición | Estado |
|-----------|--------|
| CronJob **suspendido** | `critical` |
| Último éxito hace >**48 horas** | `critical` |
| Último éxito hace >**26 horas** | `warning` |
| Último éxito reciente | `healthy` |
| Nunca ejecutado ni programado | `warning` |
| Último fallo más reciente que último éxito | `critical` (lógica en UI) |

!!! warning "Alertas de backup"
    El collector genera alertas automáticas para:

    - CronJob **suspendido** → `critical`: "CronJob {nombre} is suspended"
    - Último éxito hace >**48h** → `critical`: "CronJob {nombre} last succeeded Xh ago (>48h)"
    - Último éxito hace >**26h** → `warning`: "CronJob {nombre} last succeeded Xh ago (>26h)"

### 2. Other Backups

Tabla genérica para recursos de backup que no sean CronJobs.

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del recurso |
| Type | Tipo de recurso |
| Collected | Tiempo relativo desde la última recolección |
| Status | StatusBadge |

## Formato de tiempo relativo

Los tiempos se muestran en formato relativo legible:

| Rango | Formato |
|-------|---------|
| <1 minuto | "just now" |
| <1 hora | "Xm ago" |
| <1 día | "Xh ago" |
| <30 días | "Xd ago" |
| ≥30 días | "Xmo ago" |

!!! info "Foco especial"
    El collector marca internamente el CronJob `postgres-backup` del namespace `n8n` como backup crítico (`isPostgresBackup: true` en los metadatos).
