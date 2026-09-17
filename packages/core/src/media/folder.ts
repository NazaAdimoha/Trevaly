/**
 * Where a store's uploads live in Cloudinary.
 *
 * Split out from `./cloudinary` deliberately: that module signs uploads and so
 * imports `crypto` and reads the API secret. The upload widget runs in the
 * browser and needs this value to send the same folder the signature covers —
 * importing the signing module to get it would drag both into the client
 * bundle.
 *
 * Keyed by slug rather than tenant id because both sides can derive it from the
 * URL without a round trip, and a store's subdomain is fixed at onboarding.
 */
export type UploadKind = "products" | "branding";

export const tenantUploadFolder = (
  storeSlug: string,
  kind: UploadKind = "products",
) => `tenants/${storeSlug}/${kind}`;

/**
 * Whether a public ID belongs to this store.
 *
 * The signature endpoint stops a store *uploading* outside its folder, but
 * nothing stops one typing another store's id straight into a product payload.
 * Images are not secret, so this is a lesser leak than the database equivalent
 * — but it is the same class of mistake, and one line to close.
 */
export function isOwnedBy(publicId: string, storeSlug: string): boolean {
  // Scoped to the store root, not one kind: a logo and a product photo are both
  // this store's, and checking only the products folder would reject a
  // perfectly valid branding asset.
  return publicId.startsWith(`tenants/${storeSlug}/`);
}

/** Every folder a store may upload into. The signature endpoint allows these. */
export function tenantUploadFolders(storeSlug: string): string[] {
  return [
    tenantUploadFolder(storeSlug, "products"),
    tenantUploadFolder(storeSlug, "branding"),
  ];
}

/**
 * A Cloudinary delivery URL for a stored public ID.
 *
 * The one place a delivery URL is built. Every surface wants a different size —
 * a 40px storefront header, a 54px avatar in the app, a 1200x630 OG image — and
 * having each construct its own transformation string is how one of them ends
 * up shipping a 4MB original to a phone.
 *
 * `f_auto,q_auto` let Cloudinary pick format and quality per request, so a
 * modern browser gets AVIF and an old Android gets JPEG from the same id.
 */
export function cloudinaryUrl(
  cloudName: string | null | undefined,
  publicId: string | null | undefined,
  options: { width?: number; height?: number; crop?: "fill" | "fit" } = {},
): string | null {
  if (!cloudName || !publicId) return null;

  const { width, height, crop = "fit" } = options;
  const transforms = ["f_auto", "q_auto"];

  if (width) transforms.unshift(`w_${width}`);
  if (height) transforms.unshift(`h_${height}`);
  if (width || height) transforms.unshift(`c_${crop}`);

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(",")}/${publicId}`;
}

/**
 * A Cloudinary delivery URL for a stored VIDEO public id.
 *
 * `f_auto` is what makes an uploaded GIF affordable: Cloudinary re-encodes it
 * to MP4 or WebM per browser, which is routinely a tenth of the bytes. A
 * merchant uploads the GIF they already have and a shopper on 3G gets video.
 */
export function cloudinaryVideoUrl(
  cloudName: string | null | undefined,
  publicId: string | null | undefined,
  options: { width?: number } = {},
): string | null {
  if (!cloudName || !publicId) return null;

  const transforms = ["f_auto", "q_auto"];
  if (options.width) transforms.unshift(`w_${options.width}`);

  return `https://res.cloudinary.com/${cloudName}/video/upload/${transforms.join(",")}/${publicId}`;
}

/** The still frame for a video, so nothing renders as a black rectangle. */
export function cloudinaryVideoPoster(
  cloudName: string | null | undefined,
  publicId: string | null | undefined,
  options: { width?: number } = {},
): string | null {
  if (!cloudName || !publicId) return null;

  const transforms = ["f_auto", "q_auto", "so_0"];
  if (options.width) transforms.unshift(`w_${options.width}`);

  return `https://res.cloudinary.com/${cloudName}/video/upload/${transforms.join(",")}/${publicId}.jpg`;
}
