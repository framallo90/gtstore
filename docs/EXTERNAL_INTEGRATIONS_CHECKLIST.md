# Integraciones Externas y Faltantes

Este documento lista los servicios externos que la aplicacion ya contempla en codigo, que parte esta implementada y que falta completar fuera del repositorio para dejar el sistema listo para un despliegue real.

No incluye secretos reales. Los valores concretos deben cargarse en `.env`, en archivos de secretos (`*_PATH`) o en tu gestor de secretos.

## Resumen rapido

| Integracion | Estado en codigo | Falta externa | Bloquea produccion |
| --- | --- | --- | --- |
| Mercado Pago | Implementada | Credenciales, webhook publico, secret de firma, URLs reales | Si |
| Andreani | Implementada como cotizador opcional | Cuenta/API, credenciales, datos de origen logistico | Si queres cotizar envio real |
| Email transaccional | Implementado via `log` y `smtp` | Mailbox real, SMTP real, remitente real | Si queres enviar mails reales |
| Gmail | No hay API Gmail | Solo puede usarse como proveedor SMTP | No, pero requiere configuracion externa si elegis Gmail |
| Dominio publico | No aplica en codigo | Dominio real para store/admin/api | Si |
| HTTPS / certificados | Parcial (cookies secure preparadas) | Certificado TLS y proxy HTTPS | Si |
| Reverse proxy | Preparado | Configuracion real de nginx/proxy y headers | Si |
| Base de datos productiva | App lista para Postgres | Instancia real, backups, acceso seguro | Si |
| Secretos productivos | Soportado via `*_PATH` | Archivos reales o secret manager | Si |

## 1. Mercado Pago

### Estado actual en el proyecto

- El checkout con Mercado Pago ya existe en backend y frontend.
- El backend arma preferencias / checkout y procesa webhook.
- La firma del webhook se valida y ahora se rechaza si no hay secret cargado.

### Variables relacionadas

- `MP_ACCESS_TOKEN`
- `MP_ENV`
- `MP_CURRENCY_ID`
- `STORE_BASE_URL`
- `MP_NOTIFICATION_URL`
- `MP_WEBHOOK_SECRET`
- `MP_ACCESS_TOKEN_PATH`
- `MP_WEBHOOK_SECRET_PATH`

### Faltantes externos

1. Crear o usar una cuenta de Mercado Pago para desarrolladores.
2. Obtener credenciales del ambiente correcto:
   - Sandbox para pruebas
   - Produccion para salir en vivo
3. Configurar el dominio publico real del storefront para `STORE_BASE_URL`.
4. Publicar una URL de webhook accesible desde internet para `MP_NOTIFICATION_URL`.
5. Configurar y guardar el secret de firma del webhook en `MP_WEBHOOK_SECRET`.
6. Definir credencial productiva en archivo de secreto o secret manager, no en texto plano.
7. Probar el flujo real de callback desde Mercado Pago con dominio publico.

### Pendiente operativo

- Si no hay `MP_ACCESS_TOKEN`, no se puede cobrar con Mercado Pago.
- Si no hay `MP_WEBHOOK_SECRET`, el webhook queda rechazado.
- Si no hay `MP_NOTIFICATION_URL` publica, Mercado Pago no puede notificar cambios de pago.

## 2. Andreani

### Estado actual en el proyecto

- El backend tiene servicio de cotizacion de envio.
- El checkout ya calcula y suma envio cuando Andreani esta habilitado y configurado.
- Si no esta configurado, el sistema hoy responde con mensaje guiado y no puede cotizar envio real.

### Variables relacionadas

- `ANDREANI_ENABLED`
- `ANDREANI_USERNAME`
- `ANDREANI_PASSWORD`
- `ANDREANI_SENDER_CONTRACT`
- `ANDREANI_SENDER_CLIENT`
- `ANDREANI_SENDER_PROVINCE`
- `ANDREANI_SENDER_DISTRICT`
- `ANDREANI_SENDER_LOCALITY`
- `ANDREANI_SENDER_ZIP_CODE`
- `ANDREANI_RECEIVER_PROVINCE`
- `ANDREANI_RECEIVER_DISTRICT`
- `ANDREANI_RECEIVER_LOCALITY`
- `ANDREANI_SOURCE_COUNTRY`
- `ANDREANI_RECEIVER_COUNTRY`
- `ANDREANI_PRODUCT_TYPE`
- `ANDREANI_DEFAULT_WEIGHT_GRAMS`
- `ANDREANI_DEFAULT_HEIGHT_CM`
- `ANDREANI_DEFAULT_WIDTH_CM`
- `ANDREANI_DEFAULT_DEPTH_CM`
- `ANDREANI_MIN_WEIGHT_KG`
- `ANDREANI_TIMEOUT_MS`
- `ANDREANI_TOKEN_TTL_MS`

### Faltantes externos

1. Tener cuenta / convenio comercial activo con Andreani.
2. Obtener usuario y password de API.
3. Confirmar contrato y cliente emisores reales.
4. Definir sucursal / localidad / CP de origen reales del negocio.
5. Validar que el contrato permita cotizacion API para el tipo de producto actual.
6. Hacer pruebas reales de cotizacion desde una IP/entorno autorizado.

### Pendiente operativo

- Si `ANDREANI_ENABLED=false`, el ecommerce sigue funcionando, pero no cotiza envio real.
- Si `ANDREANI_ENABLED=true` sin credenciales completas, el checkout no puede cotizar envio.

## 3. Emails transaccionales

### Estado actual en el proyecto

- El modulo de email ya existe.
- Tiene dos modos:
  - `log`: no envia, solo deja registro en logs
  - `smtp`: envia por servidor SMTP real

### Variables relacionadas

- `EMAIL_DRIVER`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

