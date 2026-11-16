import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { buildDatabaseOptions } from './database.options';

// forRootAsync: options are built after AppConfigModule (global) has validated the env,
// and come from AppConfigService rather than raw process.env.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        ...buildDatabaseOptions(config.databaseUrl),
        // Default is 10 attempts × 3s, so a dead DB stalls startup for ~30s.
        // Fail fast instead; restarting is the orchestrator's job (restart policy).
        retryAttempts: 2,
        retryDelay: 1_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
