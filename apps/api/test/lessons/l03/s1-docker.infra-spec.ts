/**
 * L03.S1 — Docker images for api and web.
 * Both images are built from the repository root:
 *   docker build -f apps/api/Dockerfile .
 *   docker build -f apps/web/Dockerfile .
 * Contract: milestone L03.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REPO_ROOT,
  imageFiles,
  inspectImage,
  isNonRootUser,
  randomId,
  sh,
  type ShResult,
} from '../../support/docker';

const MAX_API_IMAGE_BYTES = 400 * 1024 * 1024;

// Probe files that mimic local secrets: they must never end up in an image.
const PROBES = ['.env.l03-probe', 'apps/api/.env.l03-probe', 'apps/web/.env.l03-probe'];

const id = randomId();
const API_IMAGE = `chat-it-api:${id}`;
const WEB_IMAGE = `chat-it-web:${id}`;

let apiBuild: ShResult;
let webBuild: ShResult;
let apiFiles: string[] = [];
let webFiles: string[] = [];

beforeAll(() => {
  for (const probe of PROBES) writeFileSync(resolve(REPO_ROOT, probe), 'LEAK=l03-probe\n');
  try {
    apiBuild = sh('docker', ['build', '-f', 'apps/api/Dockerfile', '-t', API_IMAGE, '.']);
    webBuild = sh('docker', ['build', '-f', 'apps/web/Dockerfile', '-t', WEB_IMAGE, '.']);
  } finally {
    for (const probe of PROBES) rmSync(resolve(REPO_ROOT, probe), { force: true });
  }
  if (apiBuild.code === 0) apiFiles = imageFiles(API_IMAGE);
  if (webBuild.code === 0) webFiles = imageFiles(WEB_IMAGE);
}, 1_200_000);

afterAll(() => {
  sh('docker', ['image', 'rm', '-f', API_IMAGE, WEB_IMAGE]);
});

/** Files outside node_modules — the app's own payload. */
const ownFiles = (files: string[]) => files.filter((f) => !f.split('/').includes('node_modules'));
const basename = (f: string) => f.replace(/\/$/, '').split('/').at(-1) ?? '';

describe('L03.S1 api image', () => {
  it('builds from the repository root with apps/api/Dockerfile', () => {
    expect({ code: apiBuild.code, output: apiBuild.code === 0 ? '' : apiBuild.output }).toEqual({
      code: 0,
      output: '',
    });
  });

  it('runs as a non-root user', () => {
    const user = inspectImage(API_IMAGE)?.user ?? '';
    expect({ user, nonRoot: isNonRootUser(user) }).toEqual({ user, nonRoot: true });
  });

  it('is smaller than 400 MB', () => {
    const size = inspectImage(API_IMAGE)?.sizeBytes ?? Number.POSITIVE_INFINITY;
    expect(size).toBeLessThan(MAX_API_IMAGE_BYTES);
  });

  it('contains compiled JS (dist/main.js), but no TypeScript sources', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
    expect(apiFiles.some((f) => /(^|\/)dist\/main\.js$/.test(f))).toBe(true);
    const tsSources = ownFiles(apiFiles).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    expect(tsSources).toEqual([]);
  });

  it('has production dependencies only (no jest, ts-jest, typescript, @nestjs/cli)', () => {
    expect(apiFiles.some((f) => f.endsWith('node_modules/@nestjs/core/package.json'))).toBe(true);
    const devPackages = ['jest', 'ts-jest', 'typescript', '@nestjs/cli'].filter((pkg) =>
      apiFiles.some((f) => f.endsWith(`node_modules/${pkg}/package.json`)),
    );
    expect(devPackages).toEqual([]);
  });

  it('contains no .env files', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
    expect(ownFiles(apiFiles).filter((f) => basename(f).startsWith('.env'))).toEqual([]);
  });
});

describe('L03.S1 web image', () => {
  it('builds from the repository root with apps/web/Dockerfile', () => {
    expect({ code: webBuild.code, output: webBuild.code === 0 ? '' : webBuild.output }).toEqual({
      code: 0,
      output: '',
    });
  });

  it('runs as a non-root user', () => {
    const user = inspectImage(WEB_IMAGE)?.user ?? '';
    expect({ user, nonRoot: isNonRootUser(user) }).toEqual({ user, nonRoot: true });
  });

  it('serves the built SPA from /srv (srv/index.html exists, no sources)', () => {
    expect(webFiles).toContain('srv/index.html');
    const sources = webFiles.filter((f) => f.startsWith('srv/') && /\.(tsx?|map)$/.test(f));
    expect(sources).toEqual([]);
  });

  it('contains no .env files', () => {
    expect(webFiles.length).toBeGreaterThan(0);
    expect(webFiles.filter((f) => basename(f).startsWith('.env'))).toEqual([]);
  });
});
