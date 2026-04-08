# Collector: Seguridad

**Archivo**: `src/backend/services/collectors/security.collector.ts`
**Categoría**: `security`
**Intervalo**: 600 segundos (10 minutos)
**Dependencias**: Kubernetes API (Core + Custom Resources)

## Sub-collectors

### 1. Certificados TLS

**API**: Custom Resource `cert-manager.io/v1/certificates`
**Tipo de recurso**: `certificate`

Recopila todos los certificados TLS de cert-manager y evalúa su caducidad.

| Dato | Origen |
|------|--------|
| Nombre | `cert.metadata.name` |
| Namespace | `cert.metadata.namespace` |
| Secret name | `cert.spec.secretName` |
| DNS names | `cert.spec.dnsNames` |
| notAfter | `cert.status.notAfter` |
| Ready | `cert.status.conditions[type=Ready].status` |
| Days until expiry | Calculado |

**Lógica de estado y alertas:**

| Días restantes | Estado | Alerta |
|---------------|--------|--------|
| <7 días | `critical` | `critical`: "TLS certificate expires in X days ({notAfter})" |
| 7-14 días | `warning` | `warning`: "TLS certificate expires in X days ({notAfter})" |
| >14 días, Ready=True | `healthy` | - |
| >14 días, Ready!=True | `warning` | - |

### 2. WireGuard VPN

**API**: `coreV1Api.listNamespacedPod({ namespace: 'apptolast-wireguard' })`
**Tipo de recurso**: `vpn`
**Nombre del recurso**: `wireguard`

Verifica que los pods del servidor VPN WireGuard están corriendo.

| Dato | Origen |
|------|--------|
| Pod count | Número de pods en el namespace |
| Pod details | Nombre, phase, ready state de cada pod |
| Container states | Estado de cada contenedor |

**Lógica de estado:**

| Condición | Estado | Alerta |
|-----------|--------|--------|
| 0 pods encontrados | `critical` | `critical`: "No WireGuard VPN pods found in namespace apptolast-wireguard" |
| Algún pod no Running o no Ready | `warning` o `critical` | - |
| Pod en phase Failed | `critical` | - |
| Todos los pods Running y Ready | `healthy` | - |

### 3. Passbolt (gestor de contraseñas)

**API**: `coreV1Api.listNamespacedPod({ namespace: 'passbolt' })`
**Tipo de recurso**: `password_manager`
**Nombre del recurso**: `passbolt`

Misma lógica que WireGuard: verifica que los pods de Passbolt están corriendo.

| Condición | Estado | Alerta |
|-----------|--------|--------|
| 0 pods encontrados | `critical` | `critical`: "No Passbolt pods found in namespace passbolt" |
| Algún pod no Running o no Ready | `warning` o `critical` | - |
| Todos los pods Running y Ready | `healthy` | - |

## Datos almacenados

### Certificate
```json
{
  "secretName": "apptolast-tls",
  "dnsNames": ["apptolast.com", "*.apptolast.com"],
  "notAfter": "2026-07-15T00:00:00Z",
  "daysUntilExpiry": 98,
  "ready": true
}
```

### WireGuard / Passbolt
```json
{
  "podCount": 1,
  "pods": [
    {
      "name": "wireguard-abc123",
      "phase": "Running",
      "ready": true,
      "containers": [
        {
          "name": "wireguard",
          "ready": true,
          "restartCount": 0
        }
      ]
    }
  ]
}
```
