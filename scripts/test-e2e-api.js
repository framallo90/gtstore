try {
  // Make .env values available to this runner (without printing them).
  require('dotenv/config');
} catch {
  // ignore
}

const { spawnSync } = require('child_process');
const { killPort } = require('@nx/node/utils');
const net = require('net');

function parseDbTarget(databaseUrl) {
  if (typeof databaseUrl !== 'string') {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);
    const host = url.hostname || '127.0.0.1';
    const port = url.port ? Number(url.port) : 5432;
    if (!Number.isFinite(port) || port <= 0) {
      return { host, port: 5432 };
    }
    return { host, port };
  } catch {
    return undefined;
  }
}

function canConnectTcp(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });

    const done = (ok) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(timeoutMs, () => done(false));
  });
}

async function main() {
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT || '3001';

  const dbTarget = parseDbTarget(process.env.DATABASE_URL);
  if (!dbTarget) {
    // eslint-disable-next-line no-console
    console.error('[api-e2e] DATABASE_URL no esta configurada. Completa tu .env antes de correr e2e.');
    process.exit(1);
  }

  const dbOk = await canConnectTcp(dbTarget.host, dbTarget.port);
  if (!dbOk) {
    // eslint-disable-next-line no-console
    console.error(`[api-e2e] No puedo conectar a Postgres en ${dbTarget.host}:${dbTarget.port}.`);
    // eslint-disable-next-line no-console
    console.error('[api-e2e] Levanta la DB antes de correr e2e. Con Docker:');
    // eslint-disable-next-line no-console
    console.error('  docker compose up -d postgres');
    // eslint-disable-next-line no-console
    console.error('  npm run prisma:deploy');
    process.exit(1);
  }

  // Make the run deterministic even if another dev server/test server is already using the port.
  await killPort(Number(port));

  const env = { ...process.env, HOST: host, PORT: String(port) };
  const args = ['nx', 'e2e', 'api-e2e', ...process.argv.slice(2)];

  const res = spawnSync('npx', args, { stdio: 'inherit', shell: true, env });
  process.exit(typeof res.status === 'number' ? res.status : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
