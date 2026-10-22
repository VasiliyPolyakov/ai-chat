import type { Config } from 'jest';

/**
 * Машинерія курсу. Jest-проєкти:
 *  - student-unit — твої власні unit-тести `src/**\/*.spec.ts` (генератор їх не пише);
 *  - e2e          — поведінкові тести `test/**\/*.e2e-spec.ts` (запускати з --runInBand);
 *  - infra        — `*.infra-spec.ts` (Docker/Compose, з L03);
 *  - remote       — `*.remote-spec.ts` (GitHub/прод, лише `lesson:check --full`).
 */
const common = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      // 151002 — інформаційне повідомлення ts-jest про module: nodenext; на роботу не впливає.
      { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { ignoreCodes: [151002] } },
    ],
  },
  // module: nodenext вимагає розширення .js у динамічних import() — у Jest мапимо їх назад на .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/test/setup/load-env.ts'],
} satisfies Config;

const config: Config = {
  // Без watchman: однакова поведінка на всіх машинах і без його попереджень у виводі.
  watchman: false,
  projects: [
    { ...common, displayName: 'student-unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...common,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      testTimeout: 30_000,
    },
    {
      ...common,
      displayName: 'infra',
      testMatch: ['<rootDir>/test/**/*.infra-spec.ts'],
      testTimeout: 300_000,
    },
    {
      ...common,
      displayName: 'remote',
      testMatch: ['<rootDir>/test/**/*.remote-spec.ts'],
      testTimeout: 60_000,
    },
  ],
};

export default config;
