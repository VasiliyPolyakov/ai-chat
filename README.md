# AI Chat

A pet project: a reusable **AI chat template** built on NestJS + PostgreSQL + TypeORM and a React SPA, together with a **harness around the LLM** that makes answers predictable. The same input, prompt version and model settings should give answers of the same quality, and regressions should be caught by tests instead of by users.

## Goals

1. **AI chat template.** A production-shaped starting point for chat products: auth, conversations, assistants stored in the database, streaming responses, OpenAPI docs, deployment and backups. It should be easy to fork for a new use case.
2. **A deterministic AI harness.** Everything that sits between the user and the model and decides the quality of the answer:
   - versioned system prompts and assistant configs stored in the DB, not hard-coded;
   - pinned model IDs and sampling parameters per assistant;
   - structured outputs validated against a schema, with retries on invalid output;
   - tool use with typed contracts;
   - provider abstraction (Anthropic → Ollama → any provider) behind one interface;
   - prompt caching and token/cost accounting per request;
   - evals: golden conversations and checks that run in CI, so a change to a prompt, model or tool is measured before it ships.

## Stack

| Layer | Tech |
|---|---|
| API | NestJS 11, TypeORM, PostgreSQL 17 |
| Web | React, Vite, TypeScript |
| Tests | Jest + supertest (e2e on a real app and a disposable Postgres) |
| Infra | Docker Compose, Caddy, GitHub Actions → GHCR → SSH deploy to a Hetzner VPS, Terraform (Hetzner Cloud + Cloudflare DNS/R2) |

## Roadmap

- [x] Monorepo, health endpoint, validated config, Postgres in Compose
- [ ] TypeORM, users table and migrations, admin seed *(in progress)*
- [ ] Docker images, CI, production deploy
- [ ] Auth, conversations, assistants in the DB, OpenAPI
- [ ] LLM integration: Anthropic, streaming (SSE), provider abstraction, Ollama
- [ ] Harness: structured outputs, tool use, prompt caching, token accounting, evals in CI
- [ ] Terraform, backups to Cloudflare R2, runbook

Work is split into numbered milestones. Each one lives on its own branch `feat/NN-<slug>` (e.g. `feat/03-docker-ci`), comes with acceptance tests in `apps/api/test/lessons/lNN`, and is merged into `main` via a PR.

## Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | 24 (see `.nvmrc`; `nvm use`) | everything |
| npm | 11+ (ships with Node 24) | npm workspaces |
| **Docker** (OrbStack or Docker Desktop) | **Docker Compose ≥ 2.24** | Postgres for dev and tests, images |
| GitHub CLI `gh` | any recent | `--full` checks (repository settings) |
| gitleaks (optional, recommended) | 8.x | pre-commit secret scan |

## Quick start

```bash
nvm use                         # Node 24
npm ci                          # dependencies + git hooks (core.hooksPath = .githooks)
cp .env.example apps/api/.env   # dev config (the API runs from apps/api)
npm run db:up                   # Postgres: dev database and db-test (port 5433)
npm run dev                     # api (Nest, :3000) + web (Vite, :5173, proxies /api → :3000)
```

## Repository layout

```
apps/api      NestJS app + test/ (test infrastructure and milestone acceptance tests)
apps/web      React + Vite SPA
infra/        Compose, Caddy, deploy, Terraform
scripts/      lesson-check (milestone checks), architecture checks
.githooks/    pre-commit (gitleaks), pre-push (protects local-only branches)
```

Fixed entry points **[FIX]** that tests rely on: `AppModule` in `src/app.module.ts`, `configureApp` in `src/app.setup.ts`, and `src/database/data-source.ts` (default export `DataSource`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | api (`nest start --watch`) + web (`vite`, :5173) in parallel |
| `npm run db:up` / `npm run db:down` | `docker compose -f infra/compose.dev.yml up -d --wait` / `down` |
| `npm run migration:*` | TypeORM migrations via `src/database/data-source.ts` |
| `npm run seed:admin` | creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `npm run lint` | ESLint + `scripts/check-architecture.mjs` (controllers don't import TypeORM) |
| `npm run typecheck` | `tsc --noEmit` in all workspaces |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:e2e` / `test:infra` | Jest projects in `apps/api` (+ Vitest for web) |
| `npm run lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]` | checks milestone N (see below) |

### `lesson:check`

1. **Preflight**: Node version from `.nvmrc`, `apps/api/.env.test`, git hooks, [FIX] entry points. db-test is required only for steps that need a database, and Docker/Compose only for infra tests. Messages are prefixed with `[preflight]`.
2. **Test integrity**: `apps/api/test/lessons/**` is compared with the commit that added the tests; any change is a warning.
3. **Steps** of the milestone (`--step K` runs a single step, without regression and static checks).
4. **Regression**: e2e tests of earlier milestones and custom e2e tests (`apps/api/test/custom`).
5. **Static checks**: `lint` + `typecheck`.
6. `--full` is the CI equivalent: it adds remote tests (GitHub settings, production) and infra regression.

The summary is a table of check → pass/fail/skip (number of tests) plus warnings, and the exit code is non-zero on any failure. Failures of the test infrastructure itself are tagged `[tooling]`.

## Secrets

The repository is public, so:

- `.env` and `.env.*` are git-ignored (except `.env.example` and the non-sensitive `apps/api/.env.test`).
- GitHub **secret scanning** and **push protection** are enabled.
- `pre-commit` runs `gitleaks git --pre-commit --staged` when gitleaks is installed (otherwise it only warns).
- Secrets live only in GitHub Secrets and in `.env` on the server, never in code, logs, build args or images.
- `lesson-*-solution` branches are local-only: the **pre-push** hook rejects any push that touches them, and a GitHub ruleset blocks creating them.
