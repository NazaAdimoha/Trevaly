/**
 * Everything the marketing site says that is a *fact about the business*
 * rather than a fact about the design.
 *
 * It lives here, in one file, for one reason: the price is not settled and the
 * brand is not named. Both appear in several places across two pages, and both
 * will change. A layout that reads them from here changes with a one-line edit;
 * a layout with the number typed into it changes with a hunt.
 *
 * `BRAND_NAME` and the `[SOMETHING]` strings are deliberate placeholders. They
 * are meant to look wrong in the page until someone fills them in — a plausible
 * fake would ship to production unnoticed.
 */

export const BRAND = {
  name: '[BRAND]',
  /** Rendered in copy as the storefront address a tenant is given. */
  domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com',
  tagline: 'Online stores for Nigerian businesses.',
  whatsapp: '[YOUR WHATSAPP NUMBER]',
  email: '[YOUR EMAIL]',
  address: '[YOUR LAGOS ADDRESS]',
  instagram: '[YOUR INSTAGRAM]',
} as const;

/**
 * The seeded demo store, linked from the home page and /pricing.
 *
 * The design brief calls this the single highest-converting asset on the site —
 * someone who adds a product to a cart on the demo has pre-sold themselves — so
 * it is a primary call to action, not a text link.
 *
 * Built as a string rather than looked up in the database: the marketing page
 * is the most-hit route we own and it should not carry a query, and the slug is
 * a deployment fact, not tenant data. `.localhost` matches how
 * `classifyHostname` resolves subdomains in development.
 */
export function demoStoreUrl(): string {
  const slug = process.env.NEXT_PUBLIC_DEMO_STORE_SLUG ?? 'adaobi-store';

  return process.env.NODE_ENV === 'development'
    ? `http://${slug}.localhost:3000`
    : `https://${slug}.${BRAND.domain}`;
}

/**
 * Pricing — model A ("one price"), which is BUILD_PLAN D4's decision of record:
 * a flat build fee, no cut of the tenant's sales. `Tenant.platformFeePercent`
 * stays at 0 for anyone sold on this, which is what the "0% of your sales" line
 * on the page is asserting. Do not put a figure on the page that the database
 * does not agree with.
 *
 * Switching to the subscription model is a change to this object plus the
 * `PLANS` array below — not a change to the pricing view.
 */
export const PRICING = {
  buildPrice: '₦75,000',
  hostingPrice: '₦7,500',
  /** Paystack's own fee, quoted so nobody is surprised at their first payout. */
  gatewayFee: '1.5% plus ₦100, waived under ₦2,500',
  anchorBrochure: '₦25,000',
  anchorAgency: '₦150,000',
} as const;

export const INCLUDED = [
  'Up to 30 products, loaded for you from your list or spreadsheet',
  'Cart and checkout — card, bank transfer, USSD via Paystack',
  'Delivery pricing in three areas, plus free in-store pickup',
  'Two launch coupon codes set up with you',
  'Your dashboard — orders, stock, products, staff logins',
  `A free address at yourshop.${BRAND.domain}`,
  'One round of changes before we hand it over',
  'Seven days of fixes after launch, no charge',
] as const;

export const ADD_ONS = [
  {
    name: 'More products',
    detail: 'Past the first 30, in blocks of 20.',
    price: '[ADD-ON PRICE]',
  },
  {
    name: 'Courier pickup and tracking',
    detail: 'GIGL, Kwik or Sendbox quoting live at checkout.',
    price: '[ADD-ON PRICE]',
  },
  {
    name: 'Your own domain',
    detail: 'Bought, pointed and secured for you.',
    price: '[ADD-ON PRICE]',
  },
  {
    name: 'Google and search setup',
    detail: 'Business profile, sitemap, product listings indexed.',
    price: '[ADD-ON PRICE]',
  },
  {
    name: 'Instagram catalogue sync',
    detail: 'Your products where your customers already are.',
    price: '[ADD-ON PRICE]',
  },
  {
    name: 'We run it for you',
    detail: 'Product uploads, price changes, priority replies.',
    price: '[ADD-ON PRICE] / month',
  },
] as const;

