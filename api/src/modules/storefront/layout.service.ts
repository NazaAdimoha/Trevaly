import { Injectable, Logger } from '@nestjs/common';

import { isOwnedBy } from '@core/media/folder';
import {
  defaultLayout,
  layoutSchema,
  mediaIds,
  parseLayout,
  type StorefrontLayout,
} from '@core/storefront/layout';
import { presetForTheme } from '@core/storefront/tokens';

import { ApiException } from '../../common/api-exception';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { StorefrontTheme } from '../../generated/prisma/enums';

/**
 * A layout as a value Prisma will store in a Json column.
 *
 * The round trip is not ceremony: Zod's optional fields leave `undefined`
 * behind, which is not JSON, and Prisma's input type rejects a typed object
 * outright. One pass through JSON gives a value that is exactly what will come
 * back out of the database — which is what makes the round-trip test in core
 * mean something.
 */
function toJson(layout: StorefrontLayout): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(layout)) as Prisma.InputJsonValue;
}

type Store = { id: string; slug: string; theme: StorefrontTheme };

/**
 * The storefront layout: read by shoppers, written by merchants.
 *
 * Two rules shape everything here.
 *
 * **A storefront must always render.** Reads never throw. A layout that cannot
 * be parsed — written by a newer app, referencing a section this build does not
 * have — degrades to the parts that do work, and the problems are logged rather
 * than shown to a shopper.
 *
 * **A draft must never be lost.** Writes are strict and say exactly what was
 * wrong, because the alternative is a merchant pressing save on a phone and
 * quietly losing the hero they just built.
 */
@Injectable()
export class StorefrontLayoutService {
  private readonly logger = new Logger('StorefrontLayout');

  constructor(private readonly prisma: PrismaService) {}

  /** The merchant's view: draft, published, and the version to send back. */
  async forMerchant(store: Store) {
    const row = await this.prisma.storefrontLayout.findUnique({
      where: { tenantId: store.id },
    });

    if (row) {
      return {
        draft: parseLayout(row.draft).layout,
        published: row.published ? parseLayout(row.published).layout : null,
        version: row.version,
        publishedAt: row.publishedAt,
      };
    }

    // First open. Seed from whatever theme the store already chose, so the
    // editor opens on a shop rather than an empty page (see `defaultLayout`).
    const seeded = defaultLayout(presetForTheme(store.theme));
    const created = await this.prisma.storefrontLayout.create({
      data: { tenantId: store.id, draft: toJson(seeded) },
    });

    return {
      draft: seeded,
      published: null,
      version: created.version,
      publishedAt: null,
    };
  }

  /**
   * Save the draft.
   *
   * `expectedVersion` is the version the app loaded. Two devices editing one
   * store is rare but real — a merchant on a phone and a laptop — and the
   * failure mode without this is one of them silently discarding the other's
   * work. A mismatch returns 409 with the current version so the app can offer
   * to reload rather than guess.
   */
  async saveDraft(store: Store, body: unknown, expectedVersion: number) {
    const layout = this.validate(body, store.slug);

    const { count } = await this.prisma.storefrontLayout.updateMany({
      where: { tenantId: store.id, version: expectedVersion },
      data: { draft: toJson(layout), version: { increment: 1 } },
    });

    if (count === 0) {
      const current = await this.prisma.storefrontLayout.findUnique({
        where: { tenantId: store.id },
        select: { version: true },
      });
      if (!current) throw new ApiException(404, 'This store has no storefront layout yet');
      throw new ApiException(
        409,
        'Someone else changed this storefront while you were editing',
        { currentVersion: current.version },
      );
    }

    return { draft: layout, version: expectedVersion + 1 };
  }

  /** Draft becomes what shoppers see. */
  async publish(store: Store, expectedVersion: number) {
    const row = await this.prisma.storefrontLayout.findUnique({
      where: { tenantId: store.id },
    });
    if (!row) throw new ApiException(404, 'This store has no storefront layout yet');
    if (row.version !== expectedVersion) {
      throw new ApiException(409, 'Someone else changed this storefront while you were editing', {
        currentVersion: row.version,
      });
    }

    // Re-validated on the way out: the draft was valid when it was written, but
    // this build may know fewer sections than the one that wrote it.
    const { layout, problems } = parseLayout(row.draft);
    if (problems.length > 0) {
      this.logger.warn({ msg: 'Publishing a layout with dropped sections', store: store.slug, problems });
    }

    const updated = await this.prisma.storefrontLayout.update({
      where: { tenantId: store.id },
      data: { published: toJson(layout), publishedAt: new Date(), version: { increment: 1 } },
    });

    return { published: layout, version: updated.version, publishedAt: updated.publishedAt };
  }

  /** Throw the draft away and go back to what shoppers currently see. */
  async revert(store: Store) {
    const row = await this.prisma.storefrontLayout.findUnique({
      where: { tenantId: store.id },
    });
    if (!row) throw new ApiException(404, 'This store has no storefront layout yet');
    if (!row.published) {
      throw new ApiException(409, 'Nothing has been published yet, so there is nothing to go back to');
    }

    const { layout } = parseLayout(row.published);
    const updated = await this.prisma.storefrontLayout.update({
      where: { tenantId: store.id },
      data: { draft: toJson(layout), version: { increment: 1 } },
    });

    return { draft: layout, version: updated.version };
  }

  /**
   * What a shopper gets. Never throws, never returns null: a store that has
   * published nothing still gets the default layout for its preset, which is
   * how an untouched store looks like a shop on day one.
   */
  async published(store: Store): Promise<StorefrontLayout> {
    const row = await this.prisma.storefrontLayout.findUnique({
      where: { tenantId: store.id },
      select: { published: true },
    });

    if (!row?.published) return defaultLayout(presetForTheme(store.theme));

    const { layout, problems } = parseLayout(row.published);
    if (problems.length > 0) {
      this.logger.warn({ msg: 'Published layout has unusable sections', store: store.slug, problems });
    }
    return layout;
  }

  /**
   * Strict validation for writes, with the image-ownership check.
   *
   * A layout is another place a Cloudinary public id can be supplied, so it is
   * another place one store could point at another's assets — the same hole the
   * product and logo routes close. Rejected, not stripped: silently dropping a
   * merchant's image looks like our bug.
   */
  private validate(body: unknown, slug: string): StorefrontLayout {
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(400, 'Invalid storefront layout', {
        issues: parsed.error.issues,
      });
    }

    const { layout, problems } = parseLayout(parsed.data);
    if (problems.length > 0) {
      throw new ApiException(400, 'Invalid storefront layout', { issues: problems });
    }

    const foreign = mediaIds(layout).filter((id) => !isOwnedBy(id, slug));
    if (foreign.length > 0) {
      throw new ApiException(403, 'Those images do not belong to this store');
    }

    return layout;
  }
}
