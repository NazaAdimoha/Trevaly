import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Web's view of the schema, which now lives in the API.
 *
 * Web only GENERATES from here (`prisma generate --generator web`) — it no
 * longer owns migrations. Those run from `api/` alone, so there is exactly one
 * pipeline that can change the database (BACKEND_MIGRATION_PLAN 3.2).
 * `migrations.path` is kept so `prisma migrate status` still works from here
 * for a read-only check.
 */
export default defineConfig({
  schema: '../api/prisma/schema.prisma',
  migrations: {
    path: '../api/prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
