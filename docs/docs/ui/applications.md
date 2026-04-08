# Aplicaciones

Vista del estado de salud de todas las aplicaciones desplegadas en el clúster.

**Componente**: `ApplicationsView.tsx`
**Hook**: `useApplications()`
**Endpoint**: `GET /monitoring/applications`
**Auto-refresh**: cada 120 segundos

## Barra de resumen

- **X** apps monitored (total)
- **X** healthy (verde)
- **X** issues (rojo, solo si hay alguna)

## Aplicaciones monitorizadas

Se realizan **HTTP health checks** a 15 aplicaciones:

| Aplicación | Namespace | Health Path | Puerto |
|-----------|-----------|-------------|--------|
| n8n | n8n | `/` | 5678 |
| langflow | langflow | `/health` | 7860 |
| gibbon | gibbon | `/` | 80 |
| openclaw | openclaw | `/` | 3000 |
| minecraft-stats | minecraft | `/` | 80 |
| passbolt | passbolt | `/healthcheck/status.json` | 443 (HTTPS) |
| wireguard | apptolast-wireguard | `/` | 51821 |
| shlink | shlink | `/rest/health` | 8080 |
| greenhouse-admin | apptolast-greenhouse-admin-prod | `/` | 80 |
| invernaderos-api | apptolast-invernadero-api | `/` | 3000 |
| menus-backend | apptolast-menus-dev | `/` | 3000 |
| whoop-david-api | apptolast-whoop-david-api-prod | `/` | 3000 |
| redisinsight | redisinsight | `/` | 5540 |
| rancher | cattle-system | `/healthz` | 443 (HTTPS) |
| traefik-dashboard | traefik | `/ping` | 9000 |

## Presentación visual

### Agrupación por namespace

Las aplicaciones se agrupan por namespace. Cada grupo tiene una cabecera collapsible (click para expandir/colapsar) que muestra:

- Nombre del namespace
- Número de apps en el namespace

Todos los namespaces se expanden automáticamente al cargar la vista.

### Tarjetas de aplicación

Dentro de cada namespace, las aplicaciones se muestran como tarjetas en un grid responsive (1-3 columnas).

Cada tarjeta muestra:

1. **Nombre** de la aplicación + **StatusBadge**
2. **Response time**: Tiempo de respuesta del health check
    - <1 segundo → verde
    - 1-5 segundos → amarillo
    - >5 segundos → rojo
3. **HTTP status** (si disponible): Código HTTP de respuesta
    - <400 → verde
    - ≥400 → rojo
4. **URL** del health check (texto truncado, tooltip con URL completa)
5. **Error** (si hubo): Mensaje de error en rojo

### Bordes de las tarjetas

- Estado `critical` → borde rojo
- Estado `warning` → borde amarillo
- Estado `healthy` → borde estándar

### Lógica de estado

| Condición | Estado |
|-----------|--------|
| HTTP 2xx y response time <5s | `healthy` |
| HTTP 2xx pero response time >5s | `warning` |
| HTTP 3xx | `warning` |
| HTTP 4xx o 5xx | `critical` |
| Timeout (>10s) | `critical` |
| Error de conexión | `critical` |
| No se pudo resolver IP del Service | `unknown` |

!!! note "Resolución de IPs"
    El collector resuelve la ClusterIP del Service de Kubernetes usando la API de K8s (`readNamespacedService`). Si no se puede resolver, la app se marca como `unknown`.
