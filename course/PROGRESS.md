# Прогрес курсу

Статуси: `—` (ще не згенеровано) → `generated` (є `lesson-NN-start`) → `reviewed` → `closed`.
Заняття N+1 генерується лише після `closed` для N.

| Заняття | Статус | `lesson-NN-start` | Еталон `lesson-NN-solution` (SHA) | G3 | Рев'ю | Merge-рішення | Год (факт) |
|---|---|---|---|---|---|---|---|
| L01 | generated | `8ac55f09c8b87edd9d68a912951298e08d614eba` | `3c0448d14204e7ede8e583d3173dce29577bd7ef` | red on start, green on solution, `--full` green | — | — | — |

## L01

- **Згенеровано:** 2026-10-22, коміт `course(l01): materials + red tests`, annotated-тег `lesson-01-start` (`git rev-parse lesson-01-start^{commit}`).
- **G3 (2026-10-22):** L01 G3: red on start (assertion), green on solution, --full green.
  - `lesson-01-start` = `8ac55f09c8b87edd9d68a912951298e08d614eba`; `lesson-01-solution` = `3c0448d14204e7ede8e583d3173dce29577bd7ef` (локальна гілка, не пушиться).
  - На старті: S1 1/2, S2 1/5, S3 0/10 (без БД) і 3/10 (з БД — падає файловий контракт compose); помилок `TS####`/`Cannot find module`/`SyntaxError`/`[course]` немає.
  - На еталоні: `lesson:check -- 1` → S1 2/2, S2 5/5, S3 10/10, lint і typecheck pass; `--full` → exit 0 (S0 skip: origin клону не GitHub); `npm run dev` → `GET :5173/api/health` = 200.
  - Перевірено в клоні: архітектурний скрипт (контролер з імпортом `typeorm` → `lint` exit 1), warning цілісності тестів, pre-push відхиляє `git push <bare> lesson-01-solution` і `git push --all`.
  - **Примітка:** S3 перевірено на тимчасовому PostgreSQL 17.10 (:5433, лише TCP) замість Docker, бо Docker на машині не встановлено. `infra/compose.dev.yml` еталона перевірено лише контрактним тестом, без `docker compose config` / `up`.
- **Merge-рішення (AC-5):** —
- **Contract migrations:** —
- **fix(course)-коміти:** `62b7613` — lesson-check пропускає remote-тести, якщо origin не GitHub (знайдено в G3; той самий фікс у `lesson-01-solution` як `3c0448d`).
- **Підказки:** див. `course/lesson-01/hints.md`

## Drift log

Відхилення твого коду від карти/еталона, важливі для наступних занять (назви таблиць, форма помилок, рішення по API).

| Дата | Заняття | Що | Наслідок для наступних занять |
|---|---|---|---|
| 2026-10-22 | L01 (G3) | Контрактний тест compose (`s3-database`) розбирає YAML без merge keys (`<<: *anchor`): валідний для Compose файл з якорями падає. Еталон написано без якорів | Кандидат на `fix(course)`: `parse(..., { merge: true })` у `l01/s3-database.e2e-spec.ts` — потребує рішення |
