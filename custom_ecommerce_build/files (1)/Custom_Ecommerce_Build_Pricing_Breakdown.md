# Custom E-Commerce Websites

**A Build, Cost & Pricing Breakdown for a Checkout + Delivery + Coupon System**

_Prepared for a React / Next.js developer building a repeatable web agency offer, targeting the ₦70,000–₦75,000 price tier_

## 1. The Business Model, Clarified

The ₦25,000 TikTok offer and a ₦70,000–₦75,000 offer aren't the same product wearing different price tags — they are structurally different builds. Understanding that difference is the whole game.

### 1.1 What the ₦25k tier actually is

- A brochure site: home, about, services/products (display only), contact.
- Built on WordPress + Elementor/Divi, or a free Shopify theme with no real backend logic.
- No cart, no checkout, no payment reconciliation, no delivery logic.
- Profit comes from volume, hosting resale, and monthly "maintenance" retainers — not the build itself.

### 1.2 What the ₦70k–₦75k tier must be

The moment a client needs customers to add items to a cart, pay online, apply a coupon, and get a delivery fee calculated at checkout, you've crossed from a website into a transactional application. That requires:

- Persistent state (cart, orders, inventory) — a real database, not just page content.
- A payment gateway integration with server-side verification (never trust the frontend alone for "payment successful").
- Business logic: coupon validation, stock decrementing, delivery fee calculation by zone/weight.
- An admin interface for the client to manage products, view orders, and mark deliveries fulfilled.

This is precisely the kind of work your existing stack (React, Next.js, TypeScript, Redux Toolkit / React Query) is suited for — you're not choosing a new discipline, you're applying what you already do professionally at a smaller scale.

One important caveat if the goal is real volume (e.g. dozens of client sites a month): a database and backend do not automatically eat your margin — but a separate database and deployment per client will. Section 7 covers the multi-tenant architecture that keeps infrastructure cost flat as client count grows, and how payments are split per business without funds ever passing through your own account.

## 2. Two Ways to Build the Checkout Layer

### 2.1 Option A — WooCommerce / Shopify as the commerce engine

Fastest to deliver, lowest technical risk. WooCommerce (WordPress) or Shopify already ships cart, checkout, coupon codes, and basic shipping rules out of the box. You customise the theme and connect a Nigerian payment gateway plugin.

- Pros: 2–4 day build time once you have a template; huge plugin ecosystem for delivery/coupon edge cases; client can self-manage products in a familiar admin (WP admin or Shopify admin).
- Cons: less differentiated ("just another WordPress store"); plugin bloat can slow the site; you're renting functionality rather than owning it; harder to layer truly custom logic later.

### 2.2 Option B — Custom Next.js storefront (your differentiator)

A hand-built storefront using Next.js on the frontend, a headless commerce or lightweight custom backend, and a Nigerian payment gateway SDK. This is what actually justifies a 3x price jump over the WordPress crowd, and it's the version worth building as a reusable template since it plays to your strengths.

- Frontend: Next.js (App Router), TypeScript, Tailwind, React Query for data fetching, Zustand or Redux Toolkit for cart state.
- Backend/data: Next.js API routes or a small Node/Express service, PostgreSQL via Prisma (or a headless CMS like Sanity for product content + a lightweight orders table).
- Payments: Paystack or Flutterwave — both have first-class Node/React SDKs and Nigerian bank settlement.
- Pros: faster page loads (a real selling point to pitch clients), full control of coupon/delivery logic, reusable component library across every client, no plugin licensing costs eating margin, positions you above the WordPress-agency crowd.
- Cons: longer initial build for your first 1–2 template versions; you own bug-fixing (no plugin support team to fall back on).

> **Recommendation:** build Option B once as a solid, reusable template (2–3 weeks of real effort), then every subsequent client site is a reskin — same pattern as the WordPress guys, but the underlying product is genuinely better, which is what supports the higher price.

## 3. Core Feature Breakdown

### 3.1 Cart & Checkout

- Client-side cart state (Zustand/Redux) persisted to localStorage so it survives page refresh.
- Checkout form: customer details, delivery address, delivery method — validated with something like Zod or React Hook Form.
- Order is created in the database in a "pending" state before payment is attempted — never after.

