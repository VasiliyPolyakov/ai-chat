/**
 * globalSetup e2e: один раз перед усіма e2e-тестами накочує міграції на db-test.
 *  1. load-env — те саме оточення, що й у тестах (DATABASE_URL = DATABASE_URL_TEST).
 *  2. db-guard — лише база з суфіксом `_test`.
 *  3. Міграції з фіксованої точки [FIX] src/database/data-source.ts (default export DataSource).
 * Порядок імпортів важливий: load-env має виконатися ДО того, як data-source прочитає process.env.
 */
import './load-env';
import dataSource from '../../src/database/data-source';
import { assertTestDatabase } from './db-guard';

export default async function globalSetup(): Promise<void> {
  await assertTestDatabase(process.env.DATABASE_URL_TEST);

  // Тести (і за потреби дочірні процеси) отримують ту саму базу, незалежно від того, що прочитав data-source.
  const ds = dataSource.setOptions({ url: process.env.DATABASE_URL_TEST });
  await ds.initialize();
  try {
    await ds.runMigrations({ transaction: 'each' });
  } finally {
    await ds.destroy();
  }
}
