import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';

export type CheckStatus = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  checks: { db: { status: CheckStatus } };
}

// Скільки чекаємо відповіді БД. Health має відповідати швидко навіть коли база «зависла»,
// інакше балансувальник/Compose отримають таймаут замість чіткого «down».
const DB_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  // DataSource реєструє TypeOrmModule.forRootAsync — тому його можна інжектити як звичайний провайдер.
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
      // SELECT 1 — найдешевший запит, що доводить: з'єднання з пулу живе і сервер відповідає.
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return 'up';
    } catch {
      // Помилку не прокидаємо: health має сказати «down», а не впасти з 500.
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
