/**
 * Copies the Prisma-generated enums into the shared core package.
 *
 * The enums are the domain vocabulary both clients speak. Prisma emits them as
 * pure TypeScript with zero imports, which is the only reason they can cross
 * the package boundary — so the sync is a copy, not a translation.
 *
 * Wired into `db:generate`, so a schema change updates both apps in the same
 * command. If it is ever skipped, `pnpm typecheck` fails on the mismatch rather
 * than letting the two drift quietly.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SOURCE = join(__dirname, '../src/generated/prisma/enums.ts');
const TARGET = join(__dirname, '../../packages/core/src/enums.ts');

const HEADER = `/**
 * GENERATED — do not edit. Produced by \`pnpm sync:core\` from
 * \`src/generated/prisma/enums.ts\`, which Prisma writes from schema.prisma.
 *
 * This is the shared domain vocabulary. Re-exporting the generated file rather
 * than hand-maintaining a copy is what stops the web app and the mobile app
 * ever disagreeing about what \`PAID\` means.
 */
`;

const generated = readFileSync(SOURCE, 'utf8');
writeFileSync(TARGET, HEADER + generated.replace(/^\n/, ''));

const count = (generated.match(/^export const /gm) ?? []).length;
console.log(`sync:core — ${count} enums copied to packages/core/src/enums.ts`);
