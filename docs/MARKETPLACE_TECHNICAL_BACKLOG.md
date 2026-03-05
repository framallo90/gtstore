# Marketplace Curado - Backlog Tecnico Priorizado

Fecha de corte: 2026-03-05
Objetivo: cerrar MVP operativo del marketplace sin romper ecommerce oficial.

## Convenciones de prioridad

- P0 = bloqueante para operacion MVP
- P1 = alto valor, se ejecuta despues de P0
- P2 = evolucion posterior

## P0 - Bloqueantes MVP

### P0.1 Storefront marketplace (cliente + vendedor)

Estado: pendiente

Alcance minimo:

- Rutas nuevas en `storefront`:
  - `/marketplace`
  - `/marketplace/:id`
  - `/marketplace/checkout`
  - `/seller`, `/seller/apply`, `/seller/listings`, `/seller/orders`, `/seller/balance`
- Solapa `Vendedor` visible solo para usuario logueado.
- Redireccion a login si intenta entrar no logueado.
- Flujo separado de checkout marketplace (no mezclar con tienda oficial).

Criterios de aceptacion:

- usuario no logueado no accede a rutas seller.
- usuario logueado ve `Vendedor` y puede enviar solicitud.
- comprador puede completar compra marketplace sin tocar carrito oficial.

Validacion:

- `npm run test:storefront`
- `npm run build:storefront`
- `npm run test:e2e:storefront`

### P0.2 Admin dashboard marketplace

Estado: pendiente

Alcance minimo:

- Secciones nuevas:
  - Marketplace > Vendedores
  - Marketplace > Publicaciones
  - Marketplace > Apelaciones
  - Marketplace > Liquidaciones
- Moderacion de solicitudes, publicaciones y apelaciones.
- Liberacion manual de payouts desde panel.

Criterios de aceptacion:

- admin/staff puede revisar y resolver ciclos completos.
- toda accion deja trazabilidad en auditoria.

Validacion:

- `npm run test:admin`
- `npm run build:admin`
- `npm run test:e2e:admin`

### P0.3 Uploads MVP en disco local con privacidad

Estado: pendiente

Alcance minimo:

- Endpoint de upload autenticado para seller/admin.
- Almacenamiento local segmentado:
  - privado: DNI frente/dorso/selfie
  - publico moderado: portada/fotos/video aprobados
- No exponer DNI/selfie por URL publica.
- Reemplazar path manual en DTO por referencia real generada por backend.

Criterios de aceptacion:

- documento de identidad no aparece en endpoints publicos.
- media privada solo accesible por rol autorizado.

Validacion:

- `npm run test:api`
- `npm run build:api`
- nuevos tests de permiso/privacidad para upload/download

### P0.4 Pruebas profundas de dominio marketplace

Estado: pendiente

Alcance minimo de E2E API:

- seller apply -> admin approve -> seller create listing -> submit -> admin publish.
- buyer quote -> checkout -> pago MP -> estado `PAID`.
- transicion `DELIVERED` -> `READY_TO_RELEASE` -> `RELEASED`.
- disputa abierta bloquea liberacion.
- una sola apelacion por caso.

Criterios de aceptacion:

- cobertura de casos felices y negativos de permisos.
- sin regresion de ecommerce oficial.

Validacion:

- `npm run test:e2e:api`
- `npm run test:e2e:fullstack`

## P1 - Alto valor despues de P0

### P1.1 Automatizacion de estado logistico

- Integrar eventos de Andreani (despachado/entregado) para reducir operacion manual.
- Mantener override manual admin como fallback.

### P1.2 Reglas operativas de reclamo

- SLA de reclamo con timers.
- bloqueo automatico de payout si hay disputa.
- panel de seguimiento de disputas.

### P1.3 Endurecimiento adicional de seguridad

- rate limits dedicados para endpoints marketplace criticos.
- alertas de intentos reiterados de bypass de contacto.
- monitoreo de acciones administrativas sensibles.

## P2 - Evolucion

### P2.1 Migracion de storage a proveedor externo

- pasar de disco local a S3 compatible (privado/publico por bucket/prefix).
- opcion Cloudinary para media publica, no para identidad.

### P2.2 Analitica de marketplace

- funnel seller onboarding.
- conversion de publicacion a venta.
- tiempos de moderacion y disputas.

### P2.3 Operacion financiera avanzada

- lotes de liquidacion.
- exportes de conciliacion.
- reglas variables de comision por categoria (si negocio lo requiere).

## Dependencias externas (bloquean salida real)

- Mercado Pago productivo (token + webhook + dominio publico).
- Andreani productivo (credenciales + contrato + pruebas reales).
- SMTP real para notificaciones.
- politica/legal final firmada para marketplace.

## Orden de ejecucion recomendado

1. P0.3 Uploads MVP (base para identidad y media real).
2. P0.1 Storefront marketplace.
3. P0.2 Admin marketplace.
4. P0.4 Pruebas profundas.
5. P1.x y P2.x segun capacidad.
