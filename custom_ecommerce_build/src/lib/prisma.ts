import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 emits the client into `src/generated/prisma` (see schema.prisma).
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Raw Prisma client.
 *
 * **Do not import this in a route handler or page for tenant-owned data** — use
 * `tenantDb(tenantId)` from `@/lib/tenant-db`, which injects the tenant filter
 * automatically. ESLint enforces this under `src/app`.
 *
 * Legitimate direct uses: resolving the tenant itself, platform-level admin
 * queries, webhook event logging, and migrations/seeds.
 *
 * Prisma 7 takes a driver adapter rather than a datasource URL from the schema.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
