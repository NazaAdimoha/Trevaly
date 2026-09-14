import { type NextRequest, NextResponse } from 'next/server';

import { cloudinaryUrl } from '@core/media/folder';
import {
  logoBelongsToStore,
  storeSettingsSchema,
} from '@core/validation/store-settings';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
// eslint-disable-next-line no-restricted-imports -- `Tenant` is not in TENANT_SCOPED_MODELS (it IS the tenant), so `tenantDb` would pass straight through and imply a scoping that never happens. The row is pinned to the id `authorizeStore` returned.
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ storeSlug: string }> };

/** The settings a merchant can read and edit about their own store. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    return NextResponse.json({
      name: tenant.name,
      slug: tenant.slug,
      tagline: tenant.tagline,
      primaryColor: tenant.primaryColor,
      theme: tenant.theme,
      logoPublicId: tenant.logoPublicId,
      // Sent alongside the id so a client can render the current logo without
      // knowing the transformation rules.
      logoUrl: cloudinaryUrl(
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        tenant.logoPublicId,
        { width: 512, height: 512, crop: 'fit' },
      ),
    });
  });
}

/**
 * Update store settings.
 *
 * PATCH rather than PUT: the app edits one field at a time and a full-document
 * write would make two merchants editing different fields overwrite each other.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = storeSettingsSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // The signature endpoint stops a store UPLOADING outside its own folder,
    // but nothing stops one PATCHing another store's public ID straight in.
    // Same class of mistake, closed in the same way.
    if (!logoBelongsToStore(parsed.data.logoPublicId, tenant.slug)) {
      return NextResponse.json(
        { error: 'That image does not belong to this store' },
        { status: 403 },
      );
    }

    // Pinned to the authorized tenant's own id — the only row this route may
    // ever touch.
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: parsed.data,
    });

    // No cache invalidation, deliberately. An `invalidateDomain` call used to
    // sit here on the belief that the domain cache held the store's name and
    // logo. It never did: that cache maps hostname -> slug and nothing else,
    // and this route cannot change either (slug and customDomain are not in
    // `storeSettingsSchema`). The storefront reads the tenant through React's
    // per-request `cache`, so a new name or logo is live on the very next
    // request. The call only forced one extra database lookup, and on
    // serverless it would have reached one instance's copy at most.
    //
    // If this route ever learns to change `slug` or `customDomain`, THAT is when
    // `invalidateDomain` belongs here — and it will need a shared store (Redis)
    // to reach every instance, not just the one serving this request.

    return NextResponse.json({
      name: updated.name,
      slug: updated.slug,
      tagline: updated.tagline,
      primaryColor: updated.primaryColor,
      theme: updated.theme,
      logoPublicId: updated.logoPublicId,
      logoUrl: cloudinaryUrl(
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        updated.logoPublicId,
        { width: 512, height: 512, crop: 'fit' },
      ),
    });
  });
}
