/**
 * Машинерія курсу (setupFiles): готує оточення ДО імпорту будь-якого коду застосунку.
 *  1. Читає apps/api/.env.test; змінні, вже задані в оточенні (CI), не перезаписуються.
 *  2. Примусово ставить DATABASE_URL = DATABASE_URL_TEST — тести ніколи не працюють з dev/prod базою.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(__dirname, '../../.env.test');

if (!existsSync(envFile)) {
  throw new Error(`[course] не знайдено ${envFile} — це файл машинерії курсу, він має бути в репо`);
}

for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match || line.trimStart().startsWith('#')) continue;
  const [, key, rawValue] = match;
  if (process.env[key] === undefined) {
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    '[course] DATABASE_URL_TEST не задано (очікується в apps/api/.env.test або в оточенні)',
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
