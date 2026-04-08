# Dashboard

Vista general que muestra el estado de salud de toda la infraestructura de un vistazo.

**Componente**: `InfraDashboard.tsx`
**Hook**: `useMonitoringDashboard()`
**Endpoint**: `GET /monitoring/dashboard`
**Auto-refresh**: cada 60 segundos

## Estructura de la vista

### 1. Barra de salud general

En la parte superior, una barra horizontal muestra:

- **StatusBadge grande** con el estado global (el peor estado de todas las categorías)
- **Contadores**: número de recursos healthy (verde), warning (amarillo) y critical (rojo)
- **Última comprobación**: tiempo relativo desde la última actualización (ej: "3m ago")

!!! info "Lógica del estado global"
    - Si hay **algún** recurso `critical` → estado global = `critical`
    - Si hay **algún** recurso `warning` (y ninguno critical) → estado global = `warning`
    - Si todos son `healthy` → estado global = `healthy`
    - Si no hay datos → estado global = `unknown`

### 2. Grid de categorías

Un grid responsive de 9 tarjetas (MetricCard), una por cada categoría de monitorización:

| Categoría | Icono | Información mostrada |
|-----------|-------|---------------------|
| Kubernetes | `⎈` | Total de recursos, distribución healthy/warning/critical |
| Databases | `⛁` | Total de DBs monitorizadas |
| Applications | `▣` | Total de apps monitorizadas |
| Network | `⚡` | Total de recursos de red |
| Storage | `⛃` | Total de volúmenes/PVCs |
| Docker | `⬡` | Total de recursos Docker |
| Security | `⛨` | Total de recursos de seguridad |
| Backups | `↻` | Total de backups monitorizados |
| IoT | `◉` | Total de recursos IoT |

Cada tarjeta es **clickeable** y navega directamente a la sub-vista correspondiente.

El subtítulo de cada tarjeta muestra la distribución de estados: `Xh / Yw / Zc` (healthy / warning / critical).

### 3. Alertas activas

Debajo del grid, una lista de alertas activas (no resueltas):

- Cada alerta muestra:
    - **Severity badge**: `critical` (rojo), `warning` (amarillo) o `info` (azul)
    - **Nombre del recurso** afectado
    - **Mensaje** descriptivo
    - **Tiempo** relativo desde que se creó

- Si no hay alertas activas, se muestra un mensaje "All clear"

## Skeleton de carga

Mientras se cargan los datos, se muestra un skeleton animado que replica la estructura de la vista:

- Barra superior con placeholder
- Grid de 9 tarjetas con skeletons
- Sección de alertas con 3 líneas placeholder

## Estado deshabilitado

Si la monitorización está deshabilitada (`MONITORING_ENABLED=false`), se muestra un mensaje centrado indicando que la monitorización está desactivada.
