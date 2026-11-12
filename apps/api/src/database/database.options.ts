import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

// Single source of DB options for both the Nest app and the TypeORM CLI/tests (no Nest DI there),
// so the two can't drift apart.
export function buildDatabaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // Schema changes go through migrations only.
    synchronize: false,
    // Makes TypeORM expect DEFAULT gen_random_uuid() (as in the migration) instead of
    // uuid_generate_v4(), so migration:generate sees no diff.
    // Side effect: on connect TypeORM runs CREATE EXTENSION IF NOT EXISTS "pgcrypto".
    uuidExtension: 'pgcrypto',
    // Globs relative to __dirname work for both TS sources (ts-node, ts-jest) and compiled dist.
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
