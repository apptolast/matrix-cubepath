# Red

Vista del estado de la infraestructura de red: ingress routes, certificados TLS, y resolución DNS.

**Componente**: `NetworkView.tsx`
**Hook**: `useNetwork()`
**Endpoint**: `GET /monitoring/network`
**Auto-refresh**: cada 300 segundos (5 minutos)

## Secciones

### 1. Ingress Routes (Traefik)

Tabla con todas las IngressRoutes de Traefik configuradas en el clúster.

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del IngressRoute |
| Namespace | Namespace de Kubernetes |
| Hosts | Dominios asociados (extraídos de las reglas `Host()` de Traefik), en fuente monoespaciada |
| Status | StatusBadge (siempre `healthy` si existe) |

Las rutas se recopilan consultando los Custom Resources de Traefik:
```
group: traefik.io
version: v1alpha1
plural: ingressroutes
```

### 2. Certificates (cert-manager)

Tabla con todos los certificados TLS gestionados por cert-manager.

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del certificado |
| DNS Names | Dominios cubiertos por el certificado (fuente monoespaciada) |
| Expiry | Fecha de expiración con código de color |
| Status | StatusBadge basado en la expiración |

**Código de color de expiración:**

| Días restantes | Color | Estado |
|---------------|-------|--------|
| <7 días | Rojo | `critical` |
| 7-14 días | Amarillo | `warning` |
| >14 días | Verde | `healthy` |

!!! warning "Alertas de certificados"
    Se generan alertas automáticas cuando un certificado está a menos de 14 días de expirar. Las alertas son `critical` si quedan menos de 7 días.

### 3. DNS Checks

Tabla con las comprobaciones de resolución DNS de los dominios críticos.

| Columna | Descripción |
|---------|-------------|
| Domain | Nombre del dominio (fuente monoespaciada) |
| Resolved | Sí/No |
| Status | StatusBadge |

**Dominios monitorizados:**

| Dominio | Descripción |
|---------|-------------|
| `apptolast.com` | Dominio principal |
| `matrix.stackbp.es` | Dominio de matrix-cubepath |
| `n8n.apptolast.com` | Servicio n8n |
| `rancher.apptolast.com` | Panel de Rancher |

!!! danger "Alertas DNS"
    Si la resolución DNS falla para cualquier dominio crítico, se genera una alerta `critical` inmediata.

## Datos recopilados pero no visibles en la UI

### MetalLB IP Pools

El collector de red también recopila los IP Address Pools de MetalLB:

```
group: metallb.io
version: v1beta1
plural: ipaddresspools
```

Estos datos se almacenan en la base de datos (categoría `network`, tipo `loadbalancer`) pero actualmente la vista de red no los muestra en una sección dedicada. Los datos incluyen:

- Nombre del pool
- Rangos de direcciones IP
- Configuración de auto-assign
