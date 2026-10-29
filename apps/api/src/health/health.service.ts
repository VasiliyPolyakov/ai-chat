import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

export interface HealthStatus {
  status: 'ok';
  version: string;
  checks: Record<string, unknown>;
}

@Injectable()
export class HealthService {
  constructor(private readonly config: AppConfigService) {}

  check(): HealthStatus {
    return {
      status: 'ok',
      version: this.config.version,
      checks: {},
    };
  }
}
