import type { INestApplication } from '@nestjs/common';

/**
 * [FIX] Фіксована точка курсу: `configureApp(app)`.
 * Викликається і з main.ts, і з тестів (test/support/create-app.ts), тож налаштування застосунку
 * (prefix, pipes, filters, shutdown hooks тощо) однакові всюди. Зараз це no-op stub — наповнюєш ти.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function configureApp(app: INestApplication): void {}
