/**
 * L02.S2 — таблиця users і міграції (run → revert → run) на одноразовій базі chat_migr_<rand>_test.
 * Контракт етапу L02.
 */
import { Client } from 'pg';
import { runNpmScript } from '../../support/cli';
import { createDisposableDb, type DisposableDb } from '../../support/db';
import { createTestApp } from '../../support/create-app';
import { http } from '../../support/http';

jest.setTimeout(120_000);

async function usersTableExists(client: Client): Promise<boolean> {
  const { rows } = await client.query<{ t: string | null }>(
    "SELECT to_regclass('public.users')::text AS t",
  );
  return rows[0].t !== null;
}

function insertUser(client: Client, email: string, role?: string) {
  return role === undefined
    ? client.query<{ role: string }>(
        "INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), $1, 'x') RETURNING role::text AS role",
        [email],
      )
    : client.query<{ role: string }>(
        "INSERT INTO users (id, email, password_hash, role) VALUES (gen_random_uuid(), $1, 'x', $2) RETURNING role::text AS role",
        [email, role],
      );
}

describe('L02.S2 users і міграції', () => {
  let db: DisposableDb;
  let client: Client;

  beforeAll(async () => {
    db = await createDisposableDb();
    client = new Client({ connectionString: db.url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
    await db?.drop();
  });

  it('npm run migration:run → таблиця users з колонками id (uuid), email, password_hash, role, created_at, updated_at', async () => {
    const result = runNpmScript('migration:run', { DATABASE_URL: db.url });
    expect(result).toMatchObject({ code: 0 });

    const { rows } = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    const columns = Object.fromEntries(rows.map((r) => [r.column_name, r.data_type]));

    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining(['id', 'email', 'password_hash', 'role', 'created_at', 'updated_at']),
    );
    expect(columns.id).toBe('uuid');
    expect(columns.created_at).toMatch(/^timestamp/);
    expect(columns.updated_at).toMatch(/^timestamp/);
  });

  it("role за замовчуванням 'user'; допустимі лише 'admin' і 'user'", async () => {
    const created = await insertUser(client, 'role-default@example.com');
    expect(created.rows[0].role).toBe('user');

    const admin = await insertUser(client, 'role-admin@example.com', 'admin');
    expect(admin.rows[0].role).toBe('admin');

    await expect(insertUser(client, 'role-bad@example.com', 'owner')).rejects.toThrow();
  });

  it('email унікальний без урахування регістру (unique violation 23505)', async () => {
    await insertUser(client, 'Case@Example.com');

    await expect(insertUser(client, 'case@EXAMPLE.com')).rejects.toMatchObject({ code: '23505' });
  });

  it('npm run migration:revert → таблиці users немає', async () => {
    const result = runNpmScript('migration:revert', { DATABASE_URL: db.url });
    expect(result).toMatchObject({ code: 0 });

    expect(await usersTableExists(client)).toBe(false);
  });

  it('повторний npm run migration:run → таблиця users знову є', async () => {
    const result = runNpmScript('migration:run', { DATABASE_URL: db.url });
    expect(result).toMatchObject({ code: 0 });

    expect(await usersTableExists(client)).toBe(true);
  });

  it('[guard] застосунок на порожній базі не створює таблиць (synchronize вимкнено)', async () => {
    const empty = await createDisposableDb();
    const emptyClient = new Client({ connectionString: empty.url });
    try {
      const app = await createTestApp({ DATABASE_URL: empty.url });
      try {
        const res = await http(app, 'GET', '/api/health');
        expect(res.status).toBe(200);
      } finally {
        await app.close();
      }

      await emptyClient.connect();
      const { rows } = await emptyClient.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'",
      );
      expect(rows[0].n).toBe(0);
    } finally {
      await emptyClient.end().catch(() => undefined);
      await empty.drop();
    }
  });
});
