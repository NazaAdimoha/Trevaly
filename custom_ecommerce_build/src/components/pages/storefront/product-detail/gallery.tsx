'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

import { ProductImage } from '@/components/ui/product-image';

/**
 * The product gallery: one large image, thumbnails beside it.
 *
 * The thumbnails are buttons rather than a scroll-snap strip, because a shopper
 * comparing the back of a shoe with its sole wants to go straight there and
 * back. On a phone they sit under the image; from `md` they run down the side,
 * which is where both reference themes put them and where they stop competing
 * with the buy button for vertical space.
 *
 * Only the first image is eager: it is the LCP on this page. The rest load as
 * the shopper asks for them.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  if (!current) {
    return <div className='st-media' aria-hidden />;
  }

  return (
    <div className='flex flex-col-reverse gap-3 md:flex-row'>
      {images.length > 1 ? (
        <ul className='flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-visible'>
          {images.map((image, index) => (
            <li key={image} className='shrink-0'>
              <button
                type='button'
                onClick={() => setActive(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === active}
                className={cn(
                  'st-media block size-16 md:size-20',
                  index === active ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                )}
                style={{
                  outline: index === active ? '2px solid var(--st-ink)' : undefined,
                  outlineOffset: '2px',
                }}
              >
                <ProductImage src={image} alt='' sizes='80px' />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className='st-media flex-1'>
        <ProductImage
          key={current}
          src={current}
          alt={alt}
          sizes='(max-width: 768px) 100vw, 50vw'
          priority
        />
      </div>
    </div>
  );
}
