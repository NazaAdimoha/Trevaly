import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration — the ONE place migrations run from.
 *
 * The schema moved here from `custom_ecommerce_build/prisma/` with every
 * migration byte-for-byte unchanged, because their checksums are recorded in
 * `_prisma_migrations`. Web still generates its own client from this schema but
 * never migrates (BACKEND_MIGRATION_PLAN 3.2 / 3.5).
 *
 * Migrate takes DIRECT_URL, not DATABASE_URL: migrations cannot run through
 * PgBouncer in transaction mode. The app runtime uses the pooled DATABASE_URL
 * through its driver adapter (src/database/prisma.service.ts).
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
