import { cn } from '@/lib/cn';

/**
 * A strip of promises that never stops moving: free delivery, returns, secure
 * checkout.
 *
 * Pure CSS. The track is rendered twice and translated by half its width, which
 * is what makes the loop seamless; the duplicate is `aria-hidden` so a screen
 * reader hears each promise once. It pauses on hover, and stops entirely for
 * anyone who asked for reduced motion.
 */
export function MarqueeSection({
  settings,
}: {
  settings: { items?: { text?: string | null }[] | null; speed?: number | null };
}) {
  const items = (settings.items ?? [])
    .map((item) => item.text?.trim())
    .filter((text): text is string => Boolean(text));

  if (items.length === 0) return null;

  // Higher setting, faster strip. Duration is the inverse, clamped so it can
  // never become a blur or appear frozen.
  const speed = Math.min(90, Math.max(10, settings.speed ?? 40));
  const duration = `${Math.round(1800 / speed)}s`;

  const track = (hidden: boolean) => (
    <ul
      className='flex shrink-0 items-center gap-10 px-5'
      aria-hidden={hidden || undefined}
    >
      {items.map((text, index) => (
        <li key={`${text}-${index}`} className='flex items-center gap-10 whitespace-nowrap'>
          <span className='st-display text-sm tracking-[0.15em] uppercase'>{text}</span>
          <span aria-hidden className='opacity-40'>
            ·
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      className={cn('st-marquee st-hairline overflow-hidden border-y py-3')}
      style={{ background: 'var(--st-surface)', ['--st-marquee-duration' as string]: duration }}
      aria-label='Store promises'
    >
      <div className='st-marquee-track flex w-max'>
        {track(false)}
        {track(true)}
      </div>
    </section>
  );
}
