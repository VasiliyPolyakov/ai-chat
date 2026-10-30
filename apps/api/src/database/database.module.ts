import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { buildDatabaseOptions } from './database.options';

/**
 * Підключення TypeORM у застосунку.
 * forRootAsync (а не forRoot): опції будуються ПІСЛЯ того, як AppConfigModule провалідував env,
 * і беруться через DI з AppConfigService — а не з сирого process.env.
 * AppConfigModule глобальний, тому імпортувати його тут не треба — лише inject.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        ...buildDatabaseOptions(config.databaseUrl),
        // Типово Nest пробує підключитись 10 разів по 3 с — при лежачій БД старт «висить» ~30 с.
        // Краще швидко впасти: перезапуск — справа оркестратора (Compose/Docker restart policy).
        retryAttempts: 2,
        retryDelay: 1_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
