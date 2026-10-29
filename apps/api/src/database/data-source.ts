import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * [FIX] Фіксована точка: default export `DataSource`.
 * Цей файл читають TypeORM CLI (`typeorm -d <шлях>` для migration:run/revert/generate)
 * і тестова інфраструктура (test/setup/global-setup.ts накочує міграції на db-test).
 *
 * Зараз це stub: валідний DataSource без сутностей і міграцій.
 * Entities, migrations і читання конфігу додаються сюди — default export лишається.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [],
});
