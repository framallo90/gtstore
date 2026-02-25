# Changelog Operativo

Este archivo se actualiza en cada cambio relevante antes de commitear.

## 2026-02-25 11:41:48 -03:00

### Commit tecnico asociado
- `8827882`

### Alcance
- Mitigacion explicita de uso de secretos `*.example` en produccion para despliegues Docker.

### Archivos tecnicos
- `docker-compose.yml`
- `scripts/docker-api-entrypoint.sh`
- `README.md`

### Cambios aplicados
- Se agregaron metadatos de origen de secretos (`SECRET_SOURCE_*`) en `docker-compose.yml` para validacion de runtime.
- El entrypoint ahora rechaza inicio en `NODE_ENV=production` si detecta origen `*.example` para secretos criticos.
- Para Mercado Pago, la validacion de origen `*.example` aplica solo cuando `MP_ENV=production`.
- README actualizado para documentar el rechazo de rutas `*.example` en produccion.

### Validacion ejecutada
- `npm run test:api` -> OK
- `npm run build:api` -> OK
- `docker compose config` -> OK

## 2026-02-25 11:37:29 -03:00

### Commit tecnico asociado
- `3a84f5f`

### Alcance
- Endurecimiento adicional de defaults de despliegue para evitar configuraciones inseguras por omision.

### Archivos tecnicos
- `docker-compose.yml`
- `scripts/docker-api-entrypoint.sh`
- `api/src/main.ts`
- `.env.example`
- `README.md`

### Cambios aplicados
- API publicada solo en loopback del host: `127.0.0.1:3000:3000`.
- `NODE_ENV` default de Docker Compose cambiado a `production`.
- EntryPoint de API:
  - valida en produccion que `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` no sean placeholders.
  - valida longitud minima de secretos JWT (>= 32) en runtime.
  - si `MP_ENV=production`, exige `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` no-placeholder.
- Validacion adicional en `api/src/main.ts` para secretos JWT cortos en produccion.
- README y `.env.example` actualizados para reflejar defaults y comportamiento seguro.

### Validacion ejecutada
- `npm run test:api` -> OK
- `npm run build:api` -> OK
- `docker compose config` -> OK

## 2026-02-25 11:26:50 -03:00

### Commit tecnico asociado
- `a5cf90b`

### Alcance
- Hardening de infraestructura Docker para secretos y configuracion de proxy.

### Archivos tecnicos
- `docker-compose.yml`
- `Dockerfile.api`
- `scripts/docker-api-entrypoint.sh`
- `api/src/main.ts`
- `.env.example`
- `README.md`
- `.secrets/README.md`
- `.secrets/postgres_password.example`
- `.secrets/jwt_access_secret.example`
- `.secrets/jwt_refresh_secret.example`
- `.secrets/mp_access_token.example`
- `.secrets/mp_webhook_secret.example`

### Cambios aplicados
- Migracion de `docker-compose` a secretos por archivo (`/run/secrets/*`) para Postgres/API.
- Eliminacion de secretos sensibles en variables planas dentro del servicio `api`.
- Entrypoint de API dedicado:
  - carga secretos desde `*_FILE`.
  - construye `DATABASE_URL` en runtime cuando no viene seteado.
  - ejecuta migraciones y arranca API sin seed automatico.
- Endurecimiento de runtime:
  - validacion explicita de `TRUST_PROXY` + `EXPECT_REVERSE_PROXY` + `PROXY_SANITIZES_XFF` en produccion.
  - bloqueo de Swagger en produccion salvo `SWAGGER_PRODUCTION_ALLOWED=1`.
  - soporte de carga de secretos desde `*_FILE` en arranque.
- Healthcheck de API optimizado con `wget` en lugar de invocar Node cada ciclo.
- Agregado set de archivos `.secrets/*.example` y guia operativa para no versionar secretos reales.

### Validacion ejecutada
- `npm run test:api` -> OK
- `npm run build:api` -> OK
- `docker compose config` -> OK

## 2026-02-25 11:06:33 -03:00

### Commit tecnico asociado
- `d72382b`

### Alcance
- Mejoras UX/UI y A11y en registro y checkout para reducir friccion.

