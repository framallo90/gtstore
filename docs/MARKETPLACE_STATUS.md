# Marketplace Curado - Estado Actual (Post-implementacion parcial)

Fecha de corte: 2026-03-05 10:04:41 -03:00
Branch objetivo: `mktplace`

## Resumen ejecutivo

El marketplace tiene una base backend funcional (modelo de datos + endpoints + reglas core), pero todavia no esta cerrado end-to-end para operacion real porque faltan las interfaces de `storefront` y `admin-dashboard`, el flujo real de uploads y mayor cobertura de pruebas especificas.

## 1. Implementado

### 1.1 Datos y dominio

- Modelo marketplace en `prisma/schema.prisma`:
  - `SellerVerificationRequest`
  - `MarketplaceListing`
  - `MarketplaceListingAsset`
  - `MarketplaceReview`
  - `MarketplaceAppeal`
  - `MarketplaceOrder`
- Estados y enums de vendedor, publicacion, apelacion, orden y payout.

### 1.2 Backend API (NestJS)

Modulo montado en `api/src/app/marketplace/` e importado desde `api/src/app/app.module.ts`.

Controladores activos:

- `marketplace-public.controller.ts`
- `seller-verification.controller.ts`
- `seller-listings.controller.ts`
- `marketplace-orders.controller.ts`
- `marketplace-admin.controller.ts`

Servicios activos:

- `marketplace-public.service.ts`
- `seller-verification.service.ts`
- `seller-listings.service.ts`
- `marketplace-orders.service.ts`
- `marketplace-admin.service.ts`

### 1.3 Reglas de negocio ya codificadas

- Comision fija 15% sobre producto en `api/src/app/marketplace/marketplace-orders.service.ts` (`MARKETPLACE_COMMISSION_RATE = 0.15`).
- Retencion y liberacion manual de payout (`PayoutStatus.ON_HOLD`, `READY_TO_RELEASE`, `RELEASED`).
- Bloqueo de compra propia (seller no puede comprar su propia publicacion).
- Reserva atomica de listing en checkout (cambio de estado/stock bajo transaccion).
- Sanitizacion anti contacto directo en `api/src/app/marketplace/listing-text-sanitizer.ts`:
  - email
  - telefono
  - URL
  - redes
  - frases de contacto por fuera

### 1.4 Integraciones existentes ya conectadas al dominio marketplace

- Mercado Pago: checkout/preferencia + webhook contemplan `MarketplaceOrder` en `api/src/app/payments/mercadopago.controller.ts`.
- Andreani: cotizacion reutilizada en `marketplace-orders.service.ts` via `AndreaniShippingService`.

## 2. Implementado parcial

### 2.1 Verificacion de identidad

- Solicitud de vendedor exige paths de DNI/selfie (`dniFrontPath`, `dniBackPath`, `selfiePath`) via DTO y servicio.
- Falta pipeline de upload real (persistencia de archivo, permisos, acceso controlado, trazabilidad de archivo).

### 2.2 Flujo operativo de entrega -> liberacion

- La orden permite pasar a `DELIVERED` y liberar payout manual.
- Falta automatizacion de estados desde carrier para evitar operacion 100% manual.

## 3. Faltante

### 3.1 Storefront marketplace

No hay rutas/paginas marketplace activas en `storefront/src/app/app.routes.ts`:

- `/marketplace`
- `/marketplace/:id`
- `/marketplace/checkout`
- `/seller/*`

No existe aun:

- solapa `Vendedor` para usuario logueado
- onboarding de vendedor
- panel vendedor
- catalogo marketplace cliente
- checkout marketplace separado en UI

### 3.2 Admin dashboard marketplace

No hay secciones marketplace en `admin-dashboard/src/app/app.routes.ts`:

- vendedores marketplace
- publicaciones marketplace
- apelaciones marketplace
- liquidaciones marketplace

### 3.3 Cobertura de pruebas marketplace

- `api-e2e/src/api/marketplace.spec.ts` existe, pero cubre casos minimos.
- Falta bateria profunda para:
  - ciclo completo seller apply -> approve -> publish -> buy -> paid -> delivered -> release
  - casos de concurrencia
  - apelaciones y reglas de una sola apelacion
  - validaciones de seguridad y permisos por rol

## 4. Estado de documentacion

Disponible:

- `docs/MARKETPLACE_MVP_SPEC.md`
- `docs/MARKETPLACE_TECHNICAL_PLAN.md`
- `docs/MARKETPLACE_IMPLEMENTATION_ROADMAP.md`
- `docs/MARKETPLACE_PRECODE_CHECKLIST.md`
- `docs/EXTERNAL_INTEGRATIONS_CHECKLIST.md`
- `docs/MARKETPLACE_STORAGE_OPTIONS.md`
- `docs/MARKETPLACE_POLICY_DRAFT.md`
- `output/doc/marketplace_operacion_y_flujo_de_fondos.docx` (fuera de versionado por `/output`)

Observacion:

- Parte de la documentacion todavia habla de etapa pre-codigo; debe leerse junto con este estado para evitar desalineacion.

## 5. Riesgos abiertos para salida real

- Sin UI marketplace en frontends, no hay operacion de negocio completa.
- Sin upload real para identidad/media, no hay flujo confiable para moderacion.
- Sin pruebas profundas, no hay garantia de integridad operacional en escenarios reales.
- Dependencia externa de credenciales reales (Mercado Pago, Andreani, SMTP) para pasar a entorno productivo.

## 6. Decision operativa recomendada

Antes de considerar salida productiva del marketplace:

1. cerrar UI de storefront y admin con flujos separados.
2. cerrar upload local seguro (MVP) con privacidad por tipo de archivo.
3. ampliar cobertura de tests de dominio marketplace.
4. recien despues activar integraciones reales por ambiente.
