# Kubernetes

Vista completa del estado del clúster Kubernetes con 6 sub-pestañas.

**Componente**: `KubernetesView.tsx`
**Hook**: `useKubernetes()`
**Endpoint**: `GET /monitoring/kubernetes`
**Auto-refresh**: cada 60 segundos

## Barra de resumen

En la parte superior se muestran contadores:

- **X** nodes
- **X** pods
- **X** deployments

## Sub-pestañas

### Nodes

Tabla con todos los nodos del clúster.

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Name | Nombre del nodo | Sí |
| Status | StatusBadge (healthy si Ready=True, critical si no) | No |
| CPU Capacity | Capacidad de CPU del nodo | No |
| Memory Capacity | Capacidad de memoria del nodo | No |
| Conditions | Lista de conditions del nodo (Ready, MemoryPressure, etc.) | No |

### Pods

Tabla con todos los pods del clúster. **Incluye buscador** para filtrar pods por nombre.

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Name | Nombre del pod | Sí |
| Namespace | Namespace donde se ejecuta | Sí |
| Phase | Estado del pod con color: `Running` (verde), `Pending` (amarillo), otro (gris) | Sí |
| Restarts | Número de reinicios. Color: 0 (gris), 1-5 (amarillo), >5 (rojo) | Sí |
| Status | StatusBadge general del pod | No |

!!! info "Lógica de estado de los pods"
    - `critical`: phase=Failed o CrashLoopBackOff detectado
    - `healthy`: phase=Running y todos los contenedores ready, o phase=Succeeded
    - `warning`: phase=Pending, restarts>5, o cualquier otro estado

### Deployments

Tabla con todos los deployments del clúster.

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Name | Nombre del deployment | Sí |
| Namespace | Namespace | Sí |
| Ready / Desired | Réplicas ready vs deseadas. Rojo si ready < desired | No |
| Status | StatusBadge | No |

!!! info "Lógica de estado de deployments"
    - `critical`: 0 réplicas ready con >0 deseadas
    - `warning`: réplicas ready < deseadas
    - `healthy`: réplicas ready = deseadas

### Services

Tabla con todos los services del clúster.

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Name | Nombre del service | Sí |
| Namespace | Namespace | Sí |
| Type | Tipo de servicio (ClusterIP, NodePort, LoadBalancer) | Sí |
| ClusterIP | IP del clúster (fuente monoespaciada) | No |
| Ports | Lista de puertos en formato `port/protocol` | No |

Todos los services se registran con estado `healthy` por defecto.

### Namespaces

Tabla con todos los namespaces del clúster.

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Name | Nombre del namespace | Sí |
| Phase | Estado: `Active` (verde) o `Terminating` (amarillo) | No |
| Status | StatusBadge | No |

### Events

Lista de eventos de tipo **Warning** de la última hora.

Cada evento muestra:

- **Reason** (en amarillo): BackOff, Failed, OOMKilling, etc.
- **Nombre del recurso** afectado
- **Mensaje** descriptivo del evento

La lista tiene scroll vertical con altura máxima de 400px.

Si no hay eventos warning, se muestra "No events found".

!!! warning "Solo eventos recientes"
    Solo se muestran eventos Warning de la última hora. Los eventos más antiguos no se recolectan.
