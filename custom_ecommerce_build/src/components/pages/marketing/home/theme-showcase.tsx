import {
  STOREFRONT_THEME_OPTIONS,
  STOREFRONT_THEMES,
} from '@/constant/storefront-themes';
import type { StorefrontTheme } from '@core/enums';

import { Eyebrow, SectionHeading } from '../shared';

/**
 * "You get to choose how it looks" — with the looks actually shown.
 *
 * Every preview is drawn from `STOREFRONT_THEMES` itself: the same aspect
 * ratio, column count, gap, radius, casing and price weight the real storefront
 * uses. Nothing here is a picture of a design, so nothing here can go stale
 * when a theme is adjusted, and a fourth theme appears without touching this
 * file.
 *
 * The one thing the previews deliberately do NOT reproduce is the typeface.
 * Each storefront theme has its own face, and pulling three extra families onto
 * the marketing page — the page whose Core Web Vitals matter most — to render
 * six words of preview text is a bad trade. The face is named in the card
 * instead.
 */

const TYPE_NOTE: Record<StorefrontTheme, string> = {
  CLASSIC: 'Clean grotesque',
  EDITORIAL: 'Serif, tracked capitals',
  UTILITY: 'Compact grotesque',
};

/** Placeholder wares, tinted per theme so a preview reads as a shop. */
const SWATCHES: Record<StorefrontTheme, string[]> = {
  CLASSIC: [
    'linear-gradient(150deg, #E9E2D8 0%, #DCD3C6 100%)',
    'linear-gradient(150deg, #DEE6E0 0%, #CDD9D1 100%)',
    'linear-gradient(150deg, #E7DFE7 0%, #D8CBD8 100%)',
    'linear-gradient(150deg, #E6E3DA 0%, #D5D1C4 100%)',
  ],
  EDITORIAL: [
    'linear-gradient(160deg, #EFE9E1 0%, #DFD4C6 100%)',
    'linear-gradient(160deg, #E8E2E4 0%, #D6C9CD 100%)',
    'linear-gradient(160deg, #E4E5DE 0%, #D0D2C7 100%)',
    'linear-gradient(160deg, #EDE6DC 0%, #DBCFC0 100%)',
  ],
  UTILITY: [
    'linear-gradient(150deg, #EEF1F4 0%, #DFE4EA 100%)',
    'linear-gradient(150deg, #F0F0EE 0%, #E2E2DE 100%)',
    'linear-gradient(150deg, #EDF1F1 0%, #DDE4E4 100%)',
    'linear-gradient(150deg, #F1EFEC 0%, #E3DFD9 100%)',
  ],
};

const SAMPLE: Record<
  StorefrontTheme,
  Array<{ name: string; price: string }>
> = {
  CLASSIC: [
    { name: 'Woven basket', price: '₦14,000' },
    { name: 'Ceramic mug', price: '₦6,500' },
    { name: 'Cotton throw', price: '₦22,000' },
    { name: 'Table lamp', price: '₦31,000' },
  ],
  EDITORIAL: [
    { name: 'Ankara wrap dress', price: '₦24,500' },
    { name: 'Raffia tote', price: '₦18,000' },
    { name: 'Beaded slides', price: '₦12,000' },
    { name: 'Silk headwrap', price: '₦8,500' },
  ],
  UTILITY: [
    { name: 'Wireless earbuds', price: '₦32,000' },
    { name: 'Fast charger 65W', price: '₦18,500' },
    { name: 'Bluetooth speaker', price: '₦27,000' },
    { name: 'Power bank 20Ah', price: '₦21,000' },
  ],
};

