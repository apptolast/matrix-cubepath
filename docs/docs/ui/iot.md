# IoT

Vista del estado del broker MQTT EMQX utilizado para la comunicación IoT (invernaderos).

**Componente**: `IoTView.tsx`
**Hook**: `useIoT()`
**Endpoint**: `GET /monitoring/iot`
**Auto-refresh**: cada 120 segundos

## EMQX Broker

La sección principal muestra el estado del broker EMQX con:

- **Cabecera**: Título "EMQX Broker" + StatusBadge + indicador de fuente de datos (api/tcp)
- **Grid de métricas**: 7 MetricCards en grid responsive (2-4 columnas)

### Métricas mostradas

| Métrica | Icono | Descripción |
|---------|-------|-------------|
| Connected Clients | :satellite: | Número de clientes MQTT conectados actualmente |
| Max Connections | :link: | Número máximo de conexiones registradas |
| Subscriptions | :mailbox_with_mail: | Número total de suscripciones activas |
| Topics | :clipboard: | Número de topics MQTT activos |
| Msg Rate In | :inbox_tray: | Tasa de mensajes recibidos por segundo |
| Msg Rate Out | :outbox_tray: | Tasa de mensajes enviados por segundo |
| Retained Messages | :floppy_disk: | Número de mensajes retenidos |

### Fuente de datos

El indicador de fuente de datos aparece como un pequeño badge:

- **api**: Datos obtenidos de la API Dashboard de EMQX (más completos)
- **tcp**: Solo comprobación TCP al puerto MQTT (datos limitados: solo up/down)

### Lógica de estado

| Condición | Estado |
|-----------|--------|
| EMQX accesible | `healthy` |
| EMQX accesible pero 0 clientes conectados | `warning` |
| EMQX no accesible | `critical` |

!!! warning "Alertas IoT"
    - **Critical**: "EMQX MQTT broker is unreachable" — Se genera cuando ni la API ni TCP responden
    - **Warning**: "EMQX MQTT broker has no connected clients" — Se genera cuando el broker está activo pero no hay clientes

    Ambas alertas se **auto-resuelven** cuando la condición desaparece.

## Otros recursos IoT

Si hay recursos IoT adicionales que no sean el broker EMQX, se muestran en una sección "Other IoT Resources" como MetricCards genéricas.

## Configuración del collector

| Parámetro | Variable de entorno | Valor por defecto |
|-----------|-------------------|-------------------|
| URL de la API EMQX | `EMQX_API_URL` | `http://emqx.apptolast-invernadero-api.svc.cluster.local:18083` |
| API Key | `EMQX_API_KEY` | (vacío — sin autenticación) |
| Puerto MQTT | - | 1883 |
| Puerto Dashboard | - | 18083 |
| Timeout | - | 10 segundos |