### 3.2 Payment (Paystack or Flutterwave)

- Frontend initiates a payment request via the SDK (Paystack Popup/Inline or Flutterwave Standard).
- On success callback, the frontend does NOT mark the order paid — it only shows a "verifying" state.
- Your backend independently calls the gateway's verify-transaction endpoint using the reference returned, using your secret key server-side.
- Only after server-side verification succeeds do you mark the order "paid" and decrement stock. This step is what most cheap templated sites skip, and it's the difference between a toy checkout and one that won't get exploited or double-charge.
- Gateway sends a webhook on payment events too — configure this as a backup reconciliation path in case the client closes the tab before the callback fires.

### 3.3 Coupon Codes

- A coupons table: code, discount type (percentage or fixed), min. order value, expiry date, usage limit, times used.
- Validation happens server-side at checkout — never trust a discount amount sent from the browser.
- Simple version: flat 10%-off codes. Advanced version: category-specific codes, first-order-only codes, auto-applied bulk discounts.

### 3.4 Delivery / Shipping

- Zone-based flat rates are the fastest to implement and the most common for Nigerian SMEs: e.g. Lagos Mainland ₦1,500, Lagos Island ₦2,000, Other States ₦3,500–₦5,000 (via interstate logistics).
- For clients wanting real courier integration, GIGL, Kwik Delivery, and Sendbox all have APIs for quote generation and tracking — this is an upsell, not part of the base build.
- Pickup option ("pick up in-store") should always be offered as a free fallback — it removes logistics risk for the client on day one.

### 3.5 Admin Dashboard for the Client

- Product CRUD (add/edit/delete, stock count, images via Cloudinary or UploadThing).
- Orders list with status (pending, paid, shipped, delivered) and manual status update.
- Coupon management (create/deactivate codes).
- This can be a simple protected /admin route in the same Next.js app — no need for a separate CMS unless the client specifically wants one.

## 4. Build Flow, Step by Step

- Discovery form — client submits business name, product catalogue (spreadsheet or list), delivery zones and rates, brand colours/logo, and any coupon rules they want at launch.
- Spin up your reusable Next.js template (Section 2.2) and rebrand: colours, fonts, logo, hero copy.
- Seed the product database from the client's catalogue (a simple CSV-to-Prisma import script saves hours here — reusable across every client).
- Configure delivery zones and rates in the admin panel.
- Connect the client's Paystack/Flutterwave account (they create their own account so settlements go directly to them, not through you).
- Set up 1–2 launch coupon codes if requested (e.g. a WELCOME10 code).
- Test the full flow end-to-end: add to cart → checkout → pay with a test card → verify order appears "paid" in admin → simulate a failed/abandoned payment to confirm stock isn't wrongly decremented.
- Deploy (Vercel is the natural home for Next.js — free tier covers most small stores).
- Handover: a short Loom/video walkthrough of the admin panel plus a one-page PDF cheat sheet. This single deliverable massively reduces post-launch support requests.

## 5. Costing — What It Actually Costs You to Deliver One Site

These are your costs, not the client's price. Some are one-time (absorbed across every future client once built), some are per-client recurring.

### 5.1 One-time costs (build once, reuse forever)

| Item                                                        | Cost / Time                  |
| ----------------------------------------------------------- | ---------------------------- |
| Your time building the reusable template                    | 20–35 hrs (first build only) |
| UI kit / component polish (optional, e.g. shadcn/ui — free) | ₦0                           |
| CSV import script for product seeding                       | 2–3 hrs (one-time)           |

### 5.2 Recurring cost per client site

