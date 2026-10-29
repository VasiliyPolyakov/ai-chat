/**
 * Запобіжник від роботи тестів з нетестовою базою.
 * Перед міграціями (global-setup) і перед TRUNCATE (reset-db) перевіряє, що current_database()
 * закінчується на `_test`. Інакше — помилка до будь-якої зміни даних.
 */
import { Client } from 'pg';

export const DB_TEST_UNAVAILABLE_HINT = 'db-test недоступна: запусти npm run db:up';

export async function assertTestDatabase(url: string | undefined): Promise<void> {
  if (!url) throw new Error('[tooling] db-guard: URL бази не задано');

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => undefined);
    const err = error as NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] };
    const reason = err.code ?? err.errors?.[0]?.code ?? (err.message || 'unknown error');
    throw new Error(`${DB_TEST_UNAVAILABLE_HINT} (${reason})`, { cause: error });
  }

  try {
    const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
    const name = rows[0].db;
    if (!name.endsWith('_test')) {
      throw new Error(
        `[tooling] db-guard: тести працюють лише з базою, назва якої закінчується на _test (зараз: ${name})`,
      );
    }
  } finally {
    await client.end();
  }
}
