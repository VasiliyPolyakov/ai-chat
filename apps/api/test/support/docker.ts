/**
 * Helpers for infra tests: docker/compose commands, free host ports, HTTP probes, image inspection.
 * Every command runs from the repository root.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export const REPO_ROOT = resolve(__dirname, '../../../..');

export interface ShResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Tail of stdout+stderr, so a failed assertion shows the reason, not only the exit code. */
  output: string;
}

export function sh(
  cmd: string,
  args: string[],
  options: { env?: Record<string, string | undefined>; timeoutMs?: number; input?: string } = {},
): ShResult {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const res = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    input: options.input,
    timeout: options.timeoutMs ?? 600_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = res.stdout ?? '';
  const stderr = `${res.stderr ?? ''}${res.error ? String(res.error) : ''}`;
  return { code: res.status ?? 1, stdout, stderr, output: `${stdout}${stderr}`.slice(-4_000) };
}

/** Unique, compose-safe project/tag suffix. */
export const randomId = (): string => randomBytes(3).toString('hex');

export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolvePort(port));
    });
  });
}

export interface HttpResult {
  status: number;
  contentType: string;
  body: string;
}

/** GET with a timeout; network errors become status 0 instead of throwing. */
export async function httpGet(url: string, timeoutMs = 5_000): Promise<HttpResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      body: await res.text(),
    };
  } catch (error) {
    return { status: 0, contentType: '', body: String(error) };
  }
}

// ------------------------------------------------------------------ images

export interface ImageInfo {
  user: string;
  sizeBytes: number;
}

export function inspectImage(image: string): ImageInfo | undefined {
  const res = sh('docker', ['image', 'inspect', '--format', '{{json .}}', image]);
  if (res.code !== 0) return undefined;
  const info = JSON.parse(res.stdout) as { Size: number; Config?: { User?: string } };
  return { user: info.Config?.User ?? '', sizeBytes: info.Size };
}

/** `USER` that is not root: name or uid, optionally with a group. */
export function isNonRootUser(user: string): boolean {
  const name = user.split(':')[0].trim();
  return name !== '' && name !== 'root' && name !== '0';
}

/** All file paths inside an image (via `docker create` + `docker export`), without leading slash. */
export function imageFiles(image: string): string[] {
  const created = sh('docker', ['create', image]);
  if (created.code !== 0) throw new Error(`docker create ${image} failed:\n${created.output}`);
  const id = created.stdout.trim();
  try {
    const listed = sh('sh', ['-c', `docker export ${id} | tar -t`]);
    if (listed.code !== 0) throw new Error(`docker export ${image} failed:\n${listed.output}`);
    return listed.stdout
      .split('\n')
      .map((p) => p.replace(/^\.?\//, ''))
      .filter(Boolean);
  } finally {
    sh('docker', ['rm', '-f', id]);
  }
}

// ------------------------------------------------------------------ compose / YAML files

export function readYaml<T>(relativePath: string): T | undefined {
  const file = resolve(REPO_ROOT, relativePath);
  if (!existsSync(file)) return undefined;
  return (parse(readFileSync(file, 'utf8'), { merge: true }) ?? undefined) as T | undefined;
}

export function readText(relativePath: string): string | undefined {
  const file = resolve(REPO_ROOT, relativePath);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

export function asList(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export class ComposeProject {
  constructor(
    readonly project: string,
    readonly file: string,
    readonly env: Record<string, string | undefined> = {},
  ) {}

  run(args: string[], timeoutMs = 900_000): ShResult {
    return sh('docker', ['compose', '-p', this.project, '-f', this.file, ...args], {
      env: this.env,
      timeoutMs,
    });
  }

  /** Always safe to call: removes containers, networks, volumes and locally built images. */
  down(): ShResult {
    return this.run(
      ['down', '-v', '--remove-orphans', '--rmi', 'local', '--timeout', '5'],
      300_000,
    );
  }
}