| Item                                                                                  | Cost / Time                           |
| ------------------------------------------------------------------------------------- | ------------------------------------- |
| Domain (.com or .com.ng)                                                              | ₦6,000 – ₦15,000 / yr                 |
| Hosting (Vercel free tier is usually enough at this scale)                            | ₦0 – ₦8,000 / mo if scaled up         |
| Database (Neon/Supabase free tier covers small stores)                                | ₦0 – ₦10,000 / mo at scale            |
| Image hosting (Cloudinary free tier)                                                  | ₦0                                    |
| Payment gateway fees (Paystack/Flutterwave — paid by client per transaction, not you) | ~1.5% per transaction (client's cost) |
| Your build/customisation time per client (once template exists)                       | 4–8 hrs                               |

Note the payment gateway's percentage fee is deducted from the client's sales automatically by the gateway — it is not something you pay, but you should tell clients about it upfront so there are no surprises.

## 6. Pricing the ₦70,000–₦75,000 Offer

At this tier you're not competing with the ₦25k brochure crowd — you're competing with agencies charging ₦150k+. Position accordingly: this is a "real online store," not "a website."

### 6.1 What to include in the base ₦70k–₦75k package

- Up to ~30 products, 1 delivery zone structure (e.g. 3 tiers), 1 payment gateway, 1–2 coupon codes at launch.
- Mobile-responsive storefront + admin panel access.
- 1 round of design revisions before handover.
- 7 days of free post-launch support for bug fixes (not new features).

### 6.2 Where the extra margin comes from (upsells, not the base price)

| Add-on                                                 | Price                 |
| ------------------------------------------------------ | --------------------- |
| Extra products beyond 30 (per 20)                      | ₦5,000 – ₦8,000       |
| Courier API integration (GIGL/Kwik/Sendbox)            | ₦15,000 – ₦25,000     |
| Monthly maintenance & support retainer                 | ₦7,000 – ₦15,000 / mo |
| Custom domain setup & DNS management                   | ₦5,000                |
| SEO basics (meta tags, sitemap, Google Business setup) | ₦10,000 – ₦20,000     |
| WhatsApp/Instagram catalogue sync                      | ₦10,000               |

### 6.3 Simple margin snapshot

If your reusable template already exists, a single build at ₦75,000 costing you roughly 4–8 hours of customisation time plus near-zero infrastructure cost (free tiers) is a strong hourly return — and every retainer or add-on you sell on top is close to pure margin, exactly like the ₦25k WordPress guys, just at a price that reflects real functionality.

## 7. Scaling to 50 Businesses a Month: Architecture & Payments

This is the right question to ask before writing a single line of code. If every one of the 50 sites is a separate Next.js deployment with its own database, your infrastructure cost and admin overhead scale roughly linearly with client count — and that erodes exactly the margin the ₦70k–₦75k price point is supposed to protect. The fix is architectural, not a pricing trick.

### 7.1 The problem with "one deployment per client"

- 50 separate Vercel projects and 50 separate Postgres databases means 50 things that can individually break, need updates, or quietly exceed a free tier.
- Free-tier hosting/database limits (Vercel, Neon, Supabase) are usually per-project, so at ~10–15 active client sites you start hitting paid tiers per project — cost now grows with every new client instead of staying flat.
- Rolling out a bug fix or new feature (e.g. a better coupon UI) means redeploying 50 separate codebases instead of one.

### 7.2 The fix: one multi-tenant application, not 50 apps

Build a single Next.js application that serves every client from shared infrastructure, with each business's data isolated by a tenant_id (or storeId) column on every table — products, orders, coupons, delivery zones all scoped to a tenant.

- One shared PostgreSQL database (a single paid Neon/Supabase instance, ~$25–69/mo, comfortably covers 50+ small stores) instead of 50 databases.
- One Vercel Pro deployment (~$20/mo) instead of 50 free-tier projects hitting limits.
- Each business gets a subdomain (client1.yourbrand.com) at zero extra cost, or a custom domain (client1.com) mapped via Vercel's domain settings — both routes to the same codebase, which reads the tenant from the domain/subdomain and serves the right branding and data.
- Onboarding a new client becomes a config task — create a tenant record, upload their branding, connect their payment subaccount (Section 7.3) — not a redeploy. This is what actually makes 50 a month operationally realistic.
- A fix or improvement ships once and every tenant gets it immediately — this is the compounding advantage a shared platform has over 50 independent WordPress installs.

### 7.3 Managing payments across many businesses

The critical rule: money should never pass through an account you control. You are not a licensed payment aggregator, and holding or routing client funds yourself creates real regulatory exposure (CBN payment service rules) and trust problems. Paystack and Flutterwave both solve this properly with a feature built exactly for platforms like this one.

- Paystack Subaccounts (and Flutterwave's equivalent Subaccounts/Split Payments): when you onboard a client, you create a subaccount for their business using their own bank account details. Every transaction on their store is initialized against their subaccount.
- The gateway automatically splits each payment at settlement — the business receives their share directly to their bank account, and your platform fee (flat or percentage) is routed to your own account automatically. You never touch the customer's or the client's money directly.
- This also opens a second revenue model worth considering at 50-clients scale: instead of (or alongside) a flat ₦75k build fee, you could take a small automatic transaction fee (e.g. 0.5–1%) via the split — recurring revenue that scales with each client's actual sales, with zero extra manual work per transaction.
- Each client still sees their own Paystack/Flutterwave dashboard for their subaccount, so they retain full visibility into their own money — this matters a lot for trust when you're managing 50 relationships at once.

### 7.4 Reconciliation at scale

- Run a single webhook endpoint in your multi-tenant app that receives events from Paystack/Flutterwave for every client's transactions.
- Identify which tenant a transaction belongs to using the subaccount code or a tenant_id you pass in the transaction's metadata field at initialization — this lets one webhook handler safely reconcile orders across all 50 stores without cross-contamination.
- Always verify server-side against the gateway's API using the transaction reference before marking any order paid, exactly as in Section 3.2 — this doesn't change at scale, it just needs to be tenant-aware.
- Log every webhook event before processing it (even if processing later fails) — at 50 clients' worth of transaction volume, an unlogged failed webhook is real money you can't easily trace back.

### 7.5 Updated cost math at 50 clients/month

With the multi-tenant architecture above, your infrastructure cost stops scaling per-client and becomes a small shared platform overhead:

| Item                                                               | Cost / Time                                    |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| Vercel Pro (single deployment, all tenants)                        | ~~₦32,000 / mo (~~$20)                         |
| Shared Postgres (Neon/Supabase paid tier)                          | ~~₦40,000 – ₦110,000 / mo (~~$25–69)           |
| Image hosting (Cloudinary, generous free tier covers many tenants) | ₦0 – minimal                                   |
| Domains (client-specific, if not using subdomains)                 | ₦6,000 – ₦15,000 / yr per client who wants one |
| Your time per new client onboarding (config, not a rebuild)        | 1–3 hrs                                        |

At 50 clients billed ₦75,000 each, gross revenue is ₦3,750,000/month. Shared infrastructure at this scale is roughly ₦75,000–₦150,000/month total — under 4% of revenue — versus the same infrastructure cost being spread over far fewer clients (or duplicated 50 times) under the one-deployment-per-client model. The multi-tenant rebuild is what makes the 50-a-month target arithmetically sound rather than just aspirational.

## 8. What Actually Makes This Repeatable

- Template, not custom build: your second, third, and fiftieth client should mostly be reskinning + reseeding data, not rewriting checkout logic.
- A tight discovery form: the less back-and-forth needed to gather product data, colours, and delivery zones, the faster each build.
- A documented checklist (Section 4) so any future hire (VA or junior dev) can execute the build under your supervision.
- Own the payment verification logic once, well, and never touch it per-client — this is the highest-risk part of the whole system and the one place where cutting corners actually costs someone money.

## 9. Prisma Schema Scaffold: Multi-Tenant Data Model

This is the actual data model for the architecture described in Section 7 — one shared database, every tenant-owned table scoped by a tenantId column and index. It covers products, orders, order items, coupons, and delivery zones, plus the Tenant model itself, which is where the Paystack/Flutterwave subaccount codes live.

### 9.1 Design decisions worth understanding, not just copying

- Money is stored as an integer in kobo (priceKobo, totalKobo, etc.), never as a Float — floating-point currency math produces rounding errors that compound across thousands of orders.
- Coupon codes are unique per tenant (@@unique([tenantId, code])), not globally — two different businesses can both run a WELCOME10 code without collision.
- Order.paymentReference is globally unique and is the value you pass to Paystack/Flutterwave at checkout — this is what makes the webhook handler in Section 7.4 idempotent, since a duplicate webhook for the same reference simply finds an already-verified order and does nothing.
- OrderItem.unitPriceKobo snapshots the price at the moment of purchase, deliberately duplicating data already on Product — this protects historic order records from silently changing if the tenant edits a product's price later.
- Every relation to Tenant uses onDelete: Cascade, so removing a tenant (e.g. a client who churns) cleanly removes their products, orders, and coupons without leaving orphaned rows.

### 9.2 schema.prisma

```prisma
// ─────────────────────────────────────────────────────────────
// Multi-tenant e-commerce schema
// Every business (tenant) shares this database. Every table that
// holds tenant-owned data carries a `tenantId` column + index so
// queries stay fast and isolated as client count grows.
// ─────────────────────────────────────────────────────────────

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrderStatus {
  PENDING // order created, payment not yet confirmed
  PAID // server-side verified with Paystack/Flutterwave
  SHIPPED
  DELIVERED
  CANCELLED
}

enum CouponType {
  PERCENTAGE
  FIXED
}

enum DeliveryMethod {
  PICKUP
  ZONE_DELIVERY
  COURIER_API
}

// One row per business using the platform.
// Holds branding + the payment subaccount that makes split
// payments possible (Section 7.3 of the breakdown doc).
model Tenant {
  id                       String   @id @default(cuid())
  name                     String
  slug                     String   @unique // e.g. "adaobi-store" -> adaobi-store.yourbrand.com
  customDomain             String?  @unique // optional: adaobistore.com
  logoUrl                  String?
  primaryColor             String?
  paystackSubaccountCode   String? // ACCT_xxx — created when tenant is onboarded
  flutterwaveSubaccountId  String?
  platformFeePercent       Decimal  @default(0) @db.Decimal(5, 2) // e.g. 1.00 = 1% platform cut
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  products      Product[]
  orders        Order[]
  coupons       Coupon[]
  deliveryZones DeliveryZone[]
  users         TenantUser[]

  @@index([slug])
}

// Admin/staff logins for a tenant's own dashboard.
model TenantUser {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email        String
  passwordHash String
  role         String   @default("owner") // "owner" | "staff"
  createdAt    DateTime @default(now())

  @@unique([tenantId, email])
  @@index([tenantId])
}

model Product {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  description String?
  priceKobo   Int // money stored as integer kobo — never use Float for currency
  stock       Int      @default(0)
  imageUrl    String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orderItems OrderItem[]

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model DeliveryZone {
  id       String  @id @default(cuid())
  tenantId String
  tenant   Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name     String // e.g. "Lagos Mainland"
  feeKobo  Int
  isActive Boolean @default(true)

  orders Order[]

  @@index([tenantId])
}

model Coupon {
  id           String     @id @default(cuid())
  tenantId     String
  tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  code         String
  type         CouponType
  value        Int // percentage (0-100) OR fixed amount in kobo, per `type`
  minOrderKobo Int?       @default(0)
  maxUses      Int?
  timesUsed    Int        @default(0)
  expiresAt    DateTime?
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())

  orders Order[]

  @@unique([tenantId, code]) // codes only need to be unique per-tenant, not globally
  @@index([tenantId])
}

model Order {
  id       String      @id @default(cuid())
  tenantId String
  tenant   Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  status   OrderStatus @default(PENDING)

  customerName  String
  customerEmail String
  customerPhone String

  deliveryMethod  DeliveryMethod @default(ZONE_DELIVERY)
  deliveryZoneId  String?
  deliveryZone    DeliveryZone?  @relation(fields: [deliveryZoneId], references: [id])
  deliveryAddress String?
  deliveryFeeKobo Int            @default(0)

  couponId     String?
  coupon       Coupon? @relation(fields: [couponId], references: [id])
  discountKobo Int     @default(0)

  subtotalKobo Int
  totalKobo    Int

  // The reference you generate and pass to Paystack/Flutterwave at
  // checkout. Unique so a webhook can never double-apply a payment.
  paymentReference  String    @unique
  paymentVerifiedAt DateTime?

  items OrderItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([paymentReference])
}

model OrderItem {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id])

  quantity      Int
  unitPriceKobo Int // snapshot of the price at purchase time —
  // never re-read live product price for a historic order,
  // or a later price change silently rewrites past receipts.

  @@index([orderId])
  @@index([productId])
}
```

### 9.3 Guarding against cross-tenant data leaks

The schema enforces the relationships, but it's still possible to write a Prisma query that forgets to filter by tenantId — which in a shared database means one business could theoretically see another's orders. The safest pattern is to never call the base Prisma client directly in route handlers; instead, wrap it in a small helper that forces the tenant filter:

```typescript
// lib/tenant-db.ts
// Every query made through this helper is automatically
// scoped to one tenant — route handlers never touch the
// raw Prisma client directly.

import { prisma } from './prisma';

export function tenantDb(tenantId: string) {
  return {
    product: {
      findMany: (args = {}) =>
        prisma.product.findMany({
          ...args,
          where: { ...(args as any).where, tenantId },
        }),
    },
    order: {
      findMany: (args = {}) =>
        prisma.order.findMany({
          ...args,
          where: { ...(args as any).where, tenantId },
        }),
    },
    // repeat for coupon, deliveryZone, etc.
  };
}
```

Even a thin wrapper like this removes an entire class of bugs — a route handler that forgets to add tenantId to a where clause simply can't leak another tenant's data, because the helper adds it automatically.

## 10. Subdomain Tenant-Routing Middleware

This is what makes one deployment serve every client's storefront (Section 7.2). Middleware inspects the incoming hostname on every request: a subdomain (client1.yourbrand.com) resolves to a tenant slug with zero database lookups since the slug is literally in the hostname; a custom domain (client1.com) is resolved through a cached Route Handler, since middleware runs on the Edge runtime and can't call Prisma directly.

### 10.1 middleware.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';

// The domain your platform sells subdomains under, e.g. "yourbrand.com"
// -> a tenant's storefront lives at "{slug}.yourbrand.com"
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'yourbrand.com';

// Skip static assets entirely. API routes ARE matched — they need the
// tenant header too, they just don't get path-rewritten (see below).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = (req.headers.get('host') ?? '')
    .replace(':3000', '')
    .replace(':443', '');

  // Root domain / www -> your own marketing site, not a tenant storefront.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.next();
  }

  const tenantSlug = hostname.endsWith(`.${ROOT_DOMAIN}`)
    ? hostname.replace(`.${ROOT_DOMAIN}`, '')
    : await resolveCustomDomain(hostname, req);

  if (!tenantSlug) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url));
  }

  // API routes: attach the tenant header, don't rewrite the path — route
  // handlers live at a shared /api/** path regardless of which storefront
  // called them.
  if (url.pathname.startsWith('/api')) {
    const res = NextResponse.next();
    res.headers.set('x-tenant-slug', tenantSlug);
    return res;
  }

  // Page routes: rewrite into a single shared dynamic segment so one
  // codebase renders every tenant's storefront.
  const rewrittenUrl = new URL(
    `/_sites/${tenantSlug}${url.pathname}${url.search}`,
    req.url,
  );
  const res = NextResponse.rewrite(rewrittenUrl);
  res.headers.set('x-tenant-slug', tenantSlug);
  return res;
}

