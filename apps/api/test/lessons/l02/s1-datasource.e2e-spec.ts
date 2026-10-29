/**
 * L02.S1 — DataSource, скрипти міграцій і перевірка БД у health.
 * Контракт етапу L02.
 */
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import dataSource from '../../../src/database/data-source';
import { assertTestDatabase } from '../../setup/db-guard';
import { runNpmScript } from '../../support/cli';
import { testDatabaseUrl } from '../../support/db';
import { createTestApp } from '../../support/create-app';
import { http } from '../../support/http';

jest.setTimeout(120_000);

describe('L02.S1 DataSource і health БД', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health → checks.db.status = "up"', async () => {
    const res = await http(app, 'GET', '/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', checks: { db: { status: 'up' } } });
  });

  it('npm run migration:run (з кореня репо) на db-test → exit 0', () => {
    const result = runNpmScript('migration:run');

    expect(result).toMatchObject({ code: 0 });
  });

  it('[FIX] src/database/data-source.ts: default export — DataSource для postgres, synchronize вимкнено', () => {
    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.options.type).toBe('postgres');
    expect(dataSource.options.synchronize ?? false).toBe(false);
  });

  it('[guard] db-guard відмовляє на базі без суфікса _test', async () => {
    const url = new URL(testDatabaseUrl());
    url.pathname = '/postgres';

    await expect(assertTestDatabase(url.toString())).rejects.toThrow(/_test/);
  });
});
