'use client';

import { CldImage } from 'next-cloudinary';

/**
 * Product imagery, delivered through Cloudinary.
 *
 * `CldImage` applies `f_auto`/`q_auto` to every delivery URL, so a tenant who
 * uploads a 4MB phone photo still serves an appropriately sized AVIF/WebP.
 * That matters more here than on most sites: storefronts carry a Lighthouse
 * ≥ 90 mobile target (M5) and product grids are almost entirely images.
 *
 * `src` is whatever `Product.imageUrls` holds. Cloudinary accepts either a bare
 * public ID or a full `res.cloudinary.com` URL, so this keeps working whichever
 * of the two M8's upload flow settles on writing.
 */
export function ProductImage({
  src,
  alt,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <CldImage
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      // Crop rather than letterbox: a grid of mixed aspect ratios reads as
      // broken, and `auto` keeps the subject rather than the centre pixels.
      crop={{ type: 'auto', source: true }}
    />
  );
}
