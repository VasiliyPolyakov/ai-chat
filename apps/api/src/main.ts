import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Поза класами конструктор-ін'єкції немає, тож беремо провайдер з контейнера напряму.
  const config = app.get(AppConfigService);
  await app.listen(config.port);
}

void bootstrap();
