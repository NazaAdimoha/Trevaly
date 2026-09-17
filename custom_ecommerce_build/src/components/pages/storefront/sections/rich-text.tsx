import { cn } from '@/lib/cn';

/**
 * A heading and a paragraph, on their own.
 *
 * The optional mark — a circle or underline drawn around the heading — is the
 * one flourish here, and it is an inline SVG rather than a background image so
 * it takes the store's own ink colour and scales with the type. Both reference
 * themes use exactly this device to make a plain section feel authored.
 */
export function RichTextSection({
  settings,
}: {
  settings: {
    eyebrow?: string | null;
    heading?: string | null;
    body?: string | null;
    align?: string | null;
    annotation?: string | null;
  };
}) {
  const { eyebrow, heading, body } = settings;
  if (!eyebrow && !heading && !body) return null;

  const align = settings.align ?? 'left';
  const annotation = settings.annotation ?? 'none';

  return (
    <section
      className={cn(
        'st-container st-reveal',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
      )}
      style={{ paddingBlock: 'var(--st-section-y)' }}
    >
      <div
        className={cn(
          'max-w-2xl',
          align === 'center' && 'mx-auto',
          align === 'right' && 'ml-auto',
        )}
      >
        {eyebrow ? (
          <p className='st-muted mb-3 text-xs font-medium tracking-[0.18em] uppercase'>
            {eyebrow}
          </p>
        ) : null}

        {heading ? (
          <h2 className='st-display relative inline-block text-3xl md:text-4xl'>
            {heading}
            {annotation !== 'none' ? <Mark kind={annotation} /> : null}
          </h2>
        ) : null}

        {body ? (
          <p className='st-muted mt-4 text-base leading-relaxed whitespace-pre-line'>
            {body}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The hand-drawn mark. `pathLength="1"` normalises the dash maths, so one
 * animation works for both shapes regardless of how long the path actually is.
 */
function Mark({ kind }: { kind: string }) {
  return (
    <svg
      aria-hidden
      viewBox='0 0 200 60'
      preserveAspectRatio='none'
      className='st-mark pointer-events-none absolute -inset-x-4 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+2rem)]'
    >
      {kind === 'circle' ? (
        <path
          d='M100 6 C40 6 8 18 8 30 C8 44 48 54 104 54 C158 54 192 43 192 30 C192 17 158 7 100 6'
          fill='none'
          stroke='var(--st-sale)'
          strokeWidth='1.5'
          pathLength='1'
          vectorEffect='non-scaling-stroke'
        />
      ) : (
        <path
          d='M6 50 C60 42 140 42 194 50'
          fill='none'
          stroke='var(--st-sale)'
          strokeWidth='2'
          pathLength='1'
          vectorEffect='non-scaling-stroke'
        />
      )}
    </svg>
  );
}
