# Marketplace Curado MVP - GeekyTreasures

## Objetivo

Agregar un marketplace de usados dentro de GeekyTreasures donde terceros puedan vender comics y libros usados, con GeekyTreasures como intermediario de:

- publicacion
- moderacion
- cobro
- retencion de fondos
- liquidacion al vendedor
- gestion de envio

La plataforma no debe permitir contacto directo entre comprador y vendedor.

## Principios del MVP

1. Marketplace curado, no abierto.
2. Solo usuarios aprobados pueden vender.
3. Toda publicacion pasa por revision antes de publicarse.
4. GeekyTreasures cobra el total y liquida despues.
5. Compras del marketplace separadas de la tienda oficial.
6. Sin chat, email, telefono ni contacto directo entre partes.
7. Revision de estado simple basada en evidencia visual.
8. Operacion inicial pensada para Argentina.

## Alcance del MVP

### Incluye

- Solicitud para convertirse en vendedor desde una cuenta existente.
- Verificacion basica de identidad con DNI y selfie.
- Panel de vendedor.
- Carga de publicaciones de usados.
- Tipos admitidos en el MVP: comics, mangas, libros y tomos coleccionables.
- Moderacion de publicaciones por admin.
- Baja de publicaciones con motivo.
- Apelacion de publicaciones dadas de baja o rechazadas.
- Compra separada del catalogo oficial.
- Cobro centralizado por la plataforma.
- Retencion y liquidacion posterior al vendedor.
- Cotizacion de envio desde el origen del vendedor al destino del comprador.

### No incluye en esta etapa

- Factura oficial para marketplace.
- Chat entre comprador y vendedor.
- Publicacion instantanea sin revision.
- Liquidacion automatica al vendedor.
- Verificacion fisica por deposito de GeekyTreasures.
- Venta internacional.
- Multiples unidades por publicacion compleja (MVP: 1 unidad por publicacion de usado).
- Figuras (quedan para una etapa posterior).

## Separacion de negocio

Se deben manejar dos lineas separadas dentro de la misma plataforma:

### 1. Tienda oficial GeekyTreasures

- productos propios
- stock propio
- futura factura oficial
- logica actual de ecommerce

### 2. Marketplace GeekyTreasures

- productos de terceros
- 1 vendedor por publicacion
- comision por venta
- moderacion previa
- retencion de fondos
- liquidacion posterior

## Roles y estados

## Roles base

- `CUSTOMER`
- `STAFF`
- `ADMIN`

## Estado comercial del vendedor

Esto debe separarse del rol base del usuario.

- `NONE`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

## Regla

- Un usuario con rol `CUSTOMER` puede tener `sellerStatus=APPROVED` y usar panel vendedor.
- No hace falta convertirlo en `ADMIN` ni `STAFF` para vender.

## Flujo 1 - Solicitud de vendedor

### Entrada

Usuario logueado entra a la solapa `Vendedor`.

### Comportamiento segun estado

#### `sellerStatus=NONE`

Mostrar:

- boton `Quiero vender en GeekyTreasures`
- resumen de requisitos
- terminos del marketplace

#### `sellerStatus=PENDING_REVIEW`

Mostrar:

- estado de revision
- fecha de envio
- documentos cargados
- mensaje de espera

#### `sellerStatus=APPROVED`

Mostrar panel vendedor completo.

#### `sellerStatus=REJECTED`

Mostrar:

- motivo de rechazo
- opcion de reenviar solicitud

#### `sellerStatus=SUSPENDED`

Mostrar:

- cuenta suspendida
- motivo
- si aplica, canal interno de apelacion

### Datos obligatorios para solicitar

- nombre y apellido legal
- pais
- provincia
- ciudad
- codigo postal
- aceptacion de terminos del marketplace

### Archivos obligatorios para verificar identidad

- foto frente DNI
- foto dorso DNI
- selfie del usuario

## Flujo 2 - Publicacion de un usado

