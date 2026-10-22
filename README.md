# AI Chat — NestJS + PostgreSQL + TypeORM

Універсальний AI-чат: бекенд на NestJS + TypeORM + PostgreSQL, SPA на React + Vite, інфраструктура в Docker Compose, CI/CD на GitHub Actions і Terraform.

**Roadmap:** auth, розмови, асистенти в БД, Anthropic → Ollama → провайдер-абстракція, tool use, prompt caching, облік токенів, OpenAPI-документація; деплой на Hetzner VPS (Compose + Caddy + GitHub Actions → GHCR → SSH), інфраструктура в Terraform, бекапи в Cloudflare R2.

Розробка йде етапами (`L01`, `L02`, …): кожен етап — гілка `lesson/NN`, PR у `main` і набір приймальних тестів у `apps/api/test/lessons/lNN`.

## Вимоги до оточення

| Що | Версія | Навіщо |
|---|---|---|
| Node.js | 24 (див. `.nvmrc`; `nvm use`) | усе |
| npm | 11+ (йде з Node 24) | npm workspaces |
| **Docker** — OrbStack або Docker Desktop | **Docker Compose ≥ 2.24** | Postgres для розробки й тестів, образи |
| GitHub CLI `gh` | будь-яка актуальна | `--full`-перевірки (налаштування репозиторію) |
| gitleaks (опційно, рекомендовано) | 8.x | pre-commit перевірка секретів |

## Швидкий старт

```bash
nvm use                         # Node 24
npm ci                          # залежності + git hooks (core.hooksPath = .githooks)
cp .env.example apps/api/.env   # конфіг для розробки (api запускається з теки apps/api)
npm run db:up                   # Postgres: dev-база і db-test (порт 5433)
npm run dev                     # api (Nest, :3000) + web (Vite, :5173, проксі /api → :3000)
```

## Структура монорепо

```
apps/api      NestJS-застосунок + test/ (тестова інфраструктура і приймальні тести етапів)
apps/web      React + Vite SPA
infra/        Compose, Caddy, деплой, Terraform
scripts/      lesson-check, архітектурні перевірки
.githooks/    pre-commit (gitleaks), pre-push (захист локальних гілок)
```

Фіксовані точки входу **[FIX]**, на які спираються тести: `AppModule` у `src/app.module.ts`, `configureApp` у `src/app.setup.ts`, `src/database/data-source.ts` (default export `DataSource`).

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | api (`nest start --watch`) + web (`vite`, :5173) паралельно |
| `npm run db:up` / `npm run db:down` | `docker compose -f infra/compose.dev.yml up -d --wait` / `down` |
| `npm run migration:*` | TypeORM-міграції через `src/database/data-source.ts` |
| `npm run lint` | ESLint + `scripts/check-architecture.mjs` (контролери не імпортують TypeORM) |
| `npm run typecheck` | `tsc --noEmit` в усіх workspaces |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:e2e` / `test:infra` | jest-проєкти `apps/api` (+ vitest web) |
| `npm run lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]` | перевірка етапу N (нижче) |

### `lesson:check`

1. **Preflight** — Node з `.nvmrc`, `apps/api/.env.test`, git hooks, фіксовані точки [FIX]; db-test — лише для кроків, яким потрібна БД; Docker/Compose — лише для infra-тестів. Повідомлення мають префікс `[preflight]`.
2. **Цілісність тестів** — `apps/api/test/lessons/**` порівнюються з комітом, де їх додано; зміни → warning.
3. **Кроки** етапу (`--step K` — лише один крок, без регресії і статики).
4. **Регресія** — e2e попередніх етапів і власні e2e-тести (`apps/api/test/custom`).
5. **Статика** — `lint` + `typecheck`.
6. `--full` — CI-еквівалент: додає remote-тести (налаштування GitHub, прод) та infra-регресію.

Підсумок — таблиця «перевірка → pass/fail/skip (к-сть тестів)» і попередження; exit ≠ 0 при будь-якому fail. Збої самої тестової інфраструктури позначаються міткою `[tooling]`.

## Секрети

Репозиторій публічний, тому:

- `.env` і `.env.*` у `.gitignore` (виняток — `.env.example` і нечутливий `apps/api/.env.test`).
- На GitHub увімкнені **secret scanning** і **push protection**.
- `pre-commit` запускає `gitleaks git --pre-commit --staged`, якщо gitleaks встановлено (інакше — лише попередження).
- Секрети живуть лише в GitHub Secrets і в `.env` на сервері; ніколи — у коді, логах, build args чи образах.
- Гілки `lesson-*-solution` — лише локальні: hook **pre-push** відхиляє будь-який push, що їх зачіпає, а ruleset на GitHub блокує їх створення.
