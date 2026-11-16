/**
 * L03.S3 — CI: code checks in .github/workflows/ci.yml (file contract, no Docker needed).
 * Contract: milestone L03.
 */
import { asList, readYaml } from '../../support/docker';

const CI_FILE = '.github/workflows/ci.yml';
const CHECK_JOBS = ['lint', 'typecheck', 'test', 'infra', 'gitleaks'];

type Step = { uses?: unknown; run?: unknown };
type Job = {
  name?: unknown;
  services?: Record<string, { image?: unknown }>;
  steps?: Step[];
};
type Trigger = { branches?: unknown; 'branches-ignore'?: unknown } | null;
type Workflow = { on?: unknown; jobs?: Record<string, Job> };

const workflow = readYaml<Workflow>(CI_FILE) ?? {};
const jobs = workflow.jobs ?? {};

/** `on:` in all three forms (string, list, map) → map of event → config. */
function triggers(): Record<string, Trigger> {
  const on = workflow.on;
  if (typeof on === 'string') return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((e) => [String(e), null]));
  if (on && typeof on === 'object') return on as Record<string, Trigger>;
  return {};
}

/** GitHub branch filter glob → RegExp (`*` within a segment, `**` across segments). */
function globToRegExp(glob: string): RegExp {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${re}$`);
}

/** Would a push to `branch` start this workflow? */
function pushTriggersOn(branch: string): boolean {
  const on = triggers();
  if (!('push' in on)) return false;
  const push = on.push ?? {};
  const include = asList(push.branches).map(String);
  const ignore = asList(push['branches-ignore']).map(String);
  if (include.length > 0) {
    let matched = false;
    for (const pattern of include) {
      if (pattern.startsWith('!')) {
        if (globToRegExp(pattern.slice(1)).test(branch)) matched = false;
      } else if (globToRegExp(pattern).test(branch)) matched = true;
    }
    return matched;
  }
  if (ignore.length > 0) return !ignore.some((p) => globToRegExp(p).test(branch));
  return true;
}

describe('L03.S3 ci.yml triggers', () => {
  it('runs on pull_request', () => {
    expect(Object.keys(triggers())).toContain('pull_request');
  });

  it('runs on push to main', () => {
    expect(pushTriggersOn('main')).toBe(true);
  });

  it('never runs for local-only solution branches (push to lesson-01-solution)', () => {
    expect(pushTriggersOn('main')).toBe(true);
    expect(pushTriggersOn('lesson-01-solution')).toBe(false);
  });

  it('does not run on push to feature branches (PRs cover them)', () => {
    expect(pushTriggersOn('main')).toBe(true);
    expect(pushTriggersOn('feat/03-docker-ci')).toBe(false);
  });
});

describe('L03.S3 ci.yml check jobs', () => {
  it.each(CHECK_JOBS)('has job "%s" whose check name is the job id', (id) => {
    expect(Object.keys(jobs)).toContain(id);
    // Required status checks (S4) match by name: a custom `name:` would rename the check.
    expect(jobs[id]?.name === undefined || jobs[id]?.name === id).toBe(true);
  });

  it('job "test" has a Postgres service container', () => {
    const images = Object.values(jobs.test?.services ?? {}).map((s) => String(s?.image ?? ''));
    expect(images.some((image) => /^postgres(:|$)/.test(image))).toBe(true);
  });

  it('every check job checks out the code', () => {
    const missing = CHECK_JOBS.filter(
      (id) =>
        !(jobs[id]?.steps ?? []).some((s) => String(s.uses ?? '').startsWith('actions/checkout@')),
    );
    expect(missing).toEqual([]);
  });

  it('jobs lint, typecheck, test and infra install dependencies with npm ci', () => {
    const missing = ['lint', 'typecheck', 'test', 'infra'].filter(
      (id) => !(jobs[id]?.steps ?? []).some((s) => /^\s*npm ci\b/.test(String(s.run ?? ''))),
    );
    expect(missing).toEqual([]);
  });
});
