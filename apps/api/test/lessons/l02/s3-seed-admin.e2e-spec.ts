/**
 * L02.S3 — npm run seed:admin (дочірній процес) + SQL-перевірки в db-test.
 * Контракт етапу L02.
 */
import { Client } from 'pg';
import { runNpmScript } from '../../support/cli';
import { testDatabaseUrl } from '../../support/db';
import { resetDb } from '../../support/reset-db';

jest.setTimeout(120_000);

// Не секрет: тестове значення ≥ 20 символів (зібране з частин, щоб не нагадувати ключ для gitleaks).
const PASSWORD = ['long', 'enough', 'test', 'passphrase'].join('-');

type UserRow = { email: string; role: string; password_hash: string };

/** Усі рядки users; якщо таблиці ще немає — порожній список (щоб тест падав на assertion). */
async function users(): Promise<UserRow[]> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ t: string | null }>(
      "SELECT to_regclass('public.users')::text AS t",
    );
    if (rows[0].t === null) return [];
    const result = await client.query<UserRow>(
      'SELECT email, role::text AS role, password_hash FROM users',
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

describe('L02.S3 seed:admin', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('створює admin: email нормалізовано (trim + нижній регістр), role=admin, хеш argon2id', async () => {
    const result = runNpmScript('seed:admin', {
      ADMIN_EMAIL: '  Admin@Example.COM ',
      ADMIN_PASSWORD: PASSWORD,
    });
    expect(result).toMatchObject({ code: 0 });

    const rows = await users();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'admin@example.com', role: 'admin' });
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  it('повторний запуск ідемпотентний — у users один рядок', async () => {
    const env = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: PASSWORD };
    expect(runNpmScript('seed:admin', env)).toMatchObject({ code: 0 });
    expect(runNpmScript('seed:admin', env)).toMatchObject({ code: 0 });

    const rows = await users();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'admin@example.com', role: 'admin' });
  });

  it('пароль з 19 символів → exit ≠ 0, повідомлення називає ADMIN_PASSWORD, рядків немає', async () => {
    const result = runNpmScript('seed:admin', {
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'a'.repeat(19),
    });

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/ADMIN_PASSWORD/);
    expect(await users()).toHaveLength(0);
  });
});
