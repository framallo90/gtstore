# Codex Working Agreement (Strict)

Este repo ya usa `AGENTS.md` en modo estricto. Este archivo resume convenciones y
rituales para que Codex trabaje de forma consistente en GeekyTreasures.

## Reglas

- Idioma: Espanol.
- Cambios minimos: no refactors grandes ni upgrades de dependencias salvo pedido explicito.
- Nunca exponer secretos:
  - No imprimir contenido de `.env` ni variables de entorno.
  - No hardcodear tokens/keys/connection strings en codigo.
  - Si un secreto se comparte en chat, tratarlo como comprometido y recomendar rotacion.
- Base de datos/Prisma:
  - Cualquier cambio en `prisma/schema.prisma` requiere migracion y `prisma generate`.
  - No ejecutar operaciones destructivas sin pedido explicito del usuario.
- Validacion obligatoria (para cambios no triviales):
  - `npm run test:api` y `npm run build:api`
  - `npm run test:storefront` y `npm run build:storefront`
  - `npm run test:admin` y `npm run build:admin`

## Mapa del Proyecto

- Frontend tienda (Angular): `storefront/` (local: `http://localhost:4200`)
- Frontend admin (Angular): `admin-dashboard/` (local: `http://localhost:4300`)
- API (NestJS + Prisma): `api/` (local: `http://localhost:3000`, prefijo `/api`)
- DB: PostgreSQL (Docker Compose recomendado)

## Comandos Utiles

```powershell
# DB local (Docker)
docker compose up -d postgres

# Prisma
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed

# Dev
npm run dev:api
npm run dev:storefront
npm run dev:admin

# Validacion
npm run test:api
npm run build:api
npm run test:storefront
npm run build:storefront
npm run test:admin
npm run build:admin

# E2E
npm run test:e2e:storefront
npm run test:e2e:admin
# Nota: por defecto corre en PORT=3001 para no interferir con Docker en 3000.
npm run test:e2e:api
```
