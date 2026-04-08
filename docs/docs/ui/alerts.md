# Alertas

Vista centralizada de todas las alertas del sistema de monitorización con filtrado y gestión.

**Componente**: `AlertsView.tsx`
**Hook**: `useMonitoringAlerts()`
**Endpoint**: `GET /monitoring/alerts`
**Auto-refresh**: cada 60 segundos

## Filtros

Barra de filtros en la parte superior con 4 botones:

| Filtro | Descripción |
|--------|-------------|
| **All** | Todas las alertas |
| **Critical** | Solo alertas críticas (con contador) |
| **Warning** | Solo alertas de advertencia (con contador) |
| **Info** | Solo alertas informativas (con contador) |

El filtro activo se resalta con fondo y borde del color accent.

## Lista de alertas

Las alertas se ordenan por:

1. **Severidad** (critical primero, luego warning, luego info)
2. **Fecha de creación** (más recientes primero)

### Contenido de cada alerta

Cada alerta se muestra como una tarjeta con fondo coloreado según su severidad:

| Severidad | Estilo |
|-----------|--------|
| `critical` | Fondo rojo semitransparente, texto rojo, borde rojo |
| `warning` | Fondo amarillo semitransparente, texto amarillo, borde amarillo |
| `info` | Fondo azul semitransparente, texto azul, borde azul |

**Campos mostrados:**

1. **Severity badge**: Etiqueta en mayúsculas con el nivel de severidad
2. **Resource name**: Nombre del recurso afectado (truncado si es largo)
3. **Category**: Badge con la categoría (k8s, database, network, etc.)
4. **Message**: Descripción detallada de la alerta
5. **Tiempo**: Tiempo relativo desde la creación (ej: "5m ago", "2h ago")
6. **Estado acknowledged**: Si ha sido marcada como vista, muestra "acknowledged" en verde
7. **Estado resolved**: Si ha sido resuelta, muestra "resolved {tiempo}" y la tarjeta se atenúa (opacity 50%)

### Botón Acknowledge

Las alertas que no han sido reconocidas ni resueltas muestran un botón **"Acknowledge"** a la derecha. Al hacer click:

- Se envía `PATCH /monitoring/alerts/:id/acknowledge`
- La alerta se marca como `acknowledged = 1`
- Se refrescan automáticamente las listas de alertas y el dashboard

## Alertas vacías

Si no hay alertas que coincidan con el filtro actual, se muestra el mensaje "All clear".

## Tipos de alertas generadas por los collectors

| Collector | Tipo de alerta | Severidad | Ejemplo de mensaje |
|-----------|---------------|-----------|-------------------|
| k8s | Events Warning | critical/warning | `[BackOff] Back-off restarting failed container` |
| database | DB offline | critical | `postgresql postgres-n8n is unreachable (TCP connect failed)` |
| database | PostgreSQL down | critical | `PostgreSQL instance postgres-n8n is down (pg_up=0)` |
| network | DNS failure | critical | `DNS resolution failed for apptolast.com: ENOTFOUND` |
| network | Cert expiry | critical/warning | `Certificate expires in 5 days (2026-04-13)` |
| storage | PVC usage | warning | `PVC usage is at 95% of capacity` |
| docker | Registry down | critical | `Docker registry unreachable: ...` |
| security | TLS cert expiry | critical/warning | `TLS certificate expires in 3 days` |
| security | WireGuard down | critical | `No WireGuard VPN pods found in namespace apptolast-wireguard` |
| security | Passbolt down | critical | `No Passbolt pods found in namespace passbolt` |
| backup | CronJob suspended | critical | `CronJob postgres-backup is suspended` |
| backup | Backup stale | critical/warning | `CronJob postgres-backup last succeeded 50h ago (>48h)` |
| iot | EMQX down | critical | `EMQX MQTT broker is unreachable` |
| iot | No clients | warning | `EMQX MQTT broker has no connected clients` |

!!! info "Deduplicación"
    No se crean alertas duplicadas. Si ya existe una alerta activa (no resuelta y no acknowledged) con el mismo `resource_name` y `message`, la inserción se ignora.

!!! info "Auto-resolución"
    Varios collectors auto-resuelven alertas cuando la condición se corrige: database, iot. Llaman a `resolveAlert()` que establece `resolved_at` en la alerta existente.
