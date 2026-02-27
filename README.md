# GeekyTreasures Monorepo

Nx monorepo con:
- `storefront` (Angular standalone para clientes)
- `admin-dashboard` (Angular standalone para administracion)
- `api` (NestJS + Prisma + PostgreSQL)

## Estructura

```text
.
|-- api/
|-- admin-dashboard/
|-- admin-dashboard-e2e/
|-- storefront/
|-- storefront-e2e/
|-- prisma/
|-- nginx/
|-- docker-compose.yml
|-- Dockerfile.api
|-- Dockerfile.storefront
|-- Dockerfile.admin
`-- .env.example
```

## Configuracion (.env)

1. Crear `.env`:

```bash
copy .env.example .env
```

2. Completar valores en `.env` (requeridos):
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
 
Opcional (recomendado si queres un usuario admin de seed):
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Opcional (para emails transaccionales reales via SMTP):
- `EMAIL_DRIVER` (`log` | `smtp`)
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

Opcional (cotizacion de envio con Andreani):
- `ANDREANI_ENABLED=true`
- `ANDREANI_USERNAME` / `ANDREANI_PASSWORD`
- `ANDREANI_SENDER_CONTRACT` / `ANDREANI_SENDER_CLIENT`
- `ANDREANI_SENDER_PROVINCE` / `ANDREANI_SENDER_DISTRICT` / `ANDREANI_SENDER_LOCALITY` / `ANDREANI_SENDER_ZIP_CODE`

Opcional (solo Docker): paths de secretos para sobrescribir los ejemplos de `./.secrets/*.example`:
- `POSTGRES_PASSWORD_PATH`
- `JWT_ACCESS_SECRET_PATH`
- `JWT_REFRESH_SECRET_PATH`
- `MP_ACCESS_TOKEN_PATH`
- `MP_WEBHOOK_SECRET_PATH`

Nota: `.env` esta ignorado por git.

## Setup local (sin Docker)

Requisito: PostgreSQL corriendo y `DATABASE_URL` apuntando a ese servidor.
Si no tenes Postgres instalado, podes levantar solo la DB con Docker:

```bash
docker compose up -d postgres
```

1. Instalar dependencias:

```bash
npm install
```

2. Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Nota: si no seteas `ADMIN_EMAIL`/`ADMIN_PASSWORD`, el seed salta la creacion de admin (solo productos).

3. Levantar apps:

```bash
npm run dev:api
npm run dev:storefront
npm run dev:admin
```

URLs:
- Storefront: `http://localhost:4200`
- Admin: `http://localhost:4300`
- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### Proxy /api en dev

Los frontends consumen la API en `'/api'` y en desarrollo usan proxy:
- `storefront/proxy.conf.json`
- `admin-dashboard/proxy.conf.json`

## Docker

Levantar todo:

```bash
docker compose up --build
```

Rebuild rapido por servicio (Docker local, leyendo secretos desde `.env`):

```bash
npm run docker:rebuild:storefront
npm run docker:rebuild:admin
npm run docker:rebuild:api
npm run docker:rebuild:all
```

Opcional (cargar data inicial manualmente):

```bash
docker compose run --rm api node prisma/seed.js
```

Servicios:
- Storefront: `http://localhost:4200` (Nginx)
- Admin: `http://localhost:4300` (Nginx)
- API: `http://localhost:3000/api` (bind local: `127.0.0.1`)
- Health API: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`
- PostgreSQL: `127.0.0.1:5433` (solo accesible desde el host local)

Nota: `docker-compose.yml` monta secretos por archivo (`/run/secrets/*`) y evita inyectarlos como variables planas.
Para desarrollo rapido, usa los ejemplos en `./.secrets/*.example`.
En produccion, el entrypoint rechaza valores placeholder y tambien rechaza secretos que apunten a rutas `*.example`; la API no inicia.

Nota: el contenedor `api` ejecuta `prisma migrate deploy` al iniciar. El seed ya no corre automaticamente.

Nota: en production Swagger se deshabilita por defecto; si queres habilitarlo setea `SWAGGER_ENABLED=1`.

## Produccion (checklist)

- Setear `NODE_ENV=production`.
- El default de Docker Compose ya es `NODE_ENV=production`; para local Docker, setear explicitamente `NODE_ENV=development`.
- Usar HTTPS (requerido para cookies `secure` del refresh token).
- Secretos:
  - No usar variables planas para credenciales de runtime.
  - Configurar paths de secretos reales (`*_PATH`) o secret manager externo.
- Configurar `CORS_ORIGINS` con tus dominios reales (storefront/admin).
- Configurar `TRUST_PROXY` segun tu red:
  - API expuesta directo (recomendado por defecto): `TRUST_PROXY=0`.
  - Detras de nginx/reverse proxy: `TRUST_PROXY=1` (o hop count estricto).
  - Asegurar que el proxy sanitice `X-Forwarded-For` (no confiar headers del cliente).
  - Si usas proxy en produccion, setear tambien:
    - `EXPECT_REVERSE_PROXY=1`
    - `PROXY_SANITIZES_XFF=1`
- Swagger:
  - Mantener `SWAGGER_ENABLED` vacio o en `0`.
  - Si excepcionalmente se habilita en prod, requiere `SWAGGER_PRODUCTION_ALLOWED=1`.
- Emails reales:
  - `EMAIL_DRIVER=smtp` + `EMAIL_FROM` + `SMTP_*`.
- Mercado Pago real:
  - `MP_ENV=production`
  - `MP_ACCESS_TOKEN` (via secret file en Docker)
  - `STORE_BASE_URL` con tu dominio publico
  - `MP_NOTIFICATION_URL` debe ser publico (webhook).
  - `MP_WEBHOOK_SECRET` (via secret file) para validar firma de webhooks entrantes.
- Envio Andreani:
  - Activar `ANDREANI_ENABLED=true`.
  - Completar credenciales y datos de origen (`ANDREANI_*`).
  - El checkout toma `Ciudad + Codigo postal` para cotizar y sumar envio al total.
- Primer arranque (opcional):
  - Crear admin manualmente ejecutando seed de forma controlada.
  - En local/dev: si usas seed, configurar `ADMIN_EMAIL`/`ADMIN_PASSWORD` fuertes.
- Backups:
  - Respaldar el volumen `postgres_data` (o usar un Postgres administrado).

## Auth

- Cliente:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Admin/Staff:
  - `POST /api/auth/admin/login`
- Refresh:
  - `POST /api/auth/refresh` (refresh token via cookie HttpOnly)
- Logout:
  - `POST /api/auth/logout` (limpia cookie y revoca refresh)

## Tests

Unit:

```bash
npm run test:api
npm run test:storefront
npm run test:admin
```

E2E (Playwright):

```bash
npx playwright install chromium
npm run test:e2e:storefront
npm run test:e2e:admin
# Requiere Postgres corriendo (ver arriba).
npm run test:e2e:api
# Fullstack real (requiere Docker): levanta Postgres + migra/seed + levanta API + corre specs fullstack.
npm run test:e2e:fullstack
```
