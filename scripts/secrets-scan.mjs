#!/usr/bin/env node
// Secret scan of the git history with gitleaks.
//
//   npm run secrets:scan
//
// Uses a locally installed gitleaks when available, otherwise the pinned official Docker image,
// so the same command works on a laptop and on a CI runner. Findings are redacted in the output.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMAGE = 'ghcr.io/gitleaks/gitleaks:v8.30.1';
const ARGS = ['git', '--redact', '--no-banner', '--exit-code', '1'];

const local = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
let res;
if (local.status === 0) {
  res = spawnSync('gitleaks', [...ARGS, '.'], { cwd: ROOT, stdio: 'inherit' });
} else {
  console.log(`gitleaks is not installed — using ${IMAGE}`);
  res = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${ROOT}:/repo:ro`,
      // The mounted repo is owned by another uid inside the container: let git read it.
      '-e',
      'GIT_CONFIG_COUNT=1',
      '-e',
      'GIT_CONFIG_KEY_0=safe.directory',
      '-e',
      'GIT_CONFIG_VALUE_0=*',
      IMAGE,
      ...ARGS,
      '/repo',
    ],
    { stdio: 'inherit' },
  );
}
process.exit(res.status ?? 1);
