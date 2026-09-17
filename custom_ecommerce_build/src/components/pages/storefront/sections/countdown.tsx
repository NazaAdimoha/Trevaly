'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * A deadline on an offer.
 *
 * The honest part is what happens when it ends: either the section disappears
 * or it says so. A countdown that loops back to "3 days left" every time it
 * expires is the internet's most common small lie, and a shopper who notices it
 * once stops believing the rest of the page.
 *
 * The first render is the server's, where there is no clock the browser agrees
 * with, so the digits start blank and fill in on mount — that is a deliberate
 * hydration-safe choice, not a flash.
 */
export function CountdownSection({
  settings,
}: {
  settings: {
    heading?: string | null;
    endsAt?: string | null;
    afterEnd?: string | null;
    endedMessage?: string | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
  };
}) {
  const endsAt = settings.endsAt ? new Date(settings.endsAt).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;

  const ended = remaining !== null && remaining <= 0;
  if (ended && (settings.afterEnd ?? 'hide') === 'hide') return null;

  const parts = (() => {
    const ms = remaining ?? 0;
    return [
      { label: 'Days', value: Math.floor(ms / 86_400_000) },
      { label: 'Hours', value: Math.floor(ms / 3_600_000) % 24 },
      { label: 'Minutes', value: Math.floor(ms / 60_000) % 60 },
      { label: 'Seconds', value: Math.floor(ms / 1000) % 60 },
    ];
  })();

  return (
    <section
      className='st-reveal'
      style={{ background: 'var(--st-surface)', paddingBlock: 'var(--st-section-y)' }}
    >
      <div className='st-container flex flex-wrap items-center justify-between gap-6'>
        <div>
          {settings.heading ? (
            <h2 className='st-display text-2xl md:text-3xl'>{settings.heading}</h2>
          ) : null}
          {ended && settings.endedMessage ? (
            <p className='st-muted mt-2 text-sm'>{settings.endedMessage}</p>
          ) : null}
        </div>

        {!ended ? (
          <ul className='flex items-start gap-6' aria-label='Time remaining'>
            {parts.map((part) => (
              <li key={part.label} className='text-center'>
                <span className='st-display block text-3xl tabular-nums md:text-4xl'>
                  {remaining === null ? '—' : String(part.value).padStart(2, '0')}
                </span>
                <span className='st-muted text-[11px] tracking-[0.16em] uppercase'>
                  {part.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {settings.ctaLabel && !ended ? (
          <Link
            href={settings.ctaHref || STOREFRONT_ROUTES.home}
            className='st-btn st-btn-accent'
          >
            {settings.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
