import { cloudinaryUrl } from '@core/media/folder';

/**
 * A quote and the mastheads behind it.
 *
 * Logos are rendered at a fixed height and desaturated so a row of wildly
 * different brand colours still reads as one strip — the usual failure here is
 * six logos at six sizes shouting over each other and over the quote.
 */
export function PressSection({
  settings,
}: {
  settings: {
    eyebrow?: string | null;
    quote?: string | null;
    logos?: { image?: string | null; name?: string | null }[] | null;
  };
}) {
  const logos = (settings.logos ?? []).filter((logo) => logo.image || logo.name);
  if (!settings.quote && logos.length === 0) return null;

  return (
    <section
      className='st-reveal'
      style={{ background: 'var(--st-surface)', paddingBlock: 'var(--st-section-y)' }}
    >
      <div className='st-container text-center'>
        {settings.eyebrow ? (
          <p className='st-muted mb-4 text-xs font-medium tracking-[0.2em] uppercase'>
            {settings.eyebrow}
          </p>
        ) : null}

        {settings.quote ? (
          <blockquote className='st-display mx-auto max-w-3xl text-xl leading-snug md:text-2xl'>
            “{settings.quote}”
          </blockquote>
        ) : null}

        {logos.length > 0 ? (
          <ul className='mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6'>
            {logos.map((logo, index) => {
              const src = cloudinaryUrl(
                process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
                logo.image,
                { width: 300 },
              );
              return (
                <li key={`${logo.name}-${index}`}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                    <img
                      src={src}
                      alt={logo.name ?? ''}
                      loading='lazy'
                      className='h-6 w-auto opacity-70 grayscale transition-opacity hover:opacity-100 md:h-7'
                    />
                  ) : (
                    <span className='st-display text-lg opacity-70'>{logo.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
