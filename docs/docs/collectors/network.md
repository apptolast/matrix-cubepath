# Collector: Red

**Archivo**: `src/backend/services/collectors/network.collector.ts`
**Categoría**: `network`
**Intervalo**: 300 segundos (5 minutos)
**Dependencias**: Kubernetes API (Custom Resources), DNS resolver

## Sub-collectors

El collector de red ejecuta 4 sub-collectors:

### 1. Traefik IngressRoutes

**API**: Custom Resource `traefik.io/v1alpha1/ingressroutes`
**Tipo de recurso**: `ingress`

Recopila todas las IngressRoutes de Traefik y extrae:

- Nombre y namespace
- Hosts (parseados de las reglas `Host()` con regex)
- Match rules completas
- Entry points

Todas las rutas se registran con estado `healthy`.

### 2. Certificates (cert-manager)

**API**: Custom Resource `cert-manager.io/v1/certificates`
**Tipo de recurso**: `certificate`

| Dato | Origen |
|------|--------|
| Nombre | `cert.metadata.name` |
| Namespace | `cert.metadata.namespace` |
| Secret name | `cert.spec.secretName` |
| DNS names | `cert.spec.dnsNames` |
| Expiry (notAfter) | `cert.status.notAfter` |
| Ready condition | `cert.status.conditions[type=Ready]` |
| Days until expiry | Calculado: `(notAfter - now) / 86400000` |

**Lógica de estado:**

| Condición | Estado | Alerta |
|-----------|--------|--------|
| Expira en <7 días | `critical` | `critical`: "Certificate expires in X days" |
| Expira en <14 días | `warning` | `warning`: "Certificate expires in X days" |
| Ready condition = True | `healthy` | - |
| Ready condition != True | `warning` | - |

### 3. MetalLB IP Pools

**API**: Custom Resource `metallb.io/v1beta1/ipaddresspools`
**Tipo de recurso**: `loadbalancer`

| Dato | Origen |
|------|--------|
| Nombre | `pool.metadata.name` |
| Addresses | `pool.spec.addresses` (rangos de IP) |
| Auto-assign | `pool.spec.autoAssign` |

Todos los pools se registran con estado `healthy`.

### 4. DNS Checks

**API**: `dns.resolve4()` (Node.js built-in)
**Tipo de recurso**: `dns`

Dominios verificados:

| Dominio |
|---------|
| `apptolast.com` |
| `matrix.stackbp.es` |
| `n8n.apptolast.com` |
| `rancher.apptolast.com` |

**Lógica de estado:**

| Condición | Estado | Alerta |
|-----------|--------|--------|
| DNS resuelve correctamente | `healthy` | - |
| DNS falla | `critical` | `critical`: "DNS resolution failed for {domain}: {error}" |

!!! info "Independencia de K8s"
    Las comprobaciones DNS se ejecutan **siempre**, incluso si la API de Kubernetes no está disponible. Los sub-collectors de Traefik, cert-manager y MetalLB requieren la API de K8s.

## Datos almacenados

### IngressRoute
```json
{
  "hosts": ["n8n.apptolast.com"],
  "matchRules": ["Host(`n8n.apptolast.com`)"],
  "entryPoints": ["websecure"]
}
```

### Certificate
```json
{
  "secretName": "n8n-tls",
  "dnsNames": ["n8n.apptolast.com"],
  "notAfter": "2026-07-15T00:00:00Z",
  "daysUntilExpiry": 98,
  "ready": true
}
```

### DNS
```json
{
  "addresses": ["185.x.x.x"],
  "resolvedAt": "2026-04-08T10:30:00.000Z"
}
```
