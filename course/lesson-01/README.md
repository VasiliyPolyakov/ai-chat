# L01 — Монорепо і Nest-основи

**Мета:** Nest-застосунок з health-ендпоінтом, валідованим конфігом і Postgres у Compose; безпечний публічний репозиторій.
**Час:** 6–8 год (підготовка ~20–30 хв + 3 кроки по 1–2 год + рев'ю).
**Гілка:** `lesson/01`, старт — тег `lesson-01-start`.

> **Docker:** кроки S1 і S2 Docker не потребують. Для **S3 потрібен Docker** — OrbStack або Docker Desktop з **Docker Compose ≥ 2.24** (`docker compose version`). Встанови його до початку S3.

## Підготовка

Без red-тестів; перевіряється `npm run lesson:check -- 1 --full` (крок S0).

1. **Публічний GitHub-репозиторій.** Створи порожній публічний репо (без README/.gitignore — вони вже є) і підключи його:
   ```bash
   gh repo create <name> --public --source . --remote origin
   git push -u origin main lesson/01 --follow-tags
   ```
   Пуш **конкретних** гілок — так і працюй далі. Не використовуй `git push --all`: еталонні гілки `lesson-NN-solution` локальні, і pre-push hook відхилить такий пуш повністю.
2. **Secret scanning і push protection:** Settings → Security (Advanced Security / Code security) → увімкни *Secret Protection* / *Secret scanning* і *Push protection*. Для публічних репо це безкоштовно.
3. **Ruleset для еталонів:** Settings → Rules → Rulesets → *New branch ruleset*:
   - Name: `no-solution-branches`; Enforcement status: **Active**; Bypass list — **порожній**;
   - Target branches → *Add target* → *Include by pattern*: `lesson-*-solution` (у API це `refs/heads/lesson-*-solution`);
   - Rules: **Restrict creations**.
4. **Залежності й hooks:** `npm ci` (ставить `core.hooksPath = .githooks`). Перевір: `git config core.hooksPath` → `.githooks`.
5. (Рекомендовано) **gitleaks** для pre-commit: `brew install gitleaks`. Без нього hook лише попереджає.
6. **Конфіг для розробки:** `cp .env.example apps/api/.env` — `npm run dev` запускає api з робочою текою `apps/api`. `.env` вже в `.gitignore`.

Перевірка підготовки: `gh auth status`, потім `npm run lesson:check -- 1 --full` — рядок `S0 (підготовка)` має бути `pass`.

## Теорія

### 1. Від ручних фабрик до DI-контейнера

У шарованому Express-API ти, найімовірніше, мав composition root: фабрику `createApp()`, яка створює пул БД, репозиторії, сервіси й передає їх у роутери. Це і є Dependency Injection — просто ручний. Nest робить те саме **автоматично**:

- **Провайдер** — клас з `@Injectable()` (або значення/фабрика під токеном). Контейнер створює його сам і кешує (singleton за замовчуванням).
- **Інжекція через конструктор:** `constructor(private readonly config: ConfigService) {}` — контейнер знаходить провайдер за типом параметра. Це працює завдяки `emitDecoratorMetadata`: TypeScript записує типи параметрів конструктора в метадані, і Nest читає їх під час старту.
- **Граф залежностей** будується на старті. Якщо провайдер не знайдено — застосунок **не стартує** (помилка `Nest can't resolve dependencies of X`), а не падає на першому запиті, як було б з ручною фабрикою і `undefined`.

### 2. Модулі — межі видимості

`@Module({ imports, controllers, providers, exports })` — це не просто тека з файлами:

- провайдер видимий **лише всередині свого модуля**, доки модуль його не `exports`, а інший модуль не `imports` цей модуль;
- `AppModule` — корінь графа; Nest обходить `imports` рекурсивно;
- **глобальні модулі** (`@Global()` або `isGlobal: true` у `ConfigModule.forRoot`) роблять експорти доступними всюди — зручно для конфігу, але не зловживай: явні `imports` — це документація залежностей;
- **динамічні модулі** (`ConfigModule.forRoot({...})`) — модуль, налаштований параметрами під час імпорту. Важлива деталь: `forRoot()` **виконується в момент імпорту файлу**, тому валідація env, зроблена тут, падає ще до створення застосунку.

Порівняння з Express: у Express «модуль» — це домовленість (тека `users/` з роутером і сервісом), і нічого не заважає імпортувати репозиторій напряму в роутер. У Nest межі перевіряються контейнером.

### 3. Lifecycle і shutdown

Nest викликає хуки провайдерів: `onModuleInit` → `onApplicationBootstrap` під час старту; `onModuleDestroy` → `beforeApplicationShutdown` → `onApplicationShutdown` під час `app.close()`. За замовчуванням Nest **не слухає** `SIGTERM`/`SIGINT` — їх вмикає `app.enableShutdownHooks()`. У Docker/Compose (з L03) це означає коректне закриття з'єднань з БД замість обриву. В Express ти робив те саме вручну через `process.on('SIGTERM')`.

### 4. Контролер ≈ роутер

`@Controller('health')` + `@Get()` ≈ `router.get('/health', handler)`. Відмінності: обробник — метод класу, залежності інжектуються в конструктор контролера, а значення, яке ти повертаєш, Nest серіалізує в JSON сам. Глобальний префікс (`/api`) задається на рівні застосунку — `app.setGlobalPrefix('api')` ≈ `app.use('/api', router)`.

### 5. Fail-fast конфіг і `APP_ENV`

Конфіг валідується **на старті**: невалідне оточення → застосунок не піднімається, з назвою змінної в повідомленні. Так помилка конфігурації видна одразу під час деплою, а не через годину в логах. В Express ти, можливо, робив `dotenv` + zod/envalid на початку `server.ts`; у Nest це `@nestjs/config`: `ConfigModule.forRoot({ validate })` (функція валідації — твоя: class-validator + class-transformer, zod або власна) і `ConfigService` для читання значень.

`APP_ENV` (`development | test | ci | production`) — **єдине джерело політик** застосунку (що вмикати в проді, що заборонено). `NODE_ENV` лишається для бібліотек: багато з них змінюють поведінку від `NODE_ENV=production`, і змішувати це з політиками застосунку небезпечно.

### 6. Чому `AppModule` і `configureApp` — фіксовані точки [FIX]

Тести курсу поведінкові: вони піднімають **справжній** застосунок у процесі тесту і ходять у нього HTTP-запитами (supertest), не знаючи назв твоїх сервісів. Для цього їм потрібні рівно дві речі:

- `export class AppModule` у `apps/api/src/app.module.ts` — корінь графа, який тест компілює;
- `export function configureApp(app: INestApplication): void` у `apps/api/src/app.setup.ts` — усе, що налаштовує **застосунок** (префікс, pipes, filters, shutdown hooks, пізніше — Swagger, cookie-parser). Вона викликається і з `main.ts`, і з тестів, тож тести перевіряють той самий застосунок, що працює в проді. Це той самий прийом, що й `createApp()` для supertest в Express.

Тестовий хелпер ізолює модулі для кожного старту (`jest.isolateModulesAsync`) і динамічно імпортує `AppModule`, бо валідація env відбувається під час імпорту конфіг-модуля: тест «без `DATABASE_URL` старт відхилено» інакше побачив би закешований модуль від попереднього тесту.

Усе інше — назви модулів, контролерів, сервісів, файлів — твій вибір. Рев'ю порівняє твій підхід з еталонним.

### 7. Postgres у Docker Compose

PostgreSQL з'являється вже тут, хоча працювати з ним ти почнеш у L02: спершу треба мати відтворюване оточення.

- **Compose-файл** описує сервіси, їхні образи, порти, змінні, томи; `name:` у файлі задає ім'я проєкту — від нього залежать імена контейнерів, мереж і томів (`chat-dev_db-data`), тож різні стеки не конфліктують.
- **Два сервіси з різними задачами:** `db` — для розробки, дані живуть в **іменованому volume** і переживають перезапуск; `db-test` — для тестів, дані на **tmpfs** (у пам'яті): швидко, і кожен перезапуск дає чисту БД.
- **Порти:** `"5433:5432"` — порт хоста : порт контейнера. Тести знають лише `DATABASE_URL_TEST` з `apps/api/.env.test` (`localhost:5433/chat_test`).
- **Healthcheck** (`pg_isready`) — Compose знає, коли Postgres готовий приймати з'єднання; `docker compose up -d --wait` (наш `npm run db:up`) чекає саме на healthy.
- Офіційний образ `postgres` створює БД з `POSTGRES_DB` і користувача з `POSTGRES_USER`/`POSTGRES_PASSWORD` під час першої ініціалізації; дані зберігаються в `/var/lib/postgresql/data`.

Якщо на машині вже працює локальний Postgres на 5432 (наприклад, з Homebrew), порт хоста для `db` можна зробити іншим (Контракт фіксує лише `db-test` на 5433) і відповідно поправити `DATABASE_URL` у своєму `.env`.

## Завдання

Побудуй основу бекенду:

1. `GET /api/health` повертає стан застосунку; усі маршрути живуть під префіксом `/api`; застосунок коректно закривається за сигналом.
2. Конфіг з env валідується на старті: невалідне оточення не дає застосунку піднятися.
3. `infra/compose.dev.yml` піднімає Postgres 17 для розробки і для тестів.

Організацію коду (модулі, назви, файли) обираєш сам — тести перевіряють лише поведінку з розділу «Контракт».

## Кроки

Після кожного кроку: `npm run lesson:check -- 1 --step K` → зелено → коміт `feat(l01.sK): …`.

### S1 — Health + `configureApp` (1–1,5 год)

- Модуль і контролер для health: `GET /api/health` → `200` з JSON `{ status: 'ok', version, checks }`; `version` поки може бути будь-яким рядком, `checks` — об'єкт (у L02 з'явиться `checks.db`).
- У `configureApp`: глобальний префікс `/api`, shutdown hooks.
- `GET /health` (без префікса) → `404`.
- Перевір руками: `npm run dev`, відкрий http://localhost:5173 — бейдж стану API має стати зеленим.

### S2 — Конфіг з валідацією (1,5–2 год)

- `@nestjs/config` з функцією валідації (class-validator/class-transformer вже в залежностях; можна й інакше).
- Змінні: `APP_ENV` — лише `development | test | ci | production`; `PORT` — число, за замовчуванням `3000`; `DATABASE_URL` — обов'язкова; `APP_VERSION` — за замовчуванням `dev`.
- Невалідне оточення → старт відхилено з назвою змінної в повідомленні.
- `version` у `/api/health` = `APP_VERSION`; `main.ts` слухає `PORT` з конфігу.
- Тести керують оточенням самі: при `APP_ENV=test` застосунок **не читає `.env`-файли** (див. «Контракт»).

### S3 — Postgres у Compose (1–1,5 год, потрібен Docker)

- `infra/compose.dev.yml` за «Контрактом»: проєкт `chat-dev`, сервіси `db` і `db-test` на `postgres:17-alpine`, healthcheck.
- `npm run db:up` → обидва сервіси healthy; `npm run db:down` — зупинка.
- Перевір: `docker compose -f infra/compose.dev.yml ps`, `psql postgres://postgres:postgres@localhost:5433/chat_test -c 'select version()'` (або будь-який SQL-клієнт).

## Критерії готовності

Усе виконується командами:

```bash
npm run lesson:check -- 1 --step 1     # S1 pass
npm run lesson:check -- 1 --step 2     # S2 pass
npm run db:up                          # обидва сервіси healthy
npm run lesson:check -- 1 --step 3     # S3 pass
npm run lesson:check -- 1              # S1–S3 pass, lint і typecheck pass, exit 0
npm run lesson:check -- 1 --full       # + S0 (підготовка GitHub) pass
npm run dev                            # http://localhost:5173 — бейдж «API: ok»; curl localhost:5173/api/health → 200
```

Плюс на рев'ю: тести `apps/api/test/lessons/**` не змінені; shutdown hooks увімкнені; `.env` не в git; секретів у коді немає.

## Контракт

Те, що читають тести. Усе інше — на твій розсуд.

### Фіксовані точки [FIX]

| Файл | Експорт |
|---|---|
| `apps/api/src/app.module.ts` | `export class AppModule` |
| `apps/api/src/app.setup.ts` | `export function configureApp(app: INestApplication): void` |

### HTTP

| Запит | Відповідь |
|---|---|
| `GET /api/health` | `200`, JSON, `toMatchObject({ status: 'ok', version: <string>, checks: <object> })`; `version` = `APP_VERSION` |
| `GET /health` | `404` |

### Змінні оточення

| Змінна | Правило | За замовчуванням |
|---|---|---|
| `APP_ENV` | одне з `development`, `test`, `ci`, `production`; інше → старт відхилено | — (у `.env.example` — `development`) |
| `PORT` | число; `abc` → старт відхилено | `3000` |
| `DATABASE_URL` | обов'язкова; відсутня → старт відхилено, назва змінної є в повідомленні помилки | — |
| `APP_VERSION` | рядок | `dev` |

- Значення з кореневого `.env.example` дають успішний старт.
- При `APP_ENV=test` `.env`-файли не читаються — лише `process.env` (тести самі задають і видаляють змінні).
- Тести читають `apps/api/.env.test` і підставляють `DATABASE_URL = DATABASE_URL_TEST`.

### Compose: `infra/compose.dev.yml`

| Що | Вимога |
|---|---|
| Проєкт | `name: chat-dev` |
| Сервіси | `db` і `db-test` |
| Образ | `postgres:17*` (рекомендовано `postgres:17-alpine`) для обох |
| `db-test` | публікує `5433` → `5432`; `POSTGRES_DB=chat_test`; дані на **tmpfs** у `/var/lib/postgresql/data` |
| `db` | дані в **іменованому volume** (оголошеному в `volumes:` верхнього рівня), змонтованому в `/var/lib/postgresql/data`; порт хоста — на твій розсуд |
| Healthcheck | є в `db` і `db-test` (потрібен для `docker compose up --wait`) |

### SQL (db-test за `DATABASE_URL_TEST` = `postgres://postgres:postgres@localhost:5433/chat_test`)

- з'єднання встановлюється (інакше тест падає з «db-test недоступна: запусти npm run db:up»);
- `current_setting('server_version_num')::int >= 170000`;
- `current_database() = 'chat_test'`.

### npm-скрипти (вже є в корені)

`npm run db:up` = `docker compose -f infra/compose.dev.yml up -d --wait`; `npm run db:down` = `docker compose -f infra/compose.dev.yml down`.

### GitHub (S0, лише `--full`)

`gh api repos/{owner}/{repo}`: репо публічний; `security_and_analysis.secret_scanning.status == "enabled"`; `security_and_analysis.secret_scanning_push_protection.status == "enabled"`. Серед rulesets — активний branch-ruleset з include `refs/heads/lesson-*-solution`, правилом `creation` і порожнім bypass-списком.

### Тести заняття

`apps/api/test/lessons/l01/`: `s0-github.remote-spec.ts`, `s1-health.e2e-spec.ts`, `s2-config.e2e-spec.ts`, `s3-database.e2e-spec.ts`. Не редагуй їх — `lesson:check` перевіряє цілісність.

## Підказки

Підказки — лише на запит, 3 рівні (**рівень 1** — натяк, **рівень 2** — напрям, **рівень 3** — конкретика). Як запитати: `hint L01.S2` + що вже спробував і де застряг (вивід `npm run lesson:check -- 1 --step 2`). Журнал — `course/lesson-01/hints.md`.

Теми, з якими найчастіше потрібна допомога:

- **S0:** де в налаштуваннях GitHub знаходяться secret scanning, push protection і rulesets; як `gh` визначає `{owner}/{repo}`.
- **S1:** модуль vs контролер vs провайдер; як зареєструвати контролер; глобальний префікс; навіщо `enableShutdownHooks()`.
- **S2:** `ConfigModule.forRoot` і його опції (`validate`, `isGlobal`, `ignoreEnvFile`, `envFilePath`); чому помилка виникає під час імпорту модуля; як перетворити рядок `PORT` у число; як прочитати конфіг у контролері й у `main.ts`.
- **S3:** коротка vs довга форма `ports`/`volumes` у Compose; tmpfs; іменовані томи; `healthcheck` з `pg_isready`; чому `up --wait`; конфлікт порту 5432 з локальним Postgres.
