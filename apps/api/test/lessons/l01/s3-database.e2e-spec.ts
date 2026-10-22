/**
 * L01.S3 — Postgres у Compose.
 * Дві групи перевірок:
 *  1. файловий контракт infra/compose.dev.yml (розбір YAML, без Docker);
 *  2. SQL-перевірки живого db-test (через DATABASE_URL_TEST).
 * Контракт: course/lesson-01/README.md, розділ «Контракт».
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Client } from 'pg';
import { parse } from 'yaml';
import { connectTestDb } from '../../support/db';

const COMPOSE_FILE = resolve(__dirname, '../../../../../infra/compose.dev.yml');
const PG_DATA = '/var/lib/postgresql/data';

type Service = {
  image?: unknown;
  ports?: unknown;
  environment?: unknown;
  volumes?: unknown;
  tmpfs?: unknown;
  healthcheck?: { test?: unknown };
};
type ComposeFile = { name?: unknown; services?: Record<string, Service>; volumes?: unknown };

function loadCompose(): ComposeFile {
  if (!existsSync(COMPOSE_FILE)) return {};
  return (parse(readFileSync(COMPOSE_FILE, 'utf8')) ?? {}) as ComposeFile;
}

function asList(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Порти сервісу як пари "published->target" (коротка і довга форми Compose). */
function publishedPorts(service: Service | undefined): string[] {
  return asList(service?.ports).map((entry) => {
    if (typeof entry === 'object' && entry !== null) {
      const { published, target } = entry as { published?: unknown; target?: unknown };
      return `${String(published)}->${String(target)}`;
    }
    const parts = String(entry)
      .replace(/\/(tcp|udp)$/, '')
      .split(':');
    const target = parts.at(-1);
    const published = parts.length > 1 ? parts.at(-2) : undefined;
    return `${String(published)}->${String(target)}`;
  });
}

/** Змінні оточення сервісу (map або list-форма). */
function environment(service: Service | undefined): Record<string, string> {
  const env = service?.environment;
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((item) => {
        const [key, ...rest] = String(item).split('=');
        return [key, rest.join('=')];
      }),
    );
  }
  if (env && typeof env === 'object') {
    return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, String(v)]));
  }
  return {};
}

/** Точки монтування: [{type, source, target}] з коротких і довгих форм volumes + tmpfs. */
function mounts(service: Service | undefined): { type: string; source?: string; target: string }[] {
  const fromVolumes = asList(service?.volumes).map((entry) => {
    if (typeof entry === 'object' && entry !== null) {
      const v = entry as { type?: string; source?: string; target?: string };
      return { type: v.type ?? 'volume', source: v.source, target: String(v.target) };
    }
    const [source, target] = String(entry).split(':');
    return { type: target ? 'volume' : 'anonymous', source, target: target ?? source };
  });
  const fromTmpfs = asList(service?.tmpfs).map((entry) => ({
    type: 'tmpfs',
    target: String(entry).split(':')[0],
  }));
  return [...fromVolumes, ...fromTmpfs];
}

describe('L01.S3 infra/compose.dev.yml (файловий контракт)', () => {
  const compose = loadCompose();
  const db = compose.services?.db;
  const dbTest = compose.services?.['db-test'];

  it('файл infra/compose.dev.yml існує', () => {
    expect(existsSync(COMPOSE_FILE)).toBe(true);
  });

  it('name: chat-dev', () => {
    expect(compose.name).toBe('chat-dev');
  });

  it('є сервіси db і db-test на образі postgres:17*', () => {
    expect(Object.keys(compose.services ?? {})).toEqual(expect.arrayContaining(['db', 'db-test']));
    expect(String(db?.image)).toMatch(/^postgres:17/);
    expect(String(dbTest?.image)).toMatch(/^postgres:17/);
  });

  it('db-test публікує порт 5433 → 5432 і створює БД chat_test', () => {
    expect(publishedPorts(dbTest)).toContain('5433->5432');
    expect(environment(dbTest)).toMatchObject({ POSTGRES_DB: 'chat_test' });
  });

  it(`db-test тримає дані на tmpfs (${PG_DATA})`, () => {
    expect(mounts(dbTest)).toContainEqual(
      expect.objectContaining({ type: 'tmpfs', target: PG_DATA }),
    );
  });

  it(`db тримає дані в іменованому volume (${PG_DATA})`, () => {
    const dataMount = mounts(db).find((m) => m.target === PG_DATA);
    expect(dataMount).toMatchObject({ type: 'volume' });
    expect(Object.keys((compose.volumes as Record<string, unknown> | undefined) ?? {})).toContain(
      dataMount?.source,
    );
  });

  it('db і db-test мають healthcheck (потрібен для `up --wait`)', () => {
    expect(db?.healthcheck?.test).toBeDefined();
    expect(dbTest?.healthcheck?.test).toBeDefined();
  });
});

describe('L01.S3 db-test (SQL)', () => {
  let client: Client | undefined;
  let reachability = 'ok';

  beforeAll(async () => {
    const result = await connectTestDb();
    client = result.client;
    if (result.unavailable) reachability = result.unavailable;
  });

  afterAll(async () => {
    await client?.end();
  });

  it('db-test доступна за DATABASE_URL_TEST', () => {
    expect(reachability).toBe('ok');
  });

  it('Postgres версії 17+ (server_version_num >= 170000)', async () => {
    expect(reachability).toBe('ok');
    const { rows } = await client!.query<{ v: number }>(
      "SELECT current_setting('server_version_num')::int AS v",
    );
    expect(rows[0].v).toBeGreaterThanOrEqual(170000);
  });

  it("current_database() = 'chat_test'", async () => {
    expect(reachability).toBe('ok');
    const { rows } = await client!.query<{ db: string }>('SELECT current_database() AS db');
    expect(rows[0].db).toBe('chat_test');
  });
});
