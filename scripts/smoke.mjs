#!/usr/bin/env node
// Smoke test of the production-like stack (infra/compose.yml) with Playwright.
//
//   npm run test:smoke
//
// 1. Builds and starts the stack under an isolated compose project (default `chat-smoke`) on a free
//    host port, with APP_ENV=ci and REGISTRATION_ENABLED=true:
//      docker compose run --rm --build migrate && docker compose up -d --build --wait api web
// 2. Runs apps/web/e2e/*.e2e.ts against it (SMOKE_BASE_URL).
// 3. Always tears the stack down (containers, networks, volumes).
// Env: SMOKE_PROJECT (compose project name), SMOKE_KEEP=1 (leave the stack running for debugging).

import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COMPOSE_FILE = join(ROOT, 'infra/compose.yml');
const project = process.env.SMOKE_PROJECT || 'chat-smoke';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(cmd, args, env) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return res.status ?? 1;
}

const port = await freePort();
const stackEnv = { WEB_HOST_PORT: String(port), APP_ENV: 'ci', REGISTRATION_ENABLED: 'true' };
const compose = (...args) =>
  run('docker', ['compose', '-p', project, '-f', COMPOSE_FILE, ...args], stackEnv);

let code;
try {
  code = compose('run', '--rm', '--build', 'migrate');
  if (code === 0)
    code = compose('up', '-d', '--build', '--wait', '--wait-timeout', '180', 'api', 'web');
  if (code === 0) {
    // Browsers: on CI runners also the system libraries (Linux); locally only the browser.
    const install = ['playwright', 'install', 'chromium'];
    if (process.env.CI) install.push('--with-deps');
    code = run('npx', ['--workspace', 'apps/web', ...install]);
  }
  if (code === 0) {
    code = run('npx', ['--workspace', 'apps/web', 'playwright', 'test'], {
      SMOKE_BASE_URL: `http://127.0.0.1:${port}`,
    });
  }
  if (code !== 0) compose('logs', '--no-color', '--tail', '100');
} finally {
  if (process.env.SMOKE_KEEP === '1') {
    console.log(
      `\nSMOKE_KEEP=1: stack left running at http://127.0.0.1:${port} (project ${project})`,
    );
  } else {
    compose('down', '-v', '--remove-orphans', '--timeout', '5');
  }
}
process.exit(code ?? 1);
