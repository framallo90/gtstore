# Docker Secrets (Ejemplo)

Este directorio contiene **archivos de ejemplo** para `docker compose`.

- No usar estos valores en produccion.
- Crear archivos reales y privados fuera del repositorio, o sobrescribir rutas con:
  - `POSTGRES_PASSWORD_PATH`
  - `JWT_ACCESS_SECRET_PATH`
  - `JWT_REFRESH_SECRET_PATH`
  - `MP_ACCESS_TOKEN_PATH`
  - `MP_WEBHOOK_SECRET_PATH`

Recomendacion:
- Mantener secretos reales en un secret manager o en archivos no versionados.
- Rotar cualquier secreto que haya sido expuesto.

