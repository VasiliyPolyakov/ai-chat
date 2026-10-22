# Курс: карта занять

Карта — **орієнтир**, а не зафіксований контент: кожне заняття генерується лише після закриття попереднього, на основі твого фактичного коду в `main`. Кожне заняття: теорія → завдання → 3 кроки (у L03, L04, L08, L13 — 4) по 1–2 год → red-тести → зелено → коміт → рев'ю.

**Обсяг:** ядро 14 занять, реалістично **100–128 год** (до чекпоінту L01–L08: 60–76 год; після: 40–52 год) + 3 опційні модулі.

## Ядро

| # | Заняття | Кроків | Год | Що з'являється | Деплой |
|---|---|---|---|---|---|
| L01 | Монорепо і Nest-основи | 3 (+ підготовка) | 6–8 | health, валідований конфіг, Postgres у Compose, безпечний публічний репо | локально |
| L02 | TypeORM, User, міграції, `seed:admin` | 3 | 7–9 | DataSource, таблиця `users`, міграції, ідемпотентний seed | локально |
| L03 | Docker + CI | 4 | 8–10 | Dockerfiles, локальний стек з Caddy, GitHub Actions, образи в GHCR, захист `main` | образи в GHCR |
| L04 | Перший деплой | 4 | 8–10 | VPS, DNS, TLS, автодеплой з CI, rollback | так, перший |
| L05 | Auth I + OpenAPI | 3 | 7–9 | реєстрація, логін, JWT, захищені маршрути, Swagger | так |
| L06 | Auth II | 3 | 7–9 | refresh-ротація в cookie, ролі, rate limit | так |
| L07 | Розмови | 3 | 7–9 | `conversations`/`messages`, власність даних, пагінація, транзакції | так |
| L08 | Anthropic + SSE — **ЧЕКПОІНТ** | 4 | 10–12 | стрімінг відповіді, помилки й обрив, контроль вартості, fake mode | так |
| L09 | Tool use | 3 | 6–8 | tools, tool loop з лімітом, історія викликів | так |
| L10 | Асистенти в БД | 3 | 6–8 | `assistants`, admin CRUD, вибір асистента | так |
| L11 | Ollama + провайдер-абстракція | 3 | 7–9 | рефакторинг під контрактними тестами, вибір провайдера з БД | так |
| L12 | Prompt caching + UsageLog | 3 | 5–7 | `cache_control`, облік токенів і вартості | так |
| L13 | Terraform (hcloud + Cloudflare + R2) | 4 | 9–11 | інфраструктура як код, перенесення сервера, друга інсталяція | так |
| L14 | Експлуатація | 3 | 7–9 | бекапи й відновлення, runbook, логування | так |

**Чекпоінт після L08:** задеплоєний чат з auth і Anthropic, CI/CD працює; ретро (фактичні години vs оцінка) і рішення про модуль A.

## Опційні модулі

| | Модуль | Год |
|---|---|---|
| A | Скидання пароля + Google OAuth (нова стратегія без змін наявних) | 8–10 |
| B | Огляд мультитенантності: `docs/multitenancy-path.md` + spike `organizationId` | 4–6 |
| C | AWS ECS Fargate + RDS через Terraform, Budgets, `terraform destroy` | 8–10 |

## Шпаргалка «Express → Nest»

HTTP-шарування, middleware і стрімінг ти вже знаєш з Express — у Nest змінюється не HTTP, а **те, хто збирає застосунок**.

### Ручні фабрики → DI-контейнер

| Express (як ти робив) | Nest |
|---|---|
| `createApp({ db, mailer })` — фабрика, у якій ти вручну створюєш і передаєш залежності | Контейнер сам створює провайдери (`@Injectable()`) і передає їх у конструктори за типом або токеном |
| `const svc = new UsersService(repo)` у composition root | `providers: [UsersService]` у модулі; `constructor(private users: UsersService)` |
| Модуль = файл/тека, межі — домовленість | `@Module()` — **межа видимості**: провайдер доступний іншому модулю, лише якщо його `exports` і модуль імпортовано |
| Синглтони через кеш модулів Node (`require`) | Скоупи провайдерів: singleton за замовчуванням, `REQUEST`, `TRANSIENT` |
| Ініціалізація/закриття вручну (`await db.connect()`, `process.on('SIGTERM')`) | Lifecycle-хуки: `onModuleInit`, `onApplicationBootstrap`, `onModuleDestroy`, `beforeApplicationShutdown` + `app.enableShutdownHooks()` |
| `createApp()` для supertest | `configureApp(app)` + `AppModule` — однаковий застосунок у `main.ts` і в тестах |

### Роутер → контролер

| Express | Nest |
|---|---|
| `const router = express.Router(); router.get('/users/:id', handler)` | `@Controller('users')` + `@Get(':id')` на методі класу |
| `app.use('/api', router)` | `app.setGlobalPrefix('api')` або `RouterModule` |
| `req.params.id`, `req.body`, `req.query` | `@Param('id')`, `@Body()`, `@Query()` — з перетворенням і валідацією через pipes |
| `res.status(201).json(dto)` | `return dto` (+ `@HttpCode(201)`), серіалізацію робить Nest |
| `res.write(...)` для стріму | `@Res()` + `res.write(...)` — обробник виходить з pipeline Nest (детально в L08) |

### Middleware → pipeline Nest

Порядок обробки запиту в Nest: **middleware → guards → interceptors (до) → pipes → handler → interceptors (після) → exception filters**.

| Express | Nest | Різниця |
|---|---|---|
| `app.use((req, res, next) => …)` | Middleware (`NestMiddleware`, `consumer.apply()`) | Те саме; підходить для логування, request id, cookie-parser |
| auth-middleware `requireAuth`, `requireRole('admin')` | **Guard** (`CanActivate`) + декоратор метаданих і `Reflector` | Guard бачить, **який** обробник викликається, і його метадані (`@Public()`, `@Roles('admin')`) |
| обгортка навколо обробника (таймінг, мапінг відповіді) | **Interceptor** (`NestInterceptor`, RxJS) | Має доступ і до запиту, і до результату обробника |
| `express-validator` / zod-middleware | **Pipe** (`ValidationPipe` + DTO-класи з `class-validator`) | Валідація й перетворення прив'язані до параметра обробника |
| error-middleware `(err, req, res, next)` | **Exception filter** (`@Catch()`) | Єдиний формат помилок; `HttpException` і підкласи |
| `express-rate-limit` | `@nestjs/throttler` | Той самий принцип, guard замість middleware |
| `passport.use(new Strategy())` | `@nestjs/passport`: клас стратегії + `AuthGuard('jwt')` | Та сама бібліотека, загорнута в DI |
| `dotenv` + zod/envalid на старті | `@nestjs/config`: `ConfigModule.forRoot({ validate })` | Валідація — частина старту модуля; `ConfigService` інжектується |
| `swagger-jsdoc` (коментарі) | `@nestjs/swagger` | Схеми беруться з DTO-класів і декораторів |
