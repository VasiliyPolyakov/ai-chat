# План: курс «AI-чат на NestJS + PostgreSQL + TypeORM»

- **Статус:** approved (2026-10-22), execution via ralph — scope: starter repo + L01
- **Consensus:** Planner/Architect/Critic — APPROVED (iteration 2 + improvements); рішення користувача U1–U5 внесено (ітерація 4); затверджено з правками (ітерація 5)
- **Ітерація:** 5 (затвердження з правками; зміни — розділ 13 «Changelog»)
- **Режим:** RALPLAN-DR, SHORT (consensus)
- **Spec:** `~/Projects/.omc/specs/deep-interview-ai-chat-course.md`
- **Тип:** greenfield. Усі шляхи нижче — майбутні шляхи у монорепо `<repo>` = `~/Projects/ai-chat`.
- **Дата:** 2026-10-22

---

## 1. Requirements Summary

Практичний курс для middle-розробника із сильним фронтенд-бекграундом. У Node студент уже робив шароване Express-API, WebSockets, Redis і streaming — тому HTTP-шарування, middleware і стрімінг не подаються як новий матеріал. **З нуля:** PostgreSQL, ORM і міграції, DI та модулі NestJS, Docker, CI/CD, Terraform. Студент сам пише бекенд (NestJS + TypeORM + PostgreSQL), Docker, CI/CD і Terraform; фронтенд (React + Vite SPA) отримує готовим, інкрементами, до відповідних занять. Результат: універсальний AI-чат (auth, розмови, асистенти в БД, Anthropic → Ollama → провайдер-абстракція, tool use, prompt caching, облік токенів, OpenAPI-документація), задеплоєний на Hetzner VPS через Compose + Caddy + GitHub Actions → GHCR → SSH, з інфраструктурою в Terraform (hcloud + Cloudflare) і бекапами в Cloudflare R2. Архітектура не закриває шлях до мультитенантності, віджета та RAG.

Формат: ядро 14 занять (**реалістично 100–128 год**) + 3 опційні модулі (A/B/C); чекпоінт після заняття 8. Кожне заняття: теорія → завдання → 3 кроки (у важких L03, L04, L08, L13 — 4 кроки) по 1–2 год → red-тести → зелені → коміт. Тести перевіряють **лише поведінку** (HTTP/e2e, SQL-стан, SSE, nock-фікстури); внутрішню структуру обирає студент. Еталон `lesson-NN-solution` генерується разом із заняттям і лежить **лише локально**; студент свідомо не дивиться його до рев'ю. Рев'ю порівнює підходи студента й еталона. Підказки на запит, 3 рівні. Репозиторій публічний. Машинерія курсу (перевірки, guard-и, фікстури, hooks) — відповідальність генератора.

**Жорстка вимога виконання:** після затвердження генерується ЛИШЕ стартовий репозиторій + заняття 1 (+ його локальний еталон). Заняття N+1 — тільки після закриття N, на основі фактичного коду студента. Карта занять — орієнтир.

**Свідоме відхилення від spec (рішення користувача U3):** spec вимагає «еталон лише після рев'ю»; тепер еталон існує локально з моменту генерації заняття, а «не дивитись до рев'ю» — відповідальність студента, не технічна заборона. Наслідок для AC-4 — розд. 4.3 і 11.

Повні AC-1…AC-38 — у spec; трасування — розділ 4.3.

---

## 2. RALPLAN-DR Summary

### 2.1 Principles
1. **Інкрементальність без забігання наперед.** Нічого з заняття N+1 (тести, фронт, еталон) не існує в репо студента, доки N не закрите.
2. **Тести перевіряють поведінку, а не структуру.** Кожен крок має ≥1 тест, червоний на старті (на assertion) і зелений на еталоні. Тести — лише через HTTP/e2e на піднятому застосунку, SQL-стан БД, SSE-потік, nock-фікстури, CLI-команди й infra-артефакти. Назви сервісів, методів, файлів, модулів обирає студент.
3. **Код студента — джерело правди.** Стартовий стан N+1 = `main` студента; еталон — матеріал для порівняння підходів на рев'ю, а не заміна.
4. **Паритет середовищ рано.** Один шлях `Caddy → /api → Nest` і один механізм міграцій (сервіс `migrate`) локально (з L03), у CI і в проді (з L04).
5. **Мінімум допоміжного інструментарію; машинерія — не тягар студента.** Студент вивчає Nest/Postgres/DevOps, а не build-системи; поломка інструментів курсу — баг генератора; публічний репо не містить секретів і еталонів.

### 2.2 Decision Drivers (top 3)
1. **Навчальна ефективність** для сильного FE-розробника з досвідом шарованого Express-API: фокус на новому (Postgres/ORM/міграції, Nest DI, Docker/CI, IaC), порівняння з Express замість повторення HTTP-основ, свобода дизайну, порівняння підходів на рев'ю.
2. **Машинна перевірюваність** кожного кроку (`lesson:check`) і кожного AC — без прив'язки до внутрішніх назв.
3. **Безпека та вартість проду в публічному репо:** секрети, витік еталонів, відкриті ендпоінти до auth, витрати на Anthropic API, руйнівні тести проти не тієї БД.

### 2.3 Viable Options

#### (a1) Інструмент монорепо
| Опція | Pros | Cons |
|---|---|---|
| **npm workspaces (обрано)** | Нуль додаткових інструментів; AC-8 сформульовано як `npm run migration:run` — збіг буквальний; `npm ci -w apps/api` у Docker тривіальний; `prepare`-скрипт ставить git-hooks | Повільніший install; phantom deps (компенсується `import/no-extraneous-dependencies`) |
| pnpm workspaces | Швидкий, строгий, `pnpm deploy` для Docker | Ще один інструмент і нюанси symlink-ів у Docker/Nest; розходження з формулюванням AC-8 |
| Nx / Turborepo | Кешування, граф задач | **Invalidated:** 2 застосунки без спільних пакетів — кешування не окупається; ховає Nest CLI і jest-конфіг (суперечить Principle 5) |

#### (a2) Репозиторій, гілки й еталони
| Опція | Pros | Cons |
|---|---|---|
| **Один публічний репо; студент працює в `lesson/NN` → PR → `main`; annotated-тег `lesson-NN-start`; еталон — локальна гілка `lesson-NN-solution` (від `lesson-NN-start`), створена в G3 і ніколи не пушиться: pre-push hook + GitHub ruleset (обрано, U1+U3)** | Один CI/деплой-пайплайн; безкоштовні branch protection, rulesets, secret scanning для публічного репо; генерація N+1 бачить реальний `main`; еталон перевірений на тих самих тестах у момент генерації; `git diff lesson/NN lesson-NN-solution` для рев'ю | Студент технічно може підглянути еталон (свідома відповідальність, U3); CI на еталонних гілках не запускається → AC-4 перевіряється локальним CI-еквівалентом (розд. 4.3) |
| Еталонні гілки в окремому приватному репо з власним CI | AC-4 виконується буквально | **Відкладено (follow-up):** користувач обрав «лише локально»; дубль CI і секретів |
| Еталон після рев'ю (як у spec) | Підглядання фізично неможливе | **Invalidated рішенням U3:** G3 і так створює перевірену реалізацію; повторна генерація подвоює вартість і ризикує розходженням з тестами |
| Окремі репо курсу і студента | Чисте розділення | **Invalidated:** тести генеруються під фактичний код студента — синхронізація двох репо дає лише накладні витрати |

#### (b) Механіка red-тестів і перевірки кроку
| Опція | Pros | Cons |
|---|---|---|
| **Генератор комітить поведінкові тести в `apps/api/test/lessons/lNN/sK-*.{e2e-spec,infra-spec,remote-spec}.ts` (жодних `*.spec.ts` unit-тестів); `npm run lesson:check -- N [--step K]` фільтрує за шляхом; stub-и — лише для 3 фіксованих точок (5.3) (обрано)** | Свобода внутрішнього дизайну; тести переживають рефакторинг (L11) без змін; тести стають регресією і йдуть у CI; одне джерело правди | Деякі речі не спостерігаються ззовні (структура auth-стратегій, ізоляція шарів) → рев'ю й архітектурний скрипт (AC-14); тести залежать від назв таблиць/колонок → схема фіксується в «Контракті» заняття |
| Unit-тести на фіксовані сервіси/методи | Точніша діагностика | **Invalidated рішенням U3:** нав'язує структуру, ламається від законного дрейфу |
| Тести в `course/…` з копіюванням / jest roots | Матеріали в одному місці | **Invalidated:** дві копії тестів або крихкі імпорти; без переваг |

#### (b2) Postgres для тестів
| Опція | Pros | Cons |
|---|---|---|
| **Compose-сервіс `db-test` локально (tmpfs, порт 5433) + service container у CI; обидва через `DATABASE_URL_TEST` (обрано)** | Однаковий механізм локально і в CI; spec вимагає service container у CI; студент вчить Compose у L01 | Треба `npm run db:up` (preflight підказує) |
| Testcontainers | Нуль ручних кроків, ізоляція | **Invalidated:** два різні механізми; +3–5 с на старт; Ryuk/Docker Desktop на macOS; ховає Compose |

#### (c) Порядок занять: деплой (L04) до auth (L05–06)
| Опція | Pros | Cons |
|---|---|---|
| **Лишити порядок. L04: у проді лише `/api/health` і SPA-оболонка. З L05: `REGISTRATION_ENABLED=false` у проді, admin через `npm run seed:admin` (пароль ≥ 20 символів). Postgres і api-порт не публікуються; firewall 22 (key-only)/80/443. Caddy IP-allowlist — опційно (обрано)** | Зберігає AC-7 і ранній фідбек від деплою; немає поверхні атаки з даними до auth | L05: логін без rate limit одне заняття — прийнятий ризик (єдиний акаунт, довгий пароль, argon2id) |
| Переставити: Auth → 3–4, Docker/CI → 5, деплой → 6 | Прод одразу з auth | **Invalidated:** порушує AC-7; security-код без регресійної сітки CI |
| Обов'язковий IP-allowlist до L06 | Повна закритість | **Відхилено як default:** динамічна IP студента; post-deploy перевірки з CI бачать лише health |
| Відкрита реєстрація з L05 | Простота | **Invalidated:** будь-хто реєструється, з L08 — витрачає API-бюджет |
| Basic auth на Caddy / SSH-тунель | Закритість | **Invalidated:** конфлікт з `Authorization: Bearer`; інструмент поза стеком |

Контроль вартості: throttle `/messages` за `userId` і денний ліміт токенів на користувача (L08.S3), spend limit у Anthropic Console (чекліст L08.S4).

#### (d) Хостинг сховищ і DNS (U2, U4)
| Опція | Pros | Cons |
|---|---|---|
| **Cloudflare: Registrar + DNS (`proxied=false`) + R2 (TF state і бекапи, free tier) (обрано)** | Нуль щомісячної вартості; бекапи в іншому провайдері, ніж VPS (Hetzner) | Vendor concentration; `use_lockfile` на R2 треба перевірити |
| Hetzner Object Storage | Один провайдер з VPS | **Відхилено (U4):** ~€5/міс; бекапи в того ж провайдера, що й VPS |
| HCP Terraform (state) + Backblaze B2 (бекапи) | Нативні блокування state | Ще два акаунти; резерв, якщо R2 не підтримає блокування |

#### (e) OpenAPI у production
| Опція | Pros | Cons |
|---|---|---|
| **Swagger UI і JSON лише при `APP_ENV ∈ {development, test, ci}`; у production не реєструються (404) (обрано)** | Інсталяція на один бізнес не має зовнішніх споживачів API — публічна мапа ендпоінтів лише полегшує розвідку; нуль додаткового коду; поведінка перевіряється e2e | Немає живої документації на проді (доступна локально й у CI-артефактах) |
| За auth (admin JWT) у production | Документація на проді | Swagger UI не передає Bearer під час завантаження JSON без додаткової обвʼязки; ще одна поверхня для помилок доступу; користі для одного бізнесу мало |
| Відкрито всюди | Простота | **Invalidated:** розкриває API-мапу публічного проду без потреби |

---

## 3. Структура монорепо

Позначки: **[S]** — у стартовому репо; **[Lnn]** — з'являється в занятті nn; **[A/B/C]** — опційні; **[M]** — машинерія курсу (відповідальність генератора, розд. 5.5). Структура `apps/api/src/**` — **приклад з еталона, не контракт**: студент обирає власні модулі й назви. Контракт — лише фіксовані точки **[FIX]** (розд. 5.3).

