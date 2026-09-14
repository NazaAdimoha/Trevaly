import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Filled tick used in every feature list across both marketing pages. */
export function Tick({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 18 18'
      fill='none'
      aria-hidden='true'
      className='mt-[3px] shrink-0'
    >
      <circle
        cx='9'
        cy='9'
        r='8.2'
        className={tone === 'dark' ? 'fill-forest-700' : 'fill-primary-50'}
      />
      <path
        d='M5.6 9.2l2.2 2.2 4.6-4.8'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={tone === 'dark' ? 'text-primary' : 'text-primary-700'}
      />
    </svg>
  );
}

export function FeatureList({
  items,
  tone = 'light',
}: {
  items: ReadonlyArray<string>;
  tone?: 'light' | 'dark';
}) {
  return (
    <ul className='flex flex-col gap-3'>
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            'flex items-start gap-3 text-base leading-relaxed',
            tone === 'dark' ? 'text-primary-50' : 'text-grey-800',
          )}
        >
          <Tick tone={tone} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small uppercase kicker above a section heading. */
export function Eyebrow({
  children,
  tone = 'light',
}: {
  children: ReactNode;
  tone?: 'light' | 'dark';
}) {
  return (
    <p
      className={cn(
        'mb-4 text-[13px] font-semibold tracking-[0.09em] uppercase',
        tone === 'dark' ? 'text-primary-400' : 'text-primary-700',
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'font-display text-[clamp(1.875rem,1.2rem+2.6vw,2.875rem)] leading-[1.07] font-bold tracking-[-0.028em] text-pretty',
        className,
      )}
    >
      {children}
    </h2>
  );
}

type ButtonTone = 'primary' | 'outline' | 'dark' | 'gold';

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: 'bg-primary text-white hover:bg-primary-600 btn-pop',
  outline: 'bg-white text-forest-900 hover:bg-paper btn-pop',
  dark: 'bg-forest-900 text-white hover:bg-forest-800 btn-pop',
  gold: 'bg-gold text-forest-900 hover:brightness-105 btn-pop btn-pop-gold',
};

/**
 * Marketing CTA — a pill with a side.
 *
 * The hard, unblurred offset shadow plus the press travel in `.btn-pop` is what
 * makes this read as a physical object rather than a coloured rectangle. It is
 * the one place on the page that borrows the toy-like weight of a real button,
 * and it earns that because a CTA is the only thing here anyone is meant to
 * push.
 *
 * `rounded-full`, not a small radius: at 54px tall a pill and a 6px-cornered
 * rectangle are two entirely different centuries.
 *
 * Deliberately not the dashboard `Button`, which tops out at 48px and carries
 * admin-form variants with no meaning here.
 */
export function Cta({
  href,
  tone = 'primary',
  children,
  className,
}: {
  href: string;
  tone?: ButtonTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-[54px] items-center justify-center gap-2.5 rounded-full px-8',
        'text-[17px] font-semibold tracking-[-0.01em] whitespace-nowrap',
        BUTTON_TONES[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A card that hovers over the page.
 *
 * Large radius and a wide, low-opacity shadow tinted with the forest ink. The
 * border is nearly invisible and exists only to hold the edge on a white
 * surface where the shadow alone leaves it undefined.
 */
export function FloatCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card-lg border-paper-line/70 bg-white p-7 shadow-float border',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * An icon in a tinted disc.
 *
 * Fixed 44px whatever the glyph, so a column of these aligns on one optical
 * axis and the text beside them starts flush. The tint carries the meaning;
 * the icon carries the specificity.
 */
export function IconBadge({
  children,
  tone = 'primary',
}: {
  children: ReactNode;
  tone?: 'primary' | 'gold' | 'dark';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    gold: 'bg-gold-50 text-gold-deep',
    dark: 'bg-forest-800 text-primary-200',
  } as const;

  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-2xl',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * An endless horizontal strip.
 *
 * Children are rendered TWICE — the track travels exactly -50%, so the second
 * copy arrives where the first started and there is no seam. Rendering once
 * would snap back visibly at the loop point.
 *
 * The duplicate is `aria-hidden`, so a screen reader hears the list once.
 */
export function Marquee({
  children,
  durationSeconds = 40,
  className,
}: {
  children: ReactNode;
  durationSeconds?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('marquee group relative overflow-hidden', className)}
      style={{ '--marquee-duration': `${durationSeconds}s` } as CSSProperties}
    >
      <div className='marquee-track flex w-max items-stretch'>
        <div className='flex shrink-0 items-stretch'>{children}</div>
        <div aria-hidden='true' className='flex shrink-0 items-stretch'>
          {children}
        </div>
      </div>

      {/* The strip must not appear to stop at a hard edge — it fades into the
          page on both sides so the loop reads as continuous motion rather than
          content being clipped. */}
      <div className='pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent' />
      <div className='pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent' />
    </div>
  );
}

export function ArrowRight() {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='none'
      aria-hidden='true'
    >
      <path
        d='M3 8h10M9 4l4 4-4 4'
        className='stroke-primary'
        strokeWidth='1.7'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

/* ── Khaime-pattern building blocks ────────────────────────────────────────
   Three primitives that do the work words were doing before: a pill kicker, a
   saturated illustration panel, and a dimensional icon. */

/**
 * The small capsule above a heading.
 *
 * A bordered pill rather than bare uppercase text: it reads as a tag on the
 * section, sits clear of the headline without needing a margin to separate
 * them, and survives being centred over a saturated panel where loose small
 * text would disappear.
 */
export function PillEyebrow({
  children,
  tone = 'light',
}: {
  children: ReactNode;
  tone?: 'light' | 'dark';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-4 py-1.5',
        'text-[11px] font-bold tracking-[0.1em] uppercase',
        tone === 'dark'
          ? 'bg-white/15 text-white'
          : 'border-paper-line/80 text-grey-700 border bg-white/70',
      )}
    >
      {children}
    </span>
  );
}

const PANEL_TONES = {
  forest: 'bg-forest-900 text-white',
  green: 'bg-primary-700 text-white',
  gold: 'bg-gold-deep text-white',
  ink: 'bg-[#16232C] text-white',
} as const;

/**
 * A saturated illustration panel.
 *
 * The colour is the point: a page of white cards asks the reader to work out
 * where one idea ends and the next begins, whereas a block of strong colour
 * settles it before they read a word. The contour texture stops that block
 * reading as a flat fill, and the large radius keeps it an object on the page
 * rather than a band across it.
 *
 * `mirrored` flips the contour sweep — two of these side by side with the same
 * sweep read as a repeated tile instead of a pair.
 */
export function ColorPanel({
  tone,
  mirrored = false,
  className,
  children,
}: {
  tone: keyof typeof PANEL_TONES;
  mirrored?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-card-xl relative overflow-hidden p-8 md:p-10',
        PANEL_TONES[tone],
        mirrored ? 'contour-right' : 'contour',
        className,
      )}
    >
      {children}
    </div>
  );
}

