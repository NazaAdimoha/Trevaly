import Link from 'next/link';

import { cloudinaryUrl } from '@core/media/folder';

import { cn } from '@/lib/cn';

/**
 * Shop by category: a row of images with a name under each.
 *
 * The three shapes matter more than they look. `circle` is the story-rail
 * treatment a phone-first shopper already understands; `tall` suits garments;
 * `square` suits an object on white. Getting this wrong is what makes a
 * catalogue look like a spreadsheet.
 */
export function CategoryTilesSection({
  settings,
}: {
  settings: {
    eyebrow?: string | null;
    heading?: string | null;
    shape?: string | null;
    items?: { image?: string | null; label?: string | null; href?: string | null }[] | null;
  };
}) {
  const items = (settings.items ?? []).filter((item) => item.label && item.href);
  if (items.length === 0) return null;

  const shape = settings.shape ?? 'square';

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        {settings.eyebrow ? (
          <p className='st-muted mb-2 text-xs font-medium tracking-[0.18em] uppercase'>
            {settings.eyebrow}
          </p>
        ) : null}
        {settings.heading ? (
          <h2 className='st-display mb-6 text-2xl md:text-3xl'>{settings.heading}</h2>
        ) : null}

        {/* Scrolls sideways on a phone rather than stacking: a shopper should be
            able to see there is more without scrolling the whole page. */}
        <ul className='-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:overflow-visible md:px-0'>
          {items.map((item) => {
            const src = cloudinaryUrl(
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
              item.image,
              { width: 500, height: shape === 'tall' ? 700 : 500, crop: 'fill' },
            );

            return (
              <li key={`${item.href}-${item.label}`} className='w-32 shrink-0 md:w-auto'>
                <Link href={item.href ?? '/'} className='group block text-center'>
                  <span
                    className={cn(
                      'block overflow-hidden',
                      shape === 'circle' && 'aspect-square rounded-full',
                      shape === 'tall' && 'aspect-[3/4]',
                      shape === 'square' && 'aspect-square',
                    )}
                    style={{
                      background: 'var(--st-surface)',
                      borderRadius:
                        shape === 'circle' ? '9999px' : 'var(--st-radius-media)',
                    }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                      <img
                        src={src}
                        alt=''
                        loading='lazy'
                        className='size-full object-cover transition-transform duration-500 group-hover:scale-105'
                      />
                    ) : null}
                  </span>
                  <span className='st-display mt-3 block text-sm'>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
