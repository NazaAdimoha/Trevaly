import Link from 'next/link';

import { cloudinaryUrl } from '@core/media/folder';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * Two to four large images, each with a label that lifts on hover.
 *
 * The label is always visible on touch devices — a reveal-on-hover that a phone
 * can never trigger is a label nobody reads. Hover only changes how it sits.
 */
export function PromoTilesSection({
  settings,
}: {
  settings: {
    eyebrow?: string | null;
    heading?: string | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    tiles?: { image?: string | null; label?: string | null; href?: string | null }[] | null;
  };
}) {
  const tiles = (settings.tiles ?? []).filter((tile) => tile.label);
  if (tiles.length === 0) return null;

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        {settings.eyebrow ? (
          <p className='st-muted mb-2 text-center text-xs font-medium tracking-[0.18em] uppercase'>
            {settings.eyebrow}
          </p>
        ) : null}
        {settings.heading ? (
          <h2 className='st-display mb-8 text-center text-2xl md:text-3xl'>
            {settings.heading}
          </h2>
        ) : null}

        <ul className='grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]'>
          {tiles.map((tile) => {
            const src = cloudinaryUrl(
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
              tile.image,
              { width: 800, height: 1000, crop: 'fill' },
            );

            return (
              <li key={`${tile.href}-${tile.label}`}>
                <Link
                  href={tile.href || STOREFRONT_ROUTES.home}
                  className='group relative block overflow-hidden'
                  style={{
                    borderRadius: 'var(--st-radius-media)',
                    background: 'var(--st-surface)',
                  }}
                >
                  <span className='block aspect-[4/5]'>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                      <img
                        src={src}
                        alt=''
                        loading='lazy'
                        className='size-full object-cover transition-transform duration-700 group-hover:scale-105'
                      />
                    ) : null}
                  </span>

                  <span
                    className='st-display absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 text-sm transition-transform duration-300 group-hover:-translate-y-1'
                    style={{
                      background: 'var(--st-bg)',
                      color: 'var(--st-ink)',
                      borderRadius: 'var(--st-radius-control)',
                    }}
                  >
                    {tile.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {settings.ctaLabel ? (
          <div className='mt-8 text-center'>
            <Link
              href={settings.ctaHref || STOREFRONT_ROUTES.home}
              className='st-btn st-btn-accent'
            >
              {settings.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