Solo disponible para vendedores aprobados.

### Wizard recomendado

#### Paso 1 - Tipo de articulo

- comic
- manga
- libro
- tomo coleccionable

#### Paso 2 - Ficha base

- titulo
- subtitulo
- autor
- editorial
- genero
- idioma
- edicion
- anio
- ISBN (opcional)
- descripcion

#### Paso 3 - Estado

- `LIKE_NEW`
- `VERY_GOOD`
- `GOOD`
- `ACCEPTABLE`
- `HAS_DETAILS`

Campos adicionales:

- notas de estado
- defectos declarados
- observaciones

#### Paso 4 - Evidencia

### Fotos obligatorias minimas

- portada
- contraportada
- lomo
- canto o bordes
- al menos 2 paginas internas
- foto del dano si existe

### Video

- 1 video corto opcional o recomendado mostrando interior / hojas

### Regla de assets

- El vendedor sube todo el material.
- La plataforma guarda todo el material.
- El vendedor elige una imagen como portada visible.
- El resto queda como galeria y evidencia para moderacion.
- El vendedor puede agregar mas fotos antes de enviar a revision.

#### Paso 5 - Venta

- precio
- portada seleccionada
- stock: `1`

#### Paso 6 - Confirmacion

- enviar a revision

## Edicion de publicaciones por vendedor

### El vendedor puede editar

- portada
- fotos adicionales
- video si aplica
- descripcion
- precio
- notas de estado

### Regla de edicion por estado

Editable solo en:

- `DRAFT`
- `CHANGES_REQUESTED`

No editable directamente en:

- `PENDING_REVIEW`
- `PUBLISHED`
- `SOLD`

Si mas adelante se permite editar una publicacion ya publicada, el cambio debe volver a moderacion.

## Estado de publicaciones

- `DRAFT`
- `PENDING_REVIEW`
- `CHANGES_REQUESTED`
- `APPROVED`
- `PUBLISHED`
- `REJECTED`
- `REMOVED_BY_ADMIN`
- `SOLD`
- `ARCHIVED`

## Flujo 3 - Moderacion admin

## Modulo admin nuevo

Se recomienda una seccion separada dentro del admin:

- Solicitudes de vendedor
- Publicaciones marketplace
- Revisiones pendientes
- Bajas
- Apelaciones
- Liquidaciones

## Acciones sobre solicitudes de vendedor

- aprobar
- rechazar con motivo
- suspender
- reactivar

## Acciones sobre publicaciones

- aprobar y publicar
- rechazar con motivo
- pedir cambios
- dar de baja con motivo
- archivar

## Criterios simples de revision en MVP

Admin revisa visualmente:

- que el producto coincida con el titulo
- que el estado declarado sea razonable segun fotos
- que no falten fotos obligatorias
- que no haya dano grave no declarado
- que no haya contenido prohibido o enganoso

## Regla operativa de moderacion

- el tiempo maximo objetivo de revision antes de publicar es `48hs`
- pueden revisar `ADMIN` y `STAFF`
- el criterio minimo de rechazo es producto en mal estado
- toda baja o rechazo debe dejar motivo estructurado y nota libre

## Baja de publicacion con justificativo

Motivos sugeridos:

- fotos insuficientes
- estado no coincide
- descripcion enganosa
- articulo prohibido
- sospecha de fraude
- incumplimiento de reglas
- precio abusivo o inconsistente

Siempre debe quedar:

- motivo estructurado
- nota manual del admin
- fecha
- responsable

## Flujo 4 - Apelacion del vendedor

Cuando una publicacion es rechazada o dada de baja:

- el vendedor ve el motivo
- puede apelar
- puede adjuntar aclaracion
- puede adjuntar nueva evidencia

## Estado de apelacion

- `NONE`
- `PENDING`
- `ACCEPTED`
- `REJECTED`

## Regla sugerida MVP

