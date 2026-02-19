import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { killPort, waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;
var __API_SERVER__: ChildProcess | undefined;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Deterministic: if a prior server is still running, close it first.
  await killPort(port);

  const apiMain = resolve(process.cwd(), 'dist', 'api', 'main.js');
  if (!existsSync(apiMain)) {
    throw new Error(`Missing API build artifact at ${apiMain}. Run "nx build api" first.`);
  }

  // Start the API for e2e without Nx "serve" (avoids watch-mode restarts and flaky-task warnings).
  const child = spawn('node', [apiMain], {
    env: { ...process.env, HOST: host, PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true,
  });
  (globalThis as unknown as { __API_SERVER__?: ChildProcess }).__API_SERVER__ = child;

  await waitForPortOpen(port, { host });

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
