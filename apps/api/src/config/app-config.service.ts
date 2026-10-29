import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv, type EnvironmentVariables } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get appEnv(): AppEnv {
    return this.config.get('APP_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get version(): string {
    return this.config.get('APP_VERSION', { infer: true });
  }

  get isProduction(): boolean {
    return this.appEnv === AppEnv.Production;
  }
}
