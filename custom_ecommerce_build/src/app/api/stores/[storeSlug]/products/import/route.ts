import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseCsvRecords } from '@core/csv';
import { tenantUploadFolder } from '@core/media/folder';
import { slugifyCategory } from '@core/validation/category';
import {
  buildImportPreview,
  type ParsedImportRow,
} from '@core/validation/import';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { uploadFromUrl } from '@/lib/media/cloudinary';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { tenantDb } from '@/lib/tenant-db';

type RouteContext = { params: Promise<{ storeSlug: string }> };

const importSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  /** Preview by default. Nothing is written until the merchant confirms. */
  commit: z.boolean().default(false),
});

/** Bounded so one paste cannot hold a serverless invocation open indefinitely. */
const MAX_ROWS = 500;

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    // A commit writes hundreds of rows and may pull images through Cloudinary,
    // so it is throttled well below the ordinary product endpoints.
    const limit = rateLimit(clientKey(req, `import:${tenant.id}`), {
      limit: 6,
      windowSeconds: 60,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many imports. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const parsed = importSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid import' }, { status: 400 });
    }

    const { records } = parseCsvRecords(parsed.data.csv);
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'That file has no rows under its header' },
        { status: 400 },
      );
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Up to ${MAX_ROWS} rows at a time — split the file` },
        { status: 400 },
      );
    }

    const db = tenantDb(tenant.id);

    // tenantId is injected by the wrapper — deliberately absent here.
    const [categories, existingProducts] = await Promise.all([
      db.category.findMany({ select: { id: true, name: true, slug: true } }),
      db.product.findMany({ select: { slug: true } }),
    ]);

    const preview = buildImportPreview(
      records,
      categories.map((c) => c.name),
    );

    // Clashes with what is already in the store, on top of clashes inside the
    // file that `buildImportPreview` already found.
    const existingSlugs = new Set(existingProducts.map((p) => p.slug));
    const clashes = preview.rows.filter((row) => existingSlugs.has(row.slug));
    const importable = preview.rows.filter(
      (row) => !existingSlugs.has(row.slug),
    );

    if (!parsed.data.commit) {
      return NextResponse.json({
        mode: 'preview',
        willCreate: importable.length,
        willSkip: clashes.length,
        newCategories: preview.newCategories,
        errors: preview.errors,
        skipped: clashes.map((row) => ({
          row: row.row,
          message: `"${row.name}" already exists at /${row.slug}`,
        })),
        sample: importable.slice(0, 10).map((row) => ({
          name: row.name,
          priceKobo: row.priceKobo,
          stock: row.stock,
          category: row.categoryName,
          optionName: row.optionName,
          variantCount: row.variants.length,
          imageCount: row.imageUrls.length,
        })),
      });
    }

    if (importable.length === 0) {
      return NextResponse.json(
        { error: 'Nothing in that file can be imported' },
        { status: 400 },
      );
    }

    // ── Commit ───────────────────────────────────────────────────────────────
    const categoryByName = new Map(
      categories.map((c) => [c.name.toLowerCase(), c.id]),
    );

    for (const name of preview.newCategories) {
      const created = await db.category.create({
        data: {
          name,
          slug: slugifyCategory(name),
          position: categoryByName.size,
        },
      } as never);
      categoryByName.set(name.toLowerCase(), (created as { id: string }).id);
    }

    const folder = tenantUploadFolder(tenant.slug);
    const created: string[] = [];
    const failed: Array<{ row: number; message: string }> = [];
    const imageWarnings: Array<{ row: number; message: string }> = [];

    for (const row of importable) {
      // Images first: Cloudinary fetches them, and a failure here should leave
      // the product created without pictures rather than not created at all.
      const publicIds: string[] = [];
      for (const url of row.imageUrls) {
        const result = await uploadFromUrl({ url, folder });
        if ('publicId' in result) {
          publicIds.push(result.publicId);
        } else {
          imageWarnings.push({
            row: row.row,
            message: `"${row.name}": ${result.error}`,
          });
        }
      }

      try {
        await createImportedProduct(
          db,
          tenant.id,
          row,
          publicIds,
          categoryByName,
        );
        created.push(row.name);
      } catch {
        // Per row, so one bad product does not abandon the other 199.
        failed.push({
          row: row.row,
          message: `"${row.name}" could not be saved`,
        });
      }
    }

    return NextResponse.json({
      mode: 'commit',
      created: created.length,
      failed,
      imageWarnings,
      skipped: clashes.length,
      errors: preview.errors,
    });
  });
}

async function createImportedProduct(
  db: ReturnType<typeof tenantDb>,
  tenantId: string,
  row: ParsedImportRow,
  imageUrls: string[],
  categoryByName: Map<string, string>,
) {
  await db.product.create({
    data: {
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      description: row.description,
      priceKobo: row.priceKobo,
      stock: row.stock,
      imageUrls,
      isActive: true,
      optionName: row.optionName,
      categoryId: row.categoryName
        ? (categoryByName.get(row.categoryName.toLowerCase()) ?? null)
        : null,
      variants: {
        // `tenantId` set explicitly: the tenantDb extension injects it into the
        // top-level `data` only, so a nested create would fail the column.
        create: row.variants.map((variant, index) => ({
          tenantId,
          value: variant.value,
          priceKobo: variant.priceKobo,
          stock: variant.stock,
          position: index,
          isActive: true,
        })),
      },
    },
  } as never);
}