// Subdomains resolve to a slug with zero lookups (it's literally in the
// hostname). Custom domains need a DB lookup — but middleware runs on the
// Edge runtime, so we go through a cached Route Handler instead of calling
// Prisma directly here.
async function resolveCustomDomain(
  hostname: string,
  req: NextRequest,
): Promise<string | null> {
  try {
    const lookup = await fetch(
      new URL('/api/internal/resolve-domain', req.url),
      {
        headers: { 'x-lookup-host': hostname },
        next: { revalidate: 300 }, // cache the mapping at the edge for 5 minutes
      },
    );
    if (!lookup.ok) return null;
    const data = (await lookup.json()) as { slug: string | null };
    return data.slug;
  } catch {
    return null;
  }
}
```

### 10.2 Custom domain lookup — app/api/internal/resolve-domain/route.ts

Middleware caches this response for 5 minutes at the edge, so a custom domain only actually hits the database on a cache miss, not on every request.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Node runtime (not Edge) so it can talk to Prisma directly. Middleware
// calls this with the incoming hostname and caches the response for 5
// minutes, so this only actually hits the DB on a cache miss.
export async function GET(req: NextRequest) {
  const hostname = req.headers.get('x-lookup-host');
  if (!hostname) {
    return NextResponse.json({ slug: null }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { customDomain: hostname },
    select: { slug: true },
  });

  return NextResponse.json(
    { slug: tenant?.slug ?? null },
    {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    },
  );
}
```

