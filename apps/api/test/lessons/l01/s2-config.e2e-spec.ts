/**
 * L01.S2 — Конфігурація з валідацією (fail-fast на старті).
 * Контракт: course/lesson-01/README.md, розділ «Контракт».
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestApp, startupError } from '../../support/create-app';
import { http } from '../../support/http';

/** Значення з кореневого .env.example (DATABASE_URL лишається тестовим — тести не ходять у dev-базу). */
function envExample(): Record<string, string> {
  const file = resolve(__dirname, '../../../../../.env.example');
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trimStart().startsWith('#')) values[match[1]] = match[2];
  }
  return values;
}

describe('L01.S2 config', () => {
  it('без DATABASE_URL старт відхилено, і в повідомленні є назва змінної', async () => {
    const error = await startupError({ DATABASE_URL: undefined });

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/DATABASE_URL/);
  });

  it('PORT=abc → старт відхилено', async () => {
    const error = await startupError({ PORT: 'abc' });

    expect(error).toBeInstanceOf(Error);
  });

  it('APP_ENV=staging (не з переліку development|test|ci|production) → старт відхилено', async () => {
    const error = await startupError({ APP_ENV: 'staging' });

    expect(error).toBeInstanceOf(Error);
  });

  it('значення з .env.example → старт успішний', async () => {
    const example = envExample();
    expect(Object.keys(example)).toEqual(
      expect.arrayContaining(['APP_ENV', 'PORT', 'APP_VERSION', 'DATABASE_URL']),
    );

    const error = await startupError({ ...example, DATABASE_URL: process.env.DATABASE_URL });

    expect(error).toBeUndefined();
  });

  it('APP_VERSION=1.2.3 видно в /api/health', async () => {
    const app = await createTestApp({ APP_VERSION: '1.2.3' });
    try {
      const res = await http(app, 'GET', '/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ version: '1.2.3' });
    } finally {
      await app.close();
    }
  });
});
