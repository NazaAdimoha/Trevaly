/**
 * Guards the one rule that makes `packages/core` shareable.
 *
 * The core is compiled from source by BOTH the Next app and the Expo app. The
 * moment something platform-specific lands in it, the web app keeps working and
 * the mobile build breaks — a failure that surfaces days later, in a different
 * repository, to someone who did not make the change.
 *
 * Written as a script rather than an ESLint rule because flat config refuses to
 * lint files outside its base path, and a second ESLint install in the package
 * costs more than these forty lines.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const CORE = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../packages/core/src',
);

const BANNED = [
  [/^react(-dom)?$/, 'React — the core is platform-free'],
  [/^react-native/, 'React Native — the core is platform-free'],
  [/^expo/, 'Expo — the core is platform-free'],
  [/^next(\/|$)/, 'Next — the core is framework-free'],
  [
    /^(node:)?(crypto|fs|path|os|child_process|http|https|net)$/,
    'a Node built-in — keep server-only code in the web app',
  ],
  [
    /^@prisma\/client$/,
    'the Prisma client — import generated enums from ./enums',
  ],
  [/^@\//, 'an app-scoped alias — the core cannot reach into an app'],
];

/** Globals that only exist on one platform. */
const BANNED_GLOBALS = [
  [/\bdocument\./, '`document` — the core is DOM-free'],
  [/\bwindow\./, '`window` — the core is DOM-free'],
  [/\blocalStorage\b/, '`localStorage` — the core is DOM-free'],
];

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const problems = [];

for (const file of walk(CORE)) {
  const source = readFileSync(file, 'utf8');
  const where = relative(CORE, file);
  // enums.ts is generated verbatim from Prisma and carries its own pragmas.
  if (where === 'enums.ts') continue;

  for (const [, specifier] of source.matchAll(IMPORT)) {
    for (const [pattern, reason] of BANNED) {
      if (pattern.test(specifier)) {
        problems.push(`${where}: imports '${specifier}' — ${reason}`);
      }
    }
  }

  for (const [pattern, reason] of BANNED_GLOBALS) {
    if (pattern.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''))) {
      problems.push(`${where}: uses ${reason}`);
    }
  }
}

if (problems.length > 0) {
  console.error('\npackages/core is not platform-free:\n');
  for (const problem of problems) console.error(`  ✖ ${problem}`);
  console.error('\nMove platform-specific code into the app that needs it.\n');
  process.exit(1);
}

console.log('check:core — packages/core is platform-free');
