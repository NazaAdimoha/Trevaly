import { Star } from 'lucide-react';

/**
 * What customers said, in their words.
 *
 * Scrolls sideways rather than stacking: three reviews in a column push the
 * rest of the page down for a shopper who has already decided. Stars are drawn
 * from the rating the merchant entered and carry an accessible label, so "5"
 * is heard as "5 out of 5", not as five decorative icons.
 */
export function TestimonialsSection({
  settings,
}: {
  settings: {
    eyebrow?: string | null;
    heading?: string | null;
    items?: { quote?: string | null; author?: string | null; rating?: number | null }[] | null;
  };
}) {
  const items = (settings.items ?? []).filter((item) => item.quote);
  if (items.length === 0) return null;

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        {settings.eyebrow ? (
          <p className='st-muted mb-2 text-xs font-medium tracking-[0.18em] uppercase'>
            {settings.eyebrow}
          </p>
        ) : null}
        {settings.heading ? (
          <h2 className='st-display mb-8 text-2xl md:text-3xl'>{settings.heading}</h2>
        ) : null}

        <ul className='-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0'>
          {items.map((item, index) => {
            const rating = Math.min(5, Math.max(1, Math.round(item.rating ?? 5)));
            return (
              <li
                key={`${item.author}-${index}`}
                className='w-[80%] shrink-0 snap-start p-6 md:w-auto'
                style={{
                  background: 'var(--st-surface)',
                  borderRadius: 'var(--st-radius-card)',
                }}
              >
                <div
                  className='flex gap-0.5'
                  role='img'
                  aria-label={`${rating} out of 5`}
                >
                  {Array.from({ length: rating }).map((_, star) => (
                    <Star
                      key={star}
                      aria-hidden
                      className='size-4'
                      style={{ fill: 'var(--st-accent)', color: 'var(--st-accent)' }}
                    />
                  ))}
                </div>
                <blockquote className='mt-4 text-sm leading-relaxed'>“{item.quote}”</blockquote>
                {item.author ? (
                  <p className='st-muted mt-4 text-xs tracking-wide uppercase'>{item.author}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
