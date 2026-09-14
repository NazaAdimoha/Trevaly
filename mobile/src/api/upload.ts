import { api, toApiError } from './client';
import { uploadConfigSchema, uploadSignatureSchema } from './schemas';

/**
 * Photograph a product and put it in the store's Cloudinary folder.
 *
 * Identical in shape to what the web upload widget does, and it needed **no
 * server change**: `/uploads/signature` already returns the config over GET and
 * signs the exact parameters over POST, and the folder is derived server-side
 * from the authorized tenant. A signature is a capability — signing a
 * client-supplied folder would let one store overwrite another's assets.
 *
 * The bytes go straight from the phone to Cloudinary. They never pass through
 * our server, which matters more on mobile than on the web: a 4MB photo over a
 * Lagos 3G connection would otherwise hold a serverless invocation open for the
 * entire upload.
 *
 * Returns the **public ID**, never a delivery URL. A stored URL freezes the
 * transformation applied at upload time; the public ID lets the storefront
 * derive format, quality and crop at render.
 */
const ACCEPTED_MIME = /^image\/(jpe?g|png|webp|avif|heic|heif)$/i;

/** 10 MB, matching what the server signs. Checked here so a merchant on mobile
 *  data is not made to upload a file that will be rejected on arrival. */
const MAX_BYTES = 10_485_760;

export async function uploadProductImage(
  storeSlug: string,
  file: {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
  },
  kind: 'products' | 'branding' = 'products',
): Promise<string> {
  // Validated HERE rather than at each picker. Every caller passes through this
  // function, and the previous code defaulted an absent MIME type to
  // 'image/jpeg' — asserting something it had not checked.
  if (file.mimeType && !ACCEPTED_MIME.test(file.mimeType)) {
    throw new Error('Choose a photo — JPG, PNG, WEBP or HEIC.');
  }
  if (file.fileSize && file.fileSize > MAX_BYTES) {
    throw new Error('That photo is over 10 MB. Try a smaller one.');
  }

  try {
    const { data: rawConfig } = await api.get(
      `/stores/${storeSlug}/uploads/signature`,
    );
    const config = uploadConfigSchema.parse(rawConfig);

    // Cloudinary rejects a signature that does not cover the parameters byte
    // for byte, so these are sent for signing exactly as they will be uploaded.
    // The server derives both folders from the authorized tenant and only signs
    // one it recognises, so picking the wrong one here fails closed rather than
    // writing somewhere it should not.
    const folder =
      kind === 'branding' && config.brandingFolder
        ? config.brandingFolder
        : config.folder;

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = { folder, timestamp };

    const { data: rawSigned } = await api.post(
      `/stores/${storeSlug}/uploads/signature`,
      { paramsToSign },
    );
    const signed = uploadSignatureSchema.parse(rawSigned);
    const enforced = signed.enforced;

    const body = new FormData();
    body.append('file', {
      uri: file.uri,
      type: file.mimeType ?? 'image/jpeg',
      name: file.fileName ?? `${kind}-${timestamp}.jpg`,
    } as unknown as Blob);
    body.append('api_key', config.apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', folder);
    body.append('signature', signed.signature);

    // Echoed back exactly as signed. Omitting any of these is a signature
    // mismatch, which is the point: the limits cannot be dropped by the client.
    if (enforced) {
      body.append('allowed_formats', enforced.allowed_formats);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: 'POST', body },
    );
    const result = (await response.json()) as {
      public_id?: string;
      error?: { message?: string };
    };

    if (!response.ok || !result.public_id) {
      throw new Error(result.error?.message ?? 'Upload failed');
    }
    return result.public_id;
  } catch (error) {
    if (error instanceof Error && !('isAxiosError' in error)) throw error;
    throw toApiError(error);
  }
}
