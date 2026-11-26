/**
 * L03.S4 — CI: smoke job, image publishing to GHCR, CI parity.
 * File contract of .github/workflows/ci.yml + `node scripts/check-ci-parity.mjs`.
 * Contract: milestone L03.
 */
import { stringify } from 'yaml';
import { readYaml, sh } from '../../support/docker';

const CI_FILE = '.github/workflows/ci.yml';
const REQUIRED_CHECKS = ['lint', 'typecheck', 'test', 'infra', 'gitleaks', 'smoke'];

type Job = {
  name?: unknown;
  if?: unknown;
  needs?: unknown;
  permissions?: unknown;
  steps?: { uses?: unknown; run?: unknown; with?: unknown }[];
};
const workflow = readYaml<{ jobs?: Record<string, Job> }>(CI_FILE) ?? {};
const jobs = workflow.jobs ?? {};
const images = jobs.images;
const imagesText = images ? stringify(images) : '';

describe('L03.S4 smoke job', () => {
  it('has job "smoke" (check name = job id) that runs npm run test:smoke', () => {
    expect(Object.keys(jobs)).toContain('smoke');
    expect(jobs.smoke?.name === undefined || jobs.smoke?.name === 'smoke').toBe(true);
    const runs = (jobs.smoke?.steps ?? []).map((s) => String(s.run ?? ''));
    expect(runs.some((r) => /^\s*npm run test:smoke\s*$/m.test(r))).toBe(true);
  });
});

describe('L03.S4 images job', () => {
  it('exists', () => {
    expect(Object.keys(jobs)).toContain('images');
  });

  it('runs only for main (job-level if on refs/heads/main)', () => {
    expect(String(images?.if ?? '')).toMatch(/refs\/heads\/main/);
  });

  it('needs every check job, so a red check never publishes an image', () => {
    const needs = Array.isArray(images?.needs)
      ? images.needs.map(String)
      : [String(images?.needs ?? '')];
    expect(needs).toEqual(expect.arrayContaining(REQUIRED_CHECKS));
  });

  it('has permissions.packages: write', () => {
    expect(images?.permissions).toMatchObject({ packages: 'write' });
  });

  it('pushes to ghcr.io with a tag that contains github.sha', () => {
    expect(imagesText).toContain('ghcr.io');
    expect(imagesText).toMatch(/\$\{\{\s*github\.sha\s*\}\}/);
  });
});

describe('L03.S4 CI parity', () => {
  it('node scripts/check-ci-parity.mjs → exit 0', () => {
    const res = sh('node', ['scripts/check-ci-parity.mjs']);
    expect({ code: res.code, output: res.code === 0 ? '' : res.output }).toEqual({
      code: 0,
      output: '',
    });
  });
});