### Archivos tecnicos
- `storefront/src/app/pages/checkout.page.ts`
- `storefront/src/app/pages/register.page.ts`

### Cambios aplicados
- Checkout invitado:
  - Eliminado campo "repetir email".
  - Metodo de pago migrado de `<select>` a radio-cards visuales.
  - Resumen de compra con miniaturas de producto.
  - Loading con skeleton y spinner en lugar de texto plano.
  - `aria-errormessage` en campos clave.
  - Focus al primer campo invalido y al mensaje general cuando corresponde.
- Registro:
  - Eliminados campos "repetir email" y "repetir password".
  - `aria-errormessage` en nombre, apellido, email y password.
  - Focus al primer campo invalido y al alerta de error de formulario.

### Validacion ejecutada
- `npm run test:storefront` -> OK
- `npm run build:storefront` -> OK

## 2026-02-25 10:52:00 -03:00

### Commit tecnico asociado
- `91f2bc2`

### Alcance
- Alineacion de `.env.example` con hardening de `TRUST_PROXY`.

### Archivos tecnicos
- `.env.example`

### Cambios aplicados
- Se dejo `TRUST_PROXY=0` como valor por defecto seguro.
- Se reforzo el comentario de uso de proxy confiable y sanitizacion de headers reenviados.

### Validacion ejecutada
- Revision de diff de configuracion (`git diff -- .env.example`) -> OK

## 2026-02-25 10:49:36 -03:00

### Commit tecnico asociado
- `cedabb4`

### Alcance
- Hardening de despliegue Docker y proxy.
- Mitigacion de seed accidental en produccion.
- Healthcheck de API conectado a base de datos.

### Archivos tecnicos
- `Dockerfile.api`
- `docker-compose.yml`
- `api/src/main.ts`
- `api/src/app/app.controller.ts`
- `api/src/app/app.service.ts`
- `api/src/app/app.controller.spec.ts`
- `api/src/app/app.service.spec.ts`
- `README.md`

### Cambios aplicados
- PostgreSQL expuesto solo en loopback del host: `127.0.0.1:5433:5432`.
- Healthcheck de API pasa de `/api` a `/api/health`.
- Nuevo endpoint `GET /api/health` con ping real a DB (`SELECT 1`).
- En `Dockerfile.api`, `RUN_SEED=1` queda ignorado en produccion.
- Hardening de `TRUST_PROXY`:
  - `true` ya no habilita trust-all; se normaliza a `1`.
  - `false` se normaliza a `0`.
  - valores invalidos pasan a `0`.
- README actualizado con recomendaciones de proxy, secretos y seed en produccion.

### Validacion ejecutada
- `npm run test:api` -> OK
- `npm run build:api` -> OK
- `docker compose config` -> OK

## 2026-02-25 10:40:07 -03:00

### Commit tecnico asociado
- `9d6953f`

### Alcance
- Hardening de checkout para seguridad de idempotencia y menor persistencia de datos sensibles.
- Hardening de infraestructura para `TRUST_PROXY` con default seguro.
- Ajuste de documentación de despliegue para reflejar defaults y uso recomendado.

### Archivos tecnicos
- `storefront/src/app/pages/checkout.page.ts`
- `api/src/main.ts`
- `docker-compose.yml`
- `README.md`

### Cambios aplicados
- Se elimino fallback inseguro de idempotencia (`Math.random`) y se fuerza generacion criptografica.
- Se agrego manejo controlado cuando el navegador no soporta API crypto segura.
- Se dejo de persistir en `sessionStorage`:
  - `idempotencyKey`
  - `idempotencyBasis`
  - `guestEmailConfirm`
  - `notes`
- Se robustecio el mapeo de errores frontend para soportar `code/errorCode` ademas de `message`.
- Se cambio default de `TRUST_PROXY` a `0` (no confiar proxies por defecto).

### Validacion ejecutada
- `npm run test:api` -> OK
- `npm run build:api` -> OK
- `npm run test:storefront` -> OK
- `npm run build:storefront` -> OK

### Notas operativas
- Si se despliega detras de reverse proxy confiable, configurar explicitamente `TRUST_PROXY=1` o hop count estricto.
- Mantener esta estructura en cada cambio futuro y agregar hash de commit al cerrar el commit.
