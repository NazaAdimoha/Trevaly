import Link from 'next/link';

import { cloudinaryUrl } from '@core/media/folder';

import { cn } from '@/lib/cn';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/** One image beside a paragraph — the workhorse for telling a brand story. */
export function ImageWithTextSection({
  settings,
}: {
  settings: {
    image?: string | null;
    imageSide?: string | null;
    eyebrow?: string | null;
    heading?: string | null;
    body?: string | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
  };
}) {
  if (!settings.image && !settings.heading && !settings.body) return null;

  const src = cloudinaryUrl(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    settings.image,
    { width: 1200, height: 1200, crop: 'fill' },
  );
  const imageRight = (settings.imageSide ?? 'left') === 'right';

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container grid items-center gap-8 md:grid-cols-2 md:gap-14'>
        <div className={cn('st-media aspect-[4/5]', imageRight && 'md:order-2')}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
            <img src={src} alt='' loading='lazy' className='size-full object-cover' />
          ) : null}
        </div>

        <div>
          {settings.eyebrow ? (
            <p className='st-muted mb-3 text-xs font-medium tracking-[0.18em] uppercase'>
              {settings.eyebrow}
            </p>
          ) : null}
          {settings.heading ? (
            <h2 className='st-display text-2xl md:text-4xl'>{settings.heading}</h2>
          ) : null}
          {settings.body ? (
            <p className='st-muted mt-4 leading-relaxed whitespace-pre-line'>{settings.body}</p>
          ) : null}
          {settings.ctaLabel ? (
            <Link
              href={settings.ctaHref || STOREFRONT_ROUTES.home}
              className='st-btn st-btn-accent mt-6'
            >
              {settings.ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
