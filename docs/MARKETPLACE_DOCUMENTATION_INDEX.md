# Marketplace Curado - Indice de Documentacion

Este es el punto de entrada de la documentacion del marketplace en estado post-implementacion parcial.

## Documentos

1. `docs/MARKETPLACE_MVP_SPEC.md`
   - definicion funcional del producto
   - alcance del MVP
   - roles, flujos y reglas de negocio

2. `docs/MARKETPLACE_TECHNICAL_PLAN.md`
   - bajada tecnica alineada con Prisma, NestJS y Angular
   - entidades propuestas
   - endpoints propuestos
   - modulos sugeridos

3. `docs/MARKETPLACE_IMPLEMENTATION_ROADMAP.md`
   - orden de implementacion por fases
   - dependencias
   - criterios de aceptacion
   - validaciones por etapa

4. `docs/MARKETPLACE_PRECODE_CHECKLIST.md`
   - decisiones que conviene congelar antes de escribir codigo
   - puntos operativos, de UX, seguridad y negocio

5. `docs/EXTERNAL_INTEGRATIONS_CHECKLIST.md`
   - integraciones externas
   - faltantes operativos
   - requisitos fuera del repo

6. `docs/MARKETPLACE_STORAGE_OPTIONS.md`
   - comparativa de disco local, S3 compatible y Cloudinary
   - costos orientativos
   - recomendacion de almacenamiento por etapa

7. `docs/MARKETPLACE_POLICY_DRAFT.md`
   - borrador base de terminos y politicas del marketplace
   - reglas de moderacion, bajas, reclamos y suspension

8. `docs/MARKETPLACE_STATUS.md`
   - estado real de implementacion (hecho / parcial / faltante)
   - brechas entre backend y frontends
   - riesgos y bloqueos operativos actuales

9. `docs/MARKETPLACE_TECHNICAL_BACKLOG.md`
   - backlog tecnico priorizado para cerrar MVP operativo
   - tareas por dominio (storefront, admin, uploads, testing)
   - criterios de aceptacion y validacion por bloque

## Orden recomendado de lectura

1. `docs/MARKETPLACE_STATUS.md`
2. `docs/MARKETPLACE_TECHNICAL_BACKLOG.md`
3. `docs/MARKETPLACE_MVP_SPEC.md`
4. `docs/MARKETPLACE_TECHNICAL_PLAN.md`
5. `docs/MARKETPLACE_IMPLEMENTATION_ROADMAP.md`
6. `docs/MARKETPLACE_PRECODE_CHECKLIST.md`
7. `docs/EXTERNAL_INTEGRATIONS_CHECKLIST.md`
8. `docs/MARKETPLACE_STORAGE_OPTIONS.md`
9. `docs/MARKETPLACE_POLICY_DRAFT.md`

## Que deberia quedar claro despues de leer todo esto

- que se quiere construir
- que ya esta implementado hoy
- que queda adentro y afuera del MVP
- como se separa del ecommerce oficial
- que brechas hay entre backend y frontends
- en que orden conviene cerrar faltantes
- que validaciones faltan para salida operativa

## Estado actual

Con estos documentos, el proyecto ya tiene:

- especificacion funcional y tecnica del marketplace
- implementacion backend parcial ya operativa en API/Prisma
- checklist externo de integraciones pendientes
- backlog tecnico priorizado para cerrar frontends, uploads y testing profundo
