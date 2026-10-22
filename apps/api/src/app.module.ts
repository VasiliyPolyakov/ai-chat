import { Module } from '@nestjs/common';

/**
 * [FIX] Фіксована точка курсу: `export class AppModule`.
 * e2e-тести піднімають справжній застосунок у процесі тесту саме з цього класу.
 * Що імпортувати в `imports` — вирішуєш ти.
 */
@Module({
  imports: [],
})
export class AppModule {}
