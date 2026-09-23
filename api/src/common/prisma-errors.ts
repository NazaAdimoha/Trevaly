import { Prisma } from '../generated/prisma/client';

/**
 * Prisma error codes the API maps to client errors.
 *
 *   P2002  unique constraint — a slug, SKU or code already in use
 *   P2003  foreign key — e.g. deleting a product that appears on orders
 *   P2025  record not found for an update or delete
 */
export function isPrismaError(err: unknown, code: 'P2002' | 'P2003' | 'P2025'): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

/**
 * The columns a unique violation named, when Prisma reports them.
 *
 * TWO shapes, because Prisma 7 with a driver adapter no longer fills
 * `meta.target` — it is `undefined`, and the columns arrive nested under the
 * adapter's own error instead:
 *
 *   meta.driverAdapterError.cause.constraint.fields  ->  ['"tenantId"', 'sku']
 *
 * Reading only the legacy shape made every caller's `target?.includes('sku')`
 * fall through to its else branch, so a duplicate SKU was reported to the
 * merchant as "a product with this slug already exists". They would then rename
 * the product, watch it fail again, and have no way to work out why. The quotes
 * around the column names are the adapter's, and are stripped here so callers
 * can keep matching on plain field names.
 */
export function uniqueTarget(err: unknown): string | undefined {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return undefined;

  const legacy = err.meta?.target as string[] | string | undefined;
  if (Array.isArray(legacy)) return legacy.join(', ');
  if (typeof legacy === 'string') return legacy;

  const fields = (
    err.meta as
      | { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
      | undefined
  )?.driverAdapterError?.cause?.constraint?.fields;

  return Array.isArray(fields)
    ? fields.map((field) => field.replace(/"/g, '')).join(', ')
    : undefined;
}
