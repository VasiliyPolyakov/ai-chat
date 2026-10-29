/**
 * Очищає дані в db-test між тестами (схема і таблиця міграцій лишаються).
 * Перед TRUNCATE — db-guard: лише база з суфіксом `_test`.
 */
import { Client } from 'pg';
import { assertTestDatabase } from '../setup/db-guard';
import { testDatabaseUrl } from './db';

export async function resetDb(): Promise<void> {
  const url = testDatabaseUrl();
  await assertTestDatabase(url);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT quote_ident(tablename) AS name FROM pg_tables
        WHERE schemaname = 'public' AND tablename NOT ILIKE '%migrations%'`,
    );
    if (rows.length > 0) {
      await client.query(`TRUNCATE ${rows.map((r) => r.name).join(', ')} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
}
