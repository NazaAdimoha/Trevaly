import { createHash } from 'crypto';

/**
 * Signed Cloudinary uploads.
 *
 * The browser uploads straight to Cloudinary — the bytes never touch our
 * server, which is the whole point: a 4MB phone photo would otherwise occupy a
 * serverless invocation for its entire upload. What the browser cannot have is
 * the API secret, so it asks us to sign the upload parameters instead.
 *
 * Unsigned upload presets are the usual shortcut and are wrong here. A preset
 * is a bearer token in the page source: anyone who views it can upload anything
 * into the account, and nothing ties an upload to a tenant.
 */

export function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured');
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary's signature: parameters sorted by key, joined `k=v` with `&`,
 * the API secret appended, SHA-1 of the result. `signature` and `api_key` are
 * excluded from the string being signed.
 */
export function signUploadParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((key) => key !== 'signature' && key !== 'api_key')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

/**
 * Upload into a tenant's folder from a remote URL, for the CSV import.
 *
 * Cloudinary does the fetching — we hand it the URL, it pulls the bytes. That
 * is deliberate on two counts: a 4MB image never occupies one of our serverless
 * invocations, and the fetch happens from Cloudinary's network rather than
 * ours, so a merchant's spreadsheet cannot make our server request an internal
 * address. Callers still restrict the input to `https://` before it gets here.
 *
 * `folder` must come from `tenantUploadFolder()`, never from user input — same
 * boundary the signature endpoint enforces for browser uploads.
 */
export async function uploadFromUrl(params: {
  url: string;
  folder: string;
}): Promise<{ publicId: string } | { error: string }> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const signed = { folder: params.folder, timestamp };
  const body = new URLSearchParams({
    file: params.url,
    folder: params.folder,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: signUploadParams(signed, apiSecret),
  });

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body },
    );
    const json = (await res.json()) as {
      public_id?: string;
      error?: { message?: string };
    };

    if (!res.ok || !json.public_id) {
      // Reported per row rather than thrown: one unreachable image must not
      // abandon an import of two hundred products.
      return { error: json.error?.message ?? `Upload failed (${res.status})` };
    }
    return { publicId: json.public_id };
  } catch {
    return { error: 'Could not reach Cloudinary' };
  }
}
