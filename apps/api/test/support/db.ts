/**
 * pg-клієнт на DATABASE_URL_TEST для SQL-перевірок стану БД.
 */
import { Client } from 'pg';

export const DB_TEST_UNAVAILABLE = 'db-test недоступна: запусти npm run db:up';

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('[tooling] DATABASE_URL_TEST не задано');
  return url;
}

/**
 * Підключається до db-test. Повертає або клієнт, або текст причини недоступності
 * (щоб тест падав на assertion з підказкою, а не на необробленому ECONNREFUSED).
 */
export async function connectTestDb(): Promise<{ client?: Client; unavailable?: string }> {
  const client = new Client({
    connectionString: testDatabaseUrl(),
    connectionTimeoutMillis: 3_000,
  });
  try {
    await client.connect();
    return { client };
  } catch (error) {
    await client.end().catch(() => undefined);
    const err = error as NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] };
    const reason = err.code ?? err.errors?.[0]?.code ?? (err.message || 'unknown error');
    return { unavailable: `${DB_TEST_UNAVAILABLE} (${reason})` };
  }
}

export interface DisposableDb {
  name: string;
  url: string;
  drop(): Promise<void>;
}

/**
 * Створює порожню одноразову базу `chat_migr_<rand>_test` на сервері db-test
 * (для перевірок міграцій і revert, щоб не чіпати спільну chat_test).
 */
export async function createDisposableDb(): Promise<DisposableDb> {
  const base = new URL(testDatabaseUrl());
  const name = `chat_migr_${Math.random().toString(36).slice(2, 10)}_test`;

  const admin = new Client({ connectionString: base.toString(), connectionTimeoutMillis: 3_000 });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(base.toString());
  url.pathname = `/${name}`;

  return {
    name,
    url: url.toString(),
    async drop() {
      const client = new Client({ connectionString: base.toString() });
      await client.connect();
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}