/** The anchor table on /pricing. `null` renders as a caveat, not a tick. */
export const COMPARISON: ReadonlyArray<{
  feature: string;
  brochure: boolean;
  ours: boolean;
  agency: boolean | string;
}> = [
  {
    feature: 'Customers can pay on the site',
    brochure: false,
    ours: true,
    agency: true,
  },
  {
    feature: 'Stock counts down when something sells',
    brochure: false,
    ours: true,
    agency: true,
  },
  {
    feature: 'Delivery fee worked out at checkout',
    brochure: false,
    ours: true,
    agency: true,
  },
  {
    feature: 'Payment checked on our server, not in the browser',
    brochure: false,
    ours: true,
    agency: 'Depends who built it',
  },
  {
    feature: 'Live in days, not months',
    brochure: true,
    ours: true,
    agency: false,
  },
];

/**
 * The copy spine of the home page, per the design brief: the visitor does not
 * feel the absence of a website, they feel these five things. Lead with the
 * pain, land the feature second.
 */
/**
 * The five things a seller does by hand today.
 *
 * One short line each. The earlier version explained each pain in two
 * sentences, which is one and a half more than a reader who lives this every
 * day needs — they are not being informed, they are being recognised. The
 * illustration beside them carries the rest.
 */
export const PAIN_POINTS = [
  {
    title: 'Squinting at a payment screenshot',
    body: 'Is it real? Is it today? Do you release the goods?',
  },
  {
    title: 'Orders buried under 300 unread DMs',
    body: 'The order, the haggling and the small talk, one thread.',
  },
  {
    title: 'Working out delivery to Ikorodu. Again.',
    body: 'By hand, every time — and you still guess low.',
  },
  {
    title: 'Walking to the shelf to check the blue one',
    body: 'And selling it twice when you get it wrong.',
  },
  {
    title: 'Sending your account number to a stranger',
    body: 'They are wondering the same about you. The sale dies.',
  },
] as const;

export const STOREFRONT_FEATURES = [
  'Product pages with real photos and stock counts',
  'Cart and checkout — card, transfer, USSD',
  'Delivery fee calculated by area, plus free pickup',
  'Coupon codes that cannot be faked from the browser',
  'No account to create — your customer just buys',
] as const;

export const DASHBOARD_FEATURES = [
  'Every paid order in one list, with a number you can quote',
  'Stock that counts itself down when something sells',
  'Add products from your phone, or import a spreadsheet',
  'Set your delivery areas once and stop doing the maths',
  'Add your staff without giving away your password',
] as const;

/**
 * Rendered as visible copy AND as FAQPage structured data from the same array.
 * Never maintain a second copy for the JSON-LD — that is how they drift and
 * get flagged as mismatched.
 */
export const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'How much does an online store cost in Nigeria?',
    a: `A brochure site with no cart goes for around ${PRICING.anchorBrochure} and cannot take a payment. A bespoke agency build starts around ${PRICING.anchorAgency}. Ours sits between the two and actually processes money.`,
  },
  {
    q: 'Do I need my own Paystack account?',
    a: 'You need a Nigerian business bank account, and we open the Paystack subaccount against it during setup. It is registered in your name, so your settlements are yours and we cannot touch them.',
  },
  {
    q: 'Can I use my own domain name?',
    a: `Yes. Every store gets a free address like yourshop.${BRAND.domain} straight away, and you can point a .com or .com.ng at it whenever you buy one. Nothing about your store changes when you do.`,
  },
  {
    q: 'Can I choose how my store looks?',
    a: 'Yes. There are three looks — Classic, Editorial and Utility — and they differ in the shape of your product photos, how many fit a row, and how loud the price is. Tell us which suits your catalogue, or send your photos and we will suggest one. Changing later is a setting, not a rebuild.',
  },
  {
    q: 'How long does setup take?',
    a: 'Send your product list, photos, delivery areas and bank details and the store is live in a few days. If your catalogue is already in a spreadsheet, we import it in one go rather than typing it in.',
  },
  {
    q: 'What if someone pays and the item has finished?',
    a: 'The payment is never dropped — it is recorded and flagged in your dashboard so you can refund or send a replacement. Losing a real payment because of a stock mistake is the one thing this must never do.',
  },
  {
    q: 'Can I keep selling on Instagram and WhatsApp?',
    a: 'Of course, and most sellers do. The store becomes the link in your bio: you keep posting, and the paying, the delivery fee and the receipt stop happening in your DMs.',
  },
];
