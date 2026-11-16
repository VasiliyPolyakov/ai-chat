import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';

export type CheckStatus = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  checks: { db: { status: CheckStatus } };
}

// A hung database must not hang the probe: report "down" after this long.
const DB_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async check(): Promise<HealthStatus> {
    const db = await this.checkDb();
    return {
      status: db === 'up' ? 'ok' : 'error',
      version: this.config.version,
      checks: { db: { status: db } },
    };
  }

  private async checkDb(): Promise<CheckStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('db check timeout')), DB_CHECK_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return 'up';
    } catch {
      // Report "down" instead of failing the request with a 500.
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
