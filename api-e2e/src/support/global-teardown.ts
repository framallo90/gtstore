import type { ChildProcess } from 'child_process';
import { killPort } from '@nx/node/utils';
/* eslint-disable */

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  const child = (globalThis as unknown as { __API_SERVER__?: ChildProcess }).__API_SERVER__;
  if (child) {
    // Best-effort graceful shutdown.
    try {
      child.kill();
    } catch {
      // ignore
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      }, 5000);

      child.once('exit', () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      });
    });
  }

  // Ensure port is closed even if the process was already gone.
  await killPort(port);
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