```
<repo>/
├── package.json                  [S] npm workspaces: apps/*; root-скрипти (3.1); "prepare": "git config core.hooksPath .githooks"
├── package-lock.json             [S]
├── .nvmrc                        [S] Node 24 LTS
├── .editorconfig .prettierrc     [S]
├── .gitignore                    [S, перший коміт] .env, .env.*, !.env.example, !apps/api/.env.test, node_modules, dist,
│                                     *.tfstate*, *.tfvars (крім *.example.tfvars), .terraform/
├── .githooks/
│   ├── pre-push                  [S][M] блокує push будь-якого ref `refs/heads/lesson-*-solution` (і отже `--all`/`--mirror`)
│   └── pre-commit                [S][M] `gitleaks git --pre-commit --staged`, якщо gitleaks встановлено; інакше warning
├── eslint.config.mjs             [S] flat config, typescript-eslint
├── tsconfig.base.json            [S]
├── .env.example                  [S] ключі L01 без значень-секретів; далі кожне заняття доповнює
├── README.md                     [S] огляд, цикл G1→D, рівні підказок, політика еталонів і секретів (AC-6),
│                                     розділ «Якщо зламалась перевірка» (5.5)
├── scripts/
│   ├── lesson-check.mjs          [S][M] без залежностей; preflight, цілісність тестів, jest-фільтр, звіт, --verbose
│   ├── check-architecture.mjs    [S][M] AC-14: клас з @Controller() не імпортує typeorm/@nestjs/typeorm — незалежно від назв файлів
│   └── check-ci-parity.mjs       [L03][M] звіряє jobs у ci.yml студента з набором `lesson:check --full` (CI-еквівалент для AC-4)
├── course/
│   ├── README.md                 [S] карта занять (орієнтир), шпаргалка «Express → Nest»
│   ├── PROGRESS.md               [S] стан занять, SHA (start, еталон), G3, merge-рішення, drift log, contract migrations,
│   │                                 fix(course)-коміти, підказки
│   └── lesson-01/                [S] README.md, hints.md (порожній журнал)
│       lesson-NN/                [Lnn] + review.md (після рев'ю); solution.md — лише на локальній гілці еталона
├── docs/
│   ├── course-plan.md            [S] копія затвердженого плану (ідентична `.omc/plans/ai-chat-course-plan.md`)
│   └── multitenancy-path.md      [L13 письмове завдання → B повна версія] (AC-38)
├── apps/
│   ├── api/
│   │   ├── package.json nest-cli.json tsconfig.json tsconfig.build.json   [S]
│   │   ├── jest.config.ts        [S][M] projects: student-unit | e2e (runInBand) | infra | remote
│   │   ├── .env.test             [S][M] нечутливі локальні значення (комітиться); APP_ENV=test
│   │   ├── .dockerignore         [L03 студент] .env*, test/, node_modules
│   │   ├── Dockerfile            [L03 студент]
│   │   ├── src/
│   │   │   ├── main.ts           [S] мінімальний bootstrap: AppModule + configureApp()
│   │   │   ├── app.module.ts     [S][FIX] export class AppModule (порожній imports)
│   │   │   ├── app.setup.ts      [S][FIX] configureApp(app): void — no-op stub
│   │   │   ├── database/data-source.ts  [L02][FIX] default export DataSource (stub від генератора на старті L02)
│   │   │   └── …                 приклад з еталона: health/, config/, users/, auth/, docs/ (OpenAPI), conversations/,
│   │   │                         chat/, assistants/, llm/, usage/ — студент може організувати інакше
│   │   └── test/                 [M] уся тека, крім student/
│   │       ├── setup/            [S] load-env.ts: читає .env.test, ставить DATABASE_URL=$DATABASE_URL_TEST до імпорту data-source;
│   │       │                     [L02] db-guard.ts (current_database() на _test, інакше abort), global-setup (міграції), reset-db;
│   │       │                     [L08] no-network.ts (nock ≥14: disableNetConnect, allow localhost/db-test)
│   │       ├── support/          [S] create-app.ts (createTestApp(env): jest.isolateModulesAsync + динамічний імпорт AppModule
│   │       │                         + configureApp + app.init), db.ts (pg-клієнт на DATABASE_URL_TEST для SQL-перевірок);
│   │       │                     [L05] openapi.ts (expectDocumented(app, [[method, path], …]));
│   │       │                     [L08] sse.ts (парсер SSE-потоку з таймстемпами подій)
│   │       ├── factories/        [L05] createUser/loginAs/createConversation — лише через HTTP API і SQL
│   │       ├── fixtures/         [L08] anthropic/*.sse (сирі SSE-тіла /v1/messages); [L11] ollama/*.ndjson
│   │       ├── contracts/        [L11] chat-provider.contract.ts — однакові HTTP-сценарії для будь-якого провайдера
│   │       ├── student/          [L05+] власні edge-case тести студента (НЕ машинерія)
│   │       └── lessons/
│   │           └── l01/          [S] s0-github.remote-spec.ts, s1-health.e2e-spec.ts, s2-config.e2e-spec.ts, s3-database.e2e-spec.ts
│   │               lNN/          [Lnn]
│   └── web/                      [M] React + Vite + TS (генерується, студент не пише)
│       ├── package.json vite.config.ts (proxy /api → :3000) tsconfig.json   [S]
│       ├── Dockerfile            [L03 студент] node build → caddy:2-alpine з dist у /srv
│       ├── src/
│       │   ├── styles/theme.css  [S] CSS-змінні теми, скоуп на #root (AC-25/26)
│       │   ├── api/client.ts     [S] fetch-обгортка з базою /api; [L06] refresh-on-401; [L08] SSE-парсер
│       │   ├── components/ui/    [S] shadcn: button, card; далі за потреби
│       │   ├── features/health/  [S] бейдж стану API (TanStack Query)
│       │   ├── features/auth/    [L05–L06]
│       │   ├── features/conversations/ [L07]
│       │   ├── features/chat/    [L08] ізольований (ESLint: без router/auth імпортів); [L09] tool-блоки
│       │   └── features/admin/   [L06] users; [L10] assistants; [L12] usage
│       └── e2e/                  [L03] Playwright smoke (генерується), росте в L05, L07, L08, L09, L10
├── infra/
│   ├── README.md                 [S] що тут з'явиться і коли
│   ├── compose.dev.yml           [L01 студент] `name: chat-dev`; db (5432, volume), db-test (5433, tmpfs); [L11] profile ollama
│   ├── compose.yml               [L03 студент] `name: chat-stack`; db, migrate (одноразовий), api, web(Caddy); порти хоста з env
│   ├── compose.prod.yml          [L04 студент] образи GHCR:${IMAGE_TAG}; той самий migrate; [L14] backup
│   ├── Caddyfile                 [L03 студент] {$SITE_ADDRESS}; /api → api:3000 flush_interval -1; SPA fallback
│   ├── cloud-init.yml            [L04 студент] docker, користувач deploy, PasswordAuthentication no; реюз у L13
│   ├── scripts/deploy.sh         [L04 студент] deploy <sha> | rollback; DRY_RUN=1
│   ├── scripts/backup.sh         [L14 студент]
│   ├── RUNBOOK.md                [L04 → L14]
│   └── terraform/                [L13 студент] main.tf variables.tf outputs.tf backend.tf imports.tf envs/*.tfvars; [C] aws/
└── .github/workflows/
    ├── ci.yml                    [L03 студент] (з gitleaks); [L04] job deploy (needs + environment prod)
    └── rollback.yml              [L14 студент] workflow_dispatch(sha)
```

### 3.1 Root-скрипти `package.json`
| Скрипт | Що робить | Коли |
|---|---|---|
| `prepare` | `git config core.hooksPath .githooks` (запускається з `npm ci`/`npm install`) | [S] |
| `dev` | `concurrently` api (`nest start --watch`) + web (`vite`, :5173) | [S] |
| `db:up` / `db:down` | `docker compose -f infra/compose.dev.yml up -d --wait` / `down` | [S] (файл пише студент у L01.S3) |
| `lint` | eslint + `node scripts/check-architecture.mjs` (AC-14) | [S] |
| `typecheck`, `format:check` | по всіх workspaces | [S] |
| `test` / `test:e2e` / `test:infra` | jest-проєкти `apps/api` (+ vitest web для `test`) | [S] (infra — з L03) |
| `lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]` | див. 3.2 | [S] |
| `migration:run` / `migration:revert` / `migration:generate` | проксі в `apps/api` | **додає студент у L02** (AC-8 перевіряє root-виклик) |
| `seed:admin` | admin з `ADMIN_EMAIL`/`ADMIN_PASSWORD` (≥ 20 символів) | студент, L02 |
| `live:cache-check` | opt-in, реальний ключ, поза jest/CI | студент, L12 |

### 3.2 `lesson:check`
1. **Preflight (покроково):** Node з `.nvmrc`; `.env.test` існує; `git config core.hooksPath` = `.githooks` (інакше warning «запусти npm ci»); TCP-перевірка `DATABASE_URL_TEST` лише для кроків з БД: у L01 — тільки S3; з L02 — усі e2e. Недоступна БД → підказка «запусти `npm run db:up`», крок = fail. Для `*.infra-spec.ts` — `docker info` і Docker Compose ≥ 2.24. Кожна preflight-помилка має префікс `[preflight]`.
2. **Цілісність тестів:** для кожного `test/lessons/lMM` база = останній коміт генератора, що торкався шляху: `BASE=$(git log -1 --format=%H -E --grep='^course\(lMM\)|contract migration|^fix\(course\)' -- apps/api/test/lessons/lMM)`; `git diff --quiet $BASE -- apps/api/test/lessons/lMM`. Зміни → **warning**; на рев'ю — **blocker**.
3. **Кроки:** `apps/api/test/lessons/lNN/s*-*`, групування за `sK`, jest з фільтром шляху.
4. **Регресія (за замовчуванням):** `e2e` для `l01..l(N-1)` + `student-unit` + `test/student/**`. `infra` і `remote` — лише з `--full` (remote — з `--remote URL`) і в CI.
5. **Статика:** `lint` (вкл. AC-14) + `typecheck`.
6. **`--full`** (з L03) додатково запускає `check-ci-parity` і відтворює набір CI-jobs локально (lint, typecheck, e2e, infra, gitleaks, smoke через `compose.yml` з ізольованим `-p`) — **CI-еквівалент** для локальних еталонних гілок (AC-4).
6a. **Одне джерело правди (рішення користувача, 2026-10-22):** кожна перевірка — окремий npm-скрипт у кореневому `package.json` (`lint`, `typecheck`, `test:e2e`, `test:infra`, `test:smoke` тощо). І `lesson:check --full`, і jobs у `.github/workflows/ci.yml` викликають **лише ці скрипти** (`run: npm run <script>`); жодних продубльованих у YAML команд (інлайн `npx eslint`, `jest …`). Поза `npm run` у workflow допустимий лише setup (checkout, setup-node, `npm ci`, services, env, логін у GHCR, деплой-кроки). `check-ci-parity` перевіряє саме це: множина `npm run`-скриптів у jobs перевірок `ci.yml` = множині скриптів `lesson:check --full`, і в цих jobs немає інших `run:`-команд.
7. **`--verbose`:** повний вивід jest/docker, змінні середовища тестів (без секретів), шлях до використаної БД, версії Node/Docker/Compose.
8. **Вихід:** таблиця `крок → pass/fail (к-сть тестів)` + warnings; помилки машинерії позначаються `[course]` (preflight, guard-канарки, збій `test/setup|support`); exit ≠ 0 при будь-якому fail.

### 3.3 Тестова інфраструктура
- Jest projects: `student-unit` (власні `src/**/*.spec.ts` студента — генератор їх не пише), `e2e` (`*.e2e-spec.ts`, `runInBand`), `infra` (`*.infra-spec.ts`, docker, до 5 хв), `remote` (`*.remote-spec.ts`, `REMOTE_BASE_URL`).
- **Що дозволено в lesson-тестах:** HTTP через supertest на застосунку з `createTestApp()`; SQL-читання/підготовка через `test/support/db.ts`; дочірні процеси для CLI (`npm run migration:run`, `seed:admin`); nock-фікстури і перевірка тіла запиту до провайдера; `/api/docs-json` для OpenAPI; Docker/Compose/Terraform-команди для infra. **Заборонено:** `jest.spyOn`, `overrideProvider`, `app.get()`/`moduleRef.get()`, імпорт будь-чого зі `src/`, крім трьох [FIX]-точок.
- **Fault injection** — лише тригерами БД (SQL).
- **Запобіжники БД:** `load-env.ts` підставляє `DATABASE_URL=$DATABASE_URL_TEST` до завантаження `data-source.ts`; з L02 `db-guard.ts` перевіряє суфікс `_test`, інакше процес завершується до будь-якого `TRUNCATE`.
- **Міграційні (revert) тести** — на одноразовій БД `chat_migr_<rand>_test`.
- `synchronize: false` скрізь (перевіряється поведінково: застосунок на порожній БД не створює таблиць).
- **Guard-тести** (`[guard]`): перевірки тестового середовища (no-network канарка, db-guard), можуть бути зеленими від старту. AC-3: кожен крок має ≥1 red-тест; guard-и додатково.
- **Env-залежні тести:** `createTestApp(envOverrides)` ізолює модулі і динамічно імпортує `AppModule`, бо валідація env відбувається під час імпорту конфіг-модуля.
- Ліміти throttler-а — з env; `.env.test` задає високі значення; throttle-тести створюють власний app з низькими лімітами.
- **OpenAPI-регресія:** кожне заняття з новими ендпоінтами містить у кроці, що їх додає, перевірку `expectDocumented()` по `/api/docs-json` (paths + методи). Старі перевірки лишаються в регресії — документація не може «загубити» ендпоінт.