export default function ThemeShowcase() {
  return (
    <section id='looks' className='pb-16 md:pb-24'>
      <div className='mx-auto max-w-[1240px] px-4 md:px-6'>
        <Eyebrow>You choose how it looks</Eyebrow>
        <SectionHeading className='reveal'>
          Three looks. Pick the one your products need.
        </SectionHeading>
        <p className='text-grey-700 mt-4 max-w-[680px] text-lg leading-relaxed text-pretty md:text-[19px]'>
          Not a template you are stuck with. Tell us which suits your catalogue
          and we set it up — and if you change your mind later, switching is a
          setting, not a rebuild.
        </p>

        <div className='mt-10 grid gap-6 md:mt-12 lg:grid-cols-3'>
          {STOREFRONT_THEME_OPTIONS.map((option) => (
            <ThemeCard key={option.value} theme={option.value} />
          ))}
        </div>

        <p className='text-grey-700 mt-8 text-base'>
          Not sure which? Send your product photos and we will tell you which
          one flatters them — that is what the choice is actually about, not the
          logo.
        </p>
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: StorefrontTheme }) {
  const config = STOREFRONT_THEMES[theme];
  const { vars } = config;
  const columns = Number(vars['--st-cols-md'] ?? 3);
  const items = SAMPLE[theme].slice(0, columns === 2 ? 2 : 4);

  return (
    <article className='border-paper-line rounded-card hover-lift reveal flex flex-col overflow-hidden border bg-white'>
      {/* The preview. Real tokens, real proportions. */}
      <div
        className='border-paper-line border-b p-4'
        style={{
          background:
            vars['--st-image-bg'] === '#FFFFFF' ? '#FAFAFA' : '#FFFFFF',
        }}
        aria-hidden='true'
      >
        <div
          className='overflow-hidden bg-white shadow-sm'
          style={{ borderRadius: vars['--st-radius'] || '0px' }}
        >
          {/* Mini storefront header — centred wordmark on Editorial, as it is
              on the real thing. */}
          <div
            className='flex items-center border-b border-gray-100 px-3'
            style={{ paddingBlock: '0.5rem' }}
          >
            <span
              className={`flex-1 text-[9px] font-semibold text-gray-800 ${
                config.headerAlign === 'center' ? 'text-center' : ''
              }`}
              style={{
                textTransform: vars['--st-name-transform'] as 'none',
                letterSpacing: vars['--st-name-tracking'],
              }}
            >
              Your store
            </span>
            <span className='size-2 shrink-0 rounded-full bg-gray-300' />
          </div>
          {config.brandRule ? (
            <div className='bg-primary h-[2px] w-full' />
          ) : null}

          <div
            className='grid p-3'
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: `calc(${vars['--st-grid-gap']} / 2.4)`,
            }}
          >
            {items.map((item, index) => (
              <div
                key={item.name}
                style={{
                  padding: vars['--st-card-pad'],
                  border: `${vars['--st-card-border']} solid ${vars['--st-card-border-color']}`,
                  borderRadius: vars['--st-radius'],
                  background: vars['--st-card-bg'],
                }}
              >
                <div
                  style={{
                    aspectRatio: vars['--st-product-aspect'],
                    borderRadius: vars['--st-radius'],
                    background: SWATCHES[theme][index],
                  }}
                />
                <p
                  className='truncate text-gray-800'
                  style={{
                    marginTop: `calc(${vars['--st-name-gap']} / 2)`,
                    fontSize: '8px',
                    fontWeight: Number(vars['--st-name-weight']),
                    textTransform: vars['--st-name-transform'] as 'none',
                    letterSpacing: vars['--st-name-tracking'],
                  }}
                >
                  {item.name}
                </p>
                <p
                  style={{
                    fontSize: '8px',
                    fontWeight: Number(vars['--st-price-weight']),
                    color: vars['--st-price-color'],
                  }}
                >
                  {item.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='flex flex-1 flex-col p-6'>
        <h3 className='font-display text-forest-900 text-[22px] leading-tight font-bold tracking-[-0.02em]'>
          {config.label}
        </h3>
        <p className='text-grey-700 mt-2 text-[15.5px] leading-relaxed'>
          {config.description}
        </p>
        <div className='grow' />
        <dl className='mt-5 flex flex-col gap-1.5 text-[13.5px]'>
          <div className='flex gap-2'>
            <dt className='text-grey-500 w-[74px] shrink-0'>Best for</dt>
            <dd className='text-forest-900'>{config.suitedTo}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='text-grey-500 w-[74px] shrink-0'>Type</dt>
            <dd className='text-forest-900'>{TYPE_NOTE[theme]}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='text-grey-500 w-[74px] shrink-0'>Photos</dt>
            <dd className='text-forest-900'>
              {vars['--st-product-aspect'] === '3 / 4' ? 'Tall' : 'Square'}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
