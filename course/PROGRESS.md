# Прогрес курсу

Статуси: `—` (ще не згенеровано) → `generated` (є `lesson-NN-start`) → `reviewed` → `closed`.
Заняття N+1 генерується лише після `closed` для N.

| Заняття | Статус | `lesson-NN-start` | Еталон `lesson-NN-solution` (SHA) | G3 | Рев'ю | Merge-рішення | Год (факт) |
|---|---|---|---|---|---|---|---|
| L01 | generated | `8ac55f09c8b87edd9d68a912951298e08d614eba` | `3791b328db2204362ac9ff4e82910b92d40595fa` | red on start, green on solution, `--full` green | — | — | — |

## L01

- **Згенеровано:** 2026-10-22, коміт `course(l01): materials + red tests`, annotated-тег `lesson-01-start` (`git rev-parse lesson-01-start^{commit}`).
- **G3 (2026-10-22):** L01 G3: red on start (assertion), green on solution, --full green.
  - `lesson-01-start` = `8ac55f09c8b87edd9d68a912951298e08d614eba`; `lesson-01-solution` = `3791b328db2204362ac9ff4e82910b92d40595fa` (локальна гілка, не пушиться; кожен fix(course) нижче перенесено в еталон cherry-pick, тому `git merge-base lesson-01-solution lesson/01` = `lesson-01-start`).
  - На старті: S1 1/2, S2 1/5, S3 0/10 (без БД) і 3/10 (з БД — падає файловий контракт compose); помилок `TS####`/`Cannot find module`/`SyntaxError`/`[course]` немає.
  - На еталоні: `lesson:check -- 1` → S1 2/2, S2 5/5, S3 10/10, lint і typecheck pass; `--full` → exit 0 (S0 skip: origin клону не GitHub); `npm run dev` → `GET :5173/api/health` = 200.
  - Перевірено в клоні: архітектурний скрипт (контролер з імпортом `typeorm` → `lint` exit 1), warning цілісності тестів, pre-push відхиляє `git push <bare> lesson-01-solution` і `git push --all`.
  - **Примітка:** S3 перевірено на тимчасовому PostgreSQL 17.10 (:5433, лише TCP) замість Docker, бо Docker на машині не встановлено. `infra/compose.dev.yml` еталона перевірено лише контрактним тестом, без `docker compose config` / `up`.
- **Merge-рішення (AC-5):** —
- **Contract migrations:** —
- **fix(course)-коміти:** `62b7613` — lesson-check пропускає remote-тести, якщо origin не GitHub (знайдено в G3; у `lesson-01-solution` — `3c0448d`).
  - `0723df1` — `l01/s3-database` розбирає compose YAML з merge keys (`<<: *anchor`); у еталоні — `18165f2`.
  - `e1b64e0` — `.omc/` (стан оркестратора) у `.gitignore`; у еталоні — `77be41c`.
  - `79880af` — `--full`: S0 = fail з `[preflight]`, якщо origin — GitHub, а `gh` не встановлено/не автентифіковано (skip лише без GitHub-origin); у еталоні — `c97143a`.
  - `422745d` — `.env.example` і README: dev-конфіг копіюється в `apps/api/.env`; у еталоні — `d3e73cc`.
  - `3791b32` — deslop `scripts/lesson-check.mjs`: один запуск jest на тип тестів, прибрано застаріле повідомлення про L03; поведінка незмінна (виводи до/після звірено); у еталоні — `4e5ac12`.
  - **Стан:** усі `fix(course)` живуть на `lesson/01` і чекають merge у `main` на кроці M (remote немає — PR у `main` неможливий).
  - Після фіксів еталон повторно перевірено: `lesson:check -- 1` і `--full` зелені; S3 зелений і з compose-файлом на YAML-якорях.
- **Підказки:** див. `course/lesson-01/hints.md`

## Drift log

Відхилення твого коду від карти/еталона, важливі для наступних занять (назви таблиць, форма помилок, рішення по API).

| Дата | Заняття | Що | Наслідок для наступних занять |
|---|---|---|---|
| 2026-10-22 | L01 (G3) | Контрактний тест compose (`s3-database`) розбирає YAML без merge keys (`<<: *anchor`): валідний для Compose файл з якорями падає. Еталон написано без якорів | Виправлено: `fix(course)` `0723df1` (`parse(..., { merge: true })`); еталон доповнено тим самим фіксом (`18165f2`) |
| 2026-10-22 | L01 (G3) | `.omc/` (стан оркестратора) з'являвся як невідстежуваний | `fix(course)` `e1b64e0`: `.omc/` у `.gitignore` |
| 2026-10-22 | L01 (G3) | `lesson-check --full` у клоні з не-GitHub origin падав на `gh api` замість skip | `fix(course)` `62b7613` (еталон `3c0448d`); у `main` — після merge `lesson/01` |
| 2026-10-22 | L01 (рев'ю архітектора) | `--full` давав skip S0, коли origin — GitHub, але `gh` недоступний (хибно-зелений CI-еквівалент) | `fix(course)` `79880af` (еталон `c97143a`): тепер fail з `[preflight]`; у `main` — після merge |
| 2026-10-22 | L01 (рев'ю архітектора) | `.env.example` радив копіювати в кореневий `.env`, а api читає `apps/api/.env` | `fix(course)` `422745d` (еталон `d3e73cc`); у `main` — після merge |
| 2026-10-22 | L01 (deslop) | Дублювання в `lesson-check.mjs` (три однакові запуски jest), застарілий рядок «infra-тести з'являться з L03» | `fix(course)` `3791b32` (еталон `4e5ac12`); у `main` — після merge |
