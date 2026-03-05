# Marketplace Curado - Plan Tecnico

Este documento baja el MVP del marketplace a una propuesta tecnica alineada con la arquitectura actual del proyecto:

- Prisma + PostgreSQL
- NestJS modular en `api/src/app`
- Angular en `storefront`
- Angular en `admin-dashboard`

No es una migracion aplicada. Es la propuesta exacta para implementarla sin mezclar la tienda oficial con el marketplace.

## 1. Decision tecnica principal

No conviene reutilizar `Product` y `Order` de forma directa para el marketplace sin separacion semantica.

La tienda oficial y el marketplace comparten conceptos, pero no el mismo flujo:

- ownership distinto
- moderacion distinta
- liquidacion distinta
- futuro fiscal distinto
- reglas de stock distintas

## Recomendacion

### Mantener

- `Product` para catalogo oficial de GeekyTreasures
- `Order` para ordenes de tienda oficial actuales

### Agregar

- entidades propias para marketplace
- una orden propia de marketplace o una extension claramente separada

Eso reduce deuda tecnica y evita contaminar el flujo actual de ecommerce.

## 2. Propuesta de extension de Prisma

## Enums nuevos sugeridos

```prisma
enum SellerStatus {
  NONE
  PENDING_REVIEW
  APPROVED
  REJECTED
  SUSPENDED
}

enum SellerVerificationStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

enum MarketplaceListingStatus {
  DRAFT
  PENDING_REVIEW
  CHANGES_REQUESTED
  APPROVED
  PUBLISHED
  REJECTED
  REMOVED_BY_ADMIN
  SOLD
  ARCHIVED
}

enum MarketplaceItemCondition {
  LIKE_NEW
  VERY_GOOD
  GOOD
  ACCEPTABLE
  HAS_DETAILS
}

enum MarketplaceAssetType {
  IMAGE
  VIDEO
}

enum MarketplaceReviewDecision {
  APPROVE
  REJECT
  REQUEST_CHANGES
  REMOVE
}

enum MarketplaceAppealStatus {
  NONE
  PENDING
  ACCEPTED
  REJECTED
}

enum MarketplaceOrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELED
  DISPUTED
}

enum PayoutStatus {
  PENDING
  ON_HOLD
  READY_TO_RELEASE
  RELEASED
  CANCELED
}
```

## Cambios propuestos en `User`

```prisma
model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String
  firstName        String
  lastName         String
  role             Role     @default(CUSTOMER)
  isActive         Boolean  @default(true)
  deactivatedAt    DateTime?
  lastLoginAt      DateTime?
  lastSeenAt       DateTime?

  // Marketplace
  sellerStatus     SellerStatus @default(NONE)
  country          String?
  province         String?
  city             String?
  postalCode       String?

  sellerVerificationRequests SellerVerificationRequest[]
  marketplaceListings        MarketplaceListing[]
  marketplaceOrdersAsBuyer   MarketplaceOrder[] @relation("MarketplaceBuyer")
  marketplaceOrdersAsSeller  MarketplaceOrder[] @relation("MarketplaceSeller")
  marketplaceAppeals         MarketplaceAppeal[]

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([sellerStatus])
  @@index([country, province, city])
}
```

## Entidad `SellerVerificationRequest`

