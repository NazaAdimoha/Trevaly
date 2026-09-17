import { cloudinaryUrl } from '@core/media/folder';

import { cn } from '@/lib/cn';

/**
 * Product imagery, delivered through Cloudinary.
 *
 * Builds the delivery URL with `cloudinaryUrl` from the shared core rather than
 * `next-cloudinary`'s `CldImage`. That is a deliberate swap, made after
 * measuring: `CldImage` drags `@cloudinary-util/url-loader`, which bundles its
 * own copy of Zod — **42KB gzipped on every storefront page**, to build a URL
 * we already know how to build, for a store whose shoppers are on Nigerian
 * mobile data. The transformations it applied (`f_auto`, `q_auto`, an automatic
 * crop) are the same ones our helper emits.
 *
 * It is also no longer a Client Component: nothing here is interactive, so the
 * catalogue now ships no JavaScript for its images at all.
 *
 * `srcSet` covers the widths a card is actually rendered at, so a phone fetches
 * a phone-sized image. `sizes` must track the grid's column counts or the
 * browser picks from the wrong end of that list.
 */
const WIDTHS = [320, 480, 640, 960, 1280, 1600];

export function ProductImage({
  src,
  alt,
  className,
  sizes = '(max-width: 768px) 50vw, 25vw',
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const url = (width: number) =>
    cloudinaryUrl(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, src, {
      width,
      crop: 'fill',
    });

  const fallback = url(960);
  if (!fallback) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary is the optimiser here; next/image would re-process an already-optimised asset and add a second hop
    <img
      src={fallback}
      srcSet={WIDTHS.map((width) => `${url(width)} ${width}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      // The hero-adjacent first card should not wait its turn; everything else
      // loads when it is close to the viewport.
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding='async'
      className={cn('absolute inset-0 size-full', className)}
    />
  );
}
