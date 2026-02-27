param(
  [ValidateSet('storefront', 'admin', 'api', 'all')]
  [string]$Target = 'storefront',
  [switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $repoRoot '.env'
$secretsDir = Join-Path $repoRoot '.secrets'

if (!(Test-Path $envFile)) {
  throw "No se encontro .env en: $envFile"
}

if (!(Test-Path $secretsDir)) {
  New-Item -ItemType Directory -Path $secretsDir | Out-Null
}

function Get-EnvValue([string]$key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -First 1
  if (-not $line) {
    return ''
  }

  $raw = ($line -split '=', 2)[1].Trim()
  if (($raw.StartsWith('"') -and $raw.EndsWith('"')) -or ($raw.StartsWith("'") -and $raw.EndsWith("'"))) {
    return $raw.Substring(1, $raw.Length - 2)
  }
  return $raw
}

function Write-SecretFile([string]$fileName, [string]$value, [switch]$AllowEmpty) {
  if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($value)) {
    throw "Falta valor requerido para secreto: $fileName"
  }

  $path = Join-Path $secretsDir $fileName
  $safeValue = if ($value) { $value.Trim() } else { '' }
  Set-Content -Path $path -Value $safeValue -Encoding Ascii -NoNewline
  return $path
}

$postgresPassword = Get-EnvValue 'POSTGRES_PASSWORD'
$jwtAccessSecret = Get-EnvValue 'JWT_ACCESS_SECRET'
$jwtRefreshSecret = Get-EnvValue 'JWT_REFRESH_SECRET'
$mpAccessToken = Get-EnvValue 'MP_ACCESS_TOKEN'
$mpWebhookSecret = Get-EnvValue 'MP_WEBHOOK_SECRET'

if ([string]::IsNullOrWhiteSpace($jwtAccessSecret)) {
  $jwtAccessSecret = 'DEV_ONLY_JWT_ACCESS_SECRET_MIN_32_CHARS_123456'
}
if ([string]::IsNullOrWhiteSpace($jwtRefreshSecret)) {
  $jwtRefreshSecret = 'DEV_ONLY_JWT_REFRESH_SECRET_MIN_32_CHARS_654321'
}

$postgresPath = Write-SecretFile -fileName 'postgres_password.local' -value $postgresPassword
$jwtAccessPath = Write-SecretFile -fileName 'jwt_access_secret.local' -value $jwtAccessSecret
$jwtRefreshPath = Write-SecretFile -fileName 'jwt_refresh_secret.local' -value $jwtRefreshSecret
$mpTokenPath = Write-SecretFile -fileName 'mp_access_token.local' -value $mpAccessToken -AllowEmpty
$mpWebhookPath = Write-SecretFile -fileName 'mp_webhook_secret.local' -value $mpWebhookSecret -AllowEmpty

Set-Location $repoRoot

$env:NODE_ENV = 'development'
$env:POSTGRES_PASSWORD_PATH = $postgresPath
$env:JWT_ACCESS_SECRET_PATH = $jwtAccessPath
$env:JWT_REFRESH_SECRET_PATH = $jwtRefreshPath
$env:MP_ACCESS_TOKEN_PATH = $mpTokenPath
$env:MP_WEBHOOK_SECRET_PATH = $mpWebhookPath

$composeArgs = @('compose', 'up', '-d')
if (-not $NoBuild) {
  $composeArgs += '--build'
}

switch ($Target) {
  'storefront' {
    $composeArgs += '--no-deps'
    $composeArgs += 'storefront'
  }
  'admin' {
    $composeArgs += '--no-deps'
    $composeArgs += 'admin-dashboard'
  }
  'api' {
    $composeArgs += 'postgres'
    $composeArgs += 'api'
  }
  'all' {
    # no extra args
  }
}

Write-Host "[docker-local-build] Ejecutando: docker $($composeArgs -join ' ')"
& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& docker compose ps
