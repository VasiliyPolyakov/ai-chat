import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';

/**
 * Форма відповіді health-ендпоінту.
 * Окремий тип (а не `any`/inline-об'єкт) — щоб і сервіс, і контролер, і пізніше Swagger (L05)
 * спиралися на один опис контракту.
 */
export interface HealthStatus {
  status: 'ok';
  version: string;
  // Record<string, ...>, бо набір перевірок росте: у L02 з'явиться `checks.db`.
  checks: Record<string, unknown>;
}

/**
 * `@Injectable()` позначає клас як провайдер: Nest сам створить ОДИН екземпляр (singleton у межах модуля)
 * і передасть його туди, де він потрібен у конструкторі (DI). В Express ти б зробив `new HealthService()`
 * вручну або просто імпортував функцію; тут контейнер керує життєвим циклом і дає підміняти залежності.
 *
 * Навіщо сервіс, якщо логіка — один return? Контролер має лише «перекладати» HTTP ↔ виклик,
 * а що саме перевіряти (БД у L02, можливо зовнішні сервіси) — це логіка, і їй місце тут.
 */
@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  check(): HealthStatus {
    return {
      status: 'ok',
      version: this.config.get('APP_VERSION', { infer: true }),
      checks: {},
    };
  }
}
