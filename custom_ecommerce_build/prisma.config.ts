import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Connection URLs moved out of `schema.prisma` in v7 — Migrate reads them from
 * here, and the runtime client takes a driver adapter instead (see
 * `src/lib/prisma.ts`).
 *
 * Migrate takes DIRECT_URL, not DATABASE_URL: migrations cannot run through
 * PgBouncer in transaction mode. (v7's datasource config no longer accepts a
 * separate `directUrl` — the migration connection is simply the one given here,
 * while the app runtime uses the pooled DATABASE_URL via its driver adapter.)
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
