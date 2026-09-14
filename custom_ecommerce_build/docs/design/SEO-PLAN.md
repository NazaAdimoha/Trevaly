# SEO Plan — marketing site and tenant storefronts

Written against the working build (Next 16 App Router, `src/app/**`).

## Where we stand today

Steps 1–5 and 7 of the ordering in §3 are **implemented and verified against a
running server**. What is left is listed at the bottom.

| Thing                       | State                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Per-page `metadata` exports | Present on every route                                                                  |
| `metadataBase`              | ✅ Root layout (platform host); overridden per tenant in the storefront layout          |
| `alternates.canonical`      | ✅ Marketing home, `/pricing`, storefront home, PDP — storefront via `tenantOrigin()`   |
| `sitemap.xml`               | ✅ `app/sitemap.ts` (platform) + `app/sites/[tenant]/sitemap.xml/route.ts` (per tenant) |
| `robots.txt`                | ✅ `app/robots.ts` with the preview-deploy guard + per-tenant handler                   |
| Structured data (JSON-LD)   | ✅ Organization, WebSite, FAQPage, Store/LocalBusiness, Product, Offer, BreadcrumbList  |
| `opengraph-image`           | **Still missing** — links shared to WhatsApp render as a bare URL                       |
| OG tags                     | ✅ Marketing + storefront layout + PDP, with absolute URLs resolved from `metadataBase` |
| `robots: { index: false }`  | Correctly set on dashboard + order confirmation                                         |

Two surfaces need completely different treatment, so they are separated below.

---

## 1. Marketing site (root domain)

### 1.1 Move it out of `(platform)` first

> **Done.** Kept below because the reasoning is the reason the boundary exists,
> and someone will eventually be tempted to put a Clerk component back on the
> marketing site. The implemented shape differs from the sketch in one way: the
> header reads a `__session` cookie server-side rather than mounting a scoped
> `ClerkProvider`, so there is no client island and no Clerk JS at all.

The marketing home previously lived at `src/app/(platform)/page.tsx`, inside the
route group whose layout mounts `ClerkProvider`. `src/app/(marketing)/` and
`src/app/(marketing)/pricing/` exist as **empty directories** — the intent was
there, the move never happened. Consequences today:

- `ROUTES.pricing` points at `/pricing`, which **404s** (verified against the
  running dev server).
- Every marketing visitor downloads and boots Clerk's client bundle before the
  page is interactive. INP and LCP are ranking inputs, and this is the single
  largest avoidable cost on the highest-traffic page we own.

Target shape:

```
src/app/(marketing)/layout.tsx    marketing shell — no ClerkProvider
src/app/(marketing)/page.tsx      home (moved from (platform)/page.tsx)
src/app/(marketing)/pricing/page.tsx
src/app/(marketing)/_components/AuthNav.tsx   'use client' island
```

The signed-in/signed-out header switch is the only thing on the marketing site
that needs Clerk. Isolate it: read the session server-side with `auth()` from
`@clerk/nextjs/server` and render a plain link, or keep a small client island
mounted inside a `<ClerkProvider>` scoped to the header alone. Do not wrap the
document for it.

`(platform)` keeps `/sign-in`, `/sign-up` and `/dashboard`.

### 1.2 Root metadata

`src/app/layout.tsx` needs `metadataBase` — without it every relative OG image
and canonical is a build error or silently absolute-less.

