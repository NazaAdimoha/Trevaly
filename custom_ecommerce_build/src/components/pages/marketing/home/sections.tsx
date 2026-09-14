        {/* Three facts, three tiles — replacing a paragraph that made the same
            three points in prose. Real renders rather than the CSS squircle:
            at 56px the modelling reads, and these three carry the section. */}
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          {[
            {
              icon: 'money-bag' as const,
              title: 'No balance to withdraw',
              body: 'We never open a reservoir.',
            },
            {
              icon: 'wallet' as const,
              title: 'Your own subaccount',
              body: 'Registered in your business name.',
            },
            {
              icon: 'computer' as const,
              title: 'Your own dashboard',
              body: 'Log in to Paystack any time.',
            },
          ].map((tile) => (
            <div
              key={tile.title}
              className='border-paper-line/70 rounded-card reveal flex items-start gap-4 border bg-white p-5'
            >
              <Icon3DAsset name={tile.icon} size={56} grounded />
              <div className='pt-1'>
                <h3 className='text-forest-900 text-[15px] leading-snug font-semibold'>
                  {tile.title}
                </h3>
                <p className='text-grey-600 mt-1 text-[14px] leading-[1.45]'>
                  {tile.body}
                </p>
              </div>
            </div>
          ))}
        </div>
import Link from 'next/link';

import {
  DASHBOARD_FEATURES,
  FAQ,
  PAIN_POINTS,
  STOREFRONT_FEATURES,
} from '@/constant/marketing';
import ROUTES from '@/constant/routes';

import {
  ArrowRight,
  ColorPanel,
  Cta,
  FloatChip,
  Icon3D,
  Icon3DAsset,
  Marquee,
  PillEyebrow,
  SectionHeading,
} from '../shared';

const SHELL = 'mx-auto max-w-[1240px] px-4 md:px-6';

/* ── What you actually get ────────────────────────────────────────────────── */

/**
 * Every entry here is a feature that EXISTS in the product today — Paystack
 * card/transfer/USSD, delivery zones, coupons, variant stock, staff roles,
 * spreadsheet import, the merchant app. A marketing marquee is the easiest
 * place in a codebase to accumulate aspirational copy, and the fastest way to
 * lose a seller is for them to sign up for something on this strip and not
 * find it.
 */
const CAPABILITIES = [
  'Card, transfer & USSD',
  'Settled by Paystack',
  'Delivery fees by area',
  'Coupon codes',
  'Stock that counts down',
  'Sizes & colours',
  'Staff logins',
  'Bulk upload from a spreadsheet',
  'Your own domain',
  'Orders on your phone',
] as const;

/**
 * A moving strip of what the product does, directly under the hero.
 *
 * Motion here is doing a job rather than decorating: the row is wider than any
 * phone, and a static list would simply be cut off at the screen edge with no
 * hint that it continues. Sliding it tells the reader there is more without
 * spending a second line of vertical space.
 */
