import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService, type HealthStatus } from './health.service';

// AC-14: контролер не знає про TypeORM — лише про HealthService.
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const result = await this.health.check();
    // БД недоступна → 503 з тим самим тілом: балансувальник/Compose healthcheck дивляться на код,
    // а людина в тілі бачить, ЯКА саме перевірка впала.
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
