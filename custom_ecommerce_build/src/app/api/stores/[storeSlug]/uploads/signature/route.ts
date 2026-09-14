import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { tenantUploadFolder, tenantUploadFolders } from '@core/media/folder';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { cloudinaryConfig, signUploadParams } from '@/lib/media/cloudinary';
import { clientKey, rateLimit } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ storeSlug: string }> };

/**
 * The widget sends the exact parameters it is about to upload with, because
 * Cloudinary rejects a signature that does not cover them byte for byte. We
 * cannot simply sign whatever arrives, though — see the folder check below.
 */
const signatureRequestSchema = z.object({
  paramsToSign: z.record(z.string(), z.union([z.string(), z.number()])),
});

/**
 * The only parameters a client may have us sign.
 *
 * A signature is a capability: whatever we put our name to, Cloudinary will
 * accept. Signing whatever arrives — which is what this did — let a merchant
 * add `notification_url` (Cloudinary makes an HTTP callback to any URL they
 * choose, on our account's reputation), `eager` (arbitrarily expensive
 * transformation chains, billed to us), or `overwrite`.
 *
 * An allowlist rather than a denylist, because the risk is the parameter
 * Cloudinary adds next year that nobody here thinks to ban.
 */
const SIGNABLE_PARAMS = new Set(['folder', 'timestamp']);

/**
 * Constraints baked into the signature.
 *
 * Only `allowed_formats` is here, and that is not an oversight — it is the only
 * one of the three constraints Cloudinary actually lets us sign. Verified
 * against the live API rather than assumed: Cloudinary excludes `resource_type`
 * and `max_file_size` from the signed string (along with `file`, `cloud_name`
 * and `api_key`), so including either produces a guaranteed signature mismatch
 * and the upload fails outright.
 *
 * `allowed_formats` does the load-bearing work anyway. It is signed, so a
 * client cannot drop it, and it refuses anything that is not one of these
 * formats WHICHEVER endpoint the file is sent to — a `/raw/upload` of
 * `payload.exe` is rejected because `exe` is not on the list. That closes the
 * arbitrary-file-hosting hole without needing to pin `resource_type`.
 *
 * SVG is excluded on purpose: it is a script-bearing document, and one served
 * from a CDN origin and opened directly is stored XSS.
 *
 * SIZE IS NOT ENFORCED HERE. `max_file_size` cannot be signed, so a client is
 * free to omit it. The 10 MB check in the mobile upload helper is a courtesy to
 * the merchant's data bill, not a control. A real cap is an account-level
 * setting in the Cloudinary console — see docs/SECURITY_AUDIT.md.
 */
const ENFORCED_PARAMS = {
  allowed_formats: 'jpg,jpeg,png,webp,avif,heic,heif',
} as const;

/**
 * Sign an upload for this store.
 *
 * The folder is the security boundary. A signature is a capability: whatever we
 * put our name to, Cloudinary will accept. Signing a client-supplied `folder`
 * unchanged would let a member of one store write into — and overwrite — another
 * store's assets, which is the same cross-tenant failure `tenantDb()` exists to
 * prevent, just in object storage instead of Postgres. So the folder is derived
 * from the authorized tenant and the request is rejected if it asks for
 * anything else.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    // Signing is cheap but it authorizes an upload, so it is not unlimited.
    const limit = rateLimit(clientKey(req, `upload-sign:${tenant.id}`), {
      limit: 30,
      windowSeconds: 60,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const parsed = signatureRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid signature request' },
        { status: 400 },
      );
    }

    const { paramsToSign } = parsed.data;

    // Rejected, not stripped. Silently dropping a parameter the client then
    // uploads with produces a signature mismatch at Cloudinary that looks like
    // a bug in our code rather than a refusal.
    const unexpected = Object.keys(paramsToSign).filter(
      (key) => !SIGNABLE_PARAMS.has(key),
    );
    if (unexpected.length > 0) {
      return NextResponse.json(
        { error: `Cannot sign: ${unexpected.join(', ')}` },
        { status: 400 },
      );
    }

    // A store has more than one folder now (product photos, branding). Still
    // derived from the authorized tenant and matched against a fixed list —
    // the folder remains the security boundary, it is just no longer a single
    // value.
    const allowed = tenantUploadFolders(tenant.slug);

    if (
      typeof paramsToSign.folder !== 'string' ||
      !allowed.includes(paramsToSign.folder)
    ) {
      return NextResponse.json(
        { error: 'Uploads must go to this store’s own folder' },
        { status: 403 },
      );
    }

    const { apiSecret } = cloudinaryConfig();

    // The client must send these back verbatim on the upload: Cloudinary
    // rejects a signature that does not cover the request byte for byte, which
    // is what makes them binding rather than advisory.
    const signedParams = { ...paramsToSign, ...ENFORCED_PARAMS };

    return NextResponse.json({
      signature: signUploadParams(signedParams, apiSecret),
      enforced: ENFORCED_PARAMS,
    });
  });
}

/** Config the widget needs before it can start, behind the same store check. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);
    const { cloudName, apiKey } = cloudinaryConfig();

    return NextResponse.json({
      cloudName,
      apiKey,
      folder: tenantUploadFolder(tenant.slug),
      brandingFolder: tenantUploadFolder(tenant.slug, 'branding'),
    });
  });
}