### 3.4 Середовища, конфігурація, секрети
- `APP_ENV = development | test | ci | production` — **єдине джерело політик**; `NODE_ENV` — лише для бібліотек.
- Прив'язки до `APP_ENV=production` (fail-fast на старті): `LLM_MODE=fake` заборонено (L08); провайдер `ollama` заборонено (L11); `COOKIE_SECURE` обов'язково `true` (L06); Swagger (`/api/docs`, `/api/docs-json`) не реєструється (L05, опція 2.3(e)).
- `REGISTRATION_ENABLED` — default `false`; `.env.example` (dev) і CI-compose для smoke — `true`.
- **Публічний репо (U1):** секрети лише в GitHub Secrets (environment-scoped з L04) і в `.env` на сервері; `.env` у `.gitignore` з першого коміту; secret scanning + push protection з L01; gitleaks — pre-commit hook (S) і CI job (з L03); GHCR-образи публічні → `.dockerignore` виключає `.env*`, секрети ніколи не потрапляють у build args.

### 3.5 LLM у тестах і runtime fake (з першого AI-заняття, L08)
- **HTTP-рівень.** Справжній `@anthropic-ai/sdk` + nock ≥14 (перехоплює `node:http` і `fetch`; запасний — undici `MockAgent`, звірити з транспортом SDK при генерації L08). Фікстури — сирі SSE-тіла `POST /v1/messages` у `test/fixtures/anthropic/*.sse`; nock фіксує тіло запиту для assertions.
- **Чому застосунок у тому ж процесі:** nock перехоплює лише виклики свого процесу → e2e піднімають `AppModule` in-process.
- **No-network guard:** `nock.disableNetConnect()` (дозволено localhost/db-test). `[guard]`-канарка `l08/s1-no-network.e2e-spec.ts`: реальний `fetch('https://api.anthropic.com/v1/messages')` падає з помилкою заборони мережі (AC-17).
- **Runtime fake mode** (`LLM_MODE=fake`, для Playwright у CI) — **поведінкова вимога**: застосунок без API-ключа стрімить ≥ 2 `text-delta` з паузою між ними і `done`. Як реалізувати — вибір студента; теорія L08 рекомендує власний `fetch` у SDK.
- **L11:** один контрактний набір HTTP-сценаріїв проганяється для Anthropic (SSE-фікстури) і Ollama (NDJSON-фікстури) через публічний API чату (AC-18).

---

## 4. Карта занять (орієнтир; деталі — при генерації кожного заняття)

**Оцінка часу.** Години заняття = теорія (1–2 год) + кроки (3–4 × 1–2 год) + рев'ю й доопрацювання (1–2 год) + деплой/налагодження. Ядро: **100–128 год** (до чекпоінту L01–L08: 60–76 год; після: 40–52 год). Опційні: A 8–10, B 4–6, C 8–10 год.

