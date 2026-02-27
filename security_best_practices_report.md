# GeekyTreassures - Informe de Seguridad (best practices)

## Resumen ejecutivo

El proyecto esta bien encaminado en seguridad baseline para una tienda chica: validacion estricta de DTOs, limites de body, headers basicos, refresh token en cookie `HttpOnly`, y checkout calculado y aplicado server-side.

Los principales puntos a mejorar (prioridad) son:

1. Reducir el impacto de XSS (tokens JS-readable, CSP y disciplina de DOM).
2. Revisar/parametrizar `trust proxy` para que el API no confie headers de proxy si llega trafico directo.
3. Control de abuso en endpoints publicos (analytics) para evitar spam/DoS y crecimiento de DB.

Ademas, se corrigio un punto de integridad de compra: se agrego lock a filas del carrito para evitar doble checkout concurrente.

---

## Hallazgos

### [H-01] Tokens persistidos en storage del navegador (XSS)

- Regla: `JS-STORAGE-001` (Web Storage no es seguro para secretos)
- Severidad: Alta
- Estado: Mitigado (parcial)
- Evidencia (cambio aplicado):
  - El `accessToken` ya no se persiste: ahora se mantiene solo en memoria en
    `storefront/src/app/core/auth.service.ts` y `admin-dashboard/src/app/core/admin-auth.service.ts`.
  - Se usa un flag no-secreto (hint) en `localStorage` para restaurar sesion en UX
    (no almacena el token).
- Impacto:
  - Ante cualquier XSS (o extension maliciosa / dispositivo comprometido), el atacante puede exfiltrar el JWT y operar como el usuario. En admin esto puede implicar takeover.
- Fix recomendado:
  - Opcion A (mas robusta): mover autenticacion a cookies `HttpOnly` (access + refresh) y eliminar el token JS-readable.
  - Opcion B (intermedia): access token solo en memoria + refresh por cookie `HttpOnly` (reduce exfiltracion, pero XSS igual puede operar mientras corre).
  - Mantener CSP estricta (ya se aplica `script-src 'self'` en nginx) y evitar sinks DOM peligrosos.

### [M-01] `trust proxy` habilitado de forma incondicional

- Regla: `EXPRESS-PROXY` (no confiar ciegamente `X-Forwarded-*`)
- Severidad: Media
- Estado: Mitigado
- Evidencia (cambio aplicado):
  - `api/src/main.ts` ahora usa `TRUST_PROXY` (y default 1 para compatibilidad).
  - Se documento `TRUST_PROXY` en `.env.example`.
- Impacto:
  - Si el API llega a estar expuesto directo a internet (sin que nginx/edge normalice headers), un atacante puede spoofear `X-Forwarded-For` y afectar cualquier logica basada en IP (rate limit, logging, auditoria).
- Fix recomendado:
  - Hacerlo configurable por entorno (ej. `TRUST_PROXY=1` solo cuando realmente hay proxy) y/o asegurar a nivel red que el API no sea alcanzable directo.

### [M-02] Endpoints de analytics son publicos y no tienen rate limit

- Regla: `EXPRESS-AUTH-001` / controles anti-abuso
- Severidad: Media
- Estado: Mitigado
- Evidencia (cambio aplicado):
  - `api/src/main.ts` ahora aplica rate limit in-memory tambien para `POST /api/analytics/events*`.
- Impacto:
  - Puede usarse para spam de DB, inflar metricas y/o DoS (aunque hay limite de body en `api/src/main.ts:107-110`).
- Fix recomendado:
  - Rate limit por IP en `/api/analytics/events*` (en app o en nginx) y/o un "public key"/header de aplicacion para filtrar trafico no deseado.

### [L-01] CSP con `style-src 'unsafe-inline'`

- Regla: `JS-CSP-001/002`
- Severidad: Baja
- Evidencia:
  - `nginx/default.conf:17-20` incluye `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`.
