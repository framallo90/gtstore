# Marketplace Curado - Opciones de Almacenamiento de Archivos

Este documento compara las opciones de almacenamiento para:

- DNI frente
- DNI dorso
- selfie
- fotos de publicaciones
- videos de publicaciones

## Estado definido para el MVP

Para avanzar rapido:

- en el MVP inicial se usara **disco local**

## Importante

Esto sirve para desarrollo o una primera etapa controlada, pero no es la mejor opcion para escalar o para operar con documentos sensibles en produccion.

## 1. Disco local (decision temporal actual)

### Ventajas

- implementacion mas simple
- cero costo extra inmediato
- rapido para desarrollo y pruebas internas

### Desventajas

- riesgo alto si el servidor falla o se corrompe el disco
- mas dificil de respaldar correctamente
- mas dificil de escalar a multiples instancias
- mas delicado para archivos privados (DNI, selfie)
- despliegues y migraciones pueden complicar los paths y permisos

### Recomendacion

- usarlo solo como solucion transitoria
- separar fisicamente al menos:
  - carpeta privada para identidad
  - carpeta publica/controlada para media aprobada
- no exponer rutas de disco directamente por URL publica

## 2. Que significa `S3 compatible`

No es un producto unico. Es una categoria de almacenamiento de objetos que usa una API compatible con Amazon S3 o muy cercana a ella.

### Beneficios

- facil de integrar con backends modernos
- escalable
- ideal para imagenes y videos
- permite separar buckets o prefijos privados/publicos
- se adapta bien a archivos del marketplace

### Para este proyecto

Sirve especialmente bien para:

- guardar documentos privados con acceso controlado
- guardar fotos y videos de publicaciones
- generar URLs temporales o privadas
- crecer sin depender del disco del servidor

## 3. Opcion A - Amazon S3 (referencia del mercado)

### Que es

Es el servicio base de almacenamiento de objetos de AWS. No es "compatible": es el estandar original.

### Precio de referencia (consultado el 2026-03-04)

Segun la pagina oficial de precios de S3 para el ejemplo en `us-east-1`:

- almacenamiento S3 Standard: aproximadamente `USD 0.023 / GB / mes` para los primeros 50 TB
- requests PUT/COPY/POST/LIST: aproximadamente `USD 0.005 por 1.000 requests`
- requests GET/SELECT: aproximadamente `USD 0.0004 por 1.000 requests`

### Pros

- muy estandar
- muchisimo ecosistema
- ideal si despues integras otros servicios AWS

### Contras

- mas complejo de operar que otras opciones simples
- el costo puede subir por requests y egreso si no se controla

## 4. Opcion B - Cloudflare R2 (S3 compatible)

### Que es

Objeto storage compatible con ecosistema S3 y muy atractivo para servir media web.

### Precio de referencia (consultado el 2026-03-04)

Segun la documentacion oficial:

- almacenamiento standard: `USD 0.015 / GB / mes`
- Class A (escrituras/mutaciones): `USD 4.50 / millon`
- Class B (lecturas): `USD 0.36 / millon`
- egreso a internet: `gratis`
- free tier mensual:
  - `10 GB`
  - `1 millon` de operaciones Class A
  - `10 millones` de operaciones Class B

### Pros

- mas barato que S3 en almacenamiento base
- sin costo de egreso, lo cual ayuda mucho si sirves imagenes
- bueno para storefronts con trafico de media

### Contras

- menos ecosistema que AWS puro
- sigue requiriendo resolver permisos, buckets y URLs firmadas si manejas privados

## 5. Opcion C - Backblaze B2 (S3 compatible)

### Que es

Object storage compatible con API S3, generalmente competitivo en costo.

### Precio de referencia (consultado el 2026-03-04)

Segun el sitio oficial y su documentacion de pricing:

- almacenamiento: desde `USD 6 / TB / mes` (aprox `USD 0.006 / GB / mes`)
- primeros `10 GB` gratuitos en la cuenta
- operaciones de upload S3 tipo write listadas como clase A: sin cargo en su esquema documentado actual
- lecturas (`GetObject`/`HeadObject`) despues del free tier diario: `USD 0.004 por 10.000`
- egreso gratis hasta `3x` el promedio mensual almacenado; excedente aproximado `USD 0.01 / GB`

### Pros

- costo de storage muy bajo
- bueno para archivos voluminosos
- S3 compatible

### Contras

- el modelo de egreso requiere revisar uso real
- menos simple para equipos que quieren una experiencia muy orientada a media/CDN

