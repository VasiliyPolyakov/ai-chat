import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Спільні налаштування підключення для двох «світів»:
 *  - застосунок Nest (DatabaseModule через TypeOrmModule.forRootAsync);
 *  - TypeORM CLI і тести (data-source.ts), які працюють БЕЗ Nest DI.
 * Одне джерело правди → CLI і застосунок не можуть розійтися (наприклад, у шляху до міграцій).
 */
export function buildDatabaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // Схему змінюють ЛИШЕ міграції. synchronize: true на проді може мовчки видалити колонку з даними.
    synchronize: false,
    // Glob відносно __dirname, а не жорсткий 'dist/**/*.js': так файли знаходяться і з TS-сирців
    // (ts-node у CLI, ts-jest у тестах), і з скомпільованого dist (там будуть .js).
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
