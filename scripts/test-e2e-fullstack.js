try {
  // Make .env values available to this runner and Playwright specs (without printing them).
  require('dotenv/config');
} catch {
  // ignore
}

const { spawn, spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');
const { killPort, waitForPortOpen } = require('@nx/node/utils');
const { randomBytes } = require('crypto');

function normalizeEnvString(input) {
  if (typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed ? trimmed : undefined;
}

function generatePassword() {
  // base64url yields ASCII and works well for env passing.
  return randomBytes(18).toString('base64url');
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: opts.env ?? process.env,
  });

  if (typeof res.status !== 'number' || res.status !== 0) {
    const argsStr = args.map(String).join(' ');
    throw new Error(`Command failed (${res.status ?? 'unknown'}): ${cmd} ${argsStr}`);
  }
}

async function main() {
  const host = process.env.HOST || '127.0.0.1';
  const apiPort = process.env.PORT ? Number(process.env.PORT) : 3000;
  const dbPort = 5433;

  const adminEmailFromEnv = normalizeEnvString(process.env.ADMIN_EMAIL);
  const adminPasswordFromEnv = normalizeEnvString(process.env.ADMIN_PASSWORD);

  const hasValidEnvCreds =
    !!adminEmailFromEnv && !!adminPasswordFromEnv && adminPasswordFromEnv.length >= 8;

  const adminEmail = hasValidEnvCreds
    ? adminEmailFromEnv
    : `e2e-admin-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const adminPassword = hasValidEnvCreds ? adminPasswordFromEnv : generatePassword();

  if (!Number.isFinite(apiPort) || apiPort <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  // 1) DB (Docker)
  try {
    run('docker', ['compose', 'up', '-d', 'postgres']);
  } catch (err) {
    throw new Error(
      'Docker no esta disponible (necesitas Docker Desktop/daemon corriendo) para correr el fullstack e2e.\n' +
        'Tip: verifica que `docker version` muestre "Server" y que el contexto sea el correcto.\n' +
        `Detalle: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await waitForPortOpen(dbPort, { host, retries: 180, retryDelay: 1000 });

  // On Windows, killing port 3000 while docker-compose api is running can terminate
  // the Docker networking process. Stop app services so only postgres remains.
  try {
    run('docker', ['compose', 'stop', 'api', 'storefront', 'admin-dashboard']);
  } catch {
    // Best effort: if services are not running, continue.
  }

  // 2) Migrate + seed (uses DATABASE_URL from .env/env)
  run('npm', ['run', 'prisma:deploy']);
  run('npm', ['run', 'prisma:seed'], {
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword },
  });

  // 3) Build + start API
  run('npm', ['run', 'build:api']);
  const apiMain = resolve(process.cwd(), 'dist', 'api', 'main.js');
  if (!existsSync(apiMain)) {
    throw new Error(`Missing API build artifact at ${apiMain}`);
  }

  await killPort(apiPort);
  const apiProc = spawn('node', [apiMain], {
    env: { ...process.env, PORT: String(apiPort), HOST: host, NODE_ENV: process.env.NODE_ENV ?? 'development' },
    stdio: 'inherit',
    windowsHide: true,
  });

  let finished = false;
  const cleanup = async () => {
    if (finished) {
      return;
    }
    finished = true;

    try {
      apiProc.kill();
    } catch {
      // ignore
    }

    // Ensure port is closed even if process already exited.
    try {
      await killPort(apiPort);
    } catch {
      // ignore
    }
  };

  process.once('SIGINT', () => cleanup().finally(() => process.exit(130)));
  process.once('SIGTERM', () => cleanup().finally(() => process.exit(143)));
  process.once('exit', () => {
    // Best-effort cleanup (can't await here).
    try {
      apiProc.kill();
    } catch {
      // ignore
    }
  });

  try {
    await waitForPortOpen(apiPort, { host, retries: 120, retryDelay: 500 });

    const env = {
      ...process.env,
      GT_FULLSTACK_E2E: '1',
      // Keep Playwright stable if CI env var is set in the shell.
      CI: process.env.CI,
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
    };

    // 4) Run Playwright suites (storefront + admin). The specs are skipped unless GT_FULLSTACK_E2E=1.
    run('npx', ['playwright', 'test', '-c', 'storefront-e2e/playwright.config.ts', 'storefront-e2e/src/fullstack.spec.ts'], { env });
    run('npx', ['playwright', 'test', '-c', 'admin-dashboard-e2e/playwright.config.ts', 'admin-dashboard-e2e/src/fullstack.spec.ts'], { env });
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
