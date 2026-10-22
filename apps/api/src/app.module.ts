import { Module } from '@nestjs/common';

/**
 * [FIX] Фіксована точка: `export class AppModule`.
 * e2e-тести піднімають справжній застосунок у процесі тесту саме з цього класу.
 * Модулі застосунку підключаються через `imports`.
 */
@Module({
  imports: [],
})
export class AppModule {}
