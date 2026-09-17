import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { parseCsvRecords } from '@core/csv';
import { tenantUploadFolder } from '@core/media/folder';
import { slugifyCategory } from '@core/validation/category';
import {
  buildImportPreview,
  importRequestSchema,
  type ParsedImportRow,
} from '@core/validation/import';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { RateLimitService } from '../../cache/rate-limit.service';
import { ApiException } from '../../common/api-exception';
import { clientIp } from '../../common/client-ip';
import { parseWith } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { type TenantDb, tenantDb } from '../../database/tenant-db';
import { CloudinaryService } from '../../integrations/cloudinary.service';

/** Bounded so one paste cannot hold a request open indefinitely. */
const MAX_ROWS = 500;

@Controller('stores/:storeSlug/products/import')
@StoreMember()
export class ImportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly cloudinary: CloudinaryService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @HttpCode(200)
  async import(@CurrentStore() { tenant }: StoreAuth, @Req() req: Request, @Body() raw: unknown) {
    // A commit writes hundreds of rows and pulls images through Cloudinary.
    await this.rateLimit.enforce(
      `import:${tenant.id}:${clientIp(req, this.env)}`,
      { limit: 6, windowSeconds: 60 },
      'Too many imports. Please wait a moment.',
    );

    const body = parseWith(importRequestSchema, raw, 'Invalid import', { withIssues: false });

    const { records } = parseCsvRecords(body.csv);
    if (records.length === 0) {
      throw new ApiException(400, 'That file has no rows under its header');
    }
    if (records.length > MAX_ROWS) {
      throw new ApiException(400, `Up to ${MAX_ROWS} rows at a time — split the file`);
    }

    const db = tenantDb(this.prisma, tenant.id);
    const [categories, existingProducts] = await Promise.all([
      db.category.findMany({ select: { id: true, name: true, slug: true } }),
      db.product.findMany({ select: { slug: true } }),
    ]);

    const preview = buildImportPreview(
      records,
      categories.map((c) => c.name),
    );

    const existingSlugs = new Set(existingProducts.map((p) => p.slug));
    const clashes = preview.rows.filter((row) => existingSlugs.has(row.slug));
    const importable = preview.rows.filter((row) => !existingSlugs.has(row.slug));

    if (!body.commit) {
      return {
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
      };
    }

    if (importable.length === 0) {
      throw new ApiException(400, 'Nothing in that file can be imported');
    }

    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    for (const name of preview.newCategories) {
      const created = await db.category.create({
        data: { name, slug: slugifyCategory(name), position: categoryByName.size },
      } as never);
      categoryByName.set(name.toLowerCase(), (created as { id: string }).id);
    }

    const folder = tenantUploadFolder(tenant.slug);
    const created: string[] = [];
    const failed: Array<{ row: number; message: string }> = [];
    const imageWarnings: Array<{ row: number; message: string }> = [];

    for (const row of importable) {
      // Images first; a failure leaves the product without pictures, not
      // uncreated.
      const publicIds: string[] = [];
      for (const url of row.imageUrls) {
        const result = await this.cloudinary.uploadFromUrl({ url, folder });
        if ('publicId' in result) {
          publicIds.push(result.publicId);
        } else {
          imageWarnings.push({ row: row.row, message: `"${row.name}": ${result.error}` });
        }
      }

      try {
        await this.createImportedProduct(db, tenant.id, row, publicIds, categoryByName);
        created.push(row.name);
      } catch {
        // Per row, so one bad product does not abandon the other 199.
        failed.push({ row: row.row, message: `"${row.name}" could not be saved` });
      }
    }

    return {
      mode: 'commit',
      created: created.length,
      failed,
      imageWarnings,
      skipped: clashes.length,
      errors: preview.errors,
    };
  }

  private async createImportedProduct(
    db: TenantDb,
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
}
