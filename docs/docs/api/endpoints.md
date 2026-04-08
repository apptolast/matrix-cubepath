# API REST

Referencia completa de los endpoints de la API de monitorización.

**Base path**: `/monitoring`
**Autenticación**: Misma autenticación que el resto de la aplicación
**Controlador**: `src/backend/controllers/monitoring.controller.ts`
**Rutas**: `src/backend/routes/monitoring.routes.ts`

## Endpoints

### Dashboard

#### `GET /monitoring/dashboard`

Retorna el resumen general de salud de toda la infraestructura.

**Response:**
```json
{
  "enabled": true,
  "summary": [
    {
      "category": "k8s",
      "total": 120,
      "healthy": 115,
      "warning": 3,
      "critical": 2
    },
    {
      "category": "database",
      "total": 9,
      "healthy": 8,
      "warning": 1,
      "critical": 0
    }
  ],
  "activeAlerts": [
    {
      "id": 1,
      "category": "k8s",
      "resource_name": "default/nginx-pod",
      "severity": "critical",
      "message": "[BackOff] Back-off restarting failed container",
      "acknowledged": 0,
      "resolved_at": null,
      "created_at": "2026-04-08T10:30:00.000Z"
    }
  ],
  "lastUpdate": "2026-04-08T10:35:00.000Z"
}
```

---

### Kubernetes

#### `GET /monitoring/kubernetes`

Retorna todos los snapshots más recientes de la categoría Kubernetes.

**Response:** Array de `MonitoringSnapshot[]`

```json
[
  {
    "id": 1,
    "category": "k8s",
    "resource_type": "pod",
    "resource_name": "n8n-main-abc123",
    "namespace": "n8n",
    "status": "healthy",
    "value_json": "{\"phase\":\"Running\",\"restartCount\":0,\"containers\":[...]}",
    "collected_at": "2026-04-08T10:30:00.000Z"
  }
]
```

#### `GET /monitoring/kubernetes/:resourceType/:name`

Retorna snapshots filtrados por tipo de recurso y nombre.

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `resourceType` | string | Tipo de recurso (node, pod, deployment, service, namespace, event) |
| `name` | string | Nombre del recurso |

**Response:** Array de `MonitoringSnapshot[]`

---

### Bases de Datos

#### `GET /monitoring/databases`

Retorna los snapshots más recientes de todas las bases de datos.

**Response:** Array de `MonitoringSnapshot[]`

Tipos de recurso posibles: `postgresql`, `timescaledb`, `mysql`, `redis`, `mqtt`

---

### Aplicaciones

#### `GET /monitoring/applications`

Retorna los snapshots más recientes de todas las aplicaciones monitorizadas.

**Response:** Array de `MonitoringSnapshot[]`

Tipo de recurso: `application`

---

### Red

#### `GET /monitoring/network`

Retorna los snapshots más recientes de recursos de red.

**Response:** Array de `MonitoringSnapshot[]`

Tipos de recurso posibles: `ingress`, `certificate`, `loadbalancer`, `dns`

---

### Almacenamiento

#### `GET /monitoring/storage`

Retorna los snapshots más recientes de almacenamiento.

**Response:** Array de `MonitoringSnapshot[]`

Tipos de recurso posibles: `pvc`, `longhorn_volume`

---

### Docker

#### `GET /monitoring/docker`

Retorna los snapshots más recientes de recursos Docker.

**Response:** Array de `MonitoringSnapshot[]`

Tipos de recurso posibles: `registry`, `container`

---

### Seguridad

#### `GET /monitoring/security`

Retorna los snapshots más recientes de seguridad.

**Response:** Array de `MonitoringSnapshot[]`

Tipos de recurso posibles: `certificate`, `vpn`, `password_manager`

---

### Backups

#### `GET /monitoring/backups`

Retorna los snapshots más recientes de backups.

**Response:** Array de `MonitoringSnapshot[]`

Tipo de recurso: `cronjob`

---

### IoT

#### `GET /monitoring/iot`

Retorna los snapshots más recientes de IoT.

**Response:** Array de `MonitoringSnapshot[]`

Tipo de recurso: `mqtt_broker`

---

### Alertas

#### `GET /monitoring/alerts`

Retorna todas las alertas (activas y resueltas).

**Query parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Número máximo de alertas a retornar |

**Response:** Array de `MonitoringAlert[]`

```json
[
  {
    "id": 1,
    "category": "database",
    "resource_name": "n8n/postgres-n8n",
    "severity": "critical",
    "message": "postgresql postgres-n8n is unreachable (TCP connect failed)",
    "acknowledged": 0,
    "resolved_at": null,
    "created_at": "2026-04-08T10:30:00.000Z"
  }
]
```

#### `PATCH /monitoring/alerts/:id/acknowledge`

Marca una alerta como "acknowledged" (reconocida).

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la alerta |

**Response exitosa:**
```json
{ "ok": true }
```

**Response error (404):**
```json
{ "error": "Alert not found or already acknowledged" }
```

---

### Historial

#### `GET /monitoring/history`

Retorna snapshots históricos para análisis de tendencias.

**Query parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `category` | string | Uno de los dos | Categoría (k8s, database, app, etc.) |
| `resource` | string | Uno de los dos | Nombre del recurso específico |
| `range` | string | No | Rango temporal: `1h`, `6h`, `24h` (default), `7d` |

!!! warning "Parámetro requerido"
    Se debe proporcionar al menos `category` o `resource`. Si no se proporciona ninguno, retorna error 400.

**Response:** Array de `MonitoringSnapshot[]` ordenados por `collected_at DESC`, limitados a 500 resultados.

---

### Configuración

#### `GET /monitoring/config`

Retorna toda la configuración de monitorización.

**Response:**
```json
{
  "key1": "value1",
  "key2": "value2"
}
```

#### `PUT /monitoring/config`

Actualiza un valor de configuración (upsert).

**Request body:**
```json
{
  "key": "some_config_key",
  "value": "some_value"
}
```

**Response:**
```json
{ "ok": true }
```

---

### Refresh manual

#### `POST /monitoring/refresh`

Ejecuta todos los collectors manualmente de forma inmediata y secuencial.

**Response:**
```json
{
  "ok": true,
  "refreshedAt": "2026-04-08T10:35:00.000Z"
}
```

!!! warning "Operación costosa"
    Esta operación ejecuta los 9 collectors secuencialmente. Puede tardar varios segundos dependiendo de la latencia de las fuentes de datos.

---

## Tipos de datos

### MonitoringSnapshot

```typescript
interface MonitoringSnapshot {
  id: number;
  category: string;       // k8s, database, app, network, storage, docker, security, backup, iot
  resource_type: string;  // node, pod, deployment, postgresql, redis, pvc, etc.
  resource_name: string;  // Nombre del recurso
  namespace: string | null;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  value_json: string;     // JSON con métricas específicas del recurso
  collected_at: string;   // ISO 8601 timestamp
}
```

### MonitoringAlert

```typescript
interface MonitoringAlert {
  id: number;
  category: string;
  resource_name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: number;    // 0 o 1
  resolved_at: string | null;
  created_at: string;      // ISO 8601 timestamp
}
```
