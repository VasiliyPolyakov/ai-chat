import type { INestApplication } from '@nestjs/common';

// Fixed entry point: shared by main.ts and the test app factory so both are configured identically.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