### 10.3 Tenant layout — app/_sites/[tenant]/layout.tsx

Every storefront page renders under this layout, which resolves the actual Tenant record (branding, id) from the URL segment the middleware rewrote into. Deriving the tenant from the URL rather than trusting a header alone means a page can't accidentally render with the wrong tenant's data even if a header were ever missing or bypassed.

```typescript
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TenantProvider } from '@/lib/tenant-context';

// app/_sites/[tenant]/layout.tsx
// Every storefront page renders through here. The tenant record (branding,
// id) is resolved once per request from the URL segment the middleware
// rewrote into — not from a header alone — so a page can never render with
// the wrong tenant's data even if middleware is ever bypassed in some path.
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: params.tenant } });

  if (!tenant) {
    notFound();
  }

  return <TenantProvider tenant={tenant}>{children}</TenantProvider>;
}
```

## 11. Checkout & Payment Verification Routes

Three pieces work together here: a checkout route that re-prices the cart entirely server-side, a shared verification helper that is the single source of truth for "is this order actually paid," and a webhook that acts as the trusted reconciliation path regardless of what the customer's browser does after paying.

### 11.1 Checkout — app/api/checkout/route.ts

The client sends product IDs and quantities; every price, delivery fee, and discount is recalculated from the database. A client-supplied total is never trusted — this is what stops someone from paying ₦500 for a ₦5,000 item by editing a request in the browser.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

