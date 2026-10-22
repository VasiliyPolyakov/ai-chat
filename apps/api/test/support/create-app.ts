/**
 * Машинерія курсу: піднімає справжній застосунок у процесі тесту.
 *
 * - Модулі ізольовано (`jest.isolateModulesAsync`), а AppModule і configureApp імпортуються динамічно:
 *   валідація env у Nest відбувається під час імпорту конфіг-модуля, тому кожен виклик бачить свої змінні.
 * - `envOverrides`: значення `undefined` видаляє змінну. Після `app.close()` (або після невдалого старту)
 *   process.env повертається до попереднього стану.
 * - Використовуються лише фіксовані точки [FIX]: `AppModule` (src/app.module.ts) і `configureApp` (src/app.setup.ts).
 */
import type { INestApplication } from '@nestjs/common';

export type EnvOverrides = Record<string, string | undefined>;

function applyEnv(overrides: EnvOverrides): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) delete process.env[key];
  }
  Object.assign(process.env, snapshot);
}

export async function createTestApp(envOverrides: EnvOverrides = {}): Promise<INestApplication> {
  const snapshot = { ...process.env };
  applyEnv(envOverrides);

  let app: INestApplication | undefined;
  try {
    await jest.isolateModulesAsync(async () => {
      const { Test } = await import('@nestjs/testing');
      const { AppModule } = await import('../../src/app.module.js');
      const { configureApp } = await import('../../src/app.setup.js');

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();
    });
  } catch (error) {
    await app?.close().catch(() => undefined);
    restoreEnv(snapshot);
    throw error;
  }

  if (!app) {
    restoreEnv(snapshot);
    throw new Error('[course] createTestApp: застосунок не створено');
  }

  const started = app;
  const close = started.close.bind(started);
  started.close = async () => {
    try {
      await close();
    } finally {
      restoreEnv(snapshot);
    }
  };
  return started;
}

/**
 * Пробує стартувати застосунок і повертає помилку старту (або undefined, якщо старт успішний).
 * Успішно стартований застосунок одразу закривається.
 */
export async function startupError(envOverrides: EnvOverrides): Promise<Error | undefined> {
  try {
    const app = await createTestApp(envOverrides);
    await app.close();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
