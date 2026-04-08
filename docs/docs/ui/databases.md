# Bases de Datos

Vista del estado de todas las bases de datos monitorizadas.

**Componente**: `DatabasesView.tsx`
**Hook**: `useDatabases()`
**Endpoint**: `GET /monitoring/databases`
**Auto-refresh**: cada 120 segundos

## Barra de resumen

- **X** databases (total)
- **X** online (verde)
- **X** offline (rojo, solo si hay alguna)

## Bases de datos monitorizadas

Se monitorizan **9 instancias** de base de datos, agrupadas por tipo:

### PostgreSQL (3 instancias)

| Nombre | Namespace | Host interno |
|--------|-----------|-------------|
| postgres-n8n | n8n | `postgres-n8n.n8n.svc.cluster.local:5432` |
| postgresql-langflow | langflow | `postgresql-langflow.langflow.svc.cluster.local:5432` |
| postgres-metadata | apptolast-invernadero-api | `postgres-metadata.apptolast-invernadero-api.svc.cluster.local:5432` |

### TimescaleDB (1 instancia)

| Nombre | Namespace | Host interno |
|--------|-----------|-------------|
| timescaledb | apptolast-invernadero-api | `timescaledb.apptolast-invernadero-api.svc.cluster.local:5432` |

### MySQL (1 instancia)

| Nombre | Namespace | Host interno |
|--------|-----------|-------------|
| mysql-gibbon | gibbon | `mysql-gibbon.gibbon.svc.cluster.local:3306` |

### Redis (3 instancias)

| Nombre | Namespace | Host interno |
|--------|-----------|-------------|
| redis-db | default | `redis-db.default.svc.cluster.local:6379` |
| redis-coordinator | n8n | `redis-coordinator.n8n.svc.cluster.local:6379` |
| redis | apptolast-invernadero-api | `redis.apptolast-invernadero-api.svc.cluster.local:6379` |

### MQTT (1 instancia)

| Nombre | Namespace | Host interno |
|--------|-----------|-------------|
| emqx | apptolast-invernadero-api | `emqx.apptolast-invernadero-api.svc.cluster.local:1883` |

## Presentación visual

Las bases de datos se muestran como **tarjetas (cards)** agrupadas por tipo, cada grupo con su icono:

| Tipo | Icono |
|------|-------|
| PostgreSQL | :elephant: |
| MySQL | :dolphin: |
| Redis | :red_circle: |
| TimescaleDB | :stopwatch: |
| MQTT | :satellite: |

### Contenido de cada tarjeta

Cada tarjeta de base de datos muestra:

1. **Cabecera**: Icono + nombre + StatusBadge
2. **Tipo**: Badge con el tipo de base de datos
3. **Barra de conexiones** (si hay datos): Barra de progreso con el número de conexiones activas
    - <60% → verde
    - 60-80% → amarillo
    - >80% → rojo
4. **Métricas** (si hay datos disponibles):
    - **Size**: Tamaño de la base de datos (formateado: B, KB, MB, GB)
    - **Uptime**: Tiempo de actividad (formateado: Xd Xh, Xh Xm, Xm)
    - **Latency**: Tiempo de respuesta en ms. >100ms se muestra en amarillo

### Bordes de las tarjetas

- Base de datos **offline**: borde rojo (`border-red-500/40`)
- Estado **warning**: borde amarillo (`border-yellow-500/30`)
- Estado **healthy**: borde estándar (`border-matrix-border`)
