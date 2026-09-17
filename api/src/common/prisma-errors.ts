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

/** The columns a unique violation named, when Prisma reports them. */
export function uniqueTarget(err: unknown): string | undefined {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return (err.meta?.target as string[] | undefined)?.join(', ');
}
