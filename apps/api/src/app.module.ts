import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      ignoreEnvFile: process.env.APP_ENV === 'test',
    }),
    HealthModule,
  ],
})
export class AppModule {}