## 6. Opcion D - Wasabi (S3 compatible)

### Que es

Object storage de costo predecible, tambien compatible con patrones S3.

### Precio de referencia (consultado el 2026-03-04)

Segun su FAQ oficial de pricing:

- `USD 6.99 / TB / mes` (aprox `USD 0.0068 / GB / mes`)
- entrada de datos: gratis
- salida de datos: gratis (segun su modelo publicado)
- requests API: gratis (segun su modelo publicado)

### Pros

- costo simple y facil de proyectar
- muy atractivo si quieres costo previsible
- bueno para media y adjuntos

### Contras

- hay que revisar bien condiciones comerciales y operativas antes de escalar
- menos integrado a pipelines de transformacion de imagen/video que Cloudinary

## 7. Opcion E - Cloudinary

### Que es

No es solo almacenamiento. Es una plataforma de media (imagenes y videos) con transformaciones, delivery por CDN y herramientas de manejo de assets.

### Precio de referencia (consultado el 2026-03-04)

Segun su pagina oficial de precios:

- plan `Free`: `USD 0`
  - `25 monthly credits`
  - 1 credito puede equivaler, por ejemplo, a `1 GB` de storage o `1 GB` de bandwidth o `1000` transformaciones, segun el uso
- plan `Plus`: `USD 99 / mes` (o `USD 89 / mes` anualizado)
  - `225 monthly credits`
- plan `Advanced`: `USD 249 / mes` (o `USD 224 / mes` anualizado)
  - `600 monthly credits`

### Pros

- muy bueno para imagen y video
- CDN y optimizacion integrados
- transformaciones y compresion muy utiles para storefront
- UI y tooling mejores para media publica

### Contras

- el pricing por creditos es menos directo que object storage puro
- para guardar documentos privados (DNI/selfie) no es la opcion mas natural si buscas maxima separacion de datos sensibles
- suele ser mejor para media publica que para identidad privada

## 8. Recomendacion practica para GeekyTreasures

## Corto plazo (MVP)

- usar disco local para salir rapido
- separar `privado` y `publico`
- no exponer identidad por rutas abiertas
- documentar que es una decision transitoria

## Mediano plazo (recomendacion realista)

### Si priorizas simplicidad, costo y control

Elegir **S3 compatible**.

La opcion mas equilibrada para este proyecto seria:

- `Cloudflare R2` si priorizas servir media web y evitar egreso caro
- `Wasabi` o `Backblaze B2` si priorizas costo simple de storage

### Si priorizas experiencia visual y media publica

Elegir **Cloudinary** para:

- portadas
- fotos aprobadas
- video visible al comprador

Y separar identidad privada en otro storage.

## Recomendacion mas sana para este proyecto

### Modelo recomendado a futuro

- **Documentos privados (DNI/selfie):** storage tipo S3 compatible privado
- **Media publica del marketplace (portadas, galeria, video aprobado):**
  - S3 compatible con CDN, o
  - Cloudinary si quieres mas foco en optimizacion visual

## 9. Decicion sugerida por etapa

### Etapa actual

- disco local temporal

### Etapa de estabilizacion

- mover identidad privada a storage S3 compatible

### Etapa visual/comercial mas madura

- evaluar Cloudinary solo para media publica si realmente necesitas transformaciones y delivery avanzado

## 10. Conclusion concreta

Si hoy quieres la mejor relacion costo / control / facilidad para este marketplace:

1. empezar temporalmente con disco local
2. planificar migracion a **Cloudflare R2** o **Wasabi / Backblaze B2** para almacenamiento real
3. usar **Cloudinary** solo si mas adelante quieres elevar mucho la calidad visual, transformaciones y delivery de imagen/video

Para el tipo de datos que vas a guardar, **Cloudinary no deberia ser el almacenamiento principal de DNI y selfies**.

## Fuentes consultadas (precios, 2026-03-04)

- AWS S3 Pricing: https://aws.amazon.com/s3/pricing/
- Cloudflare R2 Pricing: https://developers.cloudflare.com/r2/pricing/
- Backblaze B2 Pricing: https://www.backblaze.com/cloud-storage/pricing
- Backblaze B2 Transaction Pricing: https://www.backblaze.com/cloud-storage/transaction-pricing
- Wasabi Pricing FAQ: https://wasabi.com/es/pricing/faq
- Cloudinary Pricing: https://cloudinary.com/pricing
- Cloudinary Credits FAQ: https://cloudinary.com/documentation/developer_onboarding_faq_credits
