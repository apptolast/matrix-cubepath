# Seguridad

Vista del estado de los componentes de seguridad de la infraestructura: certificados TLS, VPN y gestor de contraseñas.

**Componente**: `SecurityView.tsx`
**Hook**: `useSecurity()`
**Endpoint**: `GET /monitoring/security`
**Auto-refresh**: no (datos bajo demanda)

## Secciones

### 1. Certificate Expiry

Tabla con los certificados TLS gestionados por cert-manager, enfocada en la caducidad.

| Columna | Descripción |
|---------|-------------|
| Certificate | Nombre del certificado |
| Expires | Fecha de expiración |
| Days Left | Días restantes hasta la expiración, con código de color |
| Status | StatusBadge |

**Código de color de días restantes:**

| Días | Color | Estado |
|------|-------|--------|
| <7 | Rojo | `critical` |
| 7-14 | Amarillo | `warning` |
| >14 | Verde | `healthy` |

!!! danger "Alertas automáticas"
    El collector de seguridad genera alertas automáticas:

    - **Critical**: certificado expira en menos de **7 días**
    - **Warning**: certificado expira en menos de **14 días**

### 2. VPN (WireGuard)

Sección que muestra el estado del servidor VPN WireGuard mediante **MetricCards**.

| Campo | Información |
|-------|------------|
| Label | Nombre del recurso (wireguard) |
| Icon | :locked_with_key: |
| Value | Estado del pod |
| Status | StatusBadge |
| Subtitle | Namespace (`apptolast-wireguard`) |

El collector verifica:

- Que existan pods en el namespace `apptolast-wireguard`
- Que los pods estén en fase `Running`
- Que todos los contenedores estén `ready`

!!! danger "Alerta VPN"
    Si no se encuentran pods de WireGuard, se genera una alerta `critical`: "No WireGuard VPN pods found in namespace apptolast-wireguard"

### 3. Password Manager (Passbolt)

Sección que muestra el estado de Passbolt (gestor de contraseñas) mediante **MetricCards**.

| Campo | Información |
|-------|------------|
| Label | Nombre del recurso (passbolt) |
| Icon | :key: |
| Value | Estado |
| Status | StatusBadge |
| Subtitle | Versión (si disponible) |

El collector verifica:

- Que existan pods en el namespace `passbolt`
- Que los pods estén en fase `Running`
- Que todos los contenedores estén `ready`

!!! danger "Alerta Passbolt"
    Si no se encuentran pods de Passbolt, se genera una alerta `critical`: "No Passbolt pods found in namespace passbolt"

## Otros recursos de seguridad

Si hay recursos de seguridad que no encajen en las categorías anteriores (certificados, VPN, Passbolt), se muestran en una sección "Other" como MetricCards genéricas.
