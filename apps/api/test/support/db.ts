/**
 * Машинерія курсу: pg-клієнт на DATABASE_URL_TEST для SQL-перевірок стану БД.
 */
import { Client } from 'pg';

export const DB_TEST_UNAVAILABLE = 'db-test недоступна: запусти npm run db:up';

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('[course] DATABASE_URL_TEST не задано');
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
