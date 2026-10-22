# AI Chat — практичний курс: NestJS + PostgreSQL + TypeORM

Курс для розробника із сильним фронтенд-бекграундом, який уже писав шароване Express-API, WebSockets, Redis і streaming у Node. Ти сам пишеш бекенд (NestJS + TypeORM + PostgreSQL), Docker, CI/CD і Terraform; фронтенд (React + Vite SPA) отримуєш готовим, інкрементами, до відповідних занять.

**Результат курсу:** універсальний AI-чат — auth, розмови, асистенти в БД, Anthropic → Ollama → провайдер-абстракція, tool use, prompt caching, облік токенів, OpenAPI-документація — задеплоєний на Hetzner VPS (Compose + Caddy + GitHub Actions → GHCR → SSH), з інфраструктурою в Terraform і бекапами в Cloudflare R2.

- Карта занять і шпаргалка «Express → Nest»: [`course/README.md`](course/README.md)
- Стан занять, SHA, рішення: [`course/PROGRESS.md`](course/PROGRESS.md)
- Затверджений план курсу: [`docs/course-plan.md`](docs/course-plan.md)
- Перше заняття: [`course/lesson-01/README.md`](course/lesson-01/README.md) (з'являється на гілці `lesson/01`)

## Вимоги до оточення

| Що | Версія | Навіщо |
|---|---|---|
| Node.js | 24 (див. `.nvmrc`; `nvm use`) | усе |
| npm | 11+ (йде з Node 24) | npm workspaces |
| **Docker** — OrbStack або Docker Desktop | **Docker Compose ≥ 2.24** | Postgres у Compose — **з L01.S3**; образи — з L03 |
| GitHub CLI `gh` | будь-яка актуальна | підготовка L01 і `--full`-перевірки |
| gitleaks (опційно, рекомендовано) | 8.x | pre-commit перевірка секретів |

> Без Docker кроки L01.S1 і L01.S2 проходяться повністю, а для **L01.S3 Docker потрібен** (OrbStack або Docker Desktop з Compose ≥ 2.24).

## Швидкий старт

```bash
nvm use                         # Node 24
npm ci                          # залежності + git hooks (core.hooksPath = .githooks)
cp .env.example apps/api/.env   # конфіг для розробки (api запускається з теки apps/api)
npm run dev                     # api (Nest, :3000) + web (Vite, :5173, проксі /api → :3000)
npm run lesson:check -- 1       # перевірка заняття 1
```

## Структура монорепо

```
apps/api      NestJS-застосунок (пишеш ти) + test/ (машинерія курсу і тести занять)
apps/web      React + Vite SPA (генерується курсом, ти його не пишеш)
infra/        Compose, Caddy, деплой, Terraform (пишеш ти, з L01)
course/       матеріали занять, прогрес, журнали підказок
docs/         план курсу, письмові завдання
scripts/      lesson-check, архітектурні перевірки (машинерія курсу)
.githooks/    pre-commit (gitleaks), pre-push (захист еталонів)
```

Структура `apps/api/src/**` — твоя: назви модулів, сервісів і файлів обираєш сам. Курс фіксує лише три точки **[FIX]** (`AppModule` у `src/app.module.ts`, `configureApp` у `src/app.setup.ts`, з L02 — `src/database/data-source.ts`) і **Контракт** кожного заняття (HTTP, env, compose-сервіси, таблиці).

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | api (`nest start --watch`) + web (`vite`, :5173) паралельно |
| `npm run db:up` / `npm run db:down` | `docker compose -f infra/compose.dev.yml up -d --wait` / `down` (файл пишеш ти в L01.S3) |
| `npm run lint` | ESLint + `scripts/check-architecture.mjs` (контролери не імпортують TypeORM) |
| `npm run typecheck` | `tsc --noEmit` в усіх workspaces |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:e2e` / `test:infra` | jest-проєкти `apps/api` (+ vitest web) |
| `npm run lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]` | перевірка заняття (нижче) |

### `lesson:check`

1. **Preflight** — Node з `.nvmrc`, `apps/api/.env.test`, git hooks, фіксовані точки [FIX]; db-test — лише для кроків, яким потрібна БД (у L01 — тільки S3); Docker/Compose — лише для infra-тестів. Кожне повідомлення має префікс `[preflight]`.
2. **Цілісність тестів** — `apps/api/test/lessons/**` порівнюються з останнім комітом генератора; зміни → warning (на рев'ю — blocker).
3. **Кроки** заняття (`--step K` — лише один крок, без регресії і статики).
4. **Регресія** — e2e попередніх занять і твої власні тести.
5. **Статика** — `lint` + `typecheck`.
6. `--full` — CI-еквівалент: додає remote-тести (GitHub-налаштування, з L04 — прод) та infra-регресію.

Підсумок — таблиця «перевірка → pass/fail/skip (к-сть тестів)» і попередження; exit ≠ 0 при будь-якому fail.

## Як влаштоване заняття (цикл G1 → D)

| # | Крок | Хто | Що відбувається |
|---|---|---|---|
| **G1** | Передумови | генератор | Попереднє заняття `closed`, `main` зелений; генератор читає **твій фактичний код** і drift log |
| **G2** | Генерація заняття | генератор | Гілка `lesson/NN` від `main`; коміт `course(lNN): materials + red tests` — README заняття і поведінкові **red-тести**; annotated-тег `lesson-NN-start` |
| **G3** | Еталон | генератор | В окремому клоні: тести червоні на старті (саме на assertion), зелені на еталонній реалізації; еталон стає **локальною** гілкою `lesson-NN-solution` |
| **W** | Ти пишеш | ти | Крок за кроком: `npm run lesson:check -- N --step K` → зелено → коміт `feat(lNN.sK): …` |
| **H** | Підказки | генератор | Лише на запит, 3 рівні (нижче) |
| **C** | Перевірка заняття | ти | `npm run lesson:check -- N` (+ `--full`, де є infra/деплой); з L03 — PR і зелений CI |
| **R** | Запит рев'ю | ти | «review lesson N» |
| **R1** | Рев'ю | окремий рев'юер | `course/lesson-NN/review.md`: перевірки, blockers і **порівняння підходів** — твій vs еталонний, trade-offs, вердикт «лиши своє / розглянь еталон / рівноцінно» |
| **M** | Merge | ти | PR `lesson/NN` → `main` (з L04 — деплой); рішення фіксується в `PROGRESS.md` |
| **D** | Drift log | генератор | Твої рішення, важливі для наступного заняття (назви таблиць, форма помилок тощо) |

Наступне заняття генерується лише після того, як попереднє `closed` — на основі твого коду в `main`.

### Еталон `lesson-NN-solution`: локально, не дивись до рев'ю, ніколи не пуш

- Еталон створюється разом із заняттям і лежить **лише локально** в гілці `lesson-NN-solution`.
- Не відкривай його **до рев'ю** — це твоя свідома відповідальність, технічної заборони немає. Рев'ю порівнює твій підхід з еталонним, тож самостійне рішення — головна цінність заняття.
- Єдиний дозволений виняток — діагностика зламаної перевірки (розділ нижче): запускаєш перевірку на еталоні й дивишся лише **вивід**, не код.
- Еталон **ніколи не пушиться**: hook **pre-push** відхиляє будь-який push, що зачіпає `refs/heads/lesson-*-solution` (зокрема `git push --all` і `--mirror`), а на GitHub ruleset «Restrict creations» для цього патерну блокує створення таких гілок без bypass.

### Підказки — на запит, 3 рівні

Запит: `hint L01.S2` (можна уточнити, де застряг). Кожна підказка записується в `course/lesson-NN/hints.md`.

- **рівень 1 — натяк:** концепт або розділ документації, куди дивитись.
- **рівень 2 — напрям:** конкретний API Nest/TypeORM і структура рішення, без коду.
- **рівень 3 — конкретика:** фрагмент коду для конкретного місця, але не повне рішення.

Підказки ніколи не цитують еталон дослівно. Проси наступний рівень, лише якщо попередній не допоміг.

## Секрети в публічному репозиторії

Репозиторій публічний — тому:

- `.env` і `.env.*` у `.gitignore` з першого коміту (виняток — `.env.example` і нечутливий `apps/api/.env.test`).
- На GitHub увімкнені **secret scanning** і **push protection** (налаштовуєш у підготовці L01) — push із секретом буде відхилено.
- `pre-commit` запускає `gitleaks git --pre-commit --staged`, якщо gitleaks встановлено (інакше — лише попередження); з L03 gitleaks — ще й job у CI.
- Секрети живуть лише в GitHub Secrets (environment-scoped, з L04) і в `.env` на сервері; ніколи — у коді, логах, build args чи образах.

## Налаштування GitHub

Покроково — у розділі «Підготовка» [`course/lesson-01/README.md`](course/lesson-01/README.md): публічний репо, secret scanning, push protection, ruleset для `refs/heads/lesson-*-solution`. Перевірка: `npm run lesson:check -- 1 --full`.

## Якщо зламалась перевірка

Інструменти курсу (`lesson-check`, `check-architecture`, git hooks, `test/setup`, `test/support`, фікстури, фіксовані точки [FIX], згенерований фронт) — **відповідальність генератора, а не твоє завдання**. Якщо зламалися вони — це баг курсу; генератор виправляє його окремим комітом `fix(course): <що зламалось>` і робить запис у drift log `course/PROGRESS.md`.

**Ознаки помилки інструментів курсу:**

- падіння до запуску тестів або повідомлення `[preflight]`, хоча оточення в порядку (Docker запущений, `npm run db:up` виконано, Node з `.nvmrc`);
- будь-яке повідомлення з міткою `[course]`;
- падіння guard-канарок (з L02 — db-guard, з L08 — no-network);
- падіння в `apps/api/test/setup`, `apps/api/test/support`, у фікстурах або на коді, якого ти не чіпав;
- той самий тест падає **з тією ж помилкою** і на `lesson-NN-solution`;
- червоне на чистому `lesson-NN-start` з причини, що не є assertion: `TS1234`-подібні коди, `Cannot find module`, `SyntaxError`;
- перевірка цілісності скаржиться на файл, який ти не редагував.

**Ознаки помилки у твоєму коді:** assertion-помилка з очікуваним vs фактичним значенням у тесті поточного кроку, а на `lesson-NN-solution` цей самий тест зелений.

**Кроки діагностики:**

1. `npm run lesson:check -- N --step K --verbose` — повний вивід jest, змінні тестового оточення (без секретів), шлях до БД, версії Node/Docker/Compose.
2. Перевір оточення: `apps/api/.env.test`, `APP_ENV`, `docker ps`, `npm run db:up`, версії Node (`node -v` vs `.nvmrc`) і Compose (`docker compose version`).
3. Прожени ту саму перевірку на еталоні — це **не** порушує правило «не дивись до рев'ю», бо дивишся лише вивід:
   ```bash
   git stash -u            # або закоміть роботу
   git switch lesson-NN-solution
   npm run lesson:check -- N --step K
   git switch lesson/NN && git stash pop
   ```
4. Якщо на еталоні падає так само або збігаються ознаки вище — це баг курсу.

**Що надіслати генератору:** номер заняття і кроку; команду; повний вивід з `--verbose`; результат тієї ж перевірки на `lesson-NN-solution`; вивід `git rev-parse HEAD` і `git status --porcelain`; ОС і версії Node та Docker.
