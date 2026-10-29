/**
 * Запуск кореневих npm-скриптів (migration:*, seed:admin) дочірнім процесом.
 * Оточення — як у тестах (APP_ENV=test, DATABASE_URL = DATABASE_URL_TEST) плюс overrides;
 * значення `undefined` видаляє змінну.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const REPO_ROOT = resolve(__dirname, '../../../..');

export interface CliResult {
  code: number;
  output: string;
}

export function runNpmScript(
  script: string,
  envOverrides: Record<string, string | undefined> = {},
): CliResult {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const res = spawnSync('npm', ['run', '--silent', script], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}${res.error ? String(res.error) : ''}`;
  // Хвіст виводу — щоб у diff-і assertion-а було видно причину, а не лише код виходу.
  return { code: res.status ?? 1, output: output.slice(-3_000) };
}