- 1 apelacion activa por caso
- si se acepta, la publicacion vuelve a revision o se restablece
- si se rechaza, queda cerrada la apelacion

## Flujo 5 - Compra de marketplace

## Regla principal

Las compras de marketplace deben estar separadas de la tienda oficial.

### Motivos

- futura facturacion distinta
- distinta responsabilidad comercial
- distinta conciliacion financiera
- distinta logica de comision y liquidacion

## Recomendacion operativa MVP

- carrito propio para marketplace
- checkout propio para marketplace
- no mezclar productos oficiales y marketplace en la misma orden

## Lo que ve el comprador

- ficha del producto usado
- badge de marketplace
- estado declarado
- fotos visibles aprobadas
- portada elegida por el vendedor
- zona general del vendedor (ej: ciudad/provincia)
- nunca datos directos de contacto

## Flujo de pago

### Modelo A

1. El comprador paga a GeekyTreasures.
2. GeekyTreasures recibe el total.
3. Se registra la comision de plataforma (`15%` fijo sobre el precio del producto).
4. El dinero del vendedor queda retenido.
5. Cuando la venta queda cerrada, se libera el saldo.

## Componentes monetarios recomendados

- `salePrice`
- `shippingAmount`
- `platformCommission`
- `sellerNetAmount`
- `buyerTotal`

## Estado de liquidacion

- `PENDING`
- `ON_HOLD`
- `READY_TO_RELEASE`
- `RELEASED`
- `CANCELED`

## Regla definida de liberacion de fondos

Liberar cuando:

- Andreani informe entrega del pedido
- y el admin libere manualmente el pago

## Regla operativa complementaria

- la retencion puede extenderse hasta `7 dias` en viajes largos
- si hay reclamo abierto, el pago queda retenido
- el admin evalua el reclamo antes de liberar el pago

## Flujo 6 - Envio

## Principio

El comprador y vendedor no coordinan por fuera.

La plataforma gestiona el calculo y las instrucciones.

## Datos minimos obligatorios del vendedor

- pais
- provincia
- ciudad
- codigo postal

## Flujo sugerido

1. El vendedor publica con origen cargado.
2. El comprador compra.
3. La plataforma cotiza envio desde origen vendedor a destino comprador.
4. El comprador paga producto + envio.
5. El vendedor recibe instrucciones desde su panel.
6. El comprador sigue el estado desde la orden.

## Restriccion MVP recomendada

- limitar marketplace a Argentina
- usar Andreani como cotizador principal
- el vendedor despacha por su cuenta con guia generada por la plataforma
- la plataforma usa la trazabilidad de Andreani para verificar despacho y entrega

## Regla anti-salto de comision

La plataforma no debe permitir canales de contacto directos.

## Medidas tecnicas y funcionales

- no mostrar email del vendedor
- no mostrar telefono
- no mostrar direccion exacta
- no mostrar email del comprador al vendedor
- no mostrar telefono del comprador al vendedor
- bloquear URLs en descripcion
- bloquear telefonos en descripcion
- bloquear emails en descripcion
- bloquear menciones de redes sociales
- sanitizar texto libre

## Datos y entidades recomendadas

## `User`

Agregar o reforzar:

- `sellerStatus`
- `country`
- `province`
- `city`
- `postalCode`

## `SellerVerificationRequest`

- `id`
- `userId`
- `status`
- `dniFrontUrl`
- `dniBackUrl`
- `selfieUrl`
- `reviewNotes`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

## `MarketplaceListing`

- `id`
- `sellerId`
- `status`
- `title`
- `subtitle`
- `author`
- `publisher`
- `genre`
- `language`
- `edition`
- `publicationYear`
- `isbn`
- `description`
- `condition`
- `conditionNotes`
- `declaredDefects`
- `price`
- `stock` (MVP: 1)
- `coverAssetId`
- `adminReason`
- `appealStatus`
- `createdAt`
- `updatedAt`