```ts
export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`),
  title: { default: '…', template: '%s | …' },
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'en_NG', siteName: '…' },
  twitter: { card: 'summary_large_image' },
};
```

`locale: 'en_NG'` is not cosmetic — it is one of the few signals that tells
Google this result belongs in Nigerian SERPs.

Per page, set `title`, `description` (150–160 chars, written as ad copy because
that is what it is), and `alternates.canonical` to that route's path.

### 1.3 Structured data

Three blocks, each a `<script type="application/ld+json">` rendered
server-side. Put them behind one `<JsonLd data={…} />` helper in
`src/components/JsonLd.tsx` so they cannot drift.

- **Organization** + **WebSite** on the home page. Include `areaServed: 'NG'`,
  `sameAs` for Instagram/WhatsApp, and the physical address once there is one.
- **FAQPage** on the home FAQ block. Six questions, marked up from the same
  source array the section renders from — never a hand-maintained duplicate,
  which is how these go stale and get flagged.
- **Service** or **Product** with an `offers` block on `/pricing`, once the
  price is settled. Skip it entirely rather than shipping a placeholder price.

### 1.4 Keyword targeting

The marketing copy in the design canvas is written against real search intent
rather than internal vocabulary. Primary targets:

| Intent                                        | Where it lands           |
| --------------------------------------------- | ------------------------ |
| how much does an online store cost in nigeria | FAQ answer 1, `/pricing` |
| online store for my business nigeria          | home h1 + description    |
| sell online with paystack                     | money-flow section       |
| ecommerce website lagos                       | home, footer address     |
| add cart and checkout to my website           | "Two things, not one"    |
| instagram to online store                     | FAQ answer 6             |

The FAQ is the highest-value SEO block on the site: six real questions with
answers **visible in the DOM** (no accordion hiding them behind JS), which is
why the design renders them all open.

### 1.5 Files to add

- `src/app/sitemap.ts` — home, pricing, sign-in, sign-up.
- `src/app/robots.ts` — allow everything on production; return
  `{ rules: { userAgent: '*', disallow: '/' } }` when
  `process.env.VERCEL_ENV !== 'production'`. Without this, preview deploys get
  indexed and compete with the real domain.
- `src/app/opengraph-image.tsx` and one per marketing route. WhatsApp forwards
  are the distribution mechanic; a link with no preview card loses most of its
  click-through.

---

## 2. Tenant storefronts — the part that actually matters

Fifty tenants × ~30 products is ~1,500 indexable product pages. That is a far
bigger SEO asset than the marketing site, and "your products show up on
Google" is a sellable feature.

### 2.1 The duplicate-content problem, and it is live today

A tenant with a verified custom domain is reachable at **both**
`shop.yourbrand.com` and `shop.com`, serving byte-identical HTML. With no
canonical, Google treats them as competing documents and splits authority
between them.

Two fixes, and do both:

1. **Canonical.** In `src/app/sites/[tenant]/layout.tsx`, `generateMetadata`
   already resolves the tenant. Set `metadataBase` from the tenant's
   **preferred** host — `customDomain` when `customDomainVerified`, otherwise
   `${slug}.${ROOT_DOMAIN}` — and `alternates: { canonical: pathname }`.
2. **Redirect.** In `src/proxy.ts`, once `customDomainVerified` is true, 301
   the subdomain to the custom domain. One host, one document, no ambiguity.
   Keep the subdomain resolving (people bookmark it) — just redirect it.

### 2.2 Sitemap and robots per tenant

`sitemap.ts` as a metadata file inside a dynamic segment is not a shape worth
betting on. Use explicit Route Handlers, which are unambiguous:

- `src/app/sites/[tenant]/sitemap.xml/route.ts` — home, every in-stock product
  by slug, using `Product.updatedAt` as `lastmod`. Exclude `/cart`,
  `/checkout`, `/order/**`.
- `src/app/sites/[tenant]/robots.txt/route.ts` — disallow `/cart`, `/checkout`,
  `/order/`, and point `Sitemap:` at the tenant's preferred host.

The proxy rewrite already maps `shop.yourbrand.com/sitemap.xml` onto these.
Both must be tenant-scoped through `tenantDb(tenantId)` — a sitemap is the one
place where a leak would publish another business's catalogue to Google.

### 2.3 Structured data on the storefront

This is the highest-return item in the whole plan.

- **Product** on `/products/[slug]`: `name`, `description`, `image`, `sku`,
  and an `offers` block with `price`, `priceCurrency: 'NGN'`, `availability`
  from the real stock count, and `url` at the canonical host. Rich results for
  price and availability are the difference between a listing and a click.
- **BreadcrumbList** on the PDP.
- **LocalBusiness** on the storefront home for any tenant with a
  `storeAddress`. The field exists in the schema and renders nowhere today —
  the design brief calls it the cheapest credibility win available, and it is
  also a Google Business signal.
- **ItemList** on the catalogue page.

Derive all of it from the same server-fetched records the page renders. Never
a second query, never hand-written.

### 2.4 What is already right, and must stay right

- Catalogue and PDP are **Server Components** — crawlable HTML, no client
  fetch. `AGENT.md` fixes this split; do not "optimise" it into a client
  fetch.
- `robots: { index: false }` on `/order/[reference]` — correct, those pages
  contain customer data.
- Cart and checkout are not linked from anywhere crawlable.
- The Lighthouse mobile ≥ 90 target is a Core Web Vitals target by another
  name. The design's motion is CSS-only for exactly this reason: no animation
  library, no carousel, one webfont family, two weights.

### 2.5 Missing image SEO

`Product.imageUrls` is empty for every product because M8's upload path is
unbuilt. When it lands:

- `alt` text from `Product.name`, never the filename.
- Explicit `width`/`height` so nothing shifts (CLS).
- `next/image` with Cloudinary delivery, which is already wired.
- Images in the tenant sitemap via the `image:image` extension.

---

## 3. Order of work

1. ✅ Move marketing into `(marketing)`, build `/pricing`.
2. ✅ `metadataBase` + canonical on both surfaces.
3. ✅ `robots.ts` with the preview-deploy guard.
4. ✅ Tenant sitemap + robots route handlers.
5. ✅ Product JSON-LD on the PDP.
6. **OG images — still to do.** Cosmetic for crawlers, decisive for WhatsApp
   forwards, which is the actual distribution mechanic. Needs
   `opengraph-image.tsx` on the marketing routes and a dynamic one per tenant
   storefront (store name + logo over the brand ground).
7. ✅ FAQPage + Organization + WebSite JSON-LD on marketing.

### Still outstanding after this pass

- **OG images** (item 6 above).
- **The subdomain → custom-domain 301 in `proxy.ts`.** The canonical tag now
  tells crawlers which host wins, which is the larger half of the fix, but a
  redirect consolidates link equity properly and removes the ambiguity for
  everything that ignores canonicals. Deferred because it needs a verified
  custom domain to test against and no tenant has one yet.
- **Image SEO** (§2.5) — blocked on M8's upload path; `Product.imageUrls` is
  empty for every product today, which is also why the PDP's `image` field is
  omitted rather than empty.
- **`ItemList` on the catalogue page** — small, worth doing when the catalogue
  page is next touched.
