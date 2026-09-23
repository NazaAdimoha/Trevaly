import Link from 'next/link';

import {
  cloudinaryUrl,
  cloudinaryVideoPoster,
  cloudinaryVideoUrl,
} from '@core/media/folder';

import { cn } from '@/lib/cn';

import type { StorefrontProductCard } from '@/components/pages/storefront/home';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { HeroHotspots } from './hero-hotspots';

const HEIGHTS: Record<string, string> = {
  medium: 'min-h-[42vh] md:min-h-[52vh]',
  large: 'min-h-[62vh] md:min-h-[76vh]',
  full: 'min-h-[88vh]',
};

/**
 * The hero: one image or video, a headline, and a way in.
 *
 * A Server Component. The media and the copy are what a search engine reads and
 * what a shopper waits for, so neither may depend on JavaScript — only the
 * hotspots, which are an enhancement, are client-side.
 *
 * `fetchPriority="high"` and no lazy loading on the image: this is the largest
 * element on the page and usually the LCP, so making the browser discover it
 * late is the most expensive mistake available here.
 */
export function HeroSection({
  settings,
  products,
}: {
  settings: {
    image?: string | null;
    video?: string | null;
    eyebrow?: string | null;
    heading?: string | null;
    body?: string | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    secondaryLabel?: string | null;
    secondaryHref?: string | null;
    align?: string | null;
    height?: string | null;
    overlay?: number | null;
    hotspots?: { x?: number | null; y?: number | null; product?: string | null }[] | null;
    addAllLabel?: string | null;
  };
  products: StorefrontProductCard[];
}) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const image = cloudinaryUrl(cloud, settings.image, { width: 2000 });
  const video = cloudinaryVideoUrl(cloud, settings.video, { width: 1600 });
  // The merchant's own image wins as the poster. A frame pulled from the video
  // is only used when they gave no image, because it is derived from the same
  // id as the video — so whenever the video is wrong, the poster is wrong in
  // exactly the same way and cannot rescue it.
  const poster =
    image ?? cloudinaryVideoPoster(cloud, settings.video, { width: 1600 }) ?? undefined;

  const align = settings.align ?? 'left';
  const overlay = Math.min(80, Math.max(0, settings.overlay ?? 30));
  const hasMedia = Boolean(image || video);

  const hotspots = (settings.hotspots ?? [])
    .map((spot) => ({
      x: spot.x ?? 50,
      y: spot.y ?? 50,
      product: products.find((product) => product.id === spot.product),
    }))
    // A hotspot whose product was deleted is dropped, not rendered as a dot
    // that goes nowhere.
    .filter((spot): spot is { x: number; y: number; product: StorefrontProductCard } =>
      Boolean(spot.product),
    );

  return (
    <section
      className={cn(
        'relative isolate flex items-end overflow-hidden',
        HEIGHTS[settings.height ?? 'large'] ?? HEIGHTS.large,
      )}
      style={{ background: 'var(--st-surface)' }}
    >
      {/* The image is LAYERED UNDER the video, not swapped for it.
          This used to be either/or, and the failure was ugly: a hero with both
          set rendered only the <video>, so anything that stopped it playing —
          a 404, a codec the browser will not decode, a phone refusing autoplay
          on a data saver — left the section as a flat dark rectangle with the
          merchant's perfectly good photograph never requested. On a full-height
          hero that is a black screen.

          Underneath, the image costs nothing it was not already costing: it is
          the poster too. Now the video is genuinely decorative, and every way
          it can fail degrades to the picture. */}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary already serves this at the right width, format and quality
        <img
          src={image}
          alt=''
          className='absolute inset-0 -z-20 size-full object-cover'
          fetchPriority='high'
          decoding='async'
        />
      ) : null}

      {video ? (
        <video
          className='absolute inset-0 -z-10 size-full object-cover'
          autoPlay
          muted
          loop
          playsInline
          poster={poster}
          // Muted, looping decoration: never fetched until the poster is up.
          preload='none'
        >
          <source src={video} />
        </video>
      ) : null}

      {hasMedia && overlay > 0 ? (
        <div
          aria-hidden
          className='absolute inset-0 -z-10'
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,${overlay / 100 + 0.15}), rgba(0,0,0,${overlay / 200}) 60%)`,
          }}
        />
      ) : null}

      <div
        className={cn(
          'st-container relative w-full py-14 md:py-20',
          align === 'center' && 'text-center',
          align === 'right' && 'text-right',
        )}
        // Over photography the copy is always light; with no media it takes the
        // store's own ink, so an image-less hero is still readable.
        style={{ color: hasMedia ? '#FFFFFF' : 'var(--st-ink)' }}
      >
        <div
          className={cn(
            'max-w-xl',
            align === 'center' && 'mx-auto',
            align === 'right' && 'ml-auto',
          )}
        >
          {settings.eyebrow ? (
            <p className='mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-90'>
              {settings.eyebrow}
            </p>
          ) : null}

          {settings.heading ? (
            <h1 className='st-display st-enter text-4xl md:text-6xl'>{settings.heading}</h1>
          ) : null}

          {settings.body ? (
            <p
              className='st-enter mt-4 text-base opacity-90 md:text-lg'
              style={{ '--st-index': 1 } as never}
            >
              {settings.body}
            </p>
          ) : null}

          {settings.ctaLabel || settings.secondaryLabel ? (
            <div
              className={cn(
                'st-enter mt-8 flex flex-wrap gap-3',
                align === 'center' && 'justify-center',
                align === 'right' && 'justify-end',
              )}
              style={{ '--st-index': 2 } as never}
            >
              {settings.ctaLabel ? (
                <Link
                  href={settings.ctaHref || STOREFRONT_ROUTES.home}
                  className='st-btn st-btn-accent'
                >
                  {settings.ctaLabel}
                </Link>
              ) : null}
              {settings.secondaryLabel ? (
                <Link
                  href={settings.secondaryHref || STOREFRONT_ROUTES.home}
                  className='st-btn'
                  style={{
                    border: '1px solid currentColor',
                    color: hasMedia ? '#FFFFFF' : 'var(--st-ink)',
                  }}
                >
                  {settings.secondaryLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {hotspots.length > 0 ? (
        <HeroHotspots hotspots={hotspots} addAllLabel={settings.addAllLabel ?? null} />
      ) : null}
    </section>
  );
}