type CheckoutItem = { productId: string; quantity: number };

type CheckoutPayload = {
  items: CheckoutItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: 'PICKUP' | 'ZONE_DELIVERY' | 'COURIER_API';
  deliveryZoneId?: string;
  deliveryAddress?: string;
  couponCode?: string;
};

// app/api/checkout/route.ts
// Creates a PENDING order with a server-computed total. The client sends
// what's in the cart; it never gets to say what anything costs.
export async function POST(req: NextRequest) {
  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) {
    return NextResponse.json(
      { error: 'Missing tenant context' },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body = (await req.json()) as CheckoutPayload;

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  // Re-price every line item from the DB — ignore any price the client sent.
  const productIds = body.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id, isActive: true },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: 'One or more items are unavailable' },
      { status: 400 },
    );
  }

  let subtotalKobo = 0;
  const orderItemsData = body.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new Error('Product missing after lookup');
    }
    if (product.stock < item.quantity) {
      throw new Error(`${product.name} is out of stock`);
    }
    subtotalKobo += product.priceKobo * item.quantity;
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPriceKobo: product.priceKobo,
    };
  });

  let deliveryFeeKobo = 0;
  if (body.deliveryMethod === 'ZONE_DELIVERY') {
    if (!body.deliveryZoneId) {
      return NextResponse.json(
        { error: 'Delivery zone is required' },
        { status: 400 },
      );
    }
    const zone = await prisma.deliveryZone.findFirst({
      where: { id: body.deliveryZoneId, tenantId: tenant.id, isActive: true },
    });
    if (!zone) {
      return NextResponse.json(
        { error: 'Invalid delivery zone' },
        { status: 400 },
      );
    }
    deliveryFeeKobo = zone.feeKobo;
  }

  let discountKobo = 0;
  let couponId: string | null = null;
  if (body.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: body.couponCode } },
    });

    const isValid =
      coupon &&
      coupon.isActive &&
      (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
      (coupon.maxUses === null || coupon.timesUsed < coupon.maxUses) &&
      subtotalKobo >= (coupon.minOrderKobo ?? 0);

    if (!isValid || !coupon) {
      return NextResponse.json(
        { error: 'Coupon is invalid or expired' },
        { status: 400 },
      );
    }

    const rawDiscount =
      coupon.type === 'PERCENTAGE'
        ? Math.round((subtotalKobo * coupon.value) / 100)
        : coupon.value;
    discountKobo = Math.min(rawDiscount, subtotalKobo);
    couponId = coupon.id;
  }

  const totalKobo = subtotalKobo - discountKobo + deliveryFeeKobo;
  const paymentReference = `ord_${tenant.slug}_${randomUUID()}`;

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      deliveryMethod: body.deliveryMethod,
      deliveryZoneId: body.deliveryZoneId ?? null,
      deliveryAddress: body.deliveryAddress ?? null,
      deliveryFeeKobo,
      couponId,
      discountKobo,
      subtotalKobo,
      totalKobo,
      paymentReference,
      items: { create: orderItemsData },
    },
  });

  // The frontend uses these to launch Paystack Inline/Popup directly —
  // amount and reference are both server-computed, never client-supplied.
  return NextResponse.json({
    orderId: order.id,
    paymentReference,
    amountKobo: totalKobo,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    subaccountCode: tenant.paystackSubaccountCode,
  });
}
```

### 11.2 Shared verification logic — src/lib/payments/verify-order.ts

Both the client-triggered verify call and the webhook call this same function, so the actual "mark this order paid" logic exists in exactly one place. It re-checks the amount paid against the order's stored total before ever touching stock or order status.

```typescript
import { prisma } from '@/lib/prisma';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