Шляхи тестів — відносно `apps/api/test/lessons/`. Кожен README заняття містить розділ **«Контракт»**: HTTP (шляхи, коди, JSON-форми), SSE-події, env-змінні, npm-скрипти, compose-сервіси, назви таблиць/колонок, які читають тести. Теорія не повторює HTTP-основи й middleware (студент знає їх з Express) — натомість порівнює з Express там, де це прискорює розуміння. **З L05** в одному з кроків — підзавдання «напиши власний тест на edge-case X» у `test/student/` (перевіряється на рев'ю).

| Заняття | Кроків | Години |
|---|---|---|
| L01 | 3 (+ підготовка) | 6–8 |
| L02 | 3 | 7–9 |
| L03 | 4 | 8–10 |
| L04 | 4 | 8–10 |
| L05 | 3 | 7–9 |
| L06 | 3 | 7–9 |
| L07 | 3 | 7–9 |
| L08 | 4 | 10–12 |
| L09 | 3 | 6–8 |
| L10 | 3 | 6–8 |
| L11 | 3 | 7–9 |
| L12 | 3 | 5–7 |
| L13 | 4 | 9–11 |
| L14 | 3 | 7–9 |
| **Разом** | 46 | **100–128** |

### L01 — Монорепо і Nest-основи (6–8 год)
- **Мета:** Nest-застосунок з health, валідованим env, Postgres у Compose; безпечний публічний репо.
- **Підготовка (~20–30 хв, без red-тестів):** створити **публічний** GitHub-репо, увімкнути secret scanning + push protection, ruleset «Restrict creations» для `refs/heads/lesson-*-solution` без bypass; `npm ci` (ставить hooks). Перевірка — `l01/s0-github.remote-spec.ts` у `--full`: `gh api repos/:o/:r` → `security_and_analysis.secret_scanning.status == "enabled"` і `secret_scanning_push_protection.status == "enabled"`; `gh api repos/:o/:r/rulesets` містить правило `creation` для цього патерну.
- **S1 — Health + `configureApp`** (prefix `/api`, shutdown hooks). Tests `l01/s1-health.e2e-spec.ts`: `GET /api/health` → 200, `toMatchObject({status:'ok', version: expect.any(String), checks: expect.any(Object)})`; `GET /health` → 404.
- **S2 — Конфіг з валідацією** (`APP_ENV` enum, `PORT` number default 3000, `DATABASE_URL` required, `APP_VERSION` default `dev`). Tests `l01/s2-config.e2e-spec.ts` через `createTestApp(env)`: без `DATABASE_URL` → старт відхилено з назвою змінної в повідомленні; `PORT=abc`, `APP_ENV=staging` → відхилено; значення з `.env.example` → старт успішний; `APP_VERSION=1.2.3` видно в `/api/health`.
- **S3 — Postgres у Compose:** `infra/compose.dev.yml` (`name: chat-dev`; `postgres:17-alpine`; `db` 5432 з volume; `db-test` 5433 на tmpfs, БД `chat_test`; healthcheck). Tests `l01/s3-database.e2e-spec.ts` (`pg`): ECONNREFUSED → fail на assertion «db-test недоступна: запусти npm run db:up»; `server_version_num >= 170000`; `current_database() = 'chat_test'`.
- **Нове з нуля:** DI-контейнер Nest, модулі як межі видимості провайдерів, lifecycle. **Порівняння з Express:** роутер ≈ контролер, але залежності не імпортуються вручну, а інжектуються контейнером; `configureApp` ≈ фабрика `createApp()`, яку роблять у Express для supertest; валідація env ≈ dotenv + zod/envalid, але вбудована в старт модуля.
- **Фронт:** уже в старті. **Деплой:** немає (`npm run dev`).
- **AC:** AC-1, AC-2, AC-6, AC-14 (архітектурний скрипт), AC-22 (dev), AC-36.

### L02 — TypeORM, User, міграції, seed:admin (7–9 год)
- **Генератор додає stub** `src/database/data-source.ts` [FIX] (валідний `DataSource` з порожнім `migrations`), щоб global-setup компілювався.
- **S1 — DataSource і health БД:** TypeORM-модуль з конфігу, root-скрипти міграцій, DB-перевірка в `checks.db`. Tests `l02/s1-datasource.e2e-spec.ts`: `toMatchObject({checks:{db:{status:'up'}}})`; `[guard]` db-guard відмовляє на БД без суфікса `_test`.
- **S2 — User + міграція:** таблиця `users` (`id uuid`, `email` з унікальним індексом на `lower(email)`, `password_hash`, `role` `admin|user` default `user`, `created_at/updated_at`). Tests `l02/s2-migrations.e2e-spec.ts` (одноразова БД): `npm run migration:run` → таблиця й колонки; дубль email іншим регістром через SQL → unique violation; `migration:revert` → таблиці немає; повторний `run` — ок (AC-8); `[guard]` застосунок на порожній БД не створює `users`.
- **S3 — `npm run seed:admin`:** нормалізує email, хешує argon2id, ідемпотентний; пароль < 20 символів → відмова. Tests `l02/s3-seed-admin.e2e-spec.ts` (дочірній процес + SQL): один рядок `role='admin'`, email у нижньому регістрі, хеш `$argon2id$`; повторний запуск → один рядок; пароль з 19 символів → exit ≠ 0, рядків 0.
- **Нове з нуля:** реляційна модель, індекси й обмеження, ORM-сутності й репозиторії, міграції як версіонування схеми, чому `synchronize` заборонено. **Порівняння:** на відміну від Redis (key-value без схеми) — схема, обмеження й транзакції на боці БД.
- **Фронт:** немає. **Деплой:** немає. **AC:** AC-8, AC-14.

### L03 — Docker + CI (8–10 год, 4 кроки, V1)
- **S1 — Dockerfiles + `.dockerignore`** (api multi-stage, non-root, лише prod deps; web → `caddy:2-alpine`). Tests `l03/s1-docker.infra-spec.ts`: збірка обох образів; користувач ≠ root; в api-образі немає `src/`, `jest`, жодного `.env*`; розмір < 400 MB.
- **S2 — Локальний стек:** `infra/compose.yml` (`name: chat-stack`): `db` → `migrate` (той самий образ, ідемпотентний, `restart: "no"`) → `api` (`depends_on: migrate: service_completed_successfully`; порт не публікується) → `web` (Caddy, хост `${WEB_HOST_PORT:-8080}`, `/api/*` → `api:3000` з `flush_interval -1`, SPA fallback). Канонічна послідовність: `docker compose run --rm migrate && docker compose up -d --wait api web`. Tests `l03/s2-compose.infra-spec.ts` — ізольований `-p chat-it-<rand>`, випадковий `WEB_HOST_PORT`: migrate exit 0; health 200; `/` і `/some/route` → `index.html`; api недоступний з хоста; `down -v` в `afterAll`.
- **S3 — CI: перевірки коду:** `ci.yml` з тригерами `pull_request`, `push` у `main`; jobs `lint`, `typecheck`, `test` (Postgres service container), `infra`, **`gitleaks`**. Tests `l03/s3-ci.infra-spec.ts`: YAML має тригери/jobs/services; немає тригерів на `lesson-*-solution`; є job gitleaks.
- **S4 — CI: smoke, образи, захист `main`:** jobs `smoke` (Playwright проти `compose.yml`, `REGISTRATION_ENABLED=true`, `APP_ENV=ci`) і `images` (лише `main`: GHCR, тег `${{ github.sha }}`, `permissions.packages: write`); генератор додає `check-ci-parity` [M]. **AC-28:** branch protection/ruleset на `main` — required checks (`lint`, `typecheck`, `test`, `infra`, `gitleaks`, `smoke`) + «Do not allow bypassing». Tests `l03/s4-images.infra-spec.ts` (тег містить `github.sha`; `check-ci-parity` зелений) і `l03/s4-protection.remote-spec.ts` (`--full`): `gh api repos/:o/:r/branches/main/protection` → усі 6 contexts і `enforce_admins.enabled == true`.
- **Чекліст до кінця L03 (U2):** домен куплено в Cloudflare Registrar, зона активна.
- **Перенесено в L14:** actionlint, paths-filter.
- **Нове з нуля:** образи й шари, multi-stage, Compose-мережі, CI-пайплайн, service containers, реєстр образів. **Порівняння з Express:** однаково для будь-якого Node-застосунку — Nest-специфіки тут мінімум.
- **Фронт:** Playwright smoke v1. **Деплой:** образи в GHCR. **AC:** AC-27, AC-28, AC-22, AC-36 (gitleaks), AC-7.

### L04 — Перший деплой (8–10 год, 4 кроки)
- **S1 — Сервер, доступ, DNS:** вручну Hetzner (CX22-клас), SSH-ключ, firewall 22/80/443; `cloud-init.yml`: Docker, користувач `deploy`, `PasswordAuthentication no`, `PermitRootLogin no`. DNS A-запис **вручну в дашборді Cloudflare**, `proxied = false` (у L13 — у Terraform). **GHCR-пакети `api` і `web` → Public**; перевірка — `docker pull` з сервера без логіну. Tests `l04/s1-access.remote-spec.ts` (`--full`): анонімний `docker manifest inspect` образів успішний; `dig +short <domain>` = IP сервера; SSH паролем відхиляється (`ssh -o PreferredAuthentications=password` → помилка).
- **S2 — Прод-конфіг:** `compose.prod.yml` (образи `ghcr.io/...:${IMAGE_TAG}`, той самий `migrate`, db/api без `ports`, лише web публікує 80/443, log rotation), Caddyfile з автоматичним TLS; опційно `remote_ip {$ALLOWED_IPS}` крім `/api/health`. Теорія — **expand→contract**: кожна міграція сумісна з образом N-1; «звуження» — наступним релізом; **rollback ніколи не відкочує схему**. Tests `l04/s2-prod-config.infra-spec.ts`: `compose config` валідний; db/api без `ports`; образи параметризовані `IMAGE_TAG`; `caddy adapt` → `flush_interval: -1` для `/api`.
- **S3 — Автоматичний деплой:** `deploy.sh deploy <sha>`: `pull` (fail → вихід без змін) → `IMAGE_TAG`, попередній у `.previous_tag` → `docker compose run --rm migrate && docker compose up -d --wait api web` → health retry → при фейлі автоповернення тегу; `deploy.sh rollback` — одна команда (AC-30). Job `deploy` у `ci.yml`: `needs` на всі перевірки + `images`, `if: main`, `environment: prod` (secrets `SSH_KEY`, `HOST`; var `DOMAIN`), `concurrency: deploy-prod`; post-deploy `curl https://<domain>/api/health` з `version == github.sha`. Tests `l04/s3-deploy.infra-spec.ts`: `shellcheck`; `DRY_RUN=1 deploy.sh deploy abc123` друкує очікувану послідовність; `rollback` бере `.previous_tag`; YAML: `needs`, `environment: prod`, `concurrency`.
- **S4 — Перевірка проду і rollback-дрил:** `l04/s4-prod.remote-spec.ts`: HTTPS health 200; HTTP → 301/308; сертифікат валідний; `version` = SHA `main`; `GET /api/does-not-exist` → 404 JSON. Rollback через `ssh deploy@host deploy.sh rollback` → `version` змінилась → назад. RUNBOOK: deploy, rollback (без відкату схеми), (опційно) `ALLOWED_IPS`.
- **Перенесено в L14:** `rollback.yml`.
- **Нове з нуля:** VPS, SSH-гігієна, DNS, TLS через ACME, reverse proxy, деплой образами, сумісність міграцій.
- **Фронт:** без змін. **Деплой:** так, перший. **AC:** AC-29, AC-30 (команда), AC-33, AC-22, AC-7.

### L05 — Auth I + OpenAPI (7–9 год)
- **S1 — Реєстрація:** `POST /api/auth/register`, DTO-валідація (whitelist, forbid non-whitelisted), argon2id, єдиний формат помилок `{statusCode, error, message, details?}`, `REGISTRATION_ENABLED`, `GET /api/auth/config`. Tests `l05/s1-register.e2e-spec.ts`: 201 `{id,email,role:'user'}` без хешу; 400 з деталями поля; 409 на дублікат (case-insensitive); SQL: хеш `$argon2id$`; `REGISTRATION_ENABLED=false` → 403; `/api/auth/config` → `{registrationEnabled}`.
- **S2 — Логін і захищені маршрути за замовчуванням:** `POST /api/auth/login` → `{accessToken, user}`; JWT 15 хв з `sub`, `role`; невірний пароль і неіснуючий email → ідентичні 401; admin з `seed:admin` логіниться; `GET /api/users/me`; публічні маршрути — явно позначені. Tests `l05/s2-login.e2e-spec.ts`: з токеном 200; без/прострочений/чужий підпис → 401; `/api/health` публічний (AC-9). Власний тест студента: `alg: none`.
- **S3 — OpenAPI:** `@nestjs/swagger`: Swagger UI на `/api/docs`, JSON на `/api/docs-json`, DTO auth описані схемами, bearer-схема безпеки; реєструється лише при `APP_ENV ∈ {development, test, ci}` (2.3(e)). Генератор додає `test/support/openapi.ts`. Tests `l05/s3-openapi.e2e-spec.ts`: `/api/docs-json` містить `GET /api/health`, `GET /api/auth/config`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`; схема `register` має `email` і `password` як required; `/api/docs` → 200 HTML; `APP_ENV=production` → `/api/docs-json` і `/api/docs` → 404. **Правило з цього моменту:** кожне наступне заняття з новими ендпоінтами перевіряє їх у `/api/docs-json` (3.3).
- **Генератор додає:** `test/factories/` (через HTTP і SQL).
- **Порівняння з Express:** pipeline Nest — middleware → guards → interceptors → pipes → handler → exception filters; middleware авторизації в Express ≈ guard (але з доступом до метаданих маршруту); `express-validator`/zod-middleware ≈ DTO + `ValidationPipe`; error-middleware `(err, req, res, next)` ≈ exception filter; passport — та сама бібліотека, що й в Express, загорнута в стратегії; swagger-jsdoc ≈ `@nestjs/swagger`, але схеми беруться з DTO-класів.
- **Фронт:** вхід/реєстрація (ховається за `registrationEnabled`), access token у пам'яті, protected routes, `/me`.
- **Деплой:** так; прод: `REGISTRATION_ENABLED=false`, admin через `seed:admin`, Swagger вимкнено. **AC:** AC-9, AC-36.

### L06 — Auth II (7–9 год)
- **S1 — Refresh:** cookie `rt` (`HttpOnly`, `Secure`=`COOKIE_SECURE`, `SameSite=Lax`, `Path=/api/auth`); ротація; reuse → відкликання родини; logout. Tests `l06/s1-refresh.e2e-spec.ts`: нова пара; старий refresh → 401, і новий після reuse теж 401; logout → 401; атрибути cookie; SQL: у `refresh_tokens` немає сирого значення cookie; `APP_ENV=production` + `COOKIE_SECURE=false` → старт відхилено (AC-10); `/api/docs-json` містить `POST /api/auth/refresh`, `POST /api/auth/logout`.
- **S2 — Ролі:** `GET /api/admin/users`. Tests `l06/s2-roles.e2e-spec.ts`: `user` → 403, `admin` → 200, без токена → 401 (AC-11); ендпоінт задокументований.
- **S3 — Rate limit:** лише невдалі логіни на IP, ліміти з env (`LOGIN_MAX_FAILED`, `LOGIN_WINDOW_SEC`) → 429 + `Retry-After`; `trust proxy 1`. Tests `l06/s3-throttle.e2e-spec.ts`: N+1-ша невдала → 429; успішні не рахуються; інша IP (`X-Forwarded-For`) не зачеплена (AC-12). Розширюваність стратегій — **рев'ю**. Власний тест студента: паралельні refresh.
- **Порівняння з Express:** roles-middleware ≈ guard + декоратор метаданих (`Reflector`) замість фабрики `requireRole('admin')`; `express-rate-limit` ≈ `@nestjs/throttler`, але рахувати лише невдалі спроби доводиться самому так само; cookie-parser — той самий.
- **Фронт:** single-flight refresh-on-401, тихий refresh, logout, admin users.
- **Деплой:** так. **AC:** AC-10, AC-11, AC-12, AC-37 (структура, рев'ю).

### L07 — Розмови (7–9 год)
- **S1 — Схема:** таблиці `conversations`, `messages` (FK, cascade, індекси, `tool_calls jsonb NULL`). Tests `l07/s1-schema.e2e-spec.ts`: SQL-перевірка таблиць/FK/індексів; `DELETE` розмови через API → її повідомлень немає.
- **S2 — CRUD + власність:** `POST/GET/PATCH/DELETE /api/conversations[/:id]`; курсорна пагінація (`limit ≤ 50`). Tests `l07/s2-ownership.e2e-spec.ts`: чуже → 404; список лише свій; 55 → 50 + `nextCursor` → 5; невалідний uuid → 400 (AC-13); усі 5 операцій задокументовані.
- **S3 — Транзакції:** `POST /api/conversations` з `firstMessage` створює розмову + повідомлення + автозаголовок атомарно. Tests `l07/s3-transactions.e2e-spec.ts`: заголовок = перші 50 символів; **fault injection тригером** `BEFORE INSERT ON messages WHEN (NEW.content = '__fail__')` → 5xx і SQL: розмови немає; тригер видаляється в `afterEach`. Власний тест студента: однаковий `updated_at` у пагінації.
- **Нове з нуля:** зв'язки в ORM, каскади, транзакції, N+1 запитів, курсорна пагінація на SQL. **Порівняння:** атомарність через `MULTI` у Redis vs транзакції Postgres з відкатом.
- **Фронт:** sidebar розмов, CRUD, історія. **Деплой:** так. **AC:** AC-13, AC-14, AC-8.

### L08 — Anthropic + SSE (10–12 год, 4 кроки, ЧЕКПОІНТ)
- **S1 — Перша відповідь стрімом:** `POST /api/conversations/:id/messages` → `text/event-stream` з подіями `text-delta`, `done` (з `messageId`, `usage`), `error`. Генератор постачає nock-налаштування, SSE-фікстури, `test/support/sse.ts`, no-network guard. Tests `l08/s1-stream.e2e-spec.ts`: послідовність подій із фікстури; тіло запиту до Anthropic містить system + історію + `max_tokens` і модель `DEFAULT_MODEL`; SQL: user- і assistant-повідомлення збережені, assistant — з токенами; ендпоінт задокументований як `text/event-stream`; `l08/s1-no-network.e2e-spec.ts` [guard-канарка].
- **S2 — Помилки й обрив:** теорія: `@Res()` + `res.flushHeaders()`, abort через `res.on('close')` → `AbortController`; з `@Res()` interceptor-и не мапять відповідь, exception filter діє лише до заголовків. Tests `l08/s2-errors.e2e-spec.ts`: фікстура 529 → `error` з `code`, assistant не збережено; чужа розмова → 404 до стріму; пустий контент → 400; обрив після першої дельти → assistant не збережено, наступний запит працює.
- **S3 — Контроль вартості:** throttle за `userId` (ліміт з env) → 429; `DAILY_TOKEN_LIMIT_PER_USER` → 429 `daily_limit` до виклику моделі. Tests `l08/s3-limits.e2e-spec.ts`.
- **S4 — Fake mode і наскрізний шлях:** `LLM_MODE=fake` (заборонено при `APP_ENV=production`). Tests `l08/s4-fake.e2e-spec.ts`: production + fake → старт відхилено; fake без API-ключа → ≥ 2 `text-delta` з інтервалом ≥ 30 мс і `done`. Генерований Playwright (AC-23): реєстрація → логін → нова розмова → перший фрагмент видно **до** `done` через повний стек з Caddy. Чекліст деплою: реальний ключ у GitHub Secrets, spend limit у Anthropic Console. Власний тест студента: abort.
- **Порівняння з Express:** SSE через `res.write` — той самий механізм, що студент робив в Express; нове — як `@Res()` виводить обробник з pipeline Nest; SSE vs WebSockets: однонаправлений потік, POST з тілом, проходить крізь HTTP-проксі без апгрейду.
- **Фронт:** чат зі стрімінгом, markdown + підсвітка, «стоп»; ізоляція `features/chat` + `api/` (AC-26); тест теми (AC-25).
- **ЧЕКПОІНТ:** `lesson:check -- 8 --full --remote https://<domain>`; CI зелений; architect-рев'ю бекенду; ретро (фактичні години vs оцінка); рішення про модуль A.
- **AC:** AC-15 (text-delta/done/error), AC-17, AC-22, AC-23, AC-25, AC-26.

### L09 — Tool use (6–8 год)
- **S1 — Tools пропонуються і виконуються:** `get_current_time`, `search_my_conversations`. Tests `l09/s1-tools.e2e-spec.ts`: тіло запиту має `tools` з `name` і `input_schema`; `tool_use get_current_time` → `tool-result` з ISO-датою; `search_my_conversations` повертає лише розмови поточного користувача; невалідний input → другий запит містить `tool_result` з `is_error: true`.
- **S2 — Tool loop:** події `tool-call`, `tool-result`; `MAX_TOOL_ITERATIONS` (default 5). Tests `l09/s2-loop.e2e-spec.ts`: `[tool-call, tool-result, text-delta…, done]`; нескінченний tool_use → рівно 5 запитів до моделі і `error` з `code: 'tool_limit'` (AC-16).
- **S3 — Персистентність:** `GET /api/conversations/:id` повертає tool-виклики й результати; наступний запит містить спарені `tool_use`/`tool_result`. Tests `l09/s3-history.e2e-spec.ts`. Власний тест студента.
- **Порівняння з Express:** реєстр tools ≈ масив плагінів, який в Express збирають вручну; у Nest — multi-provider і DI.
- **Фронт:** блоки tool-call/tool-result (AC-24). **Деплой:** так. **AC:** AC-15, AC-16, AC-24.

### L10 — Асистенти в БД (6–8 год)
- **S1 — Assistant + expand-міграція:** таблиця `assistants`; seed дефолтного; `conversations.assistant_id` **nullable** + backfill; розмова без `assistantId` → дефолтний. Tests `l10/s1-migration.e2e-spec.ts` (SQL): немає `NULL` після міграції; нова розмова має `assistant_id`; два default неможливі; `[guard]` в `assistants` немає колонок `key|secret|token` (AC-36). `NOT NULL` — у L11.S1.
- **S2 — Admin CRUD:** `/api/admin/assistants`; `enabledTools` ⊆ відомих tools; `GET /api/assistants` для user — активні, без `systemPrompt`. Tests `l10/s2-admin.e2e-spec.ts` (+ docs-json).
- **S3 — Використання в чаті:** Tests `l10/s3-chat.e2e-spec.ts`: system/model/tools з асистента; вимкнений tool не пропонується; `PATCH` → наступний запит з новою моделлю (AC-19, модель). Власний тест студента.
- **Нове з нуля:** data-міграції з backfill, часткові унікальні індекси.
- **Фронт:** вибір асистента; адмінка асистентів. **Деплой:** так. **AC:** AC-35, AC-19, AC-36.

### L11 — Ollama + провайдер-абстракція (7–9 год)
- **S1 — Абстракція + contract-міграція:** рефакторинг під захистом **незмінних** поведінкових тестів L08–L10. Red: `GET /api/admin/providers` → `development`: `['anthropic','ollama']`, `production`: `['anthropic']` (+ docs-json); міграція `conversations.assistant_id SET NOT NULL`. Генератор переносить сценарії L08/L09 у `test/contracts/chat-provider.contract.ts` (contract migration, очікування не змінюються). Tests `l11/s1-providers.e2e-spec.ts`, `l11/s1-not-null.e2e-spec.ts`.
- **S2 — Ollama:** profile `ollama` у `compose.dev.yml`. Tests `l11/s2-contract-ollama.e2e-spec.ts`: той самий контрактний набір з NDJSON-фікстурами дає ті самі SSE-події (AC-18).
- **S3 — Вибір провайдера з БД:** Tests `l11/s3-switch.e2e-spec.ts`: `PATCH` асистента `provider: 'ollama'` → запит іде на хост Ollama (AC-19); `APP_ENV=production` + ollama-асистент → 400. Власний тест студента: недоступний Ollama → `error`.
- **Порівняння з Express:** в Express адаптер обирають вручну у фабриці; у Nest — injection token і реєстр провайдерів у DI.
- **Фронт:** провайдер/модель в адмінці. **Деплой:** так (прод — лише Anthropic). **AC:** AC-18, AC-19, AC-17.

### L12 — Prompt caching + UsageLog (5–7 год)
- **S1 — `cache_control`:** Tests `l12/s1-cache.e2e-spec.ts`: тіло запиту має `cache_control` на system-блоці (і останньому tool); `done.usage` містить `cacheReadTokens`/`cacheCreationTokens`.
- **S2 — UsageLog:** таблиця `usage_logs`; запис на кожен виклик моделі (вкл. ітерації tool loop); вартість за таблицею цін; денний ліміт рахується з `usage_logs` (contract migration за потреби). Tests `l12/s2-usage.e2e-spec.ts` (SQL): 2 виклики → 2 рядки; `cost_usd` = очікувана; Ollama → 0 (AC-20).
- **S3 — Звіт і live-перевірка:** `GET /api/admin/usage?from&to` (+ docs-json); opt-in `live:cache-check` (AC-21), промпт ≥ мінімального порогу кешування.
- **Порівняння:** лічильники в Redis (INCR/TTL) vs журнал у Postgres — чому тут потрібна історія й агрегація, а не лише ліміт.
- **Фронт:** адмін-сторінка usage. **Деплой:** так. **AC:** AC-20, AC-21.

### L13 — Terraform (hcloud + Cloudflare + R2) (9–11 год, 4 кроки)
- **S1 — Основи й state:** Terraform ≥ 1.10; backend `s3` на **Cloudflare R2**: `bucket = "<proj>-tfstate"`, `key`, `region = "auto"`, `endpoints = { s3 = "https://<account_id>.r2.cloudflarestorage.com" }`, `skip_credentials_validation`, `skip_region_validation`, `skip_requesting_account_id`, `skip_s3_checksum`, `use_path_style` = true; `use_lockfile = true` — **перевірити при генерації L13** (S3 conditional writes на R2); якщо немає — `apply` лише з CI-job з `concurrency: terraform` (локально `plan -lock=false`) або HCP Terraform free. R2-токен state — «Object Read & Write» лише на бакет state. Ресурси hcloud: `hcloud_ssh_key`, `hcloud_firewall` (22 key-only, 80, 443), `hcloud_server` з `templatefile(cloud-init.yml)`, primary IP. Tests `l13/s1-terraform.infra-spec.ts`: `fmt -check`, `init -backend=false`, `validate`, `tflint`; розбір HCL → потрібні ресурси, firewall без 5432/3000.
- **S2 — DNS у Terraform (import):** провайдер `cloudflare` (токен Zone:DNS:Edit лише для цієї зони; назви ресурсів v5 — звірити); зона — `data` source (її створив Registrar); наявні записи — `import {}` блоки, `proxied = false`. Обґрунтування import (а не recreate): recreate = delete→create запису і вікно NXDOMAIN/TTL; import дає in-place оновлення IP на наступному кроці без проміжку. Tests `l13/s2-dns.infra-spec.ts`: розбір HCL → `import`-блоки для наявних записів, усі записи `proxied = false`, зона — data source.
- **S3 — Перенесення сервера (recreate):** `apply` нового сервера → деплой → `pg_dump | pg_restore` → оновлення IP запису (in-place) → remote-specs → видалення ручного сервера (import сервера не робимо: drift cloud-init/user_data → force replacement). `terraform plan -detailed-exitcode` = 0 (AC-31).
- **S4 — Друга інсталяція + письмове завдання:** `envs/demo-biz.tfvars` + workspace + GitHub Environment `demo-biz` → той самий `ci.yml` без змін коду → перевірка → `terraform destroy` (AC-34). **Письмове завдання** (без red-тесту, рев'ю): `docs/multitenancy-path.md` — сутності, сервіси, guard-и, де додається `organizationId`, один шар scoping (AC-38).
- **Нове з нуля:** IaC, state і блокування, import vs recreate, workspaces/tfvars.
- **AC:** AC-31, AC-34, AC-33, AC-38.

### L14 — Експлуатація (7–9 год)
- **S1 — Бекапи:** backup-сервіс у `compose.prod.yml` (`pg_dump -Fc` щодня, ретенція 7/4) → **окремий R2-бакет** `<proj>-backups` з **окремим R2-токеном** (лише на цей бакет; R2 bucket lock/retention — перевірити при генерації); опційно другий offsite. Tests `l14/s1-backup.infra-spec.ts`: dump → restore у чисту БД → кількість рядків збігається; `shellcheck`.
- **S2 — Відновлення, rollback-workflow, runbook:** дрил на проді (restore з R2 у scratch-БД); `rollback.yml` (`workflow_dispatch`, `environment: prod`); RUNBOOK: deploy, rollback (без відкату схеми), restore, ротація секретів (GitHub, Cloudflare/R2, Anthropic), масове відкликання refresh (AC-32, AC-30).
- **S3 — Логування і CI-гігієна:** структуровані логи, `x-request-id`, редакція `authorization|cookie|password|*token*`; liveness/readiness; у CI — actionlint, paths-filter для `infra`. Tests `l14/s3-ops.e2e-spec.ts` (stdout застосунку): секрети не в логах; `x-request-id` у відповідях; `l14/s3-ci.infra-spec.ts`: actionlint чистий.
- **Порівняння з Express:** pino/pino-http — ті самі, що в Express; request id через AsyncLocalStorage — так само, різниця лише в місці підключення.
- **AC:** AC-32, AC-30, AC-36.

### Опційні модулі
- **A — Скидання пароля + Google OAuth** (8–10 год; момент — на чекпоінті). S1: скидання (одноразові токени, TTL 30 хв, console-mailer у dev; після скидання всі refresh відкликані) — e2e + docs-json. S2: Google OAuth новим класом стратегії, `auth_identities`, лінкування за verified email; Google через nock — e2e. **AC-37 на рев'ю:** `git diff --diff-filter=M --name-only lesson-A-start -- apps/api/src` — змінені лише файли реєстрації/wiring.
- **B — Огляд мультитенантності** (4–6 год). Повна версія `docs/multitenancy-path.md` + spike `organizationId` для `assistants`. Test: усі шляхи, на які посилається документ, існують.
- **C — AWS ECS Fargate + RDS** (8–10 год). AWS Budgets ($10, алерти 50/80/100%), health, `terraform destroy`, перевірка відсутності ресурсів за тегом.

### 4.1 Фронт-інкременти
| Заняття | Що генерується в `apps/web` |
|---|---|
| S | Vite + React + TS, Tailwind, shadcn (button/card), `theme.css`, API-клієнт, бейдж health, vite proxy |
| L03 | Playwright smoke v1 |
| L05 | Вхід/реєстрація (з `registrationEnabled`), protected routes, `/me` |
| L06 | Refresh-on-401, logout, admin users |
| L07 | Список розмов, CRUD, історія |
| L08 | Чат зі стрімінгом, markdown, стоп; ізоляція `features/chat`; тест теми; smoke AC-23 |
| L09 | Блоки tool-call/tool-result |
| L10 | Вибір асистента, адмінка асистентів |
| L11 | Провайдер/модель в адмінці |
| L12 | Адмін-сторінка usage |

### 4.2 Деплой по заняттях
L01–L02: локально (репо вже публічний). L03: образи в GHCR. L04–L14: кожен merge у `main` → CI → job `deploy` (environment `prod`) → health. L13: перенесення на Terraform-сервер + тимчасовий environment `demo-biz`.

### 4.3 Трасування AC → заняття
| AC | Заняття | AC | Заняття |
|---|---|---|---|
| AC-1 | План (розд. 4) + `course/README.md` (S) | AC-20 | L12.S2 |
| AC-2 | Кожне заняття (шаблон; Verification п.4) | AC-21 | L12.S3 (live-check) |
| AC-3 | Кожне заняття (G3: red на старті, green на еталоні) | AC-22 | L01, L03.S2, L04.S2 |
| AC-4 | **Інтерпретація (U1+U3):** `lesson-NN-solution` існує локально; на ній зелений локальний CI-еквівалент `lesson:check -- N --full` (з L03 — з `check-ci-parity`), результат у `PROGRESS.md` | AC-23 | L08.S4 (smoke з L03.S4) |
| AC-5 | Протокол, крок M | AC-24 | L09 |
| AC-6 | `README.md` (S) | AC-25 | S (токени), L08 |
| AC-7 | L04–L14 | AC-26 | L08 |
| AC-8 | L02.S2 (+ L06, L07, L10, L11, L12) | AC-27 | L03.S2 |
| AC-9 | L05.S2 | AC-28 | L03.S4 (публічний репо) |
| AC-10 | L06.S1 | AC-29 | L04.S3 |
| AC-11 | L06.S2 | AC-30 | L04.S3 (команда), L14.S2 (workflow + runbook) |
| AC-12 | L06.S3 | AC-31 | L13.S3 |
| AC-13 | L07.S2 | AC-32 | L14 |
| AC-14 | S (`check-architecture.mjs` у `lint`), L07 | AC-33 | L04.S2/S4, L13.S3 |
| AC-15 | L08, L09 | AC-34 | L13.S4 |
| AC-16 | L09.S2 | AC-35 | L10 |
| AC-17 | L08.S1, L11 | AC-36 | L01, L03.S3 (gitleaks), L05, L10, L14 |
| AC-18 | L11.S2 | AC-37 | L06 (рев'ю) + **A** (рев'ю з `git diff`) |
| AC-19 | L10.S3, L11.S3 | AC-38 | L13.S4 (письмове) + B |

**Поза AC spec (вимога користувача):** OpenAPI — L05.S3 + регресійна перевірка `/api/docs-json` у кожному занятті з новими ендпоінтами (L06–L12, A).

---

## 5. Протокол виконання (інкрементальний — жорстка вимога)

### 5.1 Після затвердження
Генерується **лише** стартовий репозиторій + заняття 1 + його локальний еталон `lesson-01-solution` (розд. 6). Виконання — через ralph, scope: starter repo + L01.

### 5.2 Цикл одного заняття N
| # | Крок | Хто | Результат / умова переходу |
|---|---|---|---|
| G1 | **Передумови** | генератор | `PROGRESS.md`: N-1 = `closed`; `main` зелений (з L03 — CI); прочитано фактичний код `main`, drift log |
| G2 | **Генерація заняття** | генератор (executor, opus) | Гілка `lesson/NN` від `main`; (за потреби) окремі коміти `test(lMM): contract migration — <причина>`; коміт `course(lNN): materials + red tests`: README (Теорія з порівнянням з Express, Завдання, Кроки, Критерії готовності, **Контракт**, Підказки — теми по кроках і як запитати), поведінкові red-тести (з docs-json для нових ендпоінтів, з L05), stub-и лише для [FIX]-точок, фронт-інкремент, фікстури. **Annotated** тег `git tag -a lesson-NN-start` |
| G3 | **Еталон і валідація тестів** | генератор | `git clone` репо в scratchpad (не worktree). У клоні: (1) на `lesson-NN-start` нові кроки червоні **на assertion** (немає `TS\d{4}`, `Cannot find module`, `SyntaxError`, `[course]`), регресія зелена; (2) гілка `lesson-NN-solution` від `lesson-NN-start`: еталонна реалізація + `course/lesson-NN/solution.md` (рішення й trade-offs еталона); (3) на ній `lesson:check -- N --full` зелений (AC-4). Compose у клоні — лише `-p chat-it-<rand>`, `down -v`. Далі `git fetch <clone> lesson-NN-solution:lesson-NN-solution` — **без push**; клон видаляється. **Повторно еталон не генерується.** SHA і результат — у `PROGRESS.md` |
| W | **Студент пише** | студент | Свідомо **не відкриває `lesson-NN-solution` до рев'ю**. `npm run lesson:check -- N --step K` → зелено → коміт `feat(lNN.sK): …`. Якщо перевірка зламалась — README «Якщо зламалась перевірка» (5.5) |
| H | **Підказки (на запит)** | генератор | `hint LNN.SK` → **рівень 1 — натяк** (концепт/документація), **рівень 2 — напрям** (конкретний API Nest/TypeORM, структура без коду), **рівень 3 — конкретика** (фрагмент коду для місця, не повне рішення). Не цитують еталон дослівно. Журнал у `course/lesson-NN/hints.md` |
| C | **Перевірка заняття** | студент | `npm run lesson:check -- N` (+ `--full` для занять з infra/деплоєм). З L03: PR → CI зелений |
| R | **Запит рев'ю** | студент | «review lesson N» |
| R1 | **Рев'ю = порівняння підходів** | code-reviewer (окремий від генератора) | Вхід: `git diff lesson-NN-solution lesson/NN -- apps/api infra .github`. `course/lesson-NN/review.md`: (1) результати перевірок; (2) blockers; (3) **порівняння підходів** — для кожної теми: «твій підхід → підхід еталона → trade-offs → чому так в еталоні → коли твій варіант кращий → вердикт: лиши своє / розглянь еталон / рівноцінно»; (4) порівняння з тим, як це робиться в Express (де корисно); (5) що варто взяти з еталона (опційно). **Чекліст (blocker, якщо ні):** тести `test/lessons/**` не змінені студентом; є власний edge-case тест (з L05); кожна міграція сумісна з попереднім образом (з L04); AC-14 скрипт зелений; нові ендпоінти задокументовані в OpenAPI (з L05); секрети не в коді/логах/образах; письмові завдання (L13) виконані; для A — наявні стратегії не змінені. Пройдено → `reviewed` |
| M | **Merge** | студент | PR `lesson/NN` → `main` (з L04 — деплой). За бажанням cherry-pick з еталона; якщо рішення не проходить тести — merge еталона в `lesson/NN`. Рішення в `PROGRESS.md` (AC-5). Статус `closed` |
| D | **Drift log** | генератор | Відхилення студента, важливі для N+1 (назви таблиць, форма помилок, рішення по API) |

Лише після `closed` можна запускати G1 для N+1. `lesson-NN-solution` ніколи не пушиться: pre-push hook (локально) + GitHub ruleset (на сервері).

### 5.3 Фіксовані точки, контракт і contract migration
**Фіксовані точки [FIX] — лише три, і чому без них не можна:**
1. **`apps/api/src/app.module.ts` → `export class AppModule`.** e2e піднімають справжній застосунок **у процесі тесту**: nock перехоплює лише виклики свого процесу, env-ізоляція (`jest.isolateModulesAsync`) і швидкість теж вимагають in-process.
2. **`apps/api/src/app.setup.ts` → `configureApp(app: INestApplication): void`.** Prefix, pipes, filters, Swagger, `trust proxy`, cookie-parser мають бути ідентичні в `main.ts` і тестах; без спільної функції тести перевіряли б інакше сконфігурований застосунок.
3. **`apps/api/src/database/data-source.ts` → default export `DataSource`.** TypeORM CLI (`-d <path>`) працює лише з файлом data-source; від нього залежать `migration:*` (AC-8), global-setup і сервіс `migrate`.

Stub-и: `configureApp` (no-op, S) і `data-source.ts` (валідний з порожніми міграціями, старт L02). Інших stub-ів немає.

**Контракт (не внутрішня структура), фіксується в README заняття:** HTTP-шляхи, коди, JSON-форми (`toMatchObject`); SSE-події; присутність ендпоінтів у `/api/docs-json`; env-змінні; npm-скрипти; compose-сервіси (`db`, `db-test`, `migrate`, `api`, `web`); назви таблиць/колонок, які читають SQL-перевірки.

**Contract migration:** змінювати тести попередніх занять може лише генератор N+1, окремим комітом `test(lNN): contract migration — <причина>` + запис у drift log. Відомі випадки: health `checks` (L01→L02); `assistant_id` (L10 nullable → L11 `NOT NULL`); throttler у регресії (env-ліміти); денний ліміт L08 → `usage_logs` L12; винесення сценаріїв L08/L09 у контрактний набір (L11).

### 5.4 Іменування
- Гілки: `lesson/01`…; еталони (лише локально) `lesson-01-solution`…; опційні: `lesson/A`, `lesson-A-solution`.
- Теги: лише annotated, `lesson-01-start`.
- Коміти генератора: `course(lNN): …`, `test(lNN): contract migration — …`, `fix(course): …`.
- Тести: `apps/api/test/lessons/l01/s1-*.e2e-spec.ts`; власні — `apps/api/test/student/…`.

### 5.5 Машинерія курсу — відповідальність генератора
**Правило:** якщо ламається будь-що з машинерії — `lesson-check`, `check-ci-parity`, `check-architecture`, перевірка цілісності, git hooks, `db-guard`, no-network guard, `test/setup|support|factories|contracts`, фікстури, stub-и/фіксовані точки, Playwright-тести, згенерований фронт — це **баг генератора, а не завдання студента**. Генератор виправляє окремим комітом `fix(course): <що зламалось>` на поточній гілці заняття (і, якщо дефект уже в `main`, — PR у `main`), робить запис у drift log `PROGRESS.md` і, якщо фікс торкається тестів або еталона, переганяє G3-валідацію для еталона в scratchpad-клоні (еталон доповнюється тим самим `fix(course)`-комітом, не регенерується). Перевірка цілісності вважає `fix(course)`-коміти легальною базою.

**Розділ кореневого README «Якщо зламалась перевірка»** (генерується в старті) містить:
- **Ознаки помилки інструментів курсу:** падіння до запуску тестів або в `[preflight]`; повідомлення з міткою `[course]`; падіння guard-канарок (no-network, db-guard); падіння в `test/setup`/`test/support`/фікстурах або на коді, який студент не чіпав; той самий тест падає **з тією ж помилкою** і на `lesson-NN-solution`; червоне на чистому `lesson-NN-start` з причини, що не є assertion (`TS\d{4}`, `Cannot find module`, `SyntaxError`); перевірка цілісності скаржиться на файл, який студент не редагував.
- **Ознаки помилки в коді студента:** assertion-помилка з очікуваним vs фактичним значенням у тесті поточного кроку; на `lesson-NN-solution` той самий тест зелений.
- **Кроки діагностики:** (1) `npm run lesson:check -- N --step K --verbose`; (2) перевірити env (`.env.test`, `APP_ENV`), `docker ps`, `npm run db:up`, версії Node/Compose; (3) прогнати ту саму перевірку на еталоні: `git stash`/коміт, `git switch lesson-NN-solution`, `npm run lesson:check -- N --step K`, повернутись (це не порушує правило «не дивись до рев'ю» — дивимось лише вивід перевірки, не код); (4) якщо на еталоні теж падає або ознаки вище збігаються — це баг курсу.
- **Що надіслати генератору:** номер заняття й кроку, команду, повний вивід `--verbose`, результат на еталоні, `git rev-parse HEAD`, `git status --porcelain`, ОС/версії Node і Docker.

---

## 6. Scope першого виконання (після затвердження)

### 6.1 Стартовий репозиторій — генерується
- **Перший коміт `chore: starter` на `main`** уже містить `.gitignore` (з `.env`) і `.env.example`.
- **Окремий коміт `docs: course plan` на `main`** (одразу після `chore: starter`): `docs/course-plan.md` — байт-у-байт копія затвердженого `~/Projects/.omc/plans/ai-chat-course-plan.md`; оригінал лишається в `.omc/plans/`.
- **Root:** `package.json` (скрипти з 3.1 крім міграційних, `seed:admin`, `live:*`; `prepare`), `package-lock.json`, `.nvmrc`, `.editorconfig`, `.prettierrc`, `.githooks/pre-push`, `.githooks/pre-commit`, `eslint.config.mjs`, `tsconfig.base.json`, `README.md` (AC-6: цикл G1→D, рівні підказок, політика «еталон локально, не дивись до рев'ю, ніколи не пуш», секрети в публічному репо, налаштування GitHub, розділ **«Якщо зламалась перевірка»** за 5.5), `scripts/lesson-check.mjs` (з `--verbose`, мітками `[preflight]`/`[course]`), `scripts/check-architecture.mjs`.
- **`course/`:** `README.md` (карта занять, шпаргалка «Express → Nest»: middleware/guards/interceptors/pipes/filters, роутер vs контролер, ручні фабрики vs DI), `PROGRESS.md` (L01 = `generated`, запис G3, SHA еталона), `lesson-01/README.md`, `lesson-01/hints.md`.
- **`apps/api`:** `package.json` (Nest core/common/platform-express, `@nestjs/config`, class-validator, class-transformer; dev: jest, ts-jest, supertest, `pg`, типи), `nest-cli.json`, `tsconfig*.json`, `jest.config.ts`, `.env.test`, `src/main.ts`, `src/app.module.ts` [FIX], `src/app.setup.ts` [FIX, no-op], `test/setup/load-env.ts`, `test/support/{create-app,db}.ts`, тести `test/lessons/l01/*`.
- **`apps/web` — частковий shell** (Vite + React + TS, Tailwind, shadcn button/card, `theme.css` під `#root`, TanStack Query, `api/client.ts`, `features/health`), `vite.config.ts` з proxy, ESLint.
- **`infra/README.md`** — лише пояснення.
- **Git:** `git init`; `main` ← `chore: starter` ← `docs: course plan`; гілка `lesson/01` ← `course(l01): materials + red tests`; annotated тег `lesson-01-start`; локальна гілка `lesson-01-solution` (з G3). Remote не створюється і нічого не пушиться без явної команди користувача.
- Версії фіксуються в lockfile; перед генерацією — звірка актуальних major (NestJS, TypeORM, Tailwind/shadcn, gitleaks CLI) з документацією.

### 6.2 Заняття 1 — генерується
- `course/lesson-01/README.md`: Підготовка (публічний репо, secret scanning, push protection, ruleset, `npm ci`), Теорія (DI-контейнер і модулі Nest з нуля; порівняння з Express-роутерами й ручними фабриками; fail-fast конфіг і `APP_ENV`; навіщо `configureApp` і `AppModule` як [FIX]; Compose), Завдання, Кроки S1–S3 з оцінкою часу, Критерії готовності (команди), Контракт, Підказки (теми + як запитати).
- Red-тести: `l01/s0-github.remote-spec.ts` (лише `--full`), `l01/s1-health.e2e-spec.ts`, `l01/s2-config.e2e-spec.ts`, `l01/s3-database.e2e-spec.ts`.
- G3: еталон `lesson-01-solution` у scratchpad-клоні → fetch як локальна гілка; клон видалено.

### 6.3 Що НЕ генерується
- Будь-що для L02+ (README, тести, stub `data-source.ts`, фікстури, фабрики, `openapi.ts`, `check-ci-parity`, фронт-інкременти, еталони).
- `review.md`, тексти підказок.
- `.github/workflows/*`, Dockerfile-и, `infra/compose*.yml` (dev-compose — студент у L01.S3), `Caddyfile`, `cloud-init.yml`, Terraform, скрипти деплою/бекапу.
- Міграційні скрипти, TypeORM-залежності, `@nestjs/swagger`, nock, Playwright.
- Зовнішні ресурси й дії: GitHub-репо, push, Hetzner, Cloudflare (домен, DNS, R2), секрети.

---

## 7. Acceptance Criteria плану (тестовані)

**Перше виконання** (усі — командою):
1. `npm ci` → exit 0; `git config core.hooksPath` = `.githooks`; на `lesson/01`: `npm run lint` і `npm run typecheck` → exit 0.
2. `npm run lesson:check -- 1` (з `db-test`) → exit ≠ 0; S1–S3 = fail; `grep -E "TS[0-9]{4}|Cannot find module|SyntaxError|\[course\]"` по виводу — порожньо.
3. Без `db-test`: `lesson:check -- 1 --step 3` друкує `[preflight]` з підказкою `npm run db:up`, S3 fail з «db-test недоступна»; `--step 1`/`--step 2` не вимагають БД.
4. **G3:** знімки до/після: `git branch -a` відрізняється **рівно однією** новою гілкою `lesson-01-solution`; `git stash list`, `git worktree list`, `git status --porcelain`, `docker volume ls`, `docker ps -a --format '{{.Names}}'` ідентичні; імен `chat-it-*` немає; каталог клону не існує; `git merge-base lesson-01-solution lesson/01` = SHA `lesson-01-start`; у `PROGRESS.md` — SHA еталона і «L01 G3: red on start (assertion), green on solution, --full green».
5. `git branch --format='%(refname:short)' | sort` = `lesson-01-solution`, `lesson/01`, `main`; `ls course/` = `PROGRESS.md README.md lesson-01`; `ls .github/workflows infra/compose*.yml apps/*/Dockerfile` → «No such file».
6. `grep -cE "^## (Теорія|Завдання|Кроки|Критерії готовності|Підказки)" course/lesson-01/README.md` = 5; `grep -c "^## Контракт"` = 1 (AC-2).
7. `README.md`: кожен з термінів `G1`, `рівень 1`, `рівень 2`, `рівень 3`, `lesson-NN-solution`, `до рев'ю`, `pre-push`, `push protection` — `grep -c` ≥ 1 (AC-6).
8. `npm run dev` + `curl -s -o /dev/null -w "%{http_code}" localhost:5173/api/health`: на `lesson/01` **`== 404`**; 502/504 — окремий fail «api не стартував»; на `lesson-01-solution` (у G3-клоні) — `== 200`.
9. `git grep -nE "sk-ant-[A-Za-z0-9]" $(git for-each-ref --format='%(refname)' refs/heads)` — порожньо; `git log --diff-filter=A --format=%H -- .gitignore | tail -1` = корінний коміт; `git check-ignore -q .env` → exit 0.
10. `git cat-file -t lesson-01-start` = `tag`.
11. `find apps/api/test/lessons -name '*.spec.ts'` — порожньо; `grep -rPE "jest\.spyOn|overrideProvider|\.get\(|from '(\.\./)+src/(?!app\.module|app\.setup|database/data-source)" apps/api/test/lessons` — порожньо.
12. У G3-клоні: файл з класом `@Controller()`, що імпортує `typeorm` (будь-яка назва файлу) → `npm run lint` exit ≠ 0 (AC-14).
13. У G3-клоні: зміна будь-якого `test/lessons/l01/*` → `lesson:check -- 1` друкує warning цілісності.
14. У G3-клоні з локальним bare-remote: `git push <bare> lesson-01-solution` і `git push --all <bare>` → відхилено pre-push hook.
15. **Копія плану:** `diff docs/course-plan.md ~/Projects/.omc/plans/ai-chat-course-plan.md` — порожньо; `git log --format=%s -- docs/course-plan.md` містить `docs: course plan` (або файл є в корінному коміті).
16. **README «Якщо зламалась перевірка»:** `grep -c "^## Якщо зламалась перевірка" README.md` = 1; у цьому розділі (`awk` від заголовка до наступного `## `) кожен з термінів `[preflight]`, `[course]`, `--verbose`, `lesson-NN-solution`, `fix(course)`, `git rev-parse HEAD`, `npm run db:up` — `grep -c` ≥ 1.
17. `grep -ciE "spr[i]ng" README.md course/README.md course/lesson-01/README.md docs/course-plan.md` = 0 (патерн записано так, щоб сам рядок AC у копії плану не збігався).

**Курс загалом:**
18. Таблиця 4.3 покриває AC-1…AC-38.
19. Для кожного закритого заняття в `PROGRESS.md`: SHA `lesson-NN-start`, SHA еталона, результат G3 (`--full`), `review.md`, merge-рішення, contract migrations, `fix(course)`-коміти.
20. Для кожного N: дата тегу `lesson-(N+1)-start` пізніша за запис `closed` для N.
21. Після появи remote: `git ls-remote origin 'refs/heads/lesson-*-solution'` — порожньо.
22. З L05: для кожного заняття з новими ендпоінтами в `test/lessons/lNN` є виклик `expectDocumented` (`grep -l expectDocumented apps/api/test/lessons/lNN`); у production `/api/docs-json` → 404 (L05.S3 у регресії).

23. З L03: `node scripts/check-ci-parity.mjs` → exit 0, і він же падає (exit ≠ 0), якщо в job перевірок `ci.yml` додати інлайн `run: npx eslint .` або прибрати `npm run` скрипт, який викликає `lesson:check --full` (перевіряється в G3-клоні L03).

Частка перевірюваних командою: 23/23.

---

## 8. Risks & Mitigations
| Ризик | Ймовірність / вплив | Mitigation |
|---|---|---|
| **Недооцінка часу / вигорання** | Середня / високий | Реалістична оцінка 100–128 год; 4 кроки у важких заняттях; фактичні години в `PROGRESS.md`, ретро на чекпоінті L08 |
| **Поломка машинерії сприймається студентом як власна помилка** | Середня / середній | Правило 5.5; мітки `[preflight]`/`[course]`; README «Якщо зламалась перевірка»; `fix(course)`-коміти генератора |
| **Студент підглядає локальний еталон** | Середня / середній | Рішення U3 — свідома відповідальність; рев'ю дивиться на підходи; підказки не цитують еталон; діагностика на еталоні — лише вивід перевірки |
| **Випадковий push еталона в публічний репо** | Середня / високий | pre-push hook; GitHub ruleset «Restrict creations» без bypass; `git ls-remote` у `--full` і на рев'ю |
| **Витік секретів у публічному репо/образах** | Середня / високий | `.gitignore` з першого коміту; secret scanning + push protection з L01; gitleaks pre-commit (S) і CI (L03); GitHub Secrets; `.dockerignore` + перевірка образу; покриття ключів Anthropic push protection — звірити при L01 |
| **OpenAPI розходиться з реальними ендпоінтами** | Середня / низький | `expectDocumented` у кожному кроці з новими ендпоінтами; регресія; пункт чекліста рев'ю |
| **Swagger випадково ввімкнений у проді** | Низька / середній | Реєстрація лише за `APP_ENV`; e2e `APP_ENV=production` → 404 у регресії; remote-spec `/api/docs-json` → 404 (L05 деплой) |
| **Поведінкові тести не ловлять погану внутрішню структуру** | Висока / середній | Рев'ю-порівняння з еталоном; AC-14 скрипт; власні тести студента |
| **Тести прив'язані до назв таблиць/колонок** | Середня / середній | Схема — частина «Контракту»; contract migration; drift log |
| **AC-4 буквально не виконується** | Висока / низький | Локальний CI-еквівалент `--full` + `check-ci-parity`; follow-up — приватний репо еталонів |
| **Студент правит red-тести** | Середня / високий | Перевірка цілісності (warning) + blocker на рев'ю |
| **Тести проти dev/prod БД** | Низька / критичний | `DATABASE_URL=$DATABASE_URL_TEST` до імпорту data-source; `db-guard`; одноразові БД для revert |
| **infra-spec/G3 зачіпають compose студента** | Середня / середній | `name: chat-dev`/`chat-stack`; `-p chat-it-<rand>`, `down -v`; знімки Docker в AC №4 |
| **Rollback на образ N-1 ламається об нову схему** | Середня / високий | Expand→contract; rollback лише тегом; чекліст рев'ю |
| **Вартість Anthropic API** | Середня / середній | Haiku; spend limit; HTTP-фікстури + канарка; throttle за userId; денний ліміт; `REGISTRATION_ENABLED=false` |
| **Прод до auth / перебір пароля admin у L05** | Низька / високий | Немає ендпоінтів з даними до L05; реєстрація вимкнена; `ADMIN_PASSWORD` ≥ 20; argon2id |
| **Vendor concentration на Cloudflare** | Низька / високий | Бекапи в іншого провайдера, ніж VPS; 2FA і scoped-токени; опційний другий offsite |
| **`use_lockfile` не працює на R2** | Середня / низький | Перевірка при L13; CI-only apply з `concurrency` або HCP Terraform |
| **R2-токен бекапів може видаляти бекапи** | Низька / середній | Окремий токен на бакет; bucket lock/retention (перевірити); другий offsite |
| **SSE буферизується за Caddy / Cloudflare-проксі** | Середня / високий | `flush_interval -1`; `X-Accel-Buffering: no`; `res.flushHeaders()`; `proxied=false`; Playwright через повний стек |
| **DNS-міграція в Terraform дає простій** | Низька / середній | `import` + in-place update IP; зона — data source |
| **Дрейф версій бібліотек/провайдерів** | Середня / середній | Lockfile; звірка документації при генерації кожного заняття |

---

## 9. Verification Steps
1. **Після генерації старту:** виконати AC плану 1–17 (розд. 7), вивід — у звіті ralph.
2. **На кожному G3:** red на старті (assertion, без `TS\d{4}` і `[course]`), регресія зелена, `--full` зелений на еталоні в клоні, знімки git/Docker до/після → `PROGRESS.md`.
3. **AC-4:** SHA еталона + вивід `lesson:check -- N --full` — у `PROGRESS.md`.
4. **Шаблон заняття (AC-2):** 5 обов'язкових заголовків + «Контракт».
5. **З L01 (після появи remote):** `gh api` перевірки secret scanning/push protection/ruleset; `git ls-remote origin 'refs/heads/lesson-*-solution'` порожній. **З L03:** branch protection з 6 required checks і `enforce_admins`.
6. **З L05:** docs-json перевірки в регресії; production → 404.
7. **Чекпоінт L08:** `lesson:check -- 8 --full --remote https://<domain>`; Playwright smoke у CI; architect-рев'ю; фактичні години vs оцінка.
8. **Кінець ядра:** таблиця 4.3 — для кожного AC посилання на тест/CI run/runbook/рев'ю.
9. Рев'ю і верифікація — окремими агентами (code-reviewer / verifier), не генератором.

---

## 10. Обсяг і час — рішення V1 (U5)
**Рішення:** V1 — за умови користувача, що CI/CD і деплой не зсуваються пізніше чекпоінту L08. **Умова виконується:** CI/CD — L03, перший деплой — L04, чекпоінт — після L08. gitleaks — у L03 (через U1); у L14 — actionlint, paths-filter, `rollback.yml`.

**Переоцінка часу (ітерація 5):** ядро **100–128 год** (було 60–80): до чекпоінту 60–76 год, після — 40–52 год; опційні модулі 20–26 год. Важкі заняття L03, L04, L08, L13 мають по 4 кроки, щоб кожен крок лишався в межах 1–2 год; кількість занять ядра (14) і чекпоінт (після L08) не змінились.

| Варіант | Суть | Статус |
|---|---|---|
| **V1** | actionlint, paths-filter, `rollback.yml` → L14; ядро 14 (4 кроки в L03/L04/L08/L13), чекпоінт після L08 | **Обрано (2026-10-22)** |
| V2 | Розбити L04 на два заняття; ядро 15, чекпоінт після L09 | Відхилено: 4 кроки в L04 дають той самий ефект без зсуву чекпоінту |
| V3 | Розбити L03 і L04; ядро ~16, чекпоінт після L10 | Відхилено: відхід від «~14» у spec |

---

## 11. Open Questions

### Вирішено користувачем (2026-10-22)
- **U1 — публічний репо.** Секрети лише в GitHub Secrets; `.env` у `.gitignore` з першого коміту; secret scanning + push protection з L01; gitleaks у CI з L03 + pre-commit hook; еталонні гілки лише локально (pre-push hook + ruleset); GHCR-пакети public.
- **U2 — домен у Cloudflare Registrar** до кінця L03; DNS — провайдер `cloudflare`, `proxied = false`; до L13 записи вручну, у L13.S2 — `import`.
- **U3 — еталон генерується в G3**, лежить локально, не регенерується; «не дивитись до рев'ю» — відповідальність студента; тести лише поведінкові; рев'ю порівнює підходи.
- **U4 — Cloudflare R2** для TF state і бекапів; окремі бакети й токени.
- **U5 — V1**, умова виконується.
- **Затвердження з правками (ітерація 5):** прибрано хибні паралелі з Java-фреймворком (профіль: сильний FE + шароване Express-API, WebSockets, Redis, streaming); час 100–128 год; 4 кроки в L03/L04/L08/L13; правило машинерії; OpenAPI у L05.S3; копія плану в `docs/course-plan.md`.

### Прийнято за замовчуванням
- Репо: `~/Projects/ai-chat`.
- `REGISTRATION_ENABLED=false` у проді з L05; Swagger у проді вимкнено.
- Terraform ≥ 1.10; сервер у L13 — recreate, DNS — import.
- Модуль A: рішення про момент — на чекпоінті L08.
- AC-4: локальний CI-еквівалент `--full` (прийнято затвердженням плану; приватний репо еталонів — follow-up).

### Перевірити при генерації
- [ ] (L01) Чи покриває GitHub push protection формат ключів Anthropic; актуальний CLI gitleaks для pre-commit.
- [ ] (L05) Актуальна major `@nestjs/swagger`, сумісна з версією Nest.
- [ ] (L08) Транспорт Anthropic SDK: nock ≥14 vs undici `MockAgent`.
- [ ] (L12) Мінімальний поріг prompt caching для обраної моделі.
- [ ] (L13) `use_lockfile` на R2; назви ресурсів провайдера `cloudflare` v5.
- [ ] (L14) R2 bucket lock/retention для захисту бекапів.

---

## 12. ADR
- **Decision:** npm workspaces; один **публічний** репо: `lesson/NN` → PR → `main`, annotated-теги `lesson-NN-start`; еталон `lesson-NN-solution` створюється в G3 (scratchpad-клон, `--full` зелений) і фетчиться як локальна гілка без push, захищений pre-push hook і GitHub ruleset; **лише поведінкові тести** з трьома фіксованими точками (`AppModule`, `configureApp`, `data-source.ts`); рев'ю = порівняння підходів з еталоном; **машинерія курсу — відповідальність генератора** (`fix(course)`, README «Якщо зламалась перевірка»); `lesson:check` з покроковим preflight, перевіркою цілісності, `--full` як CI-еквівалентом і `--verbose`; Postgres для тестів — `db-test`/service container з запобіжниками; `APP_ENV` як джерело політик; сервіс `migrate` і expand→contract; порядок L04 → L05–06 з `REGISTRATION_ENABLED=false`; OpenAPI з L05.S3 (лише dev/test/ci) з регресійною перевіркою docs-json; deploy — job у `ci.yml` з GitHub Environments; Cloudflare Registrar + DNS (`proxied=false`) + R2; Terraform: сервер recreate, DNS import; gitleaks з L03; обсяг V1 з 4 кроками в L03/L04/L08/L13; теорія — порівняння з Express, без повторення HTTP-основ.
- **Drivers:** навчальна ефективність для сильного FE з досвідом Express; машинна перевірюваність без прив'язки до структури; безпека й вартість у публічному репо.
- **Alternatives considered:** pnpm, Nx/Turborepo; еталон після рев'ю (spec); приватний репо еталонів; окремі репо курсу/студента; unit-тести на фіксовані сервіси; тести в `course/`; Testcontainers; fake-обгортка SDK; `NODE_ENV` для політик; перестановка auth; обов'язковий allowlist, basic auth, тунель; Hetzner Object Storage, HCP Terraform + B2; terraform import сервера, recreate DNS; Swagger за auth або відкритий у проді; V2/V3.
- **Why chosen:** еталон перевіряється тими самими тестами в момент генерації; поведінкові тести переживають рефакторинг; явна межа «код студента vs інструменти курсу» знімає хибне налагодження; публічний репо дає безкоштовні захисти; R2 — нуль вартості й бекапи поза провайдером VPS; DNS import без простою; Swagger лише поза продом не розкриває API-мапу.
- **Consequences:** студент може підглянути еталон; AC-4 — у локальній інтерпретації; частина якості перевіряється лише рев'ю; тести залежать від назв таблиць і присутності ендпоінтів у OpenAPI; курс довший (100–128 год); vendor concentration на Cloudflare; логін без rate limit протягом L05; немає Swagger на проді.
- **Follow-ups:** перевірки при генерації (розд. 11); можливий приватний репо еталонів; спільний пакет типів SSE-подій api↔web — переглянути на L11; можлива генерація типів фронту з `/api/docs-json` — переглянути на L08.

---

## 13. Changelog

### Ітерація 2 (REVISE від Critic, передано координатором)
| # | Зміна | Де | Зауваження |
|---|---|---|---|
| 1 | `APP_ENV` + `COOKIE_SECURE`; політики прив'язані до `APP_ENV` | 3.4, L01, L06, L08, L11 | Critic |
| 2 | Contract migration, `toMatchObject`, відомі конфлікти | 5.3 | Critic |
| 3 | Firewall: 22 key-only, користувач `deploy` | L04, L13 | Critic |
| 4 | No-network через nock ≥14 + канарка; HTTP-фікстури; без fake-обгортки SDK | 3.5, L08, L11 | Critic |
| 5 | No-op stub-и без `throw`; жодного `TS\d{4}` | 3.3, 7 | Critic |
| 6 | Одноразова БД для revert; `db-guard`; підстановка `DATABASE_URL` | 3.3, L02 | Critic |
| 7 | AC-28: branch protection + заборона обходу; `gh api` | L03 | Critic |
| 8 | Покроковий preflight; ECONNREFUSED → assertion | 3.2, L01 | Critic |
| 9 | G3 у `git clone`, не worktree | 5.2 | Critic |
| 10 | Одноразовий сервіс `migrate` | L03, L04 | Critic |
| 11 | Доступ до GHCR з сервера | L04 | Critic |
| 12 | Перевірка цілісності тестів | 3.2, 5.2 | Critic |
| 13 | Лише annotated-теги | 5.4 | Critic |
| 14 | AC плану перевірювані командою | 7 | Critic |
| 15 | `infra`/`remote` поза регресією; `--full` | 3.2 | Critic |
| 16 | Архітектурний guard у стартовому репо | 3 | Critic |
| 17 | CI-compose: `REGISTRATION_ENABLED=true` | L03 | Critic |
| 18 | Fault injection тригером; throttler: env-ліміти, лише невдалі, `trust proxy 1`, за userId | L06, L07, L08 | Critic |
| 19 | GitHub Environments; deploy як job; власні edge-case тести; SSE-деталі; `REGISTRATION_ENABLED=false`; денний ліміт | L04, L05, L08, L13 | Critic |
| 20 | Нові ризики | 8 | Critic |
| U5 | Урізання L03/L04; варіанти V2/V3 | 10 | Critic |

### Ітерація 3 (improvements після консенсусу)
| # | Зміна | Де | Зауваження |
|---|---|---|---|
| 1 | Ізоляція compose: `-p chat-it-<rand>`, явні `name:`, знімки Docker | 3, L03, 5.2, 7 | Architect (MUST-FIX A) |
| 2 | Expand→contract; `assistant_id` nullable → `NOT NULL` у L11 | L04, L10, L11, 5.2 | Architect (MUST-FIX B) |
| 3 | AC №8: `== 404` на старті | 7 | Critic |
| 4 | База цілісності — останній коміт генератора по шляху | 3.2 | Critic |
| 5 | `run --rm migrate && up -d --wait api web`; мінімальна версія Compose | L03, L04 | Critic |
| 6 | Явний крок доступу до GHCR | L04 | Critic |
| 7 | `ADMIN_PASSWORD` ≥ 20 | L05 → L02 | Critic |
| 8 | `multitenancy-path.md` — письмове завдання | L13 | Critic |
| 9 | Позначка консенсусу; терміни U1–U5 | шапка, 11 | Координатор |

### Ітерація 4 (рішення користувача)
| # | Зміна | Де | Автор |
|---|---|---|---|
| U3-1 | Еталон генерується в G3, фетчиться як локальна `lesson-NN-solution`, не регенерується; AC №4 — рівно одна нова гілка | 1, 2.3(a2), 5.2, 6, 7, 9, 12 | Користувач (U3) |
| U3-2 | Лише поведінкові тести; три фіксовані точки з обґрунтуванням; «Контракт» у README заняття | 2.1, 2.3(b), 3, 3.3, 3.5, 4, 5.3, 7 | Користувач (U3) |
| U3-3 | Наслідки для карти: `seed:admin` → L02.S3; L07.S3 з `firstMessage`; L08/L09/L11 — через HTTP; AC-37 — рев'ю | L02, L05, L07, L08, L09, L11, A | Planner (з U3) |
| U3-4 | Рев'ю = порівняння підходів з еталоном | 5.2 | Користувач (U3) |
| U1 | Публічний репо: secret scanning, push protection, pre-push hook і ruleset для еталонів, gitleaks → L03, GHCR public | 3, 3.4, L01, L03, L04, 5, 6, 7, 8 | Користувач (U1); gitleaks → L03 — Planner |
| U2 | Домен у Cloudflare Registrar; DNS вручну до L13, у L13 — `import` | L03, L04, L13 | Користувач (U2); вибір import — Planner |
| U4 | Cloudflare R2 для state і бекапів, окремі бакети/токени | 2.3(d), L13, L14, 8, 11 | Користувач (U4) |
| U5 | V1 зафіксовано | 10 | Користувач (U5) |
| — | AC-4 як локальний CI-еквівалент | 4.3, 11 | Planner |

### Ітерація 5 (затвердження з правками)
| # | Зміна | Де | Автор |
|---|---|---|---|
| 1 | Прибрано всі паралелі з Java-фреймворком (хибний профіль); профіль: сильний FE + шароване Express-API, WebSockets, Redis, streaming; HTTP-шарування не подається як нове; з нуля — Postgres/ORM/міграції, Nest DI/модулі, Docker/CI, IaC; де корисно — порівняння з Express; шпаргалка «Express → Nest» | 1, 2.2, 4 (усі заняття), 5.2, 6, 12; AC плану №17 | Користувач |
| 2 | Переоцінка: ядро 100–128 год (таблиця годин по заняттях); L03, L04, L08, L13 — по 4 кроки; оновлено трасування AC на рівні кроків | 1, 4, 4.3, 10 | Користувач; розбиття кроків — Planner |
| 3 | Правило «машинерія курсу — відповідальність генератора»: `fix(course)`, drift log, повторна G3-валідація; README «Якщо зламалась перевірка» (ознаки, діагностика, що надіслати); мітки `[preflight]`/`[course]`, `--verbose`; `check-ci-parity` | 2.1, 3, 3.2, 5.2, 5.4, 5.5, 6.1, 8; AC плану №16 | Користувач |
| 4 | OpenAPI (`@nestjs/swagger`) у L05.S3: `/api/docs`, `/api/docs-json`; регресійна перевірка нових ендпоінтів у кожному наступному занятті; у production вимкнено за `APP_ENV` (опція 2.3(e)) | 2.3(e), 3, 3.3, 3.4, L05–L12, 4.3, 5.2, 8; AC плану №22 | Користувач; вибір «вимкнено в проді» — Planner |
| 5 | Копія плану в репо: `docs/course-plan.md` окремим комітом `docs: course plan`; AC — `diff` з оригіналом | 3, 6.1; AC плану №15 | Користувач |
| 6 | Статус: approved (2026-10-22), execution via ralph — scope: starter repo + L01 | шапка, 5.1 | Користувач |
