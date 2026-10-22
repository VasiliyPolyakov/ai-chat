#!/usr/bin/env node
// Машинерія курсу. AC-14: контролери не працюють з TypeORM напряму.
// Правило: будь-який .ts у apps/api/src, що містить клас з декоратором @Controller(...),
// не імпортує 'typeorm' / '@nestjs/typeorm' (і їхні підшляхи) — незалежно від назви файлу.
// Доступ до даних — лише через сервіси/репозиторії, які інжектуються в контролер.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'apps/api/src');

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') yield* walk(full);
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      yield full;
    }
  }
}

const CONTROLLER = /@Controller\s*\(/;
const TYPEORM_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"](?:typeorm|@nestjs\/typeorm)(?:\/[^'"]*)?['"]/m;

const violations = [];
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  if (CONTROLLER.test(text) && TYPEORM_IMPORT.test(text)) {
    violations.push(relative(root, file));
  }
}

if (violations.length > 0) {
  console.error(
    '[architecture] AC-14: контролер імпортує TypeORM напряму (typeorm / @nestjs/typeorm):',
  );
  for (const file of violations) console.error(`  - ${file}`);
  console.error('Винеси роботу з репозиторіями в сервіс і інжекти сервіс у контролер.');
  process.exit(1);
}
console.log('[architecture] AC-14 ok: жоден контролер не імпортує TypeORM');