// src/lib/payments/verify-order.ts
// The single source of truth for "is this order actually paid." Called from
// two places — the client-triggered verify route (Section below) and the
// Paystack webhook — so verification logic exists in exactly one place and
// can't drift between the two paths.
export async function verifyAndFulfillOrder(reference: string) {
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Order not found for this payment reference');
  }

  // Idempotency: whichever path (client callback or webhook) gets here
  // first wins; the other finds an already-PAID order and does nothing.
  if (order.status === 'PAID') {
    return order;
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    throw new Error('Could not reach Paystack to verify this transaction');
  }

  const payload = await res.json();
  const transaction = payload?.data;

  const paidSuccessfully = transaction?.status === 'success';
  // Confirm the amount actually charged matches what we computed at
  // checkout — this is what stops someone from paying for a cheaper item
  // and replaying the reference against a more expensive order.
  const amountMatches = transaction?.amount === order.totalKobo;

  if (!paidSuccessfully || !amountMatches) {
    throw new Error(
      'Payment could not be verified against the expected order amount',
    );
  }

  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { timesUsed: { increment: 1 } },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paymentVerifiedAt: new Date() },
    });
  });
}
```

### 11.3 Client verify route — app/api/payments/verify/route.ts

Called by the frontend right after Paystack's popup reports success. This is a fast-path for a responsive UI, not the source of truth.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAndFulfillOrder } from '@/lib/payments/verify-order';

// app/api/payments/verify/route.ts
// Called by the frontend immediately after Paystack's popup reports
// success. This is a courtesy fast-path for the UI — the webhook below is
// the path that's actually trusted to run even if the customer closes the
// tab before this request completes.
export async function POST(req: NextRequest) {
  const { reference } = (await req.json()) as { reference: string };

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  try {
    const order = await verifyAndFulfillOrder(reference);
    return NextResponse.json({ status: order.status, orderId: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### 11.4 Paystack webhook — app/api/webhooks/paystack/route.ts

This is the path that's actually trusted to run no matter what happens in the customer's browser. Signature verification (HMAC-SHA512 against the raw request body) confirms the event genuinely came from Paystack before any order is touched.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAndFulfillOrder } from '@/lib/payments/verify-order';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

// app/api/webhooks/paystack/route.ts
// This is the trusted reconciliation path (Section 7.4 of the breakdown
// doc) — it runs regardless of whether the customer's browser ever made it
// back to /api/payments/verify.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'charge.success') {
    const reference = event.data?.reference;
    if (reference) {
      // Reuses the exact same verify-and-fulfill logic as the client route
      // above — same idempotency guarantee, so a webhook that arrives after
      // the client already verified the order simply no-ops.
      await verifyAndFulfillOrder(reference).catch((err) => {
        console.error(`Webhook fulfillment failed for ${reference}:`, err);
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

## 12. Suggested Next Step

With multi-tenant routing and a verified checkout flow both in place, the pieces still missing before the first paying client are: the tenant admin panel (product CRUD, order status updates, coupon management — Section 3.5), the tenant onboarding flow that actually creates a Paystack subaccount and writes it to Tenant.paystackSubaccountCode, and a Flutterwave equivalent of the verify/webhook pair if you want to offer both gateways. An AGENT.md file for this codebase — covering stack, conventions, and the multi-tenant/payment rules established across this document — is a good next artifact so any future contributor (human or AI) follows the same rules automatically.