## `MarketplaceListingAsset`

- `id`
- `listingId`
- `type` (`IMAGE` | `VIDEO`)
- `url`
- `isCover`
- `isEvidence`
- `sortOrder`
- `createdAt`

## `MarketplaceReview`

- `id`
- `listingId`
- `reviewerId`
- `decision`
- `reason`
- `notes`
- `createdAt`

## `MarketplaceAppeal`

- `id`
- `listingId`
- `sellerId`
- `message`
- `status`
- `resolutionNotes`
- `resolvedBy`
- `resolvedAt`
- `createdAt`

## `MarketplaceOrder`

Puede ser tabla propia o una extension del modelo actual, pero conceptualmente debe soportar:

- `id`
- `buyerId`
- `sellerId`
- `listingId`
- `status`
- `salePrice`
- `shippingAmount`
- `platformCommission`
- `sellerNetAmount`
- `buyerTotal`
- `payoutStatus`
- `deliveryConfirmedAt`
- `createdAt`
- `updatedAt`

## Panel vendedor - secciones sugeridas

- Inicio vendedor
- Estado de cuenta vendedora
- Nueva publicacion
- Mis publicaciones
- Publicaciones en revision
- Publicaciones rechazadas
- Apelaciones
- Ventas
- Saldo pendiente
- Saldo liquidado

## Panel admin - secciones sugeridas

- Solicitudes de vendedor
- Revisiones de identidad
- Publicaciones pendientes
- Publicaciones publicadas
- Bajas y sanciones
- Apelaciones
- Liquidaciones pendientes

## Reglas de UX para simplificar

1. El vendedor no ve formularios gigantes en una sola pantalla.
2. Todo debe ser wizard por pasos.
3. Debe haber validaciones claras de fotos faltantes.
4. La portada debe elegirse con un selector visual simple.
5. Los motivos de rechazo deben ser entendibles.
6. El comprador debe ver claramente que es un articulo del marketplace y no de la tienda oficial.
7. El checkout del marketplace debe estar visualmente separado del checkout oficial.

## Riesgos operativos del MVP

1. Carga de moderacion alta.
2. Disputas por estado real del producto.
3. Costos manuales de liquidacion.
4. Complejidad logistica si hay multiples origenes.
5. Riesgo de fraude documental en verificacion del vendedor.

## Mitigaciones sugeridas

- checklist fijo de revision
- rechazo con plantillas administrables
- una sola apelacion activa
- retencion de fondos
- limite geografico inicial
- suspension rapida de vendedores riesgosos

## Evolucion futura recomendada

## Fase 2

- reputacion del vendedor
- badges de confianza
- sugerencia automatica de precio
- sugerencia automatica de metadata desde catalogo oficial
- filtros exclusivos de marketplace

## Fase 3

- verificacion fisica premium por GeekyTreasures
- publicaciones certificadas
- prioridad para items verificados
- comision variable segun servicio

## Fase 4

- liquidacion automatica
- dashboard financiero de vendedor
- reporting contable y fiscal
- integracion mas profunda con logistica (tracking y etiquetas)

## Fase 5

- deteccion asistida por IA de danos visuales
- sugerencia automatica de estado
- deteccion de publicaciones sospechosas
- matching automatico con ficha bibliografica existente

## Recomendacion de implementacion

Construir en este orden:

1. Estados y entidades nuevas de vendedor / marketplace.
2. Solicitud de vendedor con verificacion documental.
3. Panel vendedor basico.
4. Carga de publicaciones y assets.
5. Moderacion admin.
6. Checkout separado de marketplace.
7. Retencion y liquidacion manual.
8. Apelaciones.

## Definicion comercial recomendada

Nombre sugerido para comunicarlo al cliente:

**Marketplace curado de usados verificados por GeekyTreasures**

Eso ayuda a justificar:

- la comision
- la moderacion
- la separacion del flujo
- la confianza del comprador
