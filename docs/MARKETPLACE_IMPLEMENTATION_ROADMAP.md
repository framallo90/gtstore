# Marketplace Curado - Roadmap de Implementacion

Este roadmap traduce la especificacion funcional y el plan tecnico a una secuencia concreta de trabajo para implementar el marketplace sin romper la tienda actual.

## Objetivo del roadmap

- ordenar la implementacion por fases
- minimizar riesgo sobre el ecommerce actual
- definir dependencias tecnicas
- dejar claro que validar en cada etapa

## Regla general

No se debe implementar el marketplace mezclando cambios grandes en todos los frentes al mismo tiempo.

El orden correcto es:

1. datos
2. backend base
3. admin de moderacion
4. panel vendedor
5. compra marketplace
6. operacion y liquidacion

## Fase 0 - Congelamiento funcional

## Objetivo

Cerrar definiciones antes de tocar Prisma.

## Entregables

- `docs/MARKETPLACE_MVP_SPEC.md`
- `docs/MARKETPLACE_TECHNICAL_PLAN.md`
- `docs/MARKETPLACE_PRECODE_CHECKLIST.md`

## Salida esperada

- alcance del MVP cerrado
- sin cambios de negocio ambiguos
- sin mezclar factura oficial con marketplace

## Fase 1 - Modelo de datos y migracion

## Objetivo

Agregar la base estructural del marketplace sin afectar el flujo oficial.

## Backend

### Cambios esperados

- extender `User` con estado de vendedor y ubicacion
- agregar enums nuevos
- crear tablas:
  - `SellerVerificationRequest`
  - `MarketplaceListing`
  - `MarketplaceListingAsset`
  - `MarketplaceReview`
  - `MarketplaceAppeal`
  - `MarketplaceOrder`

### Archivos probables

- `prisma/schema.prisma`
- `prisma/migrations/*`

## Validacion obligatoria

- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run test:api`
- `npm run build:api`

## Criterios de aceptacion

- Prisma genera sin errores
- la API compila
- no se rompe el modelo actual de tienda
- no hay migracion destructiva no solicitada

## Riesgo

- medio

## Fase 2 - Backend vendedor (solicitud y borradores)

## Objetivo

Permitir que un usuario existente solicite alta como vendedor y cree borradores.

## Alcance

### Vendedor

- crear solicitud de vendedor
- consultar estado de solicitud
- reenviar solicitud rechazada
- crear borrador de publicacion
- editar borrador
- subir assets
- elegir portada
- enviar a revision

### Reglas clave

- solo usuarios logueados
- solo `sellerStatus=APPROVED` puede publicar
- solo `DRAFT` y `CHANGES_REQUESTED` son editables

## Backend

### Modulos / servicios probables

- `api/src/app/marketplace/marketplace.module.ts`
- `api/src/app/marketplace/seller-verification.controller.ts`
- `api/src/app/marketplace/seller-verification.service.ts`
- `api/src/app/marketplace/seller-listings.controller.ts`
- `api/src/app/marketplace/seller-listings.service.ts`

## Validacion obligatoria

- `npm run test:api`
- `npm run build:api`

## Criterios de aceptacion

- un usuario puede iniciar solicitud
- una solicitud pendiente no se duplica de forma inconsistente
- un vendedor no aprobado no puede publicar
- un vendedor aprobado puede guardar borradores

## Riesgo

- medio

## Fase 3 - Backend admin de moderacion

## Objetivo

Dar control total al admin sobre vendedores y publicaciones.

## Alcance

### Solicitudes de vendedor

- aprobar
- rechazar con motivo
- suspender
- reactivar

### Publicaciones

- aprobar y publicar
- rechazar
- pedir cambios
- dar de baja con motivo
- restaurar si corresponde

### Apelaciones

- listar
- aceptar
- rechazar

## Backend

### Controladores / servicios probables

- `api/src/app/marketplace/marketplace-admin.controller.ts`
- `api/src/app/marketplace/marketplace-admin.service.ts`

## Validacion obligatoria

- `npm run test:api`
- `npm run build:api`

## Criterios de aceptacion

- no hay accion administrativa sin trazabilidad
- toda baja exige motivo
- toda apelacion queda vinculada a una publicacion
- el admin no puede publicar items sin pasar por estado valido

## Riesgo

- medio

## Fase 4 - Storefront vendedor

## Objetivo

Agregar la experiencia de vendedor sin romper cuenta ni compra tradicional.

## Alcance

- solapa `Vendedor` visible para usuario logueado
- pantalla de solicitud
- pantalla de estado de solicitud
- dashboard vendedor
- wizard de publicacion
- listado de publicaciones propias
- apelaciones
- ventas y balance

## Frontend

### Archivos / areas probables

- nuevas paginas en `storefront/src/app/pages/`
- actualizacion de navbar / cuenta en `storefront/src/app/`
- nuevos modelos en `storefront/src/app/core/models.ts`
- nuevo servicio API marketplace en `storefront/src/app/core/`

## Validacion obligatoria

- `npm run test:storefront`
- `npm run build:storefront`
- `npm run test:e2e:storefront`

## Criterios de aceptacion

- si el usuario no esta logueado, `Vendedor` redirige a login
- si el usuario no esta aprobado, no puede publicar
- el wizard guarda y edita borradores correctamente
- la portada se puede seleccionar visualmente

## Riesgo

- medio-alto

## Fase 5 - Admin Dashboard marketplace

## Objetivo

Agregar herramientas operativas para moderar el marketplace.

## Alcance

- seccion de vendedores
- seccion de publicaciones
- seccion de apelaciones
- seccion de liquidaciones

## Frontend

### Archivos / areas probables

- nuevas paginas en `admin-dashboard/src/app/pages/`
- nuevos tabs / navegacion admin
- servicio marketplace admin en `admin-dashboard/src/app/core/`

## Validacion obligatoria

- `npm run test:admin`
- `npm run build:admin`
- `npm run test:e2e:admin`

## Criterios de aceptacion

- el admin puede revisar solicitudes y publicaciones
- toda accion muestra contexto y motivo
- apelaciones se pueden resolver
- liquidaciones pendientes se visualizan claramente

## Riesgo

- medio

## Fase 6 - Catalogo y compra marketplace

## Objetivo

Permitir que el comprador compre publicaciones de marketplace con flujo separado.

## Alcance

- listado publico marketplace
- detalle de publicacion
- carrito marketplace separado
- checkout marketplace separado
- cotizacion de envio desde origen vendedor
- orden marketplace separada

## Reglas clave

- no mezclar marketplace con tienda oficial en una misma orden
- no mostrar contacto directo entre comprador y vendedor
- no comprar publicaciones no aprobadas o ya vendidas

## Backend

- endpoints publicos marketplace
- quote marketplace
- checkout marketplace
- integracion de cobro contra `MarketplaceOrder`

## Frontend

- nuevas rutas `/marketplace`
- detalle `/marketplace/:id`
- checkout `/marketplace/checkout`

## Validacion obligatoria

- `npm run test:api`
- `npm run build:api`
- `npm run test:storefront`
- `npm run build:storefront`
- `npm run test:e2e:storefront`
- `npm run test:e2e:fullstack`

## Criterios de aceptacion

- el comprador puede completar compra marketplace
- la orden queda separada de la tienda oficial
- el total incluye producto + comision si aplica + envio
- el flujo falla de forma clara si el envio no puede cotizarse

## Riesgo

- alto

## Fase 7 - Liquidacion operativa

## Objetivo

Cerrar el circuito financiero del marketplace.

## Alcance

- retener fondos
- calcular comision
- calcular neto del vendedor
- marcar orden como lista para liberar
- liberar pago manual desde admin

## Backend

- logica de `PayoutStatus`
- endpoints admin para liberar / cancelar
- trazabilidad de liberaciones

## Admin

- listado de pendientes
- accion de liberar
- accion de cancelar

## Validacion obligatoria

- `npm run test:api`
- `npm run build:api`
- `npm run test:admin`
- `npm run build:admin`

## Criterios de aceptacion

- no se libera un pago dos veces
- toda liberacion queda auditada
- el vendedor puede ver saldo pendiente vs liquidado

## Riesgo

- alto

## Fase 8 - Hardening y salida controlada

## Objetivo

Reducir riesgos antes de exponer la funcionalidad al publico.

## Tareas

- sanitizacion fuerte de textos
- filtros anti-email / anti-telefono / anti-URL
- validacion de assets obligatorios
- proteccion de datos personales
- limites de tamaño de upload
- controles de rate limiting en endpoints nuevos
- auditoria de permisos

## Validacion obligatoria

- `npm run test:api`
- `npm run build:api`
- `npm run test:storefront`
- `npm run build:storefront`
- `npm run test:admin`
- `npm run build:admin`
- `npm run test:e2e:api`
- `npm run test:e2e:storefront`
- `npm run test:e2e:admin`
- `npm run test:e2e:fullstack`

## Criterios de aceptacion

- no se exponen datos entre partes
- no se puede puentear comision desde texto publico
- no hay regresiones en tienda oficial

## Dependencias cruzadas

## Dependencias tecnicas principales

- Fase 1 bloquea todo lo demas
- Fase 2 y 3 pueden avanzar en paralelo una vez cerrada Fase 1
- Fase 4 depende de Fase 2
- Fase 5 depende de Fase 3
- Fase 6 depende de Fase 2 y Fase 3
- Fase 7 depende de Fase 6
- Fase 8 depende de todas

## Orden minimo recomendado

1. Fase 1
2. Fase 2
3. Fase 3
4. Fase 4
5. Fase 5
6. Fase 6
7. Fase 7
8. Fase 8

## Hitos de entrega sugeridos

### Hito A - Vendedor y moderacion sin compra

Incluye:

- solicitud de vendedor
- panel vendedor basico
- borradores
- moderacion admin

Permite validar operacion sin tocar pagos.

### Hito B - Marketplace visible pero compra controlada

Incluye:

- catalogo marketplace
- detalle de publicacion
- sin checkout habilitado al publico o con feature flag

Permite validar contenido, SEO y UX.

### Hito C - Compra y liquidacion MVP

Incluye:

- checkout marketplace
- orden marketplace
- retencion y liberacion manual

## Criterio final para empezar a codificar

Se puede empezar codigo cuando:

1. el alcance del MVP este congelado
2. la separacion de tienda oficial y marketplace este aceptada
3. el flujo de vendedor este aprobado
4. el flujo de moderacion este aprobado
5. el flujo de compra separada este aprobado
6. la logica de comision y liquidacion este aceptada

Sin eso, conviene no empezar porque vas a reescribir modelos y pantallas a mitad de implementacion.
