import Link from 'next/link';

import MarketingShell from '@/components/Layouts/Marketing';

import { ADD_ONS, COMPARISON, INCLUDED, PRICING } from '@/constant/marketing';
import ROUTES from '@/constant/routes';

import { Cta, Eyebrow, FeatureList, SectionHeading } from '../shared';

const SHELL = 'mx-auto max-w-[1240px] px-4 md:px-6';

/**
 * /pricing
 *
 * The one instruction the design brief was emphatic about: the figure is not
 * settled, so nothing here may depend on its character count. The price sits
 * alone in a block with room around it, is never inside a table cell that has
 * to line up with anything, and comes from `PRICING` in one place — including
 * the comparison column header, which would otherwise be the thing everyone
 * forgets to update.
 */
export default function PricingView({ demoUrl }: { demoUrl: string }) {
  return (
    <MarketingShell activeNav={ROUTES.pricing}>
      {/* ── Headline + the number ──────────────────────────────────────── */}
      <section className='hero-glow px-4 pt-12 pb-8 md:px-6 md:pt-20'>
        <div className='mx-auto max-w-[1240px]'>
          <h1 className='font-display animate-rise text-forest-900 max-w-[780px] text-[clamp(2.2rem,1.3rem+3.6vw,3.875rem)] leading-[1.08] font-bold tracking-[-0.03em] text-pretty'>
            One price for a shop that takes money.
          </h1>
          <p className='text-grey-700 animate-rise mt-4 max-w-[660px] text-lg leading-relaxed [animation-delay:70ms] md:text-xl'>
            No commission on your sales. No percentage skimmed at settlement.
            You pay us once to build it, and what your customers pay goes to
            your bank.
          </p>

          <div className='animate-rise mt-10 grid items-stretch gap-7 [animation-delay:120ms] lg:mt-13 lg:grid-cols-2'>
            <div className='bg-forest-900 rounded-card-lg shadow-float flex flex-col p-8 text-white md:p-12'>
              <p className='text-primary-400 mb-7 text-[13px] font-semibold tracking-[0.09em] uppercase'>
                Everything below, once
              </p>

              <p className='flex flex-wrap items-baseline gap-3'>
                <span className='font-display text-[clamp(3.25rem,2rem+4vw,5.75rem)] leading-[0.94] font-bold tracking-[-0.045em]'>
                  {PRICING.buildPrice}
                </span>
                <span className='text-primary-200 text-[19px] font-medium'>
                  one-time
                </span>
              </p>

              <p className='text-primary-200 mt-6 max-w-[420px] text-[17px] leading-relaxed'>
                Then {PRICING.hostingPrice} a month to keep it online, updated
                and backed up. Cancel any month; your data stays yours.
              </p>

              <div className='grow' />

              <div className='mt-10 flex flex-col gap-3.5 sm:flex-row sm:items-center'>
                <Cta href={ROUTES.signUp}>Start your store</Cta>
                <Link
                  href='/#contact'
                  className='text-primary-400 inline-flex h-[52px] items-center text-base font-medium hover:text-white'
                >
                  Talk on WhatsApp
                </Link>
              </div>

              <p className='border-forest-700 text-primary-400 mt-7 flex items-center gap-2.5 border-t pt-6 text-[15px]'>
                <span className='bg-primary animate-soft-pulse inline-block size-[7px] shrink-0 rounded-full' />
                0% of your sales. We take nothing at settlement.
              </p>
            </div>

            <div className='border-paper-line/70 rounded-card-lg shadow-float-sm border bg-white p-7 md:p-11'>
              <Eyebrow>What is in it</Eyebrow>
              <FeatureList items={INCLUDED} />
              <p className='bg-grey-05 text-grey-500 mt-7 rounded-lg p-4 text-[15px] leading-relaxed'>
                Paystack charges its own fee on each sale — {PRICING.gatewayFee}{' '}
                — deducted from that sale, not billed to you. That fee is
                theirs, not ours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The anchor ─────────────────────────────────────────────────── */}
      <section className='py-14 md:py-20'>
        <div className={SHELL}>
          <SectionHeading className='reveal'>
            What the cheaper option actually gets you
          </SectionHeading>
          <p className='text-grey-700 mt-4 max-w-[700px] text-lg leading-relaxed md:text-[19px]'>
            Worth being blunt about, because the {PRICING.anchorBrochure} quote
            in your DMs is real and it is not the same product.
          </p>

          <div className='border-paper-line/70 rounded-card shadow-float-sm reveal mt-9 overflow-x-auto border bg-white'>
            <table className='w-full min-w-[720px] border-collapse text-left'>
              <caption className='sr-only'>
                Feature comparison between a brochure site, this product, and a
                bespoke agency build
              </caption>
              <thead>
                <tr className='bg-grey-05 border-paper-line border-b'>
                  <th scope='col' className='w-[38%] px-6 py-4' />
                  <th
                    scope='col'
                    className='text-grey-700 px-5 py-4 text-[15px] font-semibold'
                  >
                    Brochure site
                    <span className='text-grey-400 mt-0.5 block text-[13.5px] font-normal'>
                      around {PRICING.anchorBrochure}
                    </span>
                  </th>
                  <th
                    scope='col'
                    className='bg-primary-50 text-forest-900 px-5 py-4 text-[15px] font-semibold'
                  >
                    This
                    <span className='text-primary-700 mt-0.5 block text-[13.5px] font-normal'>
                      {PRICING.buildPrice}
                    </span>
                  </th>
                  <th
                    scope='col'
                    className='text-grey-700 px-5 py-4 text-[15px] font-semibold'
                  >
                    Agency build
                    <span className='text-grey-400 mt-0.5 block text-[13.5px] font-normal'>
                      {PRICING.anchorAgency} and up
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr
                    key={row.feature}
                    className='border-grey-50 border-b last:border-b-0'
                  >
                    <th
                      scope='row'
                      className='text-forest-900 px-6 py-4 text-base font-normal'
                    >
                      {row.feature}
                    </th>
                    <td className='px-5 py-4'>
                      <Verdict value={row.brochure} />
                    </td>
                    <td className='bg-primary-50/40 px-5 py-4'>
                      <Verdict value={row.ours} />
                    </td>
                    <td className='px-5 py-4'>
                      <Verdict value={row.agency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Add-ons ────────────────────────────────────────────────────── */}
      <section className='pb-14 md:pb-20'>
        <div className={SHELL}>
          <SectionHeading className='reveal'>
            Add these when you need them
          </SectionHeading>
          <p className='text-grey-700 mt-4 max-w-[700px] text-lg leading-relaxed md:text-[19px]'>
            Not upsells we push on day one. Most sellers start without any of
            them and add one later.
          </p>

          <ul className='mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {ADD_ONS.map((addOn) => (
              <li
                key={addOn.name}
                className='border-paper-line/70 rounded-card hover-lift reveal border bg-white p-6'
              >
                <h3 className='text-forest-900 text-[17px] font-semibold'>
                  {addOn.name}
                </h3>
                <p className='text-grey-700 mt-1.5 text-[15.5px] leading-relaxed'>
                  {addOn.detail}
                </p>
                <p className='text-primary-700 mt-3.5 text-xl font-semibold'>
                  {addOn.price}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Close ──────────────────────────────────────────────────────── */}
      <section className='border-paper-line border-t bg-white py-14 md:py-20'>
        <div className='mx-auto max-w-[760px] px-4 text-center md:px-6'>
          <SectionHeading>
            Still cheaper than one lost order a week.
          </SectionHeading>
          <p className='text-grey-700 mt-4 text-lg leading-relaxed md:text-[19px]'>
            Have a look at a real store first if you would rather see it than
            read about it.
          </p>
          <div className='mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row'>
            <Cta href={ROUTES.signUp} className='w-full sm:w-auto'>
              Start your store
            </Cta>
            <Cta href={demoUrl} tone='outline' className='w-full sm:w-auto'>
              Open the demo store
            </Cta>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

/** A tick, a cross, or an honest caveat. */
function Verdict({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className='text-grey-400 text-[14.5px]'>{value}</span>;
  }

  return value ? (
    <svg
      width='20'
      height='20'
      viewBox='0 0 20 20'
      fill='none'
      role='img'
      aria-label='Yes'
    >
      <circle cx='10' cy='10' r='9' className='fill-primary-50' />
      <path
        d='M6.2 10.2l2.4 2.4 5.2-5.4'
        className='stroke-primary-700'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ) : (
    <svg
      width='20'
      height='20'
      viewBox='0 0 20 20'
      fill='none'
      role='img'
      aria-label='No'
    >
      <circle cx='10' cy='10' r='9' className='fill-error-50' />
      <path
        d='M7 7l6 6M13 7l-6 6'
        className='stroke-error'
        strokeWidth='1.7'
        strokeLinecap='round'
      />
    </svg>
  );
}