```prisma
model SellerVerificationRequest {
  id           String   @id @default(uuid())
  userId        String
  status        SellerVerificationStatus @default(PENDING)
  dniFrontUrl   String
  dniBackUrl    String
  selfieUrl     String
  reviewNotes   String?
  reviewedById  String?
  reviewedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

## Entidad `MarketplaceListing`

```prisma
model MarketplaceListing {
  id                String   @id @default(uuid())
  sellerId          String
  status            MarketplaceListingStatus @default(DRAFT)
  title             String
  subtitle          String?
  description       String
  author            String?
  publisher         String?
  genre             String?
  language          String?
  edition           String?
  publicationYear   Int?
  isbn              String?
  type              ProductType
  condition         MarketplaceItemCondition
  conditionNotes    String?
  declaredDefects   String?
  price             Decimal  @db.Decimal(10, 2)
  stock             Int      @default(1)
  coverAssetId      String?
  adminReason       String?
  appealStatus      MarketplaceAppealStatus @default(NONE)
  isActive          Boolean  @default(false)
  publishedAt       DateTime?
  removedAt         DateTime?
  soldAt            DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  seller            User     @relation(fields: [sellerId], references: [id], onDelete: Restrict)
  assets            MarketplaceListingAsset[]
  reviews           MarketplaceReview[]
  appeals           MarketplaceAppeal[]
  orders            MarketplaceOrder[]

  @@index([sellerId])
  @@index([status])
  @@index([isActive])
  @@index([type])
  @@index([publishedAt])
  @@index([createdAt])
}
```

## Entidad `MarketplaceListingAsset`

```prisma
model MarketplaceListingAsset {
  id          String   @id @default(uuid())
  listingId    String
  type         MarketplaceAssetType
  url          String
  isCover      Boolean  @default(false)
  isEvidence   Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  listing      MarketplaceListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@index([listingId])
  @@index([type])
}
```

## Entidad `MarketplaceReview`

```prisma
model MarketplaceReview {
  id           String   @id @default(uuid())
  listingId     String
  reviewerId    String
  decision      MarketplaceReviewDecision
  reason        String
  notes         String?
  createdAt     DateTime @default(now())

  listing       MarketplaceListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  reviewer      User               @relation(fields: [reviewerId], references: [id], onDelete: Restrict)

  @@index([listingId])
  @@index([reviewerId])
  @@index([createdAt])
}
```

## Entidad `MarketplaceAppeal`

```prisma
model MarketplaceAppeal {
  id               String   @id @default(uuid())
  listingId         String
  sellerId          String
  status            MarketplaceAppealStatus @default(PENDING)
  message           String
  resolutionNotes   String?
  resolvedById      String?
  resolvedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  listing           MarketplaceListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  seller            User               @relation(fields: [sellerId], references: [id], onDelete: Restrict)

  @@index([listingId])
  @@index([sellerId])
  @@index([status])
}
```

## Entidad `MarketplaceOrder`

```prisma
model MarketplaceOrder {
  id                 String   @id @default(uuid())
  buyerId            String
  sellerId           String
  listingId          String
  status             MarketplaceOrderStatus @default(PENDING)
  paymentMethod      PaymentMethod?
  shippingProvider   String?
  shippingCity       String?
  shippingPostalCode String?
  shippingCost       Decimal  @default(0) @db.Decimal(10, 2)
  salePrice          Decimal  @db.Decimal(10, 2)
  platformCommission Decimal  @db.Decimal(10, 2)
  sellerNetAmount    Decimal  @db.Decimal(10, 2)
  buyerTotal         Decimal  @db.Decimal(10, 2)
  payoutStatus       PayoutStatus @default(PENDING)
  mpPreferenceId     String?
  mpInitPoint        String?
  mpSandboxInitPoint String?
  mpPaymentId        String?
  mpPaymentStatus    String?
  deliveredAt        DateTime?
  payoutReleasedAt   DateTime?
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  buyer              User               @relation("MarketplaceBuyer", fields: [buyerId], references: [id], onDelete: Restrict)
  seller             User               @relation("MarketplaceSeller", fields: [sellerId], references: [id], onDelete: Restrict)
  listing            MarketplaceListing @relation(fields: [listingId], references: [id], onDelete: Restrict)

  @@index([buyerId])
  @@index([sellerId])
  @@index([listingId])
  @@index([status])
  @@index([payoutStatus])
  @@index([mpPreferenceId])
  @@index([mpPaymentId])
}
```

## Por que no reutilizar `OrderItem`

No conviene en el MVP porque el marketplace de usados va con:

- 1 publicacion
- 1 vendedor
- 1 unidad

Eso simplifica mucho el flujo inicial. Mas adelante, si necesitas multi-item marketplace, recien ahi conviene evaluar una estructura de items compartida.

## 3. Modulos NestJS propuestos

## Recomendacion de modulos nuevos

Crear un dominio nuevo bajo `api/src/app/marketplace/`.

### Estructura sugerida

```text
api/src/app/marketplace/
|-- dto/
|-- marketplace.module.ts
|-- seller-verification.service.ts
|-- seller-verification.controller.ts
|-- seller-listings.service.ts
|-- seller-listings.controller.ts
|-- marketplace-public.service.ts
|-- marketplace-public.controller.ts
|-- marketplace-admin.service.ts
|-- marketplace-admin.controller.ts
|-- marketplace-orders.service.ts
|-- marketplace-orders.controller.ts
`-- listing-text-sanitizer.ts
```

## Justificacion

Separarlo en el mismo modulo funcional evita:

- dispersar logica entre `users`, `products` y `orders`
- ensuciar controllers existentes
- mezclar tienda oficial con marketplace

## 4. Endpoints propuestos

## 4.1 Endpoints vendedor autenticado

Base sugerida: `/api/marketplace/seller`

### Solicitud de vendedor

- `POST /api/marketplace/seller/apply`
  - crea solicitud de verificacion
- `GET /api/marketplace/seller/application`
  - devuelve estado actual
- `PUT /api/marketplace/seller/application`
  - actualiza solicitud rechazada o reenviada

### Publicaciones propias

- `GET /api/marketplace/seller/listings`
  - lista mis publicaciones
- `POST /api/marketplace/seller/listings`
  - crea borrador