- Impacto:
  - Reduce el valor defensivo del CSP (principalmente contra XSS via CSS/inline styles). El punto mas importante igual es `script-src`, que esta estricto.
- Fix recomendado:
  - Si mas adelante quieren endurecer: evaluar nonces/hashes para estilos o eliminar dependencias que requieran inline.

### [L-02] Cache de errores 5xx puede almacenar mensajes sensibles

- Regla: `EXPRESS-ERROR-001` (no filtrar datos sensibles)
- Severidad: Baja
- Estado: Mitigado (parcial)
- Evidencia (cambio aplicado):
  - `api/src/app/observability/all-exceptions.filter.ts` sanitiza y trunca el `message` antes de cachear/loguear.
  - Se expone a admin/staff via `GET /api/errors/recent` en `api/src/app/observability/errors.controller.ts`.
- Impacto:
  - Si alguna excepcion 5xx incluye PII/secrets en el mensaje, podria quedar visible en el panel admin.
- Fix recomendado:
  - Cachear solo `requestId`, `path`, `statusCode`, `name` (sin `message`) o sanitizar.

---

## Controles positivos observados

- Validacion estricta y whitelist de DTOs:
  - `api/src/main.ts:117-123` (`ValidationPipe` con `whitelist` + `forbidNonWhitelisted`).
- Limites de body para reducir DoS:
  - `api/src/main.ts:107-110` (`1mb`).
- Headers de seguridad baseline:
  - `api/src/main.ts:43-50` y `nginx/default.conf:9-12`.
- Checkout calculado server-side y stock decrement atomico:
  - `api/src/app/orders/orders.service.ts`.
- Lock anti doble-checkout (integridad):
  - `api/src/app/orders/orders.service.ts:23-27` (`SELECT ... FOR UPDATE`).
- `npm audit` prod dependencies:
  - Se ejecuto `npm audit --omit=dev` y reporto `found 0 vulnerabilities`.

---

## Actualizacion de cierre de auditoria (2026-02-26)

### Hallazgos criticos reportados y estado real

- `[C-01] Race condition de stock`: **Mitigado**.
  - Evidencia: `api/src/app/orders/orders.service.ts` usa decremento atomico con `updateMany` y condicion `stock >= quantity` en checkout user y guest.
- `[C-02] Normalizacion de guestEmail`: **Mitigado y reforzado**.
  - Evidencia: `api/src/app/orders/dto/create-guest-order.dto.ts` agrega `@Transform(...trim().toLowerCase())` para `guestEmail` y trim para nombre/apellido/notas.
  - Evidencia adicional: `api/src/app/orders/orders.service.ts` mantiene normalizacion defensiva en servicio.
- `[C-03] CSRF logout/cart`: **No reproducible en endpoints autenticados por JWT Bearer**.
  - Evidencia: `api/src/app/auth/auth.controller.ts` y `api/src/app/orders/orders.controller.ts` usan `JwtAuthGuard` + header `Authorization`.
  - Nota: se mantiene recomendacion de revisar SameSite/estrategia de refresh cookie segun despliegue.
- `[C-04] SQL injection por raw query`: **No vulnerable en estado actual**.
  - Evidencia: `api/src/app/orders/orders.service.ts` usa `Prisma.sql` parametrizado (sin concatenacion de strings).

### Hardening adicional aplicado en esta iteracion

- Validacion anti-replay de webhook de Mercado Pago:
  - `api/src/app/payments/mercadopago.controller.ts` ahora valida `ts` numerico y ventana maxima de 5 minutos.
- Rate limiting para endpoints costosos:
  - App-level: `api/src/main.ts` agrega limite para `POST /api/products/lookup`, `POST /api/orders/guest/quote` y `POST /api/orders/guest/checkout`.
  - Edge-level: `nginx/default.conf` agrega `expensive_limit` para las mismas rutas.
- Normalizacion de datos de envio/cupon en DTO publico:
  - `api/src/app/orders/dto/guest-quote.dto.ts` agrega transforms (`trim` y `uppercase`).
