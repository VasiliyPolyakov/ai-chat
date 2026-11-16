import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { buildDatabaseOptions } from './database.options';

/**
 * [FIX] Fixed entry point: default export `DataSource`.
 * Imported directly, without Nest, so ConfigModule isn't available here:
 *  - TypeORM CLI (`typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`);
 *  - test setup (test/setup/global-setup.ts runs migrations on db-test).
 * So the env is loaded and validated here with the same validateEnv as the app.
 */

// Mirrors `ignoreEnvFile` in AppConfigModule: tests own their environment.
// Scripts run from apps/api, so '.env' is apps/api/.env.
// loadEnvFile never overrides variables already set in the environment.
if (process.env.APP_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Invalid env → the CLI fails immediately, naming the variable (same as app startup).
const env = validateEnv(process.env);

export default new DataSource(buildDatabaseOptions(env.DATABASE_URL));