- `GET /api/marketplace/seller/listings/:id`
  - detalle de mi publicacion
- `PATCH /api/marketplace/seller/listings/:id`
  - edita borrador o cambios solicitados
- `POST /api/marketplace/seller/listings/:id/assets`
  - sube assets
- `DELETE /api/marketplace/seller/listings/:id/assets/:assetId`
  - elimina asset editable
- `PATCH /api/marketplace/seller/listings/:id/cover`
  - define portada
- `POST /api/marketplace/seller/listings/:id/submit`
  - envia a revision

### Apelaciones

- `POST /api/marketplace/seller/listings/:id/appeal`
  - crea apelacion
- `GET /api/marketplace/seller/appeals`
  - lista apelaciones

### Ventas y saldo

- `GET /api/marketplace/seller/orders`
  - ventas del vendedor
- `GET /api/marketplace/seller/balance`
  - saldo pendiente / liquidado

## 4.2 Endpoints publicos marketplace

Base sugerida: `/api/marketplace`

- `GET /api/marketplace/listings`
  - catalogo de marketplace publicado
- `GET /api/marketplace/listings/:id`
  - detalle publico
- `POST /api/marketplace/orders/quote`
  - cotizacion de total y envio
- `POST /api/marketplace/orders/checkout`
  - checkout separado marketplace
- `POST /api/marketplace/payments/mercadopago/checkout`
  - opcional si separas controller de pagos marketplace
- `POST /api/marketplace/payments/mercadopago/webhook`
  - opcional si separas webhook por dominio marketplace

## 4.3 Endpoints admin marketplace

Base sugerida: `/api/marketplace/admin`

### Vendedores

- `GET /api/marketplace/admin/seller-applications`
- `GET /api/marketplace/admin/seller-applications/:id`
- `PATCH /api/marketplace/admin/seller-applications/:id/approve`
- `PATCH /api/marketplace/admin/seller-applications/:id/reject`
- `PATCH /api/marketplace/admin/sellers/:userId/suspend`
- `PATCH /api/marketplace/admin/sellers/:userId/reactivate`

### Publicaciones

- `GET /api/marketplace/admin/listings`
- `GET /api/marketplace/admin/listings/:id`
- `PATCH /api/marketplace/admin/listings/:id/approve`
- `PATCH /api/marketplace/admin/listings/:id/reject`
- `PATCH /api/marketplace/admin/listings/:id/request-changes`
- `PATCH /api/marketplace/admin/listings/:id/remove`
- `PATCH /api/marketplace/admin/listings/:id/restore`

### Apelaciones

- `GET /api/marketplace/admin/appeals`
- `GET /api/marketplace/admin/appeals/:id`
- `PATCH /api/marketplace/admin/appeals/:id/accept`
- `PATCH /api/marketplace/admin/appeals/:id/reject`

### Ordenes y liquidaciones

- `GET /api/marketplace/admin/orders`
- `PATCH /api/marketplace/admin/orders/:id/status`
- `GET /api/marketplace/admin/payouts`
- `PATCH /api/marketplace/admin/payouts/:id/release`
- `PATCH /api/marketplace/admin/payouts/:id/cancel`

## 5. Reglas de permisos

## Vendedor

Puede:

- gestionar solo sus solicitudes
- gestionar solo sus publicaciones
- apelar solo sobre sus publicaciones
- ver solo sus ventas y su balance

No puede:

- publicar si no esta aprobado
- editar publicaciones ya publicadas sin volver a revision
- ver datos personales del comprador

## Admin / Staff

Puede:

- moderar solicitudes
- moderar publicaciones
- resolver apelaciones
- liberar liquidaciones

## Comprador

Puede:

- ver marketplace publico
- comprar publicaciones aprobadas y publicadas
- ver sus propias ordenes marketplace

## 6. Cambios sugeridos en Storefront

## Rutas nuevas sugeridas

```text
/seller
/seller/apply
/seller/listings
/seller/listings/new
/seller/listings/:id/edit
/seller/orders
/seller/balance
/marketplace
/marketplace/:id
/marketplace/checkout
```

## Comportamiento de la solapa `Vendedor`

### Usuario logueado sin permiso

- mostrar acceso a `Vendedor`
- llevar a pantalla de solicitud

### Usuario logueado con solicitud pendiente

- mostrar estado y espera

### Usuario aprobado

- mostrar dashboard vendedor

### Usuario no logueado

- al entrar a `Vendedor`, redirigir a login con `returnUrl=/seller`

## Recomendacion de UI

- No sumar esto dentro de `Cuenta` como un sub-bloque escondido.
- Hacer una solapa visible `Vendedor` para usuarios logueados.
- Ocultar opciones internas si `sellerStatus` no esta aprobado.

## 7. Cambios sugeridos en Admin Dashboard