export function CapabilityStrip() {
  return (
    <section className='border-paper-line/70 border-y bg-white py-8'>
      {/* Four of the capabilities get shown rather than named. The rest scroll
          past underneath — the icons say what kind of product this is before
          anyone reads a single item. */}
      <div className='mb-7 flex items-end justify-center gap-8 px-4 sm:gap-14'>
        {(
          [
            { icon: 'location' as const, label: 'Delivery areas' },
            { icon: 'gift' as const, label: 'Coupon codes' },
            { icon: 'file-text' as const, label: 'Bulk upload' },
            { icon: 'mobile' as const, label: 'Orders on your phone' },
          ]
        ).map((item) => (
          <div key={item.label} className='flex flex-col items-center gap-2'>
            <Icon3DAsset name={item.icon} size={58} grounded />
            <span className='text-grey-600 max-w-[92px] text-center text-[12px] leading-tight font-medium'>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <Marquee durationSeconds={46}>
        {CAPABILITIES.map((item) => (
          <span
            key={item}
            className='text-forest-900 flex items-center gap-3 px-5 text-[15px] font-medium whitespace-nowrap'
          >
            <span className='bg-gold size-1.5 shrink-0 rounded-full' />
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ── The pain ─────────────────────────────────────────────────────────────── */

export function PainSection() {
  return (
    <section
      id='how-it-works'
      className='bg-forest-900 contour py-20 text-white md:py-28'
    >
      <div className={SHELL}>
        {/* Centred and short. The old version ran an eyebrow, a heading and a
            two-line paragraph before the reader reached a single pain — three
            pieces of throat-clearing in front of the one thing they came to
            recognise themselves in. */}
        <div className='mx-auto max-w-[720px] text-center'>
          <PillEyebrow tone='dark'>Your Tuesday</PillEyebrow>
          <SectionHeading className='reveal mt-5 uppercase'>
            Five jobs you do by hand.
          </SectionHeading>
        </div>

        <ul className='mt-12 grid gap-4 md:mt-14 md:grid-cols-2 md:gap-5'>
          {PAIN_POINTS.map((point, index) => (
            <li
              key={point.title}
              className={`bg-forest-800/70 hover-lift reveal rounded-card-lg border border-white/5 p-6 ${
                index === PAIN_POINTS.length - 1 ? 'md:col-span-2' : ''
              }`}
            >
              <div className='flex items-start gap-4'>
                <Icon3D tone='forest'>
                  <PainGlyph index={index} />
                </Icon3D>
                <div>
                  <h3 className='text-[17px] leading-snug font-semibold'>
                    {point.title}
                  </h3>
                  <p className='text-primary-200 mt-1 text-[15px] leading-[1.5]'>
                    {point.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className='mx-auto mt-12 max-w-[640px] text-center text-lg leading-[1.5] text-pretty md:text-[22px]'>
          Not a design problem. An admin problem — and only a checkout removes
          it.
        </p>
      </div>
    </section>
  );
}

/**
 * One glyph per pain, in order: screenshot, message thread, delivery van,
 * stock box, bank transfer. Drawn inline rather than pulled from an icon set —
 * five shapes is far less weight than a dependency, and none of these exist in
 * a standard set with the right meaning anyway.
 */
function PainGlyph({ index }: { index: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg width='22' height='22' viewBox='0 0 24 24' aria-hidden='true'>
      {index === 0 ? (
        <>
          <rect x='4' y='3' width='16' height='18' rx='2.5' {...common} />
          <path d='M8 9h8M8 13h5' {...common} />
        </>
      ) : index === 1 ? (
        <>
          <path d='M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-5 4z' {...common} />
        </>
      ) : index === 2 ? (
        <>
          <path d='M3 7h10v9H3zM13 10h4l3 3v3h-7z' {...common} />
          <circle cx='7' cy='18' r='1.8' {...common} />
          <circle cx='17' cy='18' r='1.8' {...common} />
        </>
      ) : index === 3 ? (
        <>
          <path d='M3.5 8L12 4l8.5 4-8.5 4z' {...common} />
          <path d='M3.5 8v8l8.5 4 8.5-4V8' {...common} />
          <path d='M12 12v8' {...common} />
        </>
      ) : (
        <>
          <path d='M3 9.5L12 5l9 4.5' {...common} />
          <path d='M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18' {...common} />
        </>
      )}
    </svg>
  );
}

/* ── Where the money goes ─────────────────────────────────────────────────── */

export function MoneyFlowSection() {
  return (
    <section className='py-16 md:py-24'>
      <div className={SHELL}>
        {/* The diagram IS the argument here, so it gets the space and the copy
            gets out of its way. The previous version spent four sentences
            saying "we never hold your money" before showing the picture that
            proves it in one glance. */}
        <div className='mx-auto max-w-[720px] text-center'>
          <PillEyebrow>Asked first, every time</PillEyebrow>
          <SectionHeading className='reveal text-forest-900 mt-5 uppercase'>
            Your money never touches us.
          </SectionHeading>
          <p className='text-grey-700 mx-auto mt-5 max-w-[560px] text-lg leading-[1.55] text-pretty'>
            Paystack settles your share straight to your own bank account.
          </p>
        </div>

        <div className='border-paper-line/70 rounded-card-lg shadow-float reveal relative mt-12 border bg-white p-5 md:p-10'>
          <SettlementDiagram />

          <FloatChip
            tilt={-2.5}
            className='absolute -top-5 right-5 hidden md:block md:right-10'
          >
            <p className='text-forest-900 text-[13px] font-semibold'>
              Settled to your bank
            </p>
            <p className='text-grey-500 text-[12px]'>In your business name</p>
          </FloatChip>
        </div>

        {/* Three facts, three tiles — replacing a paragraph that made the same
            three points in prose. */}
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          {[
            {
              tone: 'green' as const,
              title: 'No balance to withdraw',
              body: 'We never open a reservoir.',
              d: 'M12 3v18M5 8h9a3 3 0 010 6H7',
            },
            {
              tone: 'gold' as const,
              title: 'Your own subaccount',
              body: 'Registered in your business name.',
              d: 'M3 9.5L12 5l9 4.5M5 10v7M12 10v7M19 10v7M3 20h18',
            },
            {
              tone: 'forest' as const,
              title: 'Your own dashboard',
              body: 'Log in to Paystack any time.',
              d: 'M4 5h16v12H4zM9 21h6M12 17v4',
            },
          ].map((tile) => (
            <div
              key={tile.title}
              className='border-paper-line/70 rounded-card reveal flex items-start gap-4 border bg-white p-5'
            >
              <Icon3D tone={tile.tone}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                  <path
                    d={tile.d}
                    stroke='currentColor'
                    strokeWidth='1.7'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </Icon3D>
              <div>
                <h3 className='text-forest-900 text-[15px] leading-snug font-semibold'>
                  {tile.title}
                </h3>
                <p className='text-grey-600 mt-1 text-[14px] leading-[1.45]'>
                  {tile.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SettlementDiagram() {
  return (
    <svg
      viewBox='0 0 1080 330'
      fill='none'
      role='img'
      aria-label='Your customer pays. Paystack splits the payment at settlement. The money lands in your own bank account. We are only told that an order was paid.'
      className='hidden h-auto w-full md:block'
    >
      <rect
        x='8'
        y='16'
        width='286'
        height='118'
        rx='10'
        fill='#F8F7F4'
        stroke='#D6D8D9'
        strokeWidth='1.4'
      />
      <text x='32' y='53' fontSize='17' fontWeight='600' fill='#0F2518'>
        Your customer
      </text>
      <text x='32' y='74' fontSize='14.5' fill='#7C8083'>
        Card or bank transfer
      </text>
      <text x='32' y='112' fontSize='26' fontWeight='600' fill='#0F2518'>
        ₦24,500
      </text>

      <path
        className='animate-flow'
        d='M310 75h84'
        stroke='#4DBF7D'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <path
        d='M388 69l7 6-7 6'
        stroke='#4DBF7D'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <text x='316' y='60' fontSize='13' fontWeight='500' fill='#337F53'>
        pays
      </text>

      <rect x='411' y='16' width='258' height='118' rx='10' fill='#0F2518' />
      <text x='437' y='53' fontSize='17' fontWeight='600' fill='#FFFFFF'>
        Paystack
      </text>
      <text x='437' y='74' fontSize='14.5' fill='#A6DFBE'>
        Splits at settlement
      </text>
      <rect x='437' y='90' width='206' height='28' rx='4' fill='#1E4330' />
      <text x='449' y='109' fontSize='13.5' fill='#6BCA93'>
        Licensed. Regulated. Not us.
      </text>

      <path
        className='animate-flow'
        style={{ animationDelay: '0.28s' }}
        d='M685 75h84'
        stroke='#4DBF7D'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <path
        d='M763 69l7 6-7 6'
        stroke='#4DBF7D'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <text x='688' y='60' fontSize='13' fontWeight='500' fill='#337F53'>
        settles
      </text>

      <rect
        x='786'
        y='16'
        width='286'
        height='118'
        rx='10'
        fill='#DBF2E5'
        stroke='#4DBF7D'
        strokeWidth='1.6'
      />
      <text x='810' y='53' fontSize='17' fontWeight='600' fill='#0F2518'>
        Your bank account
      </text>
      <text x='810' y='74' fontSize='14.5' fill='#337F53'>
        In your business name
      </text>
      <text x='810' y='112' fontSize='26' fontWeight='600' fill='#0F2518'>
        ₦24,500
      </text>

      <path
        d='M540 138v46'
        stroke='#C3C5C6'
        strokeWidth='1.6'
        strokeDasharray='5 6'
        strokeLinecap='round'
      />
      <rect
        x='381'
        y='188'
        width='318'
        height='94'
        rx='10'
        fill='#F8F7F4'
        stroke='#C3C5C6'
        strokeWidth='1.4'
        strokeDasharray='6 6'
      />
      <text x='405' y='222' fontSize='16' fontWeight='600' fill='#0F2518'>
        Us
      </text>
      <text x='405' y='245' fontSize='14.5' fill='#7C8083'>
        We are told an order was paid.
      </text>
      <text x='405' y='265' fontSize='14.5' fill='#7C8083'>
        That is all we ever receive.
      </text>

      <text
        x='540'
        y='313'
        textAnchor='middle'
        fontSize='14.5'
        fontWeight='500'
        fill='#337F53'
      >
        No account of ours sits between your customer and your bank.
      </text>
    </svg>
  );
}

/* ── What you get / what you operate ──────────────────────────────────────── */

export function ValueSection() {
  return (
    <section id='what-you-get' className='py-16 md:py-24'>
      <div className={SHELL}>
        <div className='mx-auto max-w-[720px] text-center'>
          <PillEyebrow>What you get</PillEyebrow>
          <SectionHeading className='reveal text-forest-900 mt-5 uppercase'>
            Two things, not one.
          </SectionHeading>
        </div>

        {/* Saturated panels rather than white cards. The product has two halves
            and the reader has to feel the split before they read either label —
            colour does that in the time it takes to scroll past, which is all
            the time this section gets. */}
        <div className='mt-12 grid gap-6 lg:grid-cols-2'>
          <ColorPanel tone='green' className='reveal'>
            <Icon3DAsset name='bag' size={76} />

            <h3 className='font-display mt-6 text-[30px] leading-[1.15] font-bold tracking-[-0.02em] md:text-[34px]'>
              A shop that takes the money
            </h3>

            <div className='relative mt-7'>
              <div className='rounded-card bg-white/10 p-4 backdrop-blur-sm'>
                <OrderSummaryCard />
              </div>
              {/* Real behaviour, not a mock-up flourish: the checkout does
                  compute a zone fee and Paystack does settle to the seller. */}
              <FloatChip tilt={-3} className='absolute -top-4 -left-2 hidden sm:block'>
                <p className='text-forest-900 text-[13px] font-semibold'>
                  Delivery to Ikorodu · ₦1,500
                </p>
                <p className='text-grey-500 text-[12px]'>Worked out at checkout</p>
              </FloatChip>
            </div>

            <ul className='mt-6 grid gap-2'>
              {STOREFRONT_FEATURES.map((item) => (
                <li key={item} className='flex items-start gap-2.5 text-[15px] text-white/90'>
                  <span className='bg-gold mt-2 size-1.5 shrink-0 rounded-full' />
                  {item}
                </li>
              ))}
            </ul>
          </ColorPanel>

          <ColorPanel tone='ink' mirrored className='reveal'>
            <Icon3DAsset name='chart' size={76} />

            <h3 className='font-display mt-6 text-[30px] leading-[1.15] font-bold tracking-[-0.02em] md:text-[34px]'>
              One screen instead of a thread
            </h3>

            <div className='relative mt-7'>
              <div className='rounded-card bg-white/10 p-4 backdrop-blur-sm'>
                <OrdersTable />
              </div>
              <FloatChip tilt={2.5} className='absolute -top-4 -right-2 hidden sm:block'>
                <p className='text-forest-900 text-[13px] font-semibold'>
                  Paid · order #34
                </p>
                <p className='text-grey-500 text-[12px]'>Stock counted down</p>
              </FloatChip>
            </div>

            <ul className='mt-6 grid gap-2'>
              {DASHBOARD_FEATURES.map((item) => (
                <li key={item} className='flex items-start gap-2.5 text-[15px] text-white/90'>
                  <span className='bg-gold mt-2 size-1.5 shrink-0 rounded-full' />
                  {item}
                </li>
              ))}
            </ul>
          </ColorPanel>
        </div>
      </div>
    </section>
  );
}

function OrderSummaryCard() {
  const lines = [
    { label: 'Subtotal', value: '₦42,500' },
    { label: 'Delivery — Lagos Mainland', value: '₦1,500' },
  ];

  return (
    <div className='border-grey-50 rounded-2xl border bg-[#FBFAF8] p-4 md:p-[18px]'>
      <div className='border-grey-50 mb-3.5 flex items-center justify-between border-b pb-3'>
        <span className='text-forest-900 text-sm font-semibold'>
          Order summary
        </span>
        <span className='text-grey-500 text-[12.5px]'>
          adaobi.yourbrand.com
        </span>
      </div>
      {lines.map((line) => (
        <div
          key={line.label}
          className='text-grey-700 mb-2 flex justify-between text-[14.5px]'
        >
          <span>{line.label}</span>
          <span className='text-forest-900'>{line.value}</span>
        </div>
      ))}
      <div className='text-primary-700 mb-3 flex justify-between text-[14.5px]'>
        <span>Coupon WELCOME10</span>
        <span>−₦4,250</span>
      </div>
      <div className='border-grey-50 text-forest-900 flex justify-between border-t pt-3 text-base font-semibold'>
        <span>Total</span>
        <span>₦39,750</span>
      </div>
    </div>
  );
}

const DEMO_ORDERS = [
  { id: '#1042', customer: 'Ngozi Eze', total: '₦39,750', status: 'Paid' },
  {
    id: '#1041',
    customer: 'Tunde Bakare',
    total: '₦12,000',
    status: 'Shipped',
  },
  { id: '#1040', customer: 'Amaka Obi', total: '₦24,500', status: 'Pending' },
  { id: '#1039', customer: 'Kelechi Nwosu', total: '₦18,000', status: 'Paid' },
];

const STATUS_STYLE: Record<string, string> = {
  Paid: 'bg-success-50 text-success-600',
  Shipped: 'bg-info-50 text-info-600',
  Pending: 'bg-warning-50 text-warning-600',
};

function OrdersTable() {
  return (
    <div className='border-grey-50 overflow-hidden rounded-2xl border'>
      <table className='w-full border-collapse text-left'>
        <caption className='sr-only'>
          Example of the orders list in the store dashboard
        </caption>
        <thead>
          <tr className='bg-grey-05 border-grey-50 text-grey-500 border-b text-[11.5px] font-semibold tracking-[0.06em] uppercase'>
            <th scope='col' className='px-4 py-2.5 font-semibold'>
              Order
            </th>
            <th scope='col' className='px-4 py-2.5 font-semibold'>
              Customer
            </th>
            <th scope='col' className='px-4 py-2.5 text-right font-semibold'>
              Total
            </th>
            <th scope='col' className='px-4 py-2.5 text-right font-semibold'>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ORDERS.map((order) => (
            <tr
              key={order.id}
              className='border-grey-50 text-forest-900 hover:bg-grey-05 border-b text-sm transition-colors last:border-b-0'
            >
              <td className='px-4 py-3 font-semibold'>{order.id}</td>
              <td className='text-grey-700 px-4 py-3'>{order.customer}</td>
              <td className='px-4 py-3 text-right'>{order.total}</td>
              <td className='px-4 py-3 text-right'>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[order.status]}`}
                >
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Live demo ────────────────────────────────────────────────────────────── */

export function DemoSection({ demoUrl }: { demoUrl: string }) {
  return (
    <section id='demo' className='pb-16 md:pb-24'>
      <div className={SHELL}>
        <div className='bg-primary-50 border-primary-200 rounded-card reveal grid gap-8 border p-7 md:grid-cols-[1fr_auto] md:items-center md:p-14'>
          <div>
            <h2 className='font-display text-forest-900 text-[26px] leading-tight font-bold tracking-[-0.024em] text-pretty md:text-[34px]'>
              Do not take our word for it. Go and buy something.
            </h2>
            <p className='text-primary-700 mt-3 max-w-[640px] text-base leading-relaxed md:text-[18px]'>
              A real store, running on the real thing. Add something to the
              cart, get to the payment step, and see exactly what your customer
              will see. No sign-up.
            </p>
          </div>
          <Cta href={demoUrl} tone='dark' className='w-full md:w-auto'>
            Open the demo store
            <ArrowRight />
          </Cta>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

export function FaqSection() {
  return (
    <section id='faq' className='pb-16 md:pb-24'>
      <div className={SHELL}>
        <SectionHeading className='reveal'>
          Questions we get asked before anyone pays
        </SectionHeading>
        <p className='text-grey-700 mt-4 max-w-[640px] text-lg leading-relaxed md:text-[19px]'>
          Straight answers. If yours is not here, message us and a person will
          reply.
        </p>

        {/* Rendered open, never behind an accordion: these answers are the
            page's strongest search-intent content and they ship as FAQPage
            structured data from this same array. */}
        <div className='mt-10 grid gap-5 md:mt-11 md:grid-cols-2 md:gap-x-7'>
          {FAQ.map((entry) => (
            <article
              key={entry.q}
              className='border-paper-line/70 rounded-card hover-lift reveal border bg-white p-6 md:p-7'
            >
              <h3 className='text-forest-900 text-[19px] leading-snug font-semibold'>
                {entry.q}
              </h3>
              <p className='text-grey-700 mt-2.5 text-base leading-relaxed'>
                {entry.a}
              </p>
            </article>
          ))}
        </div>

        <p className='text-grey-700 mt-8 text-base'>
          Still deciding?{' '}
          <Link
            href={ROUTES.pricing}
            className='text-primary-700 font-medium underline underline-offset-4'
          >
            See exactly what it costs
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ── Closing ──────────────────────────────────────────────────────────────── */

export function ClosingSection({ whatsapp }: { whatsapp: string }) {
  return (
    <section
      id='contact'
      className='border-paper-line relative overflow-hidden border-t bg-white py-20 md:py-28'
    >
      {/* One warm orb, low and centred, so the final ask sits in a pool of
          light rather than on flat white. Behind the content and inert. */}
      <div
        aria-hidden='true'
        className='orb bg-gold absolute -bottom-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full'
      />

      <div className='relative mx-auto max-w-[780px] px-4 text-center md:px-6'>
        <Icon3DAsset name='rocket' size={92} className='mb-6' />
        <h2 className='font-display text-forest-900 text-[clamp(1.875rem,1.2rem+2.8vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em] text-pretty'>
          Send us your product list. Start selling this week.
        </h2>
        <p className='text-grey-700 mt-4 text-lg leading-relaxed md:text-[19px]'>
          Your photos, your prices, your delivery areas, your bank details. We
          do the rest and hand you the keys.
        </p>
        <div className='mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row'>
          <Cta href={ROUTES.signUp} tone='gold' className='w-full sm:w-auto'>
            Get your store
          </Cta>
          <Cta
            href={ROUTES.pricing}
            tone='outline'
            className='w-full sm:w-auto'
          >
            See what it costs
          </Cta>
        </div>
        <p className='text-grey-500 mt-5 text-[15px]'>
          Or message us on WhatsApp — {whatsapp}
        </p>
      </div>
    </section>
  );
}
