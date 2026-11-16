import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService, type HealthStatus } from './health.service';

// Controllers don't touch TypeORM directly (enforced by scripts/check-architecture.mjs).
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const result = await this.health.check();
    // 503 with the same body: probes look at the status code, humans see which check failed.
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
