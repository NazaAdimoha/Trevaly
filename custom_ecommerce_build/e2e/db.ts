import { config } from 'dotenv';
import { Client } from 'pg';

/**
 * Direct SQL access for E2E assertions.
 *
 * Deliberately not the generated Prisma client: Prisma 7 emits ESM, and
 * Playwright loads spec files through a CommonJS require, so importing it here
 * fails at load time. `pg` is already in the tree as the Prisma driver adapter,
 * and raw SQL is arguably the better assertion anyway — it reads what is
 * actually in the table rather than what our own query layer says is there.
 */

config({ path: '.env', quiet: true });

export async function sql<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(text, values);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

export async function one<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const rows = await sql<T>(text, values);
  if (rows.length === 0) throw new Error(`No row for query: ${text}`);
  return rows[0];
}

export type OrderRow = {
  id: string;
  orderNumber: number;
  status: string;
  totalKobo: number;
  paidAmountKobo: number | null;
  hasStockIssue: boolean;
  paymentReference: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  priceKobo: number;
  stock: number;
};

export const getOrder = (reference: string) =>
  one<OrderRow>(`SELECT * FROM "Order" WHERE "paymentReference" = $1`, [
    reference,
  ]);

export const getProductById = (id: string) =>
  one<ProductRow>(`SELECT * FROM "Product" WHERE id = $1`, [id]);

export async function setStock(
  tenantSlug: string,
  productSlug: string,
  stock: number,
) {
  return one<ProductRow>(
    `UPDATE "Product" p SET stock = $3
       FROM "Tenant" t
      WHERE t.id = p."tenantId" AND t.slug = $1 AND p.slug = $2
      RETURNING p.*`,
    [tenantSlug, productSlug, stock],
  );
}

export type VariantRow = {
  id: string;
  productId: string;
  value: string;
  priceKobo: number | null;
  stock: number;
  isActive: boolean;
};

export const getVariantById = (id: string) =>
  one<VariantRow>(`SELECT * FROM "ProductVariant" WHERE id = $1`, [id]);

/** Sets one option's stock and returns the row, for before/after assertions. */
export async function setVariantStock(
  tenantSlug: string,
  productSlug: string,
  value: string,
  stock: number,
) {
  return one<VariantRow>(
    `UPDATE "ProductVariant" v SET stock = $4
       FROM "Product" p, "Tenant" t
      WHERE p.id = v."productId"
        AND t.id = p."tenantId"
        AND t.slug = $1
        AND p.slug = $2
        AND v.value = $3
      RETURNING v.*`,
    [tenantSlug, productSlug, value, stock],
  );
}
