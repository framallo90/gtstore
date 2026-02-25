#!/bin/sh
set -eu

load_file_env() {
  var_name="$1"
  file_var_name="${var_name}_FILE"

  eval "current_value=\${$var_name:-}"
  if [ -n "$current_value" ]; then
    return 0
  fi

  eval "file_path=\${$file_var_name:-}"
  if [ -z "$file_path" ]; then
    return 0
  fi

  if [ ! -f "$file_path" ]; then
    echo "[entrypoint] missing secret file for $var_name at $file_path" >&2
    exit 1
  fi

  value="$(tr -d '\r' < "$file_path" | tr -d '\n')"
  export "$var_name=$value"
}

# Load secrets from files when provided (Docker secrets compatible).
load_file_env POSTGRES_PASSWORD
load_file_env JWT_ACCESS_SECRET
load_file_env JWT_REFRESH_SECRET
load_file_env MP_ACCESS_TOKEN
load_file_env MP_WEBHOOK_SECRET

is_placeholder_secret() {
  raw_value="$1"
  normalized="$(printf '%s' "$raw_value" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

  case "$normalized" in
    ""|change_me|changeme|change_me_*|changeme*|*dev_only*|*example*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if [ "${NODE_ENV:-}" = "production" ]; then
  if is_placeholder_secret "${POSTGRES_PASSWORD:-}"; then
    echo "[entrypoint] invalid POSTGRES_PASSWORD for production." >&2
    exit 1
  fi

  if is_placeholder_secret "${JWT_ACCESS_SECRET:-}" || [ "${#JWT_ACCESS_SECRET}" -lt 32 ]; then
    echo "[entrypoint] invalid JWT_ACCESS_SECRET for production." >&2
    exit 1
  fi

  if is_placeholder_secret "${JWT_REFRESH_SECRET:-}" || [ "${#JWT_REFRESH_SECRET}" -lt 32 ]; then
    echo "[entrypoint] invalid JWT_REFRESH_SECRET for production." >&2
    exit 1
  fi

  if [ "${MP_ENV:-sandbox}" = "production" ]; then
    if is_placeholder_secret "${MP_ACCESS_TOKEN:-}"; then
      echo "[entrypoint] invalid MP_ACCESS_TOKEN for production." >&2
      exit 1
    fi
    if is_placeholder_secret "${MP_WEBHOOK_SECRET:-}"; then
      echo "[entrypoint] invalid MP_WEBHOOK_SECRET for production." >&2
      exit 1
    fi
  fi
fi

# Build DATABASE_URL from discrete env vars when not provided explicitly.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "[entrypoint] DATABASE_URL is not set and POSTGRES_PASSWORD is empty." >&2
    exit 1
  fi

  POSTGRES_USER_VALUE="${POSTGRES_USER:-postgres}"
  POSTGRES_HOST_VALUE="${POSTGRES_HOST:-postgres}"
  POSTGRES_PORT_VALUE="${POSTGRES_PORT:-5432}"
  POSTGRES_DB_VALUE="${POSTGRES_DB:-geekytreasures}"

  export DATABASE_URL="postgresql://${POSTGRES_USER_VALUE}:${POSTGRES_PASSWORD}@${POSTGRES_HOST_VALUE}:${POSTGRES_PORT_VALUE}/${POSTGRES_DB_VALUE}?schema=public"
fi

npx prisma migrate deploy
node main.js
