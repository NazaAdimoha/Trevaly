import { File, UploadType } from 'expo-file-system';

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

    /**
     * Uploaded with `expo-file-system`, NOT `fetch` + `FormData`.
     *
     * This used to append React Native's `{ uri, type, name }` part to a
     * `FormData` and hand it to the global `fetch`. That stopped working in
     * Expo SDK 57, which replaces the global `fetch` with its WinterCG
     * implementation — and that one accepts only a string, a real `Blob`, or an
     * object with `bytes()`. A `uri` part is none of those, so every image
     * upload in the app failed with "Unsupported FormDataPart implementation".
     * Expo's own converter says so in a comment: `uri` is not supported.
     *
     * `File.upload` is the right tool rather than the nearest workaround. The
     * obvious patch — read the file into a `Blob` and append that — would pull
     * a 10MB photo through the JS heap on a mid-range Android. This streams it
     * from disk natively, and it speaks multipart itself, so the parameters
     * below are the same ones Cloudinary was already being sent.
     */
    const parameters: Record<string, string> = {
      api_key: config.apiKey,
      timestamp: String(timestamp),
      folder,
      signature: signed.signature,
      // Echoed back exactly as signed. Omitting any of these is a signature
      // mismatch, which is the point: the limits cannot be dropped by the client.
      ...(enforced ? { allowed_formats: enforced.allowed_formats } : {}),
    };

    const upload = await new File(file.uri).upload(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      {
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.mimeType ?? 'image/jpeg',
        parameters,
      },
    );

    // `upload` resolves for ANY completed response, including a 4xx — it
    // rejects only when the file cannot be read or the request never
    // completed. The status has to be checked here or a rejected upload would
    // read as a success with no public id.
    const result = JSON.parse(upload.body || '{}') as {
      public_id?: string;
      error?: { message?: string };
    };

    if (upload.status >= 400 || !result.public_id) {
      throw new Error(result.error?.message ?? 'Upload failed');
    }
    return result.public_id;
  } catch (error) {
    if (error instanceof Error && !('isAxiosError' in error)) throw error;
    throw toApiError(error);
  }
}
