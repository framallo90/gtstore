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

Opcional (solo Docker/primer arranque): forzar seed al iniciar contenedor:
- `RUN_SEED=1`

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

Servicios:
- Storefront: `http://localhost:4200` (Nginx)
- Admin: `http://localhost:4300` (Nginx)
- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- PostgreSQL: `localhost:5433`

Nota: `docker-compose.yml` usa variables desde tu `.env` (JWT secrets, admin seed, Postgres).

Nota: el contenedor `api` ejecuta `prisma migrate deploy` al iniciar. El seed corre automaticamente en local (`NODE_ENV!=production`) o si seteas `RUN_SEED=1` (recomendado solo para primer arranque/local).

Nota: en production Swagger se deshabilita por defecto; si queres habilitarlo setea `SWAGGER_ENABLED=1`.

## Produccion (checklist)

- Setear `NODE_ENV=production`.
- Usar HTTPS (requerido para cookies `secure` del refresh token).
- Configurar `CORS_ORIGINS` con tus dominios reales (storefront/admin).
- Configurar `TRUST_PROXY` segun tu red:
  - Detras de nginx/reverse proxy: `TRUST_PROXY=1` (default).
  - API expuesta directo (no recomendado): `TRUST_PROXY=0`.
- Emails reales:
  - `EMAIL_DRIVER=smtp` + `EMAIL_FROM` + `SMTP_*`.
- Mercado Pago real:
  - `MP_ENV=production`
  - `MP_ACCESS_TOKEN` (solo backend)
  - `STORE_BASE_URL` con tu dominio publico
  - `MP_NOTIFICATION_URL` debe ser publico (webhook).
  - `MP_WEBHOOK_SECRET` para validar firma de webhooks entrantes.
- Primer arranque (opcional):
  - Para crear admin automaticamente, setear `ADMIN_EMAIL`/`ADMIN_PASSWORD` y correr con `RUN_SEED=1` solo una vez.
  - Luego volver `RUN_SEED=0` (y mantener `NODE_ENV=production`).
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
