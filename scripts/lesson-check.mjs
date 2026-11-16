#!/usr/bin/env node
// Перевірка етапу.
//
//   npm run lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]
//
// 1. Preflight (покроково): Node з .nvmrc, apps/api/.env.test, git hooks, фіксовані точки [FIX],
//    db-test (лише для кроків, яким потрібна БД), Docker/Compose (лише для *.infra-spec.ts).
// 2. Цілісність тестів test/lessons/lMM відносно коміту, де їх додано (warning).
// 3. Кроки етапу: test/lessons/lNN/sK-*.{e2e,infra,remote}-spec.ts, згруповані за sK.
// 4. Регресія (за замовчуванням, без --step): e2e попередніх етапів + власні e2e-тести.
// 5. Статика (без --step): npm run lint (вкл. AC-14) + npm run typecheck.
// Підсумок — таблиця; exit != 0 при будь-якому fail. Збої тестової інфраструктури позначаються [tooling].
// Без зовнішніх залежностей.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API = join(ROOT, 'apps/api');
const LESSONS = join(API, 'test/lessons');
const ENV_TEST = join(API, '.env.test');
const REPORT_DIR = join(ROOT, 'node_modules/.cache/lesson-check');

// Кроки, яким НЕ потрібна db-test. У L01 БД потрібна лише S3; з L02 — усім e2e-крокам.
const DB_FREE_STEPS = { 1: new Set([0, 1, 2]) };

// ---------------------------------------------------------------- аргументи

const USAGE = `Використання: npm run lesson:check -- N [--step K] [--no-regression] [--full] [--remote URL] [--verbose]

  N                номер етапу (1, 2, …)
  --step K         лише крок K (без регресії і статики) — швидкий цикл під час роботи
  --no-regression  без регресії попередніх етапів
  --full           + remote-тести (GitHub/прод) та infra-тести попередніх етапів — CI-еквівалент
  --remote URL     базовий URL задеплоєного застосунку для remote-тестів (з L04)
  --verbose        повний вивід jest, змінні тестового оточення (без секретів), версії інструментів`;