### Faltantes externos

1. Definir proveedor real de correo:
   - Gmail por SMTP
   - Google Workspace SMTP
   - Mailgun SMTP
   - SendGrid SMTP
   - Otro relay SMTP
2. Crear la casilla emisora real.
3. Definir remitente valido para `EMAIL_FROM`.
4. Cargar host, puerto y credenciales reales del relay.
5. Probar envio real de:
   - verificacion de email
   - confirmacion de pedido
   - cambios de estado

### Pendiente operativo

- Con `EMAIL_DRIVER=log`, no salen correos reales.
- Para produccion, si queres notificaciones reales al cliente, tenes que pasar a `smtp`.

## 4. Gmail (aclaracion)

### Estado actual en el proyecto

- El proyecto no usa Gmail API.
- El proyecto no usa OAuth de Google para correos.
- Solo soporta SMTP generico.

### Si queres usar Gmail

1. Usar Gmail como servidor SMTP, no como API.
2. Configurar:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
3. Si usas Gmail personal, normalmente necesitas:
   - 2FA activa
   - App Password
4. Si usas Google Workspace, usar las credenciales SMTP del dominio/cuenta corporativa.

### Conclusión

- No falta una integracion nueva con Gmail API.
- Lo que falta, si elegis Gmail, es la configuracion SMTP real.

## 5. Dominio publico

### Estado actual en el proyecto

- En local se usa `localhost`.
- El codigo ya permite URLs publicas via configuracion.

### Variables relacionadas

- `STORE_BASE_URL`
- `CORS_ORIGINS`

### Faltantes externos

1. Definir dominio publico del storefront.
2. Definir subdominio o dominio del admin.
3. Definir dominio o ruta publica de la API (si aplica).
4. Ajustar CORS con los dominios reales.
5. Verificar que `STORE_BASE_URL` coincida con el dominio real del cliente.

## 6. HTTPS, TLS y cookies seguras

### Estado actual en el proyecto

- La app esta preparada para usar cookies seguras.
- En produccion, el esquema esperado es HTTPS.

### Faltantes externos

1. Certificado TLS valido.
2. Terminacion HTTPS en nginx, proxy o plataforma cloud.
3. Redireccion HTTP -> HTTPS.
4. Verificar cookies, redirects y webhooks sobre dominios reales.

### Pendiente operativo

- Sin HTTPS, el comportamiento de cookies seguras queda limitado o incorrecto en produccion.

## 7. Reverse proxy y cabeceras

### Estado actual en el proyecto

- El backend ya endurece `TRUST_PROXY` y valida configuraciones inseguras en produccion.

### Variables relacionadas

- `TRUST_PROXY`
- `EXPECT_REVERSE_PROXY`
- `PROXY_SANITIZES_XFF`

### Faltantes externos

1. Definir si la API va expuesta directo o detras de proxy.
2. Si va detras de proxy:
   - configurar `TRUST_PROXY`
   - setear `EXPECT_REVERSE_PROXY=1`
   - setear `PROXY_SANITIZES_XFF=1`
3. Confirmar que el proxy limpie y reescriba `X-Forwarded-For`.
4. Configurar rate limiting y TLS en el borde si corresponde.

## 8. Base de datos productiva

### Estado actual en el proyecto

- Prisma y Postgres estan integrados.
- Docker local ya funciona con Postgres.

### Variables relacionadas

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PASSWORD_PATH`

### Faltantes externos

1. Elegir Postgres productivo:
   - servidor propio
   - contenedor administrado
   - servicio cloud
2. Definir backup y restore.
3. Definir politica de acceso de red.
4. Rotar credenciales por ambiente.
5. Confirmar monitoreo y espacio de almacenamiento.

## 9. Secretos productivos

### Estado actual en el proyecto

- Docker ya soporta secretos por archivo (`*_PATH`).
- El entrypoint bloquea placeholders en produccion.

### Variables relacionadas

- `POSTGRES_PASSWORD_PATH`
- `JWT_ACCESS_SECRET_PATH`
- `JWT_REFRESH_SECRET_PATH`
- `MP_ACCESS_TOKEN_PATH`
- `MP_WEBHOOK_SECRET_PATH`

### Faltantes externos

1. Crear archivos de secretos reales.
2. O integrar un gestor de secretos externo.
3. Confirmar permisos de lectura correctos.
4. Separar secretos por ambiente:
   - desarrollo
   - staging
   - produccion

## 10. Lista concreta de faltantes por salir a produccion

Antes de subir a servidor y operar en vivo, todavia falta definir fuera del repo:

1. Credenciales productivas de Mercado Pago.
2. URL publica real para webhook de Mercado Pago.
3. Secret de firma de Mercado Pago.
4. Cuenta / credenciales reales de Andreani si queres cotizacion automatica.
5. Casilla real y relay SMTP real para emails.
6. Dominios reales de tienda y admin.
7. Certificados HTTPS.
8. Politica final de proxy / cabeceras / CORS.
9. Secretos reales en archivos seguros o secret manager.
10. Base de datos productiva con backup.

## 11. Recomendacion operativa

Para evitar mezclar desarrollo con produccion, conviene cerrar esto en este orden:

1. Dominio + HTTPS.
2. Secretos reales.
3. Mercado Pago.
4. Email SMTP.
5. Andreani.
6. Validacion fullstack con URLs publicas.

## 12. Fuente de verdad tecnica

Los parametros de configuracion que respaldan este checklist estan definidos principalmente en:

- `.env.example`
- `README.md`
- `api/src/main.ts`
- `api/src/app/payments/mercadopago.controller.ts`
- `api/src/app/payments/mercadopago.service.ts`
- `api/src/app/orders/andreani-shipping.service.ts`
- `api/src/app/email/email.service.ts`

