import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { buildDatabaseOptions } from './database.options';

/**
 * [FIX] Фіксована точка: default export `DataSource`.
 * Його імпортують напряму — без Nest, тож ConfigModule тут не працює:
 *  - TypeORM CLI (`typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`);
 *  - тестова інфраструктура (test/setup/global-setup.ts накочує міграції на db-test).
 * Тому env читаємо й валідуємо самі — тією ж функцією validateEnv, що й застосунок.
 */

// Аналог `ignoreEnvFile` з AppConfigModule: у тестах оточенням керують тести, .env не читаємо.
// npm run -w apps/api запускає скрипт з теки apps/api, тож '.env' — це apps/api/.env.
// loadEnvFile (вбудований у Node ≥ 20.12) НЕ перезаписує змінні, вже задані в оточенні.
if (process.env.APP_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Невалідне оточення → CLI падає одразу з назвою змінної (як і застосунок на старті).
const env = validateEnv(process.env);

export default new DataSource(buildDatabaseOptions(env.DATABASE_URL));