const ICON_3D_TONES = {
  green: 'from-primary-400 to-primary-700 [--icon-3d-shadow:rgb(51_127_83/0.5)]',
  gold: 'from-gold to-gold-deep [--icon-3d-shadow:rgb(154_107_0/0.45)]',
  forest: 'from-forest-600 to-forest-900 [--icon-3d-shadow:rgb(15_37_24/0.5)]',
  white: 'from-white to-[#E8E6DF] [--icon-3d-shadow:rgb(15_37_24/0.3)]',
} as const;

/**
 * A dimensional icon tile.
 *
 * Deliberately CSS rather than rendered 3D artwork: it recolours from a token,
 * stays sharp at any density, and adds nothing to download weight. It will not
 * pass for a ray-traced render — that needs an artist or an icon pack — but it
 * reads as a solid, lit object, which is the job.
 *
 * `relative` is required, not optional: the gloss is an absolutely-positioned
 * pseudo-element and collapses onto the page without it.
 */
export function Icon3D({
  tone = 'green',
  size = 'md',
  children,
}: {
  tone?: keyof typeof ICON_3D_TONES;
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'icon-3d relative inline-flex shrink-0 items-center justify-center',
        'bg-gradient-to-br',
        size === 'lg' ? 'size-16 rounded-[20px]' : 'size-12 rounded-[15px]',
        tone === 'white' ? 'text-forest-900' : 'text-white',
        ICON_3D_TONES[tone],
      )}
    >
      {/* Above the gloss layer, or the glyph sits under the highlight. */}
      <span className='relative z-10 flex items-center justify-center'>
        {children}
      </span>
    </span>
  );
}

/**
 * A tilted notification card dropped over an illustration.
 *
 * Everything in one of these must be something the product genuinely does —
 * this is the format most likely to drift into showing a feature that does not
 * exist, because it looks like a screenshot without being one.
 */
export function FloatChip({
  className,
  tilt = -2,
  children,
}: {
  className?: string;
  tilt?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{ rotate: `${tilt}deg` }}
      className={cn(
        'float-chip rounded-2xl bg-white px-4 py-2.5 text-left',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The ten rendered icons in `public/3d`.
 *
 * A union rather than a loose string: a missing PNG renders as a broken image
 * with no error anywhere, and on a marketing page that is the kind of fault
 * that survives to production. A typo here fails the build instead.
 *
 * Adding one means downloading it from the same set — see `public/3d/README.md`.
 * Never mix in an icon from a different pack; two 3D styles on one page reads
 * as a mistake rather than a choice.
 */
export type Icon3DName =
  | 'bag'
  | 'chart'
  | 'computer'
  | 'file-text'
  | 'gift'
  | 'location'
  | 'mobile'
  | 'money-bag'
  | 'rocket'
  | 'wallet';

/**
 * A rendered 3D icon.
 *
 * These are real Blender renders (CC0, see `public/3d/README.md`), not the CSS
 * `Icon3D` squircle — use this one wherever the icon is large enough for the
 * modelling to read, and the CSS one where it is small or needs to take a brand
 * colour the renders do not come in.
 *
 * Decorative by definition: every one of these sits beside a heading that
 * already says what it means, so an alt text would only make a screen reader
 * announce the same thing twice.
 *
 * Source is 400x400; `next/image` serves a correctly-sized WebP or AVIF, so
 * asking for 64px here does not ship a 400px file.
 */
export function Icon3DAsset({
  name,
  size = 64,
  grounded = false,
  className,
}: {
  name: Icon3DName;
  size?: number;
  /** Adds a soft contact shadow so the object sits on the surface rather than
   *  floating above it. Wrong on a dark panel, where it reads as grime. */
  grounded?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden='true'
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {grounded ? (
        <span
          className='absolute inset-x-[18%] bottom-[4%] h-[10%] rounded-[50%] bg-forest-900/25 blur-md'
        />
      ) : null}
      <Image
        src={`/3d/${name}.png`}
        alt=''
        width={size}
        height={size}
        // Never the LCP element — these sit beside headings, and marking them
        // priority would push the real hero content down the queue.
        className='relative h-full w-full object-contain'
      />
    </span>
  );
}
