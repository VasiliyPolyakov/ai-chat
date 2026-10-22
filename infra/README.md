# infra/

Інфраструктуру пишеш **ти**, заняття за заняттям. Поки що тут лише цей файл.

| Файл | Заняття | Що це |
|---|---|---|
| `compose.dev.yml` | L01.S3 | Postgres для розробки (`db`, volume) і для тестів (`db-test`, tmpfs, порт 5433); проєкт `chat-dev`. Запуск: `npm run db:up` / `npm run db:down` |
| `compose.yml` | L03 | Локальний стек як у проді: `db` → `migrate` → `api` → `web` (Caddy); проєкт `chat-stack` |
| `Caddyfile` | L03 | `/api/*` → `api:3000` (`flush_interval -1` для SSE), SPA fallback; з L04 — автоматичний TLS |
| `compose.prod.yml` | L04 | Образи з GHCR за `IMAGE_TAG`, той самий `migrate`; з L14 — backup |
| `cloud-init.yml` | L04 | Docker, користувач `deploy`, SSH лише за ключем |
| `scripts/deploy.sh` | L04 | `deploy <sha>` / `rollback`, `DRY_RUN=1` |
| `RUNBOOK.md` | L04 → L14 | deploy, rollback, restore, ротація секретів |
| `scripts/backup.sh` | L14 | `pg_dump` → Cloudflare R2 |
| `terraform/` | L13 | hcloud (сервер, firewall, ключі) + Cloudflare (DNS, R2) |

Вимоги: Docker (OrbStack або Docker Desktop) з **Docker Compose ≥ 2.24**.
