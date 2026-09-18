'use client';

import { useEffect, useRef, useState } from 'react';

import { formatCurrency } from '@core/money';

/**
 * The confirmation mark.
 *
 * An SVG whose ring and tick draw themselves rather than a static icon, because
 * this is the one place in a storefront where a shopper has done something
 * irreversible with their money and deserves to be told so unambiguously. The
 * drawing reads as "this just happened"; an icon reads as "this was always
 * here".
 *
 * Colour comes from `--st-success`, a real token, so a shop whose accent is red
 * does not render its one good moment in its danger colour.
 */
export function SuccessMark() {
  return (
    <div className='relative mx-auto flex size-28 items-center justify-center'>
      {/* One ripple out of the mark — not a pulse loop, which would read as
          "still working" on a page whose entire point is that it is finished. */}
      <span
        aria-hidden
        className='st-halo absolute inset-0 rounded-full'
        style={{ background: 'var(--st-success-wash)' }}
      />
      <svg
        viewBox='0 0 100 100'
        className='st-mark relative size-full'
        role='img'
        aria-label='Payment successful'
      >
        <circle
          cx='50'
          cy='50'
          r='46'
          fill='none'
          stroke='var(--st-success)'
          strokeWidth='3'
          strokeLinecap='round'
          className='st-mark-ring'
          // Starts the stroke at twelve o'clock and travels clockwise, which is
          // the direction a progress ring is read in.
          transform='rotate(-90 50 50)'
        />
        <path
          d='M31 51.5 L44 64 L69 38'
          fill='none'
          stroke='var(--st-success)'
          strokeWidth='5'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='st-mark-tick'
        />
      </svg>
    </div>
  );
}

/**
 * Fixed, not random.
 *
 * Randomising the burst would make the server's markup differ from the client's
 * and hand React a hydration mismatch on the page a shopper sees straight after
 * paying — the worst possible page to flicker. Hand-placed values also spread
 * more evenly than `Math.random()` actually does over eighteen pieces.
 *
 * `[x drift, y fall, rotation, size, delay, duration]`.
 */
const PIECES: [number, number, number, number, number, number][] = [
  [-300, 300, 420, 8, 0, 1900], [-235, 360, -300, 6, 90, 2100],
  [-175, 260, 520, 10, 40, 1750], [-120, 340, -420, 7, 160, 2000],
  [-68, 280, 360, 9, 70, 1850], [-24, 370, -520, 6, 210, 2150],
  [24, 300, 460, 8, 30, 1800], [68, 350, -360, 10, 130, 2050],
  [120, 270, 540, 7, 190, 1900], [175, 360, -440, 9, 60, 2100],
  [235, 290, 380, 6, 150, 1800], [300, 340, -500, 8, 100, 2000],
  [-262, 210, 300, 7, 230, 1700], [262, 220, -340, 7, 20, 1750],
  [-150, 400, 480, 5, 260, 2200], [150, 410, -460, 5, 180, 2200],
  [-44, 220, 320, 11, 120, 1650], [44, 230, -380, 11, 250, 1700],
];

/**
 * A two-second burst, then nothing.
 *
 * Eighteen spans, `aria-hidden`, `pointer-events-none`, each animating only
 * transform and opacity — no canvas, no library, and no layout cost. It is
 * mounted after paint so it never delays the thing it is celebrating, and it
 * unmounts itself afterwards rather than leaving eighteen finished animations
 * parked on the page.
 *
 * Nothing here is behind a `prefers-reduced-motion` check in JavaScript: the
 * keyframes themselves live inside that media query, so for a viewer who asked
 * for less motion these spans render at their start position and stay
 * invisible.
 */
export function Confetti() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden
      // Zero-height and `overflow-visible`: the pieces have to escape this box
      // to fall at all, while the box itself takes no space in the layout. The
      // page wrapper is what actually clips them, so nothing can widen the
      // document and produce a horizontal scrollbar.
      className='st-confetti pointer-events-none absolute inset-x-0 top-16 z-0 flex justify-center'
      style={{ height: 0 }}
    >
      {PIECES.map(([x, y, rotation, size, delay, duration], index) => (
        <span
          key={index}
          className='absolute block'
          style={
            {
              '--st-cx': `${x}px`,
              '--st-cy': `${y}px`,
              '--st-cr': `${rotation}deg`,
              '--st-cdelay': `${delay}ms`,
              '--st-cd': `${duration}ms`,
              width: `${size}px`,
              height: `${size * 1.6}px`,
              // The store's own three colours, so the celebration belongs to
              // this shop rather than arriving from a party-supplies library.
              background: [
                'var(--st-accent)',
                'var(--st-success)',
                'var(--st-ink)',
              ][index % 3],
              borderRadius: index % 4 === 0 ? '999px' : '2px',
              opacity: 0,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * The total, counting up to itself.
 *
 * Small, and the reason it is worth any JavaScript at all: it puts the eye on
 * the number the shopper most wants confirmed, and it lands at the real figure
 * rather than merely being decorative motion.
 *
 * Reduced motion is checked here rather than in CSS because the animation is
 * the value itself — there are no keyframes to leave out. Those viewers get the
 * final number on the first frame, which is the correct finished state.
 */
export function CountUpAmount({ kobo }: { kobo: number }) {
  // Starts at the real figure, which is also what the server renders and what a
  // viewer with JavaScript off keeps. The count-up then runs down from it and
  // back, rather than the page ever server-rendering a zero — a confirmation
  // that says ₦0.00 in the HTML is the one failure mode worth designing out.
  const [shown, setShown] = useState(kobo);
  const frame = useRef(0);

  useEffect(() => {
    // No synchronous setState here, in either branch. The reduced-motion case
    // needs none — the state already holds the final figure — and the animated
    // case is driven entirely from inside the rAF callback, which is the
    // external system this effect exists to subscribe to.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const DURATION = 850;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      // Ease-out cubic: fast at first, settling onto the figure rather than
      // stopping dead on it.
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(kobo * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [kobo]);

  return <span className='tabular-nums'>{formatCurrency(shown)}</span>;
}
