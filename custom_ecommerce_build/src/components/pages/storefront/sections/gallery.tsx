import Link from 'next/link';

import { cloudinaryUrl } from '@core/media/folder';

import type { StorefrontProductCard } from '@/components/pages/storefront/home';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * Campaign or customer photography, in a grid, each optionally tagged with the
 * product in it.
 *
 * The tag is the point. A wall of lifestyle photos is decoration; a wall where
 * the dress in the photo is one tap away is merchandising, and it is how these
 * stores actually sell on Instagram already.
 */
export function GallerySection({
  settings,
  products,
}: {
  settings: {
    heading?: string | null;
    handle?: string | null;
    columns?: number | null;
    items?: { image?: string | null; product?: string | null }[] | null;
  };
  products: StorefrontProductCard[];
}) {
  const items = (settings.items ?? []).filter((item) => item.image);
  if (items.length === 0) return null;

  const columns = Math.min(6, Math.max(2, settings.columns ?? 4));

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        {settings.heading || settings.handle ? (
          <div className='mb-6 flex flex-wrap items-baseline justify-between gap-2'>
            {settings.heading ? (
              <h2 className='st-display text-2xl md:text-3xl'>{settings.heading}</h2>
            ) : null}
            {settings.handle ? (
              <span className='st-muted text-sm'>{settings.handle}</span>
            ) : null}
          </div>
        ) : null}

        <ul
          className='grid gap-2'
          style={{ gridTemplateColumns: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))` }}
        >
          {items.map((item, index) => {
            const src = cloudinaryUrl(
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
              item.image,
              { width: 600, height: 600, crop: 'fill' },
            );
            const tagged = products.find((product) => product.id === item.product);

            const picture = (
              <span className='st-media block aspect-square'>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                  <img
                    src={src}
                    alt={tagged ? tagged.name : ''}
                    loading='lazy'
                    className='size-full object-cover transition-transform duration-500 hover:scale-105'
                  />
                ) : null}
              </span>
            );

            return (
              <li
                key={`${item.image}-${index}`}
                // The grid widens on larger screens; the inline style above only
                // sets the phone count, which is the one a shopper sees most.
                className={
                  columns >= 4
                    ? 'md:[grid-column:span_1] lg:[grid-column:span_1]'
                    : undefined
                }
              >
                {tagged ? (
                  <Link href={STOREFRONT_ROUTES.product(tagged.slug)} className='group block'>
                    {picture}
                    <span className='st-muted mt-1 block truncate text-xs'>{tagged.name}</span>
                  </Link>
                ) : (
                  picture
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