function parseArgs(argv) {
  const opts = {
    lesson: undefined,
    step: undefined,
    regression: true,
    full: false,
    remote: undefined,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '--step') {
      opts.step = Number(argv[++i]);
    } else if (arg.startsWith('--step=')) {
      opts.step = Number(arg.slice('--step='.length));
    } else if (arg === '--no-regression') {
      opts.regression = false;
    } else if (arg === '--full') {
      opts.full = true;
    } else if (arg === '--remote') {
      opts.remote = argv[++i];
    } else if (arg.startsWith('--remote=')) {
      opts.remote = arg.slice('--remote='.length);
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (/^\d+$/.test(arg) && opts.lesson === undefined) {
      opts.lesson = Number(arg);
    } else {
      console.error(`Невідомий аргумент: ${arg}\n\n${USAGE}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(opts.lesson) || opts.lesson < 1) {
    console.error(`Вкажи номер етапу.\n\n${USAGE}`);
    process.exit(2);
  }
  if (opts.step !== undefined && (!Number.isInteger(opts.step) || opts.step < 0)) {
    console.error(`--step очікує номер кроку (0, 1, 2, …).\n\n${USAGE}`);
    process.exit(2);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const N = opts.lesson;
const pad = (n) => String(n).padStart(2, '0');
const lessonId = `l${pad(N)}`;

// ---------------------------------------------------------------- утиліти

const warnings = [];
const rows = [];
let hardFailure = false;

const log = (msg = '') => console.log(msg);
const warn = (msg) => {
  warnings.push(msg);
  console.log(`warning: ${msg}`);
};
const verbose = (msg) => {
  if (opts.verbose) console.log(msg);
};

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...options });
  return {
    code: res.status ?? (res.error ? 127 : 1),
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    error: res.error,
  };
}

function git(...args) {
  return run('git', args);
}

function readEnvFile(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#')) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function mask(key, value) {
  if (/(SECRET|TOKEN|PASSWORD|API_?KEY|PRIVATE)/i.test(key)) return '***';
  return String(value).replace(/(\/\/[^:/@]+:)[^@]+@/, '$1***@');
}

function listFiles(dir, predicate) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'node_modules') walk(full);
      } else if (predicate(full)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const indent = (text) =>
  text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');

function tcpReachable(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok, reason) => {
      socket.destroy();
      resolve({ ok, reason });
    };
    socket.setTimeout(timeoutMs, () => done(false, 'timeout'));
    socket.once('connect', () => done(true));
    socket.once('error', (err) => done(false, err.code ?? (err.errors?.[0]?.code || err.message)));
  });
}

// ---------------------------------------------------------------- етапи і кроки

if (!existsSync(join(LESSONS, lessonId))) {
  console.error(
    `Тестів етапу ${N} немає (apps/api/test/lessons/${lessonId}). ` +
      `Перевір гілку етапу: feat/${pad(N)}-<slug>`,
  );
  process.exit(1);
}

const SPEC = /^s(\d+)-.+\.(e2e|infra|remote)-spec\.ts$/;
const steps = new Map();
for (const name of readdirSync(join(LESSONS, lessonId)).sort()) {
  const m = SPEC.exec(name);
  if (!m) continue;
  const k = Number(m[1]);
  if (!steps.has(k)) steps.set(k, []);
  steps.get(k).push({ name, kind: m[2], path: join(LESSONS, lessonId, name) });
}

if (opts.step !== undefined && !steps.has(opts.step)) {
  const known = [...steps.keys()].map((k) => `S${k}`).join(', ');
  console.error(`На етапі ${N} немає кроку ${opts.step} (є: ${known}).`);
  process.exit(2);
}

log(
  `lesson:check — етап ${N}${opts.step !== undefined ? `, крок ${opts.step}` : ''}${opts.full ? ' (--full)' : ''}`,
);
log('');

// ---------------------------------------------------------------- 1. preflight

log('Preflight');

const nvmrc = existsSync(join(ROOT, '.nvmrc'))
  ? readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim()
  : '';
const wantMajor = nvmrc.replace(/^v/, '').split('.')[0];
const haveMajor = process.versions.node.split('.')[0];
if (wantMajor && wantMajor !== haveMajor) {
  warn(`[preflight] Node ${process.versions.node}, а .nvmrc вимагає ${nvmrc} — виконай nvm use`);
}

if (!existsSync(ENV_TEST)) {
  console.error(
    '[preflight] [tooling] немає apps/api/.env.test — цей файл має бути в репо',
  );
  process.exit(1);
}
const envTest = readEnvFile(ENV_TEST);
for (const key of Object.keys(envTest))
  if (process.env[key] !== undefined) envTest[key] = process.env[key];

const hooksPath = git('config', 'core.hooksPath').stdout.trim();
if (hooksPath !== '.githooks') {
  warn('[preflight] git hooks не підключені (core.hooksPath ≠ .githooks) — запусти npm ci');
}

// Фіксовані точки [FIX]: їх імпортують тести, тож зміна назв ламає запуск тестів.
// Четвертий елемент — етап, з якого точка існує.
const FIX_POINTS = [
  ['apps/api/src/app.module.ts', /export\s+class\s+AppModule\b/, 'export class AppModule', 1],
  [
    'apps/api/src/app.setup.ts',
    /export\s+(async\s+)?function\s+configureApp\b|export\s+const\s+configureApp\b/,
    'export function configureApp(app)',
    1,
  ],
  ['apps/api/src/database/data-source.ts', /export\s+default\b/, 'export default <DataSource>', 2],
];
for (const [file, re, expected, since] of FIX_POINTS) {
  if (N < since) continue;
  const full = join(ROOT, file);
  if (!existsSync(full) || !re.test(readFileSync(full, 'utf8'))) {
    console.error(
      `[preflight] фіксована точка [FIX] змінена: ${file} має містити \`${expected}\` (контракт етапу L${pad(since)})`,
    );
    hardFailure = true;
  }
}

const requireFromApi = createRequire(join(API, 'package.json'));
let jestBin;
try {
  jestBin = requireFromApi.resolve('jest/bin/jest');
} catch {
  console.error('[preflight] jest не встановлено — запусти npm ci');
  process.exit(1);
}

if (opts.verbose) {
  log(`  Node ${process.versions.node} (.nvmrc: ${nvmrc || '—'})`);
  const docker = run('docker', ['version', '--format', '{{.Server.Version}}']);
  const compose = run('docker', ['compose', 'version', '--short']);
  log(
    `  Docker: ${docker.code === 0 ? docker.stdout.trim() : 'недоступний'}; Compose: ${compose.code === 0 ? compose.stdout.trim() : 'недоступний'}`,
  );
  log(`  core.hooksPath: ${hooksPath || '—'}`);
  log('  Тестове оточення (apps/api/.env.test + змінні оточення):');
  for (const [k, v] of Object.entries(envTest)) log(`    ${k}=${mask(k, v)}`);
  log(
    `  БД тестів: DATABASE_URL = DATABASE_URL_TEST = ${mask('DATABASE_URL', envTest.DATABASE_URL_TEST ?? '—')}`,
  );
}

let dbStatus;
async function dbPreflight() {
  if (dbStatus) return dbStatus;
  const raw = envTest.DATABASE_URL_TEST;
  if (!raw) {
    dbStatus = {
      ok: false,
      message: '[preflight] [tooling] DATABASE_URL_TEST не задано в apps/api/.env.test',
    };
    return dbStatus;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    dbStatus = {
      ok: false,
      message: `[preflight] DATABASE_URL_TEST не є валідним URL: ${mask('DATABASE_URL_TEST', raw)}`,
    };
    return dbStatus;
  }
  const host = url.hostname || 'localhost';
  const port = Number(url.port || 5432);
  const res = await tcpReachable(host, port);
  dbStatus = res.ok
    ? { ok: true, message: `db-test доступна (${host}:${port})` }
    : {
        ok: false,
        message: `[preflight] db-test недоступна (${host}:${port}, ${res.reason}): запусти npm run db:up`,
      };
  return dbStatus;
}

let dockerStatus;
function dockerPreflight() {
  if (dockerStatus) return dockerStatus;
  const info = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (info.code !== 0) {
    dockerStatus = {
      ok: false,
      message: '[preflight] Docker недоступний (docker info) — запусти OrbStack або Docker Desktop',
    };
    return dockerStatus;
  }
  const version = run('docker', ['compose', 'version', '--short']).stdout.trim().replace(/^v/, '');
  const [maj, min] = version.split('.').map(Number);
  dockerStatus =
    maj > 2 || (maj === 2 && min >= 24)
      ? { ok: true, message: `Docker ${info.stdout.trim()}, Compose ${version}` }
      : {
          ok: false,
          message: `[preflight] потрібен Docker Compose ≥ 2.24 (зараз: ${version || 'не знайдено'})`,
        };
  return dockerStatus;
}

let ghStatus;
// S0/remote: skip — лише коли GitHub-репо ще немає (origin відсутній або не GitHub, напр. локальний клон).
// Якщо origin — GitHub, а gh недоступний, це fail з [preflight]: --full не може бути зеленим без перевірки.
function ghPreflight() {
  if (ghStatus) return ghStatus;
  const origin = git('remote', 'get-url', 'origin');
  if (origin.code !== 0) {
    ghStatus = {
      ok: false,
      skip: true,
      message: 'немає remote origin — спершу створи GitHub-репо (Підготовка L01)',
    };
    return ghStatus;
  }
  const originUrl = origin.stdout.trim();
  if (!/github\.com[:/]/.test(originUrl)) {
    ghStatus = {
      ok: false,
      skip: true,
      message: `remote origin не вказує на GitHub (${originUrl}) — remote-тести потребують GitHub-репо`,
    };
    return ghStatus;
  }
  const auth = run('gh', ['auth', 'status']);
  if (auth.code === 0) {
    ghStatus = { ok: true, skip: false, message: `gh автентифіковано, origin: ${originUrl}` };
  } else if (auth.error) {
    ghStatus = {
      ok: false,
      skip: false,
      message: `[preflight] origin — GitHub (${originUrl}), але gh CLI не встановлено: brew install gh, потім gh auth login`,
    };
  } else {
    ghStatus = {
      ok: false,
      skip: false,
      message: `[preflight] origin — GitHub (${originUrl}), але gh не автентифіковано: gh auth login`,
    };
  }
  return ghStatus;
}

log(`  ok: Node ${process.versions.node}, .env.test, jest`);
log('');

// ---------------------------------------------------------------- 2. цілісність тестів

log('Цілісність тестів');
const isGitRepo = git('rev-parse', '--is-inside-work-tree').code === 0;
if (!isGitRepo) {
  warn('[tooling] не git-репозиторій — перевірку цілісності тестів пропущено');
} else {
  const lessonDirs = readdirSync(LESSONS)
    .filter((d) => /^l\d{2}$/.test(d))
    .sort();
  for (const id of lessonDirs) {
    const rel = `apps/api/test/lessons/${id}`;
    // Squash-merge у main прибирає коміти з тестами з історії. Тоді база — start-тег поточного
    // етапу (тести змінюються лише до тегу) або, якщо його ще немає, start-тег етапу тестів.
    const tagCommit = (tag) =>
      git('rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`).stdout.trim();
    const base =
      git(
        'log',
        '-1',
        '--format=%H',
        '-E',
        `--grep=^test\\(${id}\\): acceptance tests|contract migration|^fix\\(tooling\\)`,
        '--',
        rel,
      ).stdout.trim() ||
      tagCommit(`lesson-${pad(N)}-start`) ||
      tagCommit(`lesson-${id.slice(1)}-start`);
    if (!base) {
      warn(`[tooling] для ${rel} не знайдено коміт з тестами — цілісність не перевірено`);
      continue;
    }
    const changed = git('diff', '--name-only', base, '--', rel)
      .stdout.trim()
      .split('\n')
      .filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard', '--', rel)
      .stdout.trim()
      .split('\n')
      .filter(Boolean);
    const all = [...changed, ...untracked];
    if (all.length > 0) {
      warn(
        `тести ${id} відрізняються від коміту з тестами ${base.slice(0, 8)}: ${all.join(', ')}. ` +
          `Тести test/lessons/** — контракт етапу, їх не редагують.`,
      );
    } else {
      verbose(`  ${id}: без змін відносно ${base.slice(0, 8)}`);
    }
  }
  if (!warnings.some((w) => w.startsWith('тести '))) log('  ok: тести етапів не змінені');
}
log('');

// ---------------------------------------------------------------- jest

if (existsSync(REPORT_DIR)) rmSync(REPORT_DIR, { recursive: true, force: true });
mkdirSync(REPORT_DIR, { recursive: true });
let reportSeq = 0;

const MACHINERY_PATH = /test\/(setup|support|factories|fixtures|contracts)\//;
const COMPILE_ERROR = /TS\d{4}|SyntaxError|Cannot find module/;

function runJest({ project, pattern, label, passWithNoTests = false }) {
  const outputFile = join(REPORT_DIR, `report-${++reportSeq}.json`);
  const args = [
    // require() ESM-only пакетів (напр. @nestjs/typeorm 12) у Jest працює лише з vm-модулями.
    '--experimental-vm-modules',
    '--disable-warning=ExperimentalWarning',
    jestBin,
    '--selectProjects',
    project,
    '--runInBand',
    '--testPathPatterns',
    pattern,
    '--json',
    '--outputFile',
    outputFile,
  ];
  if (passWithNoTests) args.push('--passWithNoTests');
  if (process.stdout.isTTY) args.push('--colors');
  verbose(`  $ jest ${args.slice(1).join(' ')}`);

  const res = spawnSync(process.execPath, args, { cwd: API, encoding: 'utf8' });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;

  let report;
  try {
    report = JSON.parse(readFileSync(outputFile, 'utf8'));
  } catch {
    return {
      ok: false,
      passed: 0,
      total: 0,
      output,
      notes: [`[tooling] jest завершився без звіту (код ${res.status}) — ${label}`],
    };
  }

  const notes = [];
  for (const suite of report.testResults ?? []) {
    const suiteFailedToRun =
      suite.status === 'failed' && (suite.assertionResults ?? []).length === 0;
    if (!suiteFailedToRun) continue;
    const message = suite.message ?? '';
    const file = relative(ROOT, suite.name);
    if (
      MACHINERY_PATH.test(message) ||
      (COMPILE_ERROR.test(message) && !/apps\/api\/src\/|\/src\//.test(message))
    ) {
      notes.push(
        `[tooling] тест-файл ${file} не запустився через збій тестової інфраструктури`,
      );
    } else {
      notes.push(
        `${file}: набір тестів не запустився — найімовірніше, помилка компіляції або старту у коді застосунку (див. вивід вище)`,
      );
    }
  }

  return {
    ok: report.success === true,
    passed: report.numPassedTests ?? 0,
    total: report.numTotalTests ?? 0,
    output,
    notes,
  };
}

function printOutput(result, force = false) {
  if (opts.verbose || force) {
    const text = result.output.trim();
    if (text) log(indent(text));
  }
  for (const note of result.notes) log(`  ${note}`);
}

// ---------------------------------------------------------------- 3. кроки

const stepsToRun = opts.step !== undefined ? [opts.step] : [...steps.keys()].sort((a, b) => a - b);

for (const k of stepsToRun) {
  const files = steps.get(k);
  const label = k === 0 ? `S0 (підготовка)` : `S${k}`;
  log(`Крок ${label}: ${files.map((f) => f.name).join(', ')}`);

  const kinds = new Set(files.map((f) => f.kind));
  let stepOk = true;
  let passed = 0;
  let total = 0;
  const reasons = [];
  let ran = false;

  if (hardFailure) {
    rows.push({ name: label, status: 'fail', tests: '—', note: 'фіксовану точку [FIX] змінено' });
    log('');
    continue;
  }

  const runKind = (kind) => {
    const pattern = files
      .filter((f) => f.kind === kind)
      .map((f) => escapeRe(`test/lessons/${lessonId}/${f.name}`))
      .join('|');
    const r = runJest({ project: kind, pattern, label });
    ran = true;
    passed += r.passed;
    total += r.total;
    if (!r.ok) stepOk = false;
    printOutput(r, !r.ok);
  };

  if (kinds.has('e2e')) {
    const needsDb = !(DB_FREE_STEPS[N]?.has(k) ?? false);
    if (needsDb) {
      const db = await dbPreflight();
      if (!db.ok) {
        log(`  ${db.message}`);
        stepOk = false;
        reasons.push('db-test недоступна');
      } else verbose(`  ${db.message}`);
    }
    runKind('e2e');
  }

  if (kinds.has('infra')) {
    const docker = dockerPreflight();
    if (!docker.ok) {
      log(`  ${docker.message}`);
      stepOk = false;
      reasons.push('Docker недоступний');
    } else {
      runKind('infra');
    }
  }

  // remote — лише з --full
  let skipped = false;
  if (kinds.has('remote')) {
    if (!opts.full) {
      skipped = !ran;
      reasons.push('remote-тести — лише з --full');
      log('  skip: remote-тести запускаються лише з --full');
    } else {
      const gh = ghPreflight();
      if (!gh.ok && gh.skip) {
        skipped = !ran;
        reasons.push(`remote пропущено: ${gh.message}`);
        log(`  skip: remote-тести пропущено — ${gh.message}`);
      } else if (!gh.ok) {
        stepOk = false;
        reasons.push('gh недоступний');
        log(`  ${gh.message}`);
      } else {
        verbose(`  ${gh.message}`);
        runKind('remote');
      }
    }
  }

  rows.push({
    name: label,
    status: skipped && stepOk ? 'skip' : stepOk ? 'pass' : 'fail',
    tests: ran ? `${passed}/${total}` : '—',
    note: reasons.join('; '),
  });
  log('');
}

// ---------------------------------------------------------------- 4. регресія

if (opts.step === undefined && opts.regression && !hardFailure) {
  log('Регресія');
  const prior = readdirSync(LESSONS)
    .filter((d) => /^l\d{2}$/.test(d) && Number(d.slice(1)) < N)
    .sort();
  const customTests = listFiles(join(API, 'test/custom'), (f) => f.endsWith('.e2e-spec.ts'));
  const unitTests = listFiles(join(API, 'src'), (f) => f.endsWith('.spec.ts'));

  if (prior.length > 0 || customTests.length > 0) {
    const parts = [...prior.map((id) => `test/lessons/${id}/`), 'test/custom/'];
    if (prior.length > 0) {
      const db = await dbPreflight();
      if (!db.ok) log(`  ${db.message}`);
    }
    const r = runJest({
      project: 'e2e',
      pattern: parts.map(escapeRe).join('|'),
      label: 'регресія e2e',
      passWithNoTests: true,
    });
    rows.push({
      name: `регресія e2e (${prior.join(', ') || 'custom'})`,
      status: r.ok ? 'pass' : 'fail',
      tests: `${r.passed}/${r.total}`,
      note: '',
    });
    printOutput(r, !r.ok);

    if (opts.full && prior.length > 0) {
      const infra = listFiles(
        LESSONS,
        (f) => f.endsWith('.infra-spec.ts') && prior.some((id) => f.includes(`/lessons/${id}/`)),
      );
      if (infra.length > 0) {
        const docker = dockerPreflight();
        if (!docker.ok) {
          log(`  ${docker.message}`);
          rows.push({
            name: 'регресія infra',
            status: 'fail',
            tests: '—',
            note: 'Docker недоступний',
          });
        } else {
          const ri = runJest({
            project: 'infra',
            pattern: prior.map((id) => escapeRe(`test/lessons/${id}/`)).join('|'),
            label: 'регресія infra',
            passWithNoTests: true,
          });
          rows.push({
            name: 'регресія infra',
            status: ri.ok ? 'pass' : 'fail',
            tests: `${ri.passed}/${ri.total}`,
            note: '',
          });
          printOutput(ri, !ri.ok);
        }
      }
    }
  } else {
    log('  немає попередніх етапів і власних e2e-тестів — регресія порожня');
  }

  if (unitTests.length > 0) {
    const r = runJest({
      project: 'unit',
      pattern: escapeRe('src/'),
      label: 'unit',
      passWithNoTests: true,
    });
    rows.push({
      name: 'unit-тести (src/**/*.spec.ts)',
      status: r.ok ? 'pass' : 'fail',
      tests: `${r.passed}/${r.total}`,
      note: '',
    });
    printOutput(r, !r.ok);
  }
  log('');
}

// ---------------------------------------------------------------- 5. статика

if (opts.step === undefined) {
  log('Статика');
  for (const script of ['lint', 'typecheck']) {
    const r = run('npm', ['run', '--silent', script]);
    rows.push({
      name: `npm run ${script}`,
      status: r.code === 0 ? 'pass' : 'fail',
      tests: '—',
      note: '',
    });
    const text = `${r.stdout}${r.stderr}`.trim();
    if (r.code !== 0 || opts.verbose) {
      log(`  npm run ${script}:`);
      if (text) log(indent(text));
    } else {
      log(`  npm run ${script}: ok`);
    }
  }
  log('');
}

// ---------------------------------------------------------------- підсумок

const width = Math.max(...rows.map((r) => r.name.length), 'Перевірка'.length);
log(`Підсумок — етап ${N}`);
log(`  ${'Перевірка'.padEnd(width)}  Результат  Тести   Примітка`);
for (const r of rows) {
  log(`  ${r.name.padEnd(width)}  ${r.status.padEnd(9)}  ${r.tests.padEnd(6)}  ${r.note}`);
}
if (warnings.length > 0) {
  log('');
  log(`Попередження (${warnings.length}):`);
  for (const w of warnings) log(`  - ${w}`);
}
if (opts.step !== undefined) {
  log('');
  log(
    `Це перевірка одного кроку. Повна перевірка етапу (регресія + lint + typecheck): npm run lesson:check -- ${N}`,
  );
}

const failed = hardFailure || rows.some((r) => r.status === 'fail');
log('');
log(failed ? 'Результат: FAIL' : 'Результат: OK');
process.exit(failed ? 1 : 0);
