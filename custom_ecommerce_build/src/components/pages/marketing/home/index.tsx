import JsonLd from '@/components/JsonLd';
import MarketingShell from '@/components/Layouts/Marketing';

import { BRAND, FAQ } from '@/constant/marketing';
import ROUTES from '@/constant/routes';

import {
  CapabilityStrip,
  ClosingSection,
  DemoSection,
  FaqSection,
  MoneyFlowSection,
  PainSection,
  ValueSection,
} from './sections';
import StorefrontPreview from './storefront-preview';
import ThemeShowcase from './theme-showcase';
import { ArrowRight, Cta } from '../shared';

/**
 * Marketing home — root domain only (see `src/proxy.ts`).
 *
 * Structure follows the design brief's copy spine: name the seller's daily
 * pain, answer the money question with a diagram, then show the two surfaces
 * they get. The features come second in every section, deliberately — a seller
 * running their business out of Instagram DMs does not feel the absence of a
 * website, they feel the screenshot-checking.
 */
export default function MarketingHomeView({ demoUrl }: { demoUrl: string }) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };

  return (
    <MarketingShell>
      <JsonLd data={faqSchema} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* The glow is on the section, so the light falls behind the content in
          normal flow — no absolutely-positioned layers to mis-stack or overflow
          on a narrow screen. */}
      <section className='hero-glow px-4 pt-12 pb-16 md:px-6 md:pt-24 md:pb-28'>
        <div className='mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1fr_380px] lg:gap-[72px]'>
          <div>
            <p className='animate-rise border-paper-line/80 shadow-float-sm mb-7 inline-flex h-[34px] items-center gap-2 rounded-full border bg-white/80 px-4 text-[13px] font-semibold text-forest-900 backdrop-blur-sm'>
              <span className='bg-primary animate-soft-pulse inline-block size-1.5 rounded-full' />
              Built for Nigerian sellers · Naira only
            </p>

            {/* Bigger, and set looser than a headline usually is. Bricolage has
                tall ascenders and a wide eye; packed to 1.03 the lines lock
                together into a block. The extra air is what lets a 68px
                headline still read as three separate sentences. */}
            <h1 className='font-display animate-rise text-forest-900 text-[clamp(2.6rem,1.3rem+4.6vw,4.75rem)] leading-[1.08] font-bold tracking-[-0.035em] text-balance [animation-delay:60ms]'>
              Take the order. Get paid.{' '}
              <span className='relative whitespace-nowrap'>
                Straight to your bank.
                {/* The one gold mark on the page above the fold: it underlines
                    the promise the whole product is built on. Drawn behind the
                    text at 38% height so it reads as a highlighter stroke, not
                    an underline. */}
                <span
                  aria-hidden='true'
                  className='bg-gold/45 absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.38em] -rotate-[0.6deg] rounded-sm'
                />
              </span>
            </h1>

            <p className='text-grey-700 animate-rise mt-7 max-w-[560px] text-lg leading-[1.6] text-pretty [animation-delay:140ms] md:text-xl'>
              A real shop for your business — cart, card and transfer checkout,
              delivery fees by area, coupon codes. Your customer pays, Paystack
              settles it into your own account. We never hold your money.
            </p>

            <div className='animate-rise mt-9 flex flex-col gap-3.5 [animation-delay:220ms] sm:flex-row sm:items-center'>
              <Cta href={ROUTES.signUp}>Get your store</Cta>
              <Cta href={demoUrl} tone='outline'>
                Browse a live store
                <ArrowRight />
              </Cta>
            </div>

            <p className='text-grey-500 animate-rise mt-5 flex items-start gap-2.5 text-[15px] [animation-delay:300ms]'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='none'
                aria-hidden='true'
                className='mt-1 shrink-0'
              >
                <path
                  d='M8 1.5l5.5 2.2v4c0 3.2-2.3 5.6-5.5 6.8-3.2-1.2-5.5-3.6-5.5-6.8v-4L8 1.5z'
                  className='stroke-primary'
                  strokeWidth='1.4'
                  strokeLinejoin='round'
                />
                <path
                  d='M5.8 8l1.6 1.6 3-3.2'
                  className='stroke-primary'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
              Payments processed by Paystack. No card details ever touch us.
            </p>
          </div>

          {/* The product, on a phone. Below `lg` the device frame drops away
              and the same markup renders as a plain card — a bezel on a phone
              is a picture of a phone inside a phone. */}
          <div className='animate-rise flex justify-center [animation-delay:120ms] lg:justify-end'>
            <div className='border-paper-line rounded-card w-full max-w-[340px] border lg:rounded-[46px] lg:border-0 lg:bg-[#0F2518] lg:p-2.5 lg:shadow-float'>
              <div className='overflow-hidden rounded-[10px] lg:rounded-[34px] lg:pt-6'>
                <StorefrontPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CapabilityStrip />
      <PainSection />
      <MoneyFlowSection />
      <ValueSection />
      <ThemeShowcase />
      <DemoSection demoUrl={demoUrl} />
      <FaqSection />
      <ClosingSection whatsapp={BRAND.whatsapp} />
    </MarketingShell>
  );
}
