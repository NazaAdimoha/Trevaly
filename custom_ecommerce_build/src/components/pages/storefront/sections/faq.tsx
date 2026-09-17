/**
 * The questions that stop someone buying.
 *
 * Built on `<details>`/`<summary>`, which means it opens, closes, is keyboard
 * operable, is announced correctly by a screen reader and is searchable by the
 * browser's own find-in-page — with zero JavaScript. An accordion is the single
 * most over-engineered component on the web; this one is free.
 */
export function FaqSection({
  settings,
}: {
  settings: {
    heading?: string | null;
    openFirst?: boolean | null;
    items?: { question?: string | null; answer?: string | null }[] | null;
  };
}) {
  const items = (settings.items ?? []).filter((item) => item.question && item.answer);
  if (items.length === 0) return null;

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container max-w-3xl'>
        {settings.heading ? (
          <h2 className='st-display mb-8 text-center text-2xl md:text-3xl'>
            {settings.heading}
          </h2>
        ) : null}

        <div className='st-hairline divide-y border-y'>
          {items.map((item, index) => (
            <details
              key={`${item.question}-${index}`}
              open={index === 0 && (settings.openFirst ?? true)}
              className='st-faq group py-4'
            >
              <summary className='flex cursor-pointer list-none items-center justify-between gap-4 text-left'>
                <span className='st-display text-base'>{item.question}</span>
                <span
                  aria-hidden
                  className='st-muted shrink-0 text-xl transition-transform duration-200 group-open:rotate-45'
                >
                  +
                </span>
              </summary>
              <p className='st-muted mt-3 text-sm leading-relaxed whitespace-pre-line'>
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
