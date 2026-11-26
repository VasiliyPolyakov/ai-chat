#!/usr/bin/env node
// CI parity: .github/workflows/ci.yml and `npm run lesson:check -- N --full` run the same checks.
//
// Single source of truth: every check is a root npm script. In check jobs (all jobs except the
// publication jobs below) every `run:` line must be `npm ci` or `npm run <script>` — no inline
// commands such as `npx eslint .`. The set of scripts used by check jobs must equal CI_CHECK_SCRIPTS.
// Setup steps (`uses:` actions, services, env) are free-form.
//
//   node scripts/check-ci-parity.mjs [path/to/ci.yml]   → exit 0 when in parity, 1 otherwise

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The checks CI must run; `lesson:check --full` runs (or covers) the same set. */
export const CI_CHECK_SCRIPTS = [
  'lint',
  'typecheck',
  'test',
  'test:infra',
  'secrets:scan',
  'test:smoke',
];

/** Jobs that publish or deploy rather than check: no parity rules for them. */
export const PUBLISH_JOBS = new Set(['images', 'deploy']);

const RUN_LINE = /^npm (?:ci|run ([A-Za-z0-9:._-]+))$/;

export function checkParity(ciFile = join(ROOT, '.github/workflows/ci.yml')) {
  const errors = [];
  if (!existsSync(ciFile)) return { ok: false, errors: [`${ciFile} not found`], scripts: [] };

  let workflow;
  try {
    workflow = parse(readFileSync(ciFile, 'utf8'), { merge: true }) ?? {};
  } catch (error) {
    return { ok: false, errors: [`cannot parse ci.yml: ${error.message}`], scripts: [] };
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const rootScripts = new Set(Object.keys(pkg.scripts ?? {}));
  const used = new Set();

  for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
    if (PUBLISH_JOBS.has(jobId)) continue;
    (job?.steps ?? []).forEach((step, index) => {
      if (step?.run === undefined) return;
      const where = `jobs.${jobId}.steps[${index}]${step.name ? ` (${step.name})` : ''}`;
      const lines = String(step.run)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      for (const line of lines) {
        const m = RUN_LINE.exec(line);
        if (!m) {
          errors.push(
            `${where}: "${line}" — check jobs may only run "npm ci" or "npm run <script>"`,
          );
          continue;
        }
        if (!m[1]) continue;
        if (!rootScripts.has(m[1]))
          errors.push(`${where}: script "${m[1]}" is not in the root package.json`);
        used.add(m[1]);
      }
    });
  }

  const missing = CI_CHECK_SCRIPTS.filter((s) => !used.has(s));
  const extra = [...used].filter((s) => !CI_CHECK_SCRIPTS.includes(s));
  if (missing.length > 0)
    errors.push(`check jobs never run: ${missing.map((s) => `npm run ${s}`).join(', ')}`);
  if (extra.length > 0) {
    errors.push(
      `check jobs run scripts that lesson:check --full does not: ${extra.join(', ')} (expected set: ${CI_CHECK_SCRIPTS.join(', ')})`,
    );
  }
  return { ok: errors.length === 0, errors, scripts: [...used].sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkParity(process.argv[2]);
  if (result.ok) {
    console.log(`check-ci-parity: ok (${result.scripts.join(', ')})`);
  } else {
    console.error('check-ci-parity: FAIL');
    for (const e of result.errors) console.error(`  - ${e}`);
  }
  process.exit(result.ok ? 0 : 1);
}
