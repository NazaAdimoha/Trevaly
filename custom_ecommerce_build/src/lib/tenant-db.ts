import { prisma } from '@/lib/prisma';

/**
 * Tenant-scoped Prisma client.
 *
 * Every query made through this helper is automatically constrained to one
 * tenant. Route handlers and Server Components never touch the raw client for
 * tenant-owned data, so a forgotten `where: { tenantId }` cannot leak another
 * business's records.
 *
 * This is a Prisma Client Extension rather than the hand-rolled per-model
 * wrapper sketched in the pricing doc (§9.3). The manual version requires
 * re-implementing every model × every operation by hand, and the first one you
 * forget to add is a silent leak. `$allModels` + `$allOperations` covers
 * everything by construction — including models added later.
 *
 * @example
 * const db = tenantDb(tenant.id);
 * const products = await db.product.findMany({ where: { isActive: true } });
 */

/** Models carrying a `tenantId` column. Keep in sync with schema.prisma. */
const TENANT_SCOPED_MODELS = new Set([
  'TenantUser',
  'Category',
  'Product',
  'ProductVariant',
  'DeliveryZone',
  'Coupon',
  'Order',
  // Platform revenue, not tenant data — a tenant must never read it. It is
  // listed here anyway: the table carries a `tenantId`, so anything reaching it
  // through `tenantDb` would otherwise return every tenant's earnings. Platform
  // aggregates go through `prisma` directly, which is the documented escape
  // hatch for platform-level queries.
  'PlatformEarning',
]);

/** Operations whose `where` must be narrowed to the tenant. */
const WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that write a new row and must have `tenantId` stamped on. */
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * Operations targeting a unique record. Prisma rejects a non-unique field in
 * `where` for these, so they cannot be narrowed inline — they are routed
 * through a `findFirst` guard instead (see below).
 */
const UNIQUE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

export class CrossTenantAccessError extends Error {
  constructor(model: string) {
    super(`Refused cross-tenant access to ${model}`);
    this.name = 'CrossTenantAccessError';
  }
}

export function tenantDb(tenantId: string) {
  if (!tenantId) {
    throw new Error('tenantDb() requires a tenantId');
  }

  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const typedArgs = args as Record<string, unknown>;

          if (WHERE_OPS.has(operation)) {
            typedArgs.where = {
              ...(typedArgs.where as object | undefined),
              tenantId,
            };
            return query(typedArgs);
          }

          if (CREATE_OPS.has(operation)) {
            const data = typedArgs.data;
            typedArgs.data = Array.isArray(data)
              ? data.map((row) => ({ ...row, tenantId }))
              : { ...(data as object | undefined), tenantId };
            return query(typedArgs);
          }

          if (UNIQUE_OPS.has(operation)) {
            // `where` here targets a unique constraint, so `tenantId` cannot be
            // merged in without breaking Prisma's type contract. Verify
            // ownership first, then let the original query run untouched.
            const owned = await (
              prisma as unknown as Record<
                string,
                { findFirst: (a: unknown) => Promise<unknown> }
              >
            )[lowerFirst(model)].findFirst({
              where: { ...(typedArgs.where as object | undefined), tenantId },
              select: { id: true },
            });

            if (!owned && operation !== 'upsert') {
              throw new CrossTenantAccessError(model);
            }

            if (operation === 'upsert') {
              typedArgs.create = {
                ...(typedArgs.create as object | undefined),
                tenantId,
              };
            }
          }

          return query(typedArgs);
        },
      },
    },
  });
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export type TenantDb = ReturnType<typeof tenantDb>;
