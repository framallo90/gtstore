# Changelog Operativo

Este archivo se actualiza en cada cambio relevante antes de commitear.

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
