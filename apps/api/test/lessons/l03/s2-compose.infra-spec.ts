/**
 * L03.S2 — local production-like stack: infra/compose.yml + infra/Caddyfile.
 * Canonical start:
 *   docker compose -f infra/compose.yml run --rm migrate
 *   docker compose -f infra/compose.yml up -d --wait api web
 * The live part runs under an isolated project `chat-it-<rand>` with a random WEB_HOST_PORT
 * and removes everything (containers, volumes, built images) afterwards.
 * Contract: milestone L03.
 */
import {
  ComposeProject,
  asList,
  freePort,
  httpGet,
  randomId,
  readText,
  readYaml,
  type HttpResult,
  type ShResult,
} from '../../support/docker';

const COMPOSE_FILE = 'infra/compose.yml';

type Service = {
  image?: unknown;
  build?: unknown;
  ports?: unknown;
  restart?: unknown;
  depends_on?: unknown;
};
type ComposeFile = { name?: unknown; services?: Record<string, Service> };

const compose = readYaml<ComposeFile>(COMPOSE_FILE) ?? {};
const services = compose.services ?? {};

/** depends_on in both forms → { service: condition }. */
function dependsOn(service: Service | undefined): Record<string, string> {
  const deps = service?.depends_on;
  if (Array.isArray(deps))
    return Object.fromEntries(deps.map((d) => [String(d), 'service_started']));
  if (deps && typeof deps === 'object') {
    return Object.fromEntries(
      Object.entries(deps as Record<string, { condition?: string }>).map(([k, v]) => [
        k,
        v?.condition ?? 'service_started',
      ]),
    );
  }
  return {};
}

describe('L03.S2 infra/compose.yml (file contract)', () => {
  it('has project name chat-stack and services db, migrate, api, web', () => {
    expect(compose.name).toBe('chat-stack');
    expect(Object.keys(services)).toEqual(expect.arrayContaining(['db', 'migrate', 'api', 'web']));
  });

  it('migrate is a one-off job: restart "no" (or unset)', () => {
    expect(services.migrate).toBeDefined();
    const restart = services.migrate?.restart;
    expect(restart === undefined || restart === 'no' || restart === false).toBe(true);
  });

  it('api waits for migrate to complete successfully', () => {
    expect(dependsOn(services.api)).toMatchObject({ migrate: 'service_completed_successfully' });
  });

  it('api publishes no host ports', () => {
    expect(services.api).toBeDefined();
    expect(asList(services.api?.ports)).toEqual([]);
  });

  it('web publishes its host port from WEB_HOST_PORT (default 8080)', () => {
    const ports = asList(services.web?.ports).map((p) => JSON.stringify(p));
    expect(ports.some((p) => p.includes('WEB_HOST_PORT'))).toBe(true);
  });
});

describe('L03.S2 infra/Caddyfile (file contract)', () => {
  const caddyfile = readText('infra/Caddyfile') ?? '';

  it('proxies to api:3000 with flush_interval -1 (needed for SSE later)', () => {
    expect(caddyfile).toMatch(/reverse_proxy[^\n]*\bapi:3000\b/);
    expect(caddyfile).toMatch(/flush_interval\s+-1/);
  });
});

describe('L03.S2 live stack', () => {
  let stack: ComposeProject;
  let port: number;
  let migrate: ShResult;
  let migrateAgain: ShResult;
  let up: ShResult;

  beforeAll(async () => {
    port = await freePort();
    stack = new ComposeProject(`chat-it-${randomId()}`, COMPOSE_FILE, {
      WEB_HOST_PORT: String(port),
    });
    migrate = stack.run(['run', '--rm', '--build', 'migrate']);
    migrateAgain = stack.run(['run', '--rm', 'migrate']);
    up = stack.run(['up', '-d', '--build', '--wait', '--wait-timeout', '180', 'api', 'web']);
  }, 1_500_000);

  afterAll(() => {
    stack?.down();
  }, 300_000);

  const get = (path: string): Promise<HttpResult> => httpGet(`http://127.0.0.1:${port}${path}`);

  it('migrate exits 0, and again on a second run (idempotent)', () => {
    expect({ code: migrate.code, output: migrate.code === 0 ? '' : migrate.output }).toEqual({
      code: 0,
      output: '',
    });
    expect({
      code: migrateAgain.code,
      output: migrateAgain.code === 0 ? '' : migrateAgain.output,
    }).toEqual({ code: 0, output: '' });
  });

  it('up -d --wait api web succeeds', () => {
    expect({ code: up.code, output: up.code === 0 ? '' : up.output }).toEqual({
      code: 0,
      output: '',
    });
  });

  it('GET /api/health through Caddy → 200 with db up', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body || '{}')).toMatchObject({
      status: 'ok',
      checks: { db: { status: 'up' } },
    });
  });

  it('GET / → the SPA (index.html)', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/text\/html/);
    expect(res.body).toContain('id="root"');
  });

  it('GET /some/route → index.html (SPA fallback)', async () => {
    const res = await get('/some/route');
    expect(res.status).toBe(200);
    expect(res.body).toContain('id="root"');
  });

  it('GET /api/unknown → API 404 JSON, not the SPA', async () => {
    const res = await get('/api/unknown-l03');
    expect(res.status).toBe(404);
    expect(res.contentType).toMatch(/application\/json/);
  });

  it('api is not reachable from the host directly', () => {
    expect(up.code).toBe(0);
    const published = stack.run(['port', 'api', '3000']);
    // Compose prints `:0` (or fails) for an unpublished port; only a real host port counts.
    const mapped = published.code === 0 && /:[1-9]\d*\s*$/m.test(published.stdout);
    expect(mapped).toBe(false);
  });
});
