import { File, UploadType } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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

/**
 * Formats Cloudinary has to DECODE rather than just store.
 *
 * HEIC/HEIF are HEVC-encoded, and decoding HEVC is rationed on Cloudinary's
 * Free plan: an upload comes back `429 Slow Down, Out of Processing Capacity`
 * perhaps two times in three, then succeeds — verified directly against the
 * account, with and without our `allowed_formats`, while a PNG posted seconds
 * later went through every time. Nothing about it is a rate limit we can wait
 * out, and nothing about it is our signature.
 *
 * Every photo an iPhone takes is one of these by default, so on that plan most
 * merchants would simply find that images "sometimes don't upload".
 */
const NEEDS_TRANSCODE = /^image\/(heic|heif)$/i;

/**
 * Re-encode a HEIC/HEIF photo to JPEG before it leaves the phone.
 *
 * This is the fix for the above, and it is better than the alternatives on
 * their own terms: the phone already has a hardware HEVC decoder and does this
 * in milliseconds, the resulting JPEG is usually SMALLER over Nigerian mobile
 * data, and Cloudinary never has to decode anything — so the failure cannot
 * come back on a busy day or a different plan.
 *
 * Anything else is passed through untouched; re-encoding a JPEG would cost a
 * generation of quality for nothing.
 */
async function toUploadable(file: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}) {
  if (!file.mimeType || !NEEDS_TRANSCODE.test(file.mimeType)) return file;

  const converted = await manipulateAsync(file.uri, [], {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });

  return {
    uri: converted.uri,
    mimeType: 'image/jpeg',
    fileName: (file.fileName ?? 'photo').replace(/\.(heic|heif)$/i, '.jpg'),
    // The size changed, and the old one would make the guard below lie.
    fileSize: null,
  };
}

export async function uploadProductImage(
  storeSlug: string,
  original: {
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
  if (original.mimeType && !ACCEPTED_MIME.test(original.mimeType)) {
    throw new Error('Choose a photo — JPG, PNG, WEBP or HEIC.');
  }
  if (original.fileSize && original.fileSize > MAX_BYTES) {
    throw new Error('That photo is over 10 MB. Try a smaller one.');
  }

  // Checked before conversion, on the size the merchant actually picked.
  const file = await toUploadable(original);

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

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
    const options = {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.mimeType ?? 'image/jpeg',
      parameters,
    } as const;

    /**
     * Retried on 429 only.
     *
     * Converting HEIC on the phone removes the reason this account saw 429s,
     * but not the possibility: Cloudinary throttles by capacity, so a big photo
     * on a busy afternoon can still bounce. Two extra attempts a couple of
     * seconds apart is the difference between "it worked" and a merchant
     * deciding the app is broken.
     *
     * Nothing else is retried. A 400 is a bad signature or a rejected format
     * and will fail identically forever; retrying it just makes the error
     * take six seconds to arrive.
     */
    let upload = await new File(file.uri).upload(endpoint, options);
    for (let attempt = 1; attempt <= 2 && upload.status === 429; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      upload = await new File(file.uri).upload(endpoint, options);
    }

    // `upload` resolves for ANY completed response, including a 4xx — it
    // rejects only when the file cannot be read or the request never
    // completed. The status has to be checked here or a rejected upload would
    // read as a success with no public id.
    const result = JSON.parse(upload.body || '{}') as {
      public_id?: string;
      error?: { message?: string };
    };

    if (upload.status === 429) {
      // Cloudinary says "Slow Down, Out of Processing Capacity", which reads
      // as the merchant's fault. It is not.
      throw new Error('Our image service is busy. Please try that photo again.');
    }
    if (upload.status >= 400 || !result.public_id) {
      throw new Error(result.error?.message ?? 'Upload failed');
    }
    return result.public_id;
  } catch (error) {
    if (error instanceof Error && !('isAxiosError' in error)) throw error;
    throw toApiError(error);
  }
}
