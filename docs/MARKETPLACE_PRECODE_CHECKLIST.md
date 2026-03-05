# Marketplace Curado - Checklist Previo a Codigo

Este checklist define lo que conviene cerrar antes de empezar implementacion. Su objetivo es evitar cambios de alcance durante migraciones, endpoints y pantallas.

## 1. Decisiones de negocio que deben quedar cerradas

## Comision

Definido:

- porcentaje fijo: `15%`
- no cambia por categoria
- no cambia por nivel de vendedor en el MVP
- se calcula solo sobre el precio del producto
- el envio no comisiona en esta etapa

## Liberacion de fondos

Definido:

- el dinero se retiene hasta que Andreani informe entrega del pedido
- tope de retencion orientativo: hasta `7 dias` para viajes largos
- la liberacion del pago la hace el admin manualmente en el MVP
- si hay reclamo abierto, el admin evalua el caso antes de liberar el pago
- mientras haya reclamo o revision pendiente, el pago debe seguir en `ON_HOLD`

## Alcance geografico

Definido:

- el MVP arranca solo en Argentina
- la expansion internacional queda para etapas futuras

## Tipos de producto admitidos

Definido para el MVP:

- comics
- mangas
- libros
- tomos coleccionables

Fuera del MVP inmediato:

- figuras, como proxima etapa

## 2. Decisiones operativas que deben quedar cerradas

## Moderacion

Definido:

- tiempo maximo de revision antes de publicar: `48hs`
- revisan `ADMIN` y `STAFF`
- criterio minimo de rechazo: producto en mal estado
- cantidad maxima de apelaciones por caso: `1`
- los rechazos y bajas deben usar motivos estructurados y nota libre

## Verificacion de identidad

Definido:

- frente DNI
- dorso DNI
- selfie simple
- permitir reenvio si se rechaza

## Envio

Definido:

- el vendedor despacha por su cuenta
- la guia la genera la plataforma
- el objetivo es que la plataforma pueda verificar despacho y entrega sin depender de contacto directo entre partes
- la entrega efectiva para liberacion de fondos se toma desde el estado informado por Andreani

## 3. Decisiones tecnicas que deben quedar cerradas

## Uploads y almacenamiento de archivos

Definido para el MVP inicial:

- se usara disco local de forma temporal

Pendiente para salida robusta a produccion:

- migrar a almacenamiento externo compatible con objetos

Archivos a guardar:

- fotos de DNI
- selfies
- fotos de publicaciones
- videos

## Opciones viables

- disco local (solo desarrollo)
- volumen docker (no ideal para produccion)
- S3 compatible (recomendado)
- Cloudinary (posible para imagen/video)

## Regla operativa

- el disco local solo se usa como solucion transitoria
- no conviene sostener identidad + media productiva en disco local a largo plazo
- antes de escalar, migrar a almacenamiento externo

## Privacidad de archivos

No todos los archivos deben ser publicos.

### Privados

- DNI frente
- DNI dorso
- selfie

### Publicos o publicables

- portada de la publicacion
- fotos aprobadas de la publicacion
- video aprobado si se decide mostrarlo

## Regla

La documentacion de identidad no debe salir por endpoints publicos ni quedar expuesta por URL publica sin control.

## Sanitizacion de texto

Debe definirse antes de implementar:

- que patrones se bloquean
- que mensaje ve el usuario si su descripcion es rechazada
- si se bloquea automatico o se marca para revision

## Recomendacion MVP

Bloquear de forma automatica:

- emails
- telefonos
- URLs
- redes sociales
- frases de contacto directo

## 4. Decisiones de UX que deben quedar cerradas

## Solapa `Vendedor`

Definido:

- visible para usuario logueado
- si no esta logueado y entra por URL, redirigir a login
- aparece en la barra superior, arriba a la derecha
- funciona como una opcion mas del navbar
- debe tener color distinto al resto para diferenciar la funcionalidad de venta
- no reemplaza `Admin` ni `Carrito`, es una solapa propia

## Checkout marketplace

Definir:

- si se usa una pagina separada o una variante del checkout actual
- como se comunica que no es compra oficial de tienda

## Recomendacion MVP

- pagina separada o al menos flujo claramente separado
- badge y copy explicito de marketplace

## Fichas de producto marketplace

Definir que muestra al comprador:

- ciudad y provincia del vendedor
- estado declarado
- badge de moderado
- cantidad de fotos visibles
- politica de reclamo

## Recomendacion MVP

- no mostrar direccion exacta
- mostrar solo zona general

## Estado de definicion actual

Con lo definido hasta ahora, ya quedaron cerrados:

- comision
- liberacion de fondos
- alcance geografico
- tipos de producto del MVP
- moderacion base
- verificacion de identidad
- regla de envio
- privacidad de archivos
- sanitizacion base
- visibilidad de solapa vendedor
- separacion de checkout marketplace
- datos visibles al comprador

Lo que sigue necesitando cierre final para una implementacion sin retrabajo es:

- almacenamiento externo definitivo (aunque el MVP arranque en disco local)
- version legal final revisada (ya existe borrador operativo base)

## 5. Decisiones legales / comerciales que conviene cerrar

Ya existe un borrador base en:

- `docs/MARKETPLACE_POLICY_DRAFT.md`

Antes de salir a produccion, conviene convertirlo en version formal revisada.

Temas que deben quedar cubiertos:

- terminos del marketplace
- politica de publicaciones prohibidas
- politica de baja de publicaciones
- politica de reclamos y devoluciones
- regla de retencion y liberacion de fondos
- criterio de suspension de vendedores

## Recomendacion

Aunque sea en texto simple, conviene tener una primera version antes de abrir el marketplace.

## 6. Checklist tecnico previo a la primera implementacion

Antes de arrancar con Prisma y endpoints, deberia estar decidido:

- [x] porcentaje de comision
- [x] regla de liberacion de fondos
- [x] alcance geografico inicial
- [x] categorias exactas admitidas
- [x] politica de apelacion
- [ ] almacenamiento de archivos productivo
- [x] politica de visibilidad de archivos privados
- [x] ubicacion exacta de la solapa `Vendedor`
- [x] estrategia de checkout separado
- [x] politica minima de reclamos

## 7. Criterio para empezar codigo

Se puede empezar implementacion cuando este checklist tenga definicion suficiente para evitar:

- reescribir el esquema de Prisma a mitad de desarrollo
- rehacer endpoints por cambio de flujo
- rehacer el panel vendedor por cambio de UX
- rehacer la logica de pagos por cambio de comision

## 8. Recomendacion practica

Si queres avanzar sin frenar el proyecto, antes de escribir codigo conviene congelar estas 5 decisiones:

1. porcentaje exacto de comision
2. regla exacta de liberacion de fondos
3. alcance geografico del MVP
4. almacenamiento de archivos (sobre todo DNI y selfies)
5. si el checkout marketplace sera ruta nueva o variante fuerte del actual

Con esas 5 definidas, ya se puede entrar a modelado real sin riesgo alto de rehacer el backend.
