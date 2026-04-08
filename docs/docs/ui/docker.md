# Docker

Vista del estado de los recursos Docker, actualmente centrada en el registry local.

**Componente**: `DockerView.tsx`
**Hook**: `useDocker()`
**Endpoint**: `GET /monitoring/docker`
**Auto-refresh**: no (datos bajo demanda)

## Secciones

### 1. Registry

Sección que muestra el estado del Docker Registry local mediante **MetricCards**.

Cada tarjeta muestra:

| Campo | Descripción |
|-------|-------------|
| Label | Nombre del registry (`local-registry`) |
| Value | Número de repositorios o estado |
| Icon | :package: |
| Status | StatusBadge (healthy/critical) |
| Subtitle | URL o namespace |

**Registry monitorizado:**

| Nombre | URL | Descripción |
|--------|-----|-------------|
| local-registry | `http://localhost:5000/v2/_catalog` | Registry Docker local del servidor |

El collector consulta el endpoint `/v2/_catalog` del registry y extrae:

- Código de respuesta HTTP
- Lista de repositorios
- Número total de repositorios

### 2. Containers

Tabla con contenedores Docker (si hay datos disponibles).

| Columna | Descripción |
|---------|-------------|
| Name | Nombre del contenedor |
| Image | Imagen Docker (fuente monoespaciada, truncada a 200px) |
| Status | StatusBadge |

### 3. Resources

Sección genérica para otros recursos Docker que no encajen en las categorías anteriores. Se muestran como MetricCards.

!!! note "Alcance actual"
    Actualmente solo se monitoriza el registry local. La sección de contenedores se mostrará cuando haya datos de contenedores Docker standalone (fuera de Kubernetes).