## Secciones nuevas

- `Marketplace > Vendedores`
- `Marketplace > Publicaciones`
- `Marketplace > Apelaciones`
- `Marketplace > Liquidaciones`

## Vista minima necesaria

### Vendedores

- nombre
- email
- ciudad / provincia
- estado
- fecha de solicitud
- accesos a DNI/selfie
- aprobar / rechazar / suspender

### Publicaciones

- portada
- titulo
- vendedor
- precio
- estado
- fecha de envio
- acciones de moderacion

### Apelaciones

- publicacion
- motivo original
- mensaje del vendedor
- evidencia nueva
- resolver

### Liquidaciones

- vendedor
- orden
- monto total
- comision
- neto vendedor
- estado de liquidacion
- liberar / cancelar

## 8. Integracion con pagos

## Mercado Pago

Hay dos opciones tecnicas:

### Opcion A - Reutilizar la integracion actual con extension

- Mantener `PaymentMethod.MERCADOPAGO`
- Duplicar flujo de preferencia pero apuntando a `MarketplaceOrder`
- Reusar firma HMAC y validacion de webhook

### Opcion B - Separar controller de pagos marketplace

- `MarketplacePaymentsController`
- webhook especifico para marketplace
- preferencia separada

## Recomendacion MVP

Usar la opcion A a nivel de servicio, pero con controller separado o branch claro en logica para no mezclar `Order` con `MarketplaceOrder`.

## 9. Integracion con envios

## Reusar `AndreaniShippingService`

No hace falta un servicio nuevo si el cotizador sirve para ambos dominios.

## Lo que cambia

- el origen sale de la ubicacion del vendedor
- el destino sale del checkout del comprador
- la logica debe validar que el vendedor tenga ubicacion completa antes de publicar

## Regla operativa fuerte

No permitir publicacion marketplace si faltan:

- pais
- provincia
- ciudad
- codigo postal

## 10. Sanitizacion y anti-contacto

Debe existir una utilidad dedicada para limpiar textos del marketplace.

## Recomendacion tecnica

Crear algo como:

- `listing-text-sanitizer.ts`

## Debe bloquear

- emails
- telefonos
- URLs
- handles de redes
- frases de contacto directo

## Aplicacion

- al crear publicacion
- al editar publicacion
- opcionalmente al apelar

## 11. Estrategia de implementacion por etapas

## Etapa 1 - Base de datos

1. Agregar enums nuevos.
2. Extender `User` con `sellerStatus` y ubicacion.
3. Crear tablas de marketplace.
4. Correr migracion Prisma.
5. Regenerar cliente Prisma.

## Etapa 2 - Backend vendedor

1. Crear modulo `marketplace`.
2. Implementar solicitud de vendedor.
3. Implementar CRUD de borradores.
4. Implementar subida de assets.
5. Implementar submit a revision.

## Etapa 3 - Backend admin

1. Listado de solicitudes.
2. Aprobar / rechazar vendedores.
3. Aprobar / rechazar / pedir cambios en publicaciones.
4. Baja con motivo.
5. Apelaciones.

## Etapa 4 - Frontend vendedor

1. Solapa `Vendedor`.
2. Pantalla de solicitud.
3. Dashboard vendedor.
4. Wizard de alta de publicacion.
5. Pantalla de mis publicaciones.
6. Pantalla de apelaciones.

## Etapa 5 - Frontend comprador

1. Catalogo marketplace.
2. Detalle de publicacion.
3. Carrito / checkout marketplace separado.
4. Compra con pagos.
5. Vista de ordenes marketplace del comprador.

## Etapa 6 - Liquidacion y operacion

1. Calculo de comision.
2. Retencion de fondos.
3. Estado de liquidacion.
4. Liberacion manual desde admin.

## 12. Riesgos tecnicos a vigilar

1. No mezclar accidentalmente `Order` con `MarketplaceOrder`.
2. No mezclar carrito oficial con carrito marketplace.
3. No permitir bypass de moderacion con cambios de estado manuales desde frontend.
4. No exponer datos personales entre comprador y vendedor.
5. No dejar texto libre sin sanitizar.
6. No liberar pagos sin estado de entrega o sin regla de hold definida.

## 13. Recomendacion final de arquitectura

Para este proyecto, la evolucion mas sana es:

- **mantener ecommerce oficial intacto**
- **agregar marketplace como subdominio funcional interno**
- **reusar servicios existentes solo cuando el dominio coincide** (auth, email, parte de pagos, parte de envios)
- **no reciclar modelos de negocio centrales cuando la semantica cambia**

En la practica:

- reusar `User`
- reusar auth
- reusar parte de Mercado Pago
- reusar Andreani
- crear tablas, endpoints y pantallas propias para marketplace

Eso te permite crecer sin romper la tienda actual.
