# Multi-Tenant Commerce Platform — Build Plan

Derived from `Custom_Ecommerce_Build_Pricing_Breakdown.md`, `AGENT.md`, `schema.prisma`, and `multi-tenant-routing-and-checkout/`.

**Read Part 0 first.** The reference code in those files is architecturally right and implementationally unsafe. Building on it as-is ships four exploitable bugs to every tenant simultaneously — which is the specific failure mode a shared platform has and 50 independent WordPress sites don't.

---

## Status

Gate green: `pnpm lint` (0 errors), `pnpm typecheck`, `pnpm test` (**79 passing**), `pnpm test:e2e` (**7 passing**, against the live Paystack test gateway), `pnpm build` (39 routes).

**Database live.** Neon `multi-tenant-commerce` (`bitter-flower-98157633`), migration applied, two demo tenants seeded.

**Paystack live.** Keys populated and verified in TEST mode (`pnpm check:paystack`). Both demo tenants now hold real subaccounts issued by Paystack — `adaobi-store` → `ACCT_hmdy4nq66m9sssz`, `chidi-electronics` → `ACCT_9qmqqx75qj2t0fs`. The fake `ACCT_seed_*` values the seed script writes are gone; note that `prisma/seed.ts` still writes them, so a re-seed reintroduces stores that 503 at checkout.

**Complete:** M0, M1 (12 isolation tests vs live Postgres — exit met), M2, M3 (Clerk identity + page/API authorization split), M4 products CRUD + all store APIs (orders, coupons, zones) with status-transition rules and rate limiting, M5 storefront (grid, PDP, cart, checkout, confirmation), **M6 checkout + payments — exit met against the live gateway**, **M7 platform onboarding — exit met**.

**Still blocked on credentials:** Clerk keys are empty, so the platform surface runs on the temporary dev keys `@clerk/nextjs` provisions automatically. Consequences worth knowing:

- `PlatformUser` and `TenantUser` are both **empty**, so no dashboard is reachable by anyone. The first operator is created out of band with `pnpm grant:admin <clerkUserId> <email>` — there is deliberately no in-app route that grants platform rights.
- Clerk's bot protection (Cloudflare Turnstile) blocks automated sign-up, so **the dashboard UI has never been driven end to end**. Its API and data layers have been; the screens themselves have only been type-checked and built.

**Marketing site live.** `src/app/(marketing)/**` now holds the real home page and `/pricing` — the latter was a 404 that `ROUTES.pricing` had always linked to. Built from the design canvas in `docs/design/canvas/`, against the existing token set (the deep greens are the sidebar gradient's own stops, promoted to `forest-*` tokens). Copy, prices and the brand name come from `src/constant/marketing.ts`; the brand is still `[BRAND]` and the price is still a placeholder, deliberately.

**SEO layer built.** `metadataBase`, canonicals, `robots.ts` with a preview-deploy guard, a platform sitemap, per-tenant `robots.txt` and `sitemap.xml`, and JSON-LD for Organization, WebSite, FAQPage, Store/LocalBusiness, Product, Offer and BreadcrumbList. Status and what is left in `docs/design/SEO-PLAN.md`. This closed a live duplicate-content bug: a tenant with a verified custom domain was reachable at two hosts serving identical HTML with no canonical on either.

**`PlatformEarning` added.** Until now the platform's own revenue existed only inside Paystack — verified by pulling a real transaction, where a ₦6,000 order split `{paystack: 19000, integration: 6000, subaccount: 575000}` and nothing in our database recorded the ₦60. `Order` now snapshots `platformFeeKobo` and `platformFeePercent` at checkout (the rate can change while a customer is on the payment screen), and `verifyAndFulfillOrder` writes one `PlatformEarning` row inside the same conditional `PENDING → PAID` claim that guards the stock decrement, so it is exactly-once under a race.

**Clerk dev-handshake fixed.** `clerkMiddleware` ran on every platform-host request including `/`, so on a development instance the marketing home answered the first browser request with a 307 to `<instance>.clerk.accounts.dev/v1/client/handshake` — a bounce on the very first page every visitor lands on. `proxy.ts` now has an `isClerkRoute` matcher; Clerk wraps `/dashboard`, `/sign-in`, `/sign-up`, `/api/stores`, `/api/platform` and `/__clerk` only. Marketing serves 200 with zero Clerk references in the HTML. **Keep that matcher in sync** — a route that calls `auth()` and is missing from it fails closed.

**Image upload works — the earlier note here saying otherwise was wrong.** Verified end to end against the live Cloudinary account (`hjdbv8tx`): the widget signs through `/api/stores/{slug}/uploads/signature` (401 without a session), the asset lands in `tenants/{slug}/products/`, the **public ID** — not a delivery URL — is stored on `Product.imageUrls`, and the storefront renders it as an `f_auto/q_auto` responsive srcset from `res.cloudinary.com`. One real asset exists today on `silk-head-wrap`; it is a 1x1 smoke-test PNG, so the pipeline is proven but no store has real photography yet.

The folder is the security boundary. A signature is a capability, so signing a client-supplied `folder` unchanged would let one store overwrite another's assets — the signature route derives the folder from the authorized tenant and rejects anything else, and `isOwnedBy()` stops a store typing a foreign public ID straight into a product payload.

**Remaining:** orders/coupons/zones admin _views_ (APIs done), email (M8), the rest of the E2E suite (M9 — checkout is covered, nothing else is), OG images, the subdomain → custom-domain 301, and image-URL import beyond the CSV path.

**Storefront themes shipped (3).** `Tenant.theme` selects `CLASSIC`, `EDITORIAL` or `UTILITY` — a bounded enum, one shared bundle, no per-tenant CSS. Tokens live in `src/constant/storefront-themes.ts` and are applied as custom properties on the storefront root exactly like `--brand`; the `st-*` classes in `globals.css` consume them. The markup is identical on all three, which is the whole point: one cart, one checkout, one fulfillment path, verified once. The operator picks a look at onboarding from a picker whose thumbnails are drawn from the theme config itself, so they cannot drift from the storefront they describe.

The strongest differentiator is `--st-product-aspect` (3:4 on EDITORIAL) — a garment shot portrait and cropped square loses the garment. `UTILITY` shows SKUs and a louder price because its shopper is comparing, not browsing. Each theme has its own typeface, declared `preload: false` so a browser downloads only the family its store references: per-store cost is one family, the same as the brief's one-typeface recommendation. Reverse that if a seeded store drops below Lighthouse mobile 90.

Deliberately still true under themes: the tenant colour stays a controlled accent. `UTILITY` spends the most of it and that is a 2px rule under the header, not a band — an unreviewed `primaryColor` behind white text is the failure the brief warned about.

**What themes are NOT:** a licence to fork. A theme may change layout, density, shape and typography. It may not change data, routes or business logic. The next honest step for merchant differentiation is not a fourth theme — it is `ProductVariant` (a fashion tenant cannot sell a dress in S/M/L today) and rendering `Category` on the storefront. Those are schema problems wearing a design costume, and they will lose more clients than any grid will win.

**Product variants shipped.** `Product.optionName` + `ProductVariant` — one axis (Size, Colour, Weight), not a Size x Colour matrix, because one axis covers a dress in S/M/L, a shoe in 39-44 and rice in 5kg/10kg while a matrix multiplies the admin UI and the CSV import for the minority that need two. A seller who genuinely needs both lists "Red / Small" as a value.

The load-bearing rule: **stock lives on the variant once a product has any**, and `Product.stock` is then ignored entirely rather than denormalised — the copy that drifts is always the one checkout reads. `src/lib/products/variants.ts` is the single source of truth for price and availability, used by the grid, the product page and `/api/checkout` alike, so a shopper cannot be quoted one price and charged another.

Checkout rejects a variant mismatch in both directions and resolves the variant from the already-loaded tenant-scoped `product.variants` rather than by a bare id lookup. `verifyAndFulfillOrder` decrements the variant row under the same conditional guard the product path uses. Covered by a new E2E test that buys size M through the real Paystack gateway and asserts size L did not move — 7/7 passing, plus 17 new unit tests.

Two things the merchant-facing side gained: an options editor with presets (typing S, M, L, XL across thirty products is what turns a one-hour onboarding into three), and a marketing section at `/#looks` showing all three storefront themes, previewed from the theme config itself so the marketing site cannot promise a look the storefront does not render.

**Categories shipped, closing that gap.** `Category` existed in the schema from the first migration and was reachable from nothing — no API, no field in the product form, no storefront rendering. Now: `GET|POST /api/stores/{slug}/categories` plus `PATCH|DELETE` on one, a picker in the product form with **inline create** (a merchant adding thirty products must never abandon a half-filled form to go and define "Dresses" elsewhere — that round trip is why the column sat unused), a scrollable category strip on the catalogue, and indexable `/categories/{slug}` pages carrying their own canonical and BreadcrumbList.

Category pages are real routes rather than a query filter, and they are listed in the tenant sitemap **above** products: a category is the broadest term a store will ever rank for. Verified isolated — `dresses` 404s on the electronics store's host.

Closed while building it: `Product.categoryId` is a plain foreign key, so Postgres would accept **another tenant's** category id. Both product routes now resolve it through `tenantDb` first — the same class of check `isOwnedBy()` performs for Cloudinary public IDs.

**CSV bulk import shipped.** §4 named it as the thing that saves hours per client, and it is what makes a 1–3 hour onboarding realistic instead of thirty trips through a form. `/dashboard/stores/{slug}/products/import`: download a template, pick a file, **preview**, then commit. Only `name` and `price` are required; headers match case- and space-insensitively so an existing spreadsheet usually works untouched. Categories are created on the fly, variants come in as `S=4;M=6;L=3;XL=2@28000`, and images arrive as `https://` URLs that **Cloudinary fetches** — the bytes never touch our server, and a merchant's spreadsheet cannot make us request an internal address.

The CSV reader is hand-written (`src/lib/csv.ts`, ~40 lines) rather than a dependency: a split on commas corrupts the first product whose description contains one, and Excel's BOM otherwise becomes part of the first header so `name` silently stops matching. 22 unit tests cover quoting, escapes, embedded newlines, CRLF, the BOM, money formats, the variant grammar and slug collisions _within_ the file — checking only the database imports the first half and fails mid-run.

Verified against the live database: a three-row file with a quoted comma-bearing description and `₦45,000` produced Kaftan Set (Size S/M/L/XL, XL at ₦48,000, product stock zeroed), Leather Sandals (39/40/41) and Aso-Oke Gele, all filed into the right categories and rendering on the storefront with an AggregateOffer.

**Two storefront bugs fixed.** Cart thumbnails rendered broken because the cart stores a Cloudinary **public ID** and the line item used a bare `<img src>`, which the browser resolved as a relative path — it now goes through `ProductImage` like every other surface. And the uploader silently kept only the last image of a batch: `CldUploadWidget` retains the first `onSuccess` it is given, so a callback closing over `images` kept seeing the array as it was on first render. Latest-ref pattern, synced in an effect. Merchants can now add up to 8 and promote any of them to cover.

**Merchant mobile app planned.** React Native (Expo), iOS + Android, sharing one workspace with the web app — `docs/MOBILE_PLAN.md`. Scoped deliberately to four screens (today, orders, products, add-product-with-camera) rather than a dashboard port: the long tail stays on the web and is deep-linked, because every screen in the app is a screen maintained twice forever.

The audit that shaped it: `lib/products/variants.ts`, the Zod validators, `csv.ts`, `domains/hostname.ts` and `media/folder.ts` are already portable — `variants.ts` was written Prisma-free so it could run in a Client Component, and that same property makes it run in React Native untouched. What does not port is the UI: 14 Radix packages, 36 primitives and 17 Formik fields, all DOM-bound. The keystone is `src/generated/prisma/enums.ts` — pure TypeScript with zero imports, so re-exporting it from the shared package is what stops the two apps disagreeing about what `PAID` means.

Two things flagged as gating: Clerk bearer-token auth for the API (unverified against the installed v7 build — spike it day one), and the fact that **a mobile client is not versioned by your deploy**, which makes API responses additive-only and a minimum-version gate a pre-v1 requirement rather than a nice-to-have.

**Undecided, and blocking nothing yet:** the pricing model. The marketing site ships model A (BUILD_PLAN D4 — flat build fee, `platformFeePercent` 0, "0% of your sales" on the page). Model B (subscription-first, free tier taking a percentage) is designed on the canvas but needs `Plan` / `Subscription` / `PlatformInvoice` and a card-on-file billing loop that does not exist. Do not put a figure on the pricing page that `Tenant.platformFeePercent` does not agree with.

---

## Part 0 — Findings in the reference code

These are not style notes. Each one is a concrete failure with a concrete trigger.

### 0.1 SECURITY — Tenant identity is forgeable (`middleware.ts`)

Two defects compound into a cross-tenant data breach.

**Defect A — the header never arrives.** `res.headers.set('x-tenant-slug', ...)` sets a header on the _response_. Route handlers read `req.headers.get('x-tenant-slug')` — the _request_. That value is always `null`, so `/api/checkout` returns `400 Missing tenant context` for every request. Checkout is non-functional as written.

**Defect B — and when you fix A the naive way, the header becomes spoofable.** The root-domain branch returns early:

```ts
if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
  return NextResponse.next(); // inbound headers pass through untouched
}
```

So `POST https://yourbrand.com/api/checkout` with a hand-set `x-tenant-slug: victims-store` header reaches the handler with an attacker-chosen tenant. Once route handlers trust that header, this reads and writes another business's data.

**Fix — strip inbound, then set, on every path without exception:**

```ts
function withTenant(req: NextRequest, slug: string | null) {
  const headers = new Headers(req.headers);
  headers.delete('x-tenant-slug'); // an inbound value is ALWAYS hostile
  if (slug) headers.set('x-tenant-slug', slug);
  return headers;
}
// every return path: NextResponse.next({ request: { headers: withTenant(req, slug) } })
```

The `delete` is not redundant with `set` — it is what protects the early-return branches where no slug exists to overwrite it.

### 0.2 SECURITY — Negative quantities invert the cart total (`app/api/checkout/route.ts`)

There is no validation on `quantity`, despite `AGENT.md` mandating Zod on all input:

```ts
subtotalKobo += product.priceKobo * item.quantity; // quantity: -5 is accepted
```

Cart of one ₦50,000 item plus the same item at `quantity: -49` produces a subtotal of ₦0. `product.stock < item.quantity` passes trivially for negatives. Total is server-computed, so every downstream check agrees the order is legitimately ₦0.

**Fix:** Zod at the boundary — `z.number().int().min(1).max(99)` — plus a `subtotalKobo > 0` assertion before the order is created.

### 0.3 SECURITY — The customer chooses what to pay

Checkout returns `publicKey` + `amountKobo` and the frontend launches Paystack Inline with them. Paystack Inline takes its amount **from the browser**. An attacker edits it to ₦100, pays, and `verifyAndFulfillOrder` correctly rejects the mismatch — but the card was already charged. You now have a real payment against an order that will never be fulfilled, on the tenant's subaccount, requiring a manual refund. Every abandoned attempt is a support ticket and a chargeback risk.

**Fix — initialize server-side.** Call `POST https://api.paystack.co/transaction/initialize` from the checkout route with the amount, your generated reference, `subaccount`, and `metadata: { tenantId, orderId }`. Return the `access_code` to the browser and open the popup with `resumeTransaction(access_code)`. The amount is now pinned server-side and unreachable from the client. This also plants the `tenantId` in transaction metadata, which §7.4 of the breakdown doc calls for and the current code never actually does.

### 0.4 CORRECTNESS — Oversell and negative stock (`verify-order.ts`)

Stock is _checked_ when the order is created and _decremented_ when payment verifies — an unbounded window apart. Two customers buying the last unit both pass the check, both pay, both decrement:

```ts
data: {
  stock: {
    decrement: item.quantity;
  }
} // no floor, goes negative
```

**Fix — guarded atomic decrement inside the existing transaction:**

```ts
const { count } = await tx.product.updateMany({
  where: { id: item.productId, stock: { gte: item.quantity } },
  data: { stock: { decrement: item.quantity } },
});
if (count === 0) {
  /* see policy below */
}
```

**Policy decision, and it matters:** do _not_ fail the fulfillment. The customer has paid. Refusing to mark the order `PAID` means money taken and no record for the tenant to act on — strictly worse than overselling. Mark it `PAID`, set `hasStockIssue: true`, and surface it in the admin dashboard as "needs attention." The tenant refunds or backorders; you never silently lose a paid order.

### 0.5 CORRECTNESS — Coupon usage limits don't hold

`timesUsed: { increment: 1 }` is unconditional. Concurrent checkouts blow past `maxUses`. Prisma can't compare two columns in a `where`, so this one needs raw SQL:

```ts
const rows = await tx.$executeRaw`
  UPDATE "Coupon" SET "timesUsed" = "timesUsed" + 1
  WHERE id = ${order.couponId}
    AND ("maxUses" IS NULL OR "timesUsed" < "maxUses")`;
if (rows === 0) {
  /* coupon exhausted between checkout and payment — log, still fulfill */
}
```

### 0.6 CORRECTNESS — Duplicate cart lines are rejected as "unavailable"

```ts
if (products.length !== productIds.length)   // [{p1,q:1},{p1,q:1}] → 1 !== 2 → rejected
```

Any cart with the same product on two lines fails with a misleading error. **Fix:** merge quantities by `productId` before the lookup.

### 0.7 BROKEN — Middleware fetch caching is a no-op (`resolveCustomDomain`)

```ts
next: {
  revalidate: 300;
} // the Next Data Cache is not available in middleware
```

Every custom-domain request does an uncached round trip to your own origin, which then hits Postgres. That is a full extra serverless invocation per request on your highest-value tenants.

**This whole mechanism is now obsolete.** Next.js 16 renames `middleware.ts` → `proxy.ts` and **runs it on the Node.js runtime**. The Edge-runtime constraint that forced the `/api/internal/resolve-domain` indirection no longer exists. Call Prisma directly from `proxy.ts` behind an in-process TTL cache and delete the internal route.

### 0.8 BROKEN — Reserved and preview hostnames resolve as tenants

`my-app-git-main-xyz.vercel.app` becomes tenant slug `my-app-git-main-xyz`. So does `admin.yourbrand.com`. Needs an explicit reserved list (`www, app, admin, api, mail, blog, static, assets, cdn, docs, status`) and a `*.vercel.app` bypass.

### 0.9 GAP — Webhooks are logged nowhere and never retried

§7.4 of the breakdown doc says _"Log every webhook event before processing it (even if processing later fails) — an unlogged failed webhook is real money you can't easily trace back."_ The code does neither: no `WebhookEvent` table exists, and the handler swallows failures and returns `200`, which tells Paystack **not to retry**. A transient DB blip silently loses a paid order permanently.

**Fix:** persist the raw event before processing; return `500` on fulfillment failure so Paystack retries on its backoff schedule. Also use `crypto.timingSafeEqual` for the signature comparison instead of `!==`.

### 0.10 GAP — Coupon codes are brute-forceable

`/api/checkout` distinguishes "coupon invalid" from success, unauthenticated and unthrottled. Codes are short and guessable. Needs rate limiting and a dedicated throttled `/api/coupons/preview` endpoint.

### 0.11 BROKEN — The storefront rewrite target is not a route

Found while building, not by reading: **`app/_sites/[tenant]` never resolves.** In the App Router a folder whose name starts with `_` is a _private folder_, opted out of routing along with all its children. The pages compile, but Next emits no route for them, so `NextResponse.rewrite('/_sites/{slug}/...')` 404s in production.

Verified against a real build — before the rename, the route list had no `_sites` entry at all; after renaming to `sites`, `ƒ /sites/[tenant]` appears.

**Fix:** rename to `app/sites/[tenant]` (done), and have the proxy reject direct `/sites/**` requests, since it is an internal rewrite target rather than a public URL. Without that guard `yourbrand.com/sites/adaobi-store` would serve any tenant's storefront off the platform domain.

---

## Part 1 — Decisions (all resolved)

### D1 — Tenant admin location → **platform domain** ✅

`AGENT.md` originally placed admin at `_sites/[tenant]/admin/**`, on each tenant's storefront subdomain. That breaks auth: a cookie scoped to `.yourbrand.com` is sent to _every_ tenant subdomain, and custom-domain tenants can't share a platform cookie at all.

**Resolved: admin lives on the root domain at `/dashboard/stores/{slug}/**`.** One auth origin, one cookie, one login however many domains a tenant owns. Storefronts stay a purely public surface, so an XSS on a tenant's storefront cannot reach an admin session.

Chose `yourbrand.com/dashboard` over `app.yourbrand.com` because it needs no extra rewrite branch and mirrors the Ceviant back-office exactly. **D3 turned this into a five-figure decision** — see below.

Stores are addressed by slug in the URL rather than an implicit "active store" in session state: every page is deep-linkable, and `requireTenantMember()` authorizes against the URL itself.

### D2 — Prisma 7 ✅

Adopted. Note the docs understate the break: `url` in the datasource block is **removed, not deprecated**. Working configuration, verified:

- `generator client { provider = "prisma-client", output = "../src/generated/prisma" }`
- connection URLs in `prisma.config.ts`; Migrate takes `DIRECT_URL` (unpooled — migrations can't run through PgBouncer in transaction mode)
- runtime client takes a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- imports come from `@/generated/prisma/client`, never `@prisma/client`

### D3 — Auth → **Clerk for identity, `TenantUser` for tenancy** ✅

You asked whether Clerk can handle this business model. **Yes — but only under D1, and not the way Clerk markets it.**

**The disqualifying trap.** Clerk bills **satellite domains at $10/mo each**. If tenant admin lived on tenant subdomains or custom domains, every store needing an authenticated session is a satellite domain. At 50 new tenants/month that is **+$500/mo recurring, compounding monthly** — roughly $6,000/mo by month twelve, against infrastructure the plan budgets at ~$100/mo total. It would consume the margin the entire multi-tenant architecture exists to protect. Under D1 the count is **one domain, forever, $0**.

**Do not use Clerk Organizations.** This is the counter-intuitive part. Organizations look like the obvious fit — org = tenant — but Clerk prices them as **monthly retained organizations**: 100 included on Free, and the Enhanced B2B add-on is $100/mo. Organization count is precisely the axis your business grows on: you'd cross the free tier in month two and thereafter pay to acquire customers, on top of the build fee.

Meanwhile the thing Clerk actually bills on — **monthly active users** — is nearly free here. Storefront shoppers **never authenticate** (the schema has no `Customer` model; `Order` carries name/email/phone directly and checkout is guest-only). The only accounts are store owners and staff: ~2 per tenant, so ~1,200 users after a full year at 50/month, against a 50,000 MAU free allowance.

**Resolved:** Clerk for identity only — passwords, MFA, password reset, social login, the flows that are genuinely expensive to build correctly. Tenancy stays in our own `TenantUser` table, which your original schema already modelled. Cost stays flat at $0–25/mo regardless of tenant count, and identity stays portable: swapping Clerk out later means repointing `TenantUser.clerkUserId`, not re-architecting.

The one thing you build yourself is the staff-invite flow (~half a day). That is the whole price of avoiding a per-tenant pricing axis.

`TenantUser.passwordHash` is therefore **removed** — Clerk owns the credential. It becomes `clerkUserId`.

> Verify before committing: whether Pro includes unlimited organizations is the one number I could not pin down from public pricing pages. It does not affect this recommendation (we aren't using Organizations), but confirm with Clerk if you ever reconsider.

### D4 — Revenue model → **flat fee now, split-ready** ✅

Built for both, defaulted to neither being hard-coded. `Tenant.platformFeePercent` defaults to `0`, and checkout passes `transaction_charge` to Paystack only when it is non-zero. Setting a tenant's percentage is a data change, not a code change — so you can start on flat ₦75k builds and turn on a transaction split per tenant later without touching live subaccounts.

### D5 — Frontend architecture → **ported from Ceviant** ✅

You asked for the Ceviant back-office architecture on the frontend. Adopted, including its stack: **SWR + Formik + Yup**, not the React Query + React Hook Form + Zod that the original `AGENT.md` specified.

That reversal is deliberate. The value in reusing Ceviant is its ~39 UI primitives (`TableFactory`, `FilterPanel`, `SummaryCard`, `TabsNavigation`, `Stepper`) and 16 Formik-bound field components. **All of them are written against Formik.** Switching form libraries would mean rewriting every field component — discarding the entire reason for the port and costing roughly a week.

**Zod is retained for server boundaries only** — API input, webhook payloads. That split is not redundancy: Yup validates a human filling a form, Zod validates a hostile client, and finding 0.2 is exactly what happens when the second job goes undone.

---

## Part 2 — Reality check on the timeline

The pricing doc budgets **20–35 hours** for the reusable template. That covers roughly the checkout route and the middleware — the two things already drafted.

Realistically this is **150–200 hours** (~4–5 focused weeks) once you include auth, admin CRUD, storefront UI, onboarding, email, image upload, and the test coverage `AGENT.md` mandates for checkout/payments/tenant-resolution.

This doesn't damage the business case — amortized over 50 clients it's ~3 hours each, and the ₦70–75k pricing and 4–8h-per-client customisation estimate both still hold. It changes _when you can start selling_, not whether the margin works. Plan for a month before the first client, not a week.

---

## Part 3 — Revised data model

Changes against the supplied `schema.prisma`, with reasons:

| Change                                                       | Why                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `generator client` → `provider = "prisma-client"` + `output` | Prisma 7 (D2)                                                      |
| **New** `WebhookEvent`                                       | §7.4 requires it; nothing implements it (0.9)                      |
| **New** `PlatformUser`                                       | Nothing models _you_ — the operator who onboards tenants           |
| **New** `Category`                                           | Product browsing; unlocks category-scoped coupons later            |
| `TenantUser.role: String` → `enum TenantRole`                | `AGENT.md`: enums over string unions for bounded domains           |
| **New** `Tenant.status`                                      | Suspend a non-paying tenant without deleting their data            |
| **New** `Tenant.currency`, `contactEmail`, `whatsappNumber`  | Receipts, order notifications, storefront contact                  |
| **New** `Order.orderNumber` (per-tenant sequence)            | `paymentReference` is a cuid blob; humans need `#1042`             |
| **New** `Order.paymentProvider`                              | Two gateways — you must know which one settled                     |
| **New** `Order.hasStockIssue`                                | The oversell escape hatch from 0.4                                 |
| **New** `OrderItem.productName`                              | Snapshot alongside price; a deleted product must not erase history |
| `Order.deliveryZone` / `coupon` → `onDelete: SetNull`        | Deleting a zone with historic orders currently throws              |
| `OrderItem.product` → `onDelete: Restrict` (explicit)        | Prevent silent history loss                                        |
| **New** `@@index([tenantId, createdAt])` on `Order`          | Every admin order list sorts by date within a tenant               |

Everything the original schema got right stays untouched: integer kobo, `@@unique([tenantId, code])` and `([tenantId, slug])`, globally-unique `paymentReference`, `unitPriceKobo` snapshots, cascade-on-tenant-delete. Those are the load-bearing decisions and they're correct.

```prisma
enum TenantStatus { ACTIVE SUSPENDED ONBOARDING }
enum TenantRole   { OWNER STAFF }
enum PaymentProvider { PAYSTACK FLUTTERWAVE }
enum WebhookStatus { RECEIVED PROCESSED FAILED }

model WebhookEvent {
  id              String          @id @default(cuid())
  provider        PaymentProvider
  providerEventId String?         // dedupe key where the provider supplies one
  eventType       String
  reference       String?
  tenantId        String?         // from transaction metadata; null if unresolvable
  payload         Json            // raw body, persisted BEFORE processing
  status          WebhookStatus   @default(RECEIVED)
  error           String?
  attempts        Int             @default(0)
  createdAt       DateTime        @default(now())
  processedAt     DateTime?

  @@unique([provider, providerEventId])
  @@index([reference])
  @@index([status, createdAt])
}
```

Full revised schema is written in M1.

---

## Part 4 — Milestones

Each milestone has a binary exit criterion. Don't advance on "looks done."

### M0 — Foundation · 1 day ✅ DONE

Next.js 16 + React 19 + TS strict + Tailwind 4, pnpm. All scripts from `AGENT.md`'s Build & Validation section wired and passing. Prettier config matching the stated conventions (single quotes, semis, arrow parens, width 2). Move the reference files from `app/**` → `src/app/**` (`AGENT.md` specifies `src/`; the drafts aren't there). ESLint rule banning `!` non-null assertions, per convention.

**Exit:** `pnpm lint && pnpm typecheck && pnpm build` green on a bare app.

### M1 — Data layer + tenant isolation · 2 days · mostly done

Revised schema, first migration, seed script with 2 demo tenants (this matters — one tenant can't prove isolation).

`src/lib/tenant-db.ts` — **not** the hand-rolled wrapper from §9.3 of the doc. That version requires manually re-implementing every model × every operation, and the first one you forget is a silent leak. Use a Prisma Client Extension instead:

```ts
export function tenantDb(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
            args.where = { ...args.where, tenantId };
          }
          if (CREATE_OPS.has(operation)) {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
```

This covers every model and every operation by construction — including ones added later, which is the actual failure mode of the manual wrapper.

Note the implemented version goes further than the sketch above: `findUnique`/`update`/`delete`/`upsert` target a unique constraint, so `tenantId` cannot be merged into their `where` without breaking Prisma's type contract. Those operations are routed through an ownership pre-check that throws `CrossTenantAccessError` instead — otherwise they would silently bypass scoping, which is the exact hole the wrapper exists to close.

**Remaining:** first migration has never been applied (needs a live `DATABASE_URL`).

**Exit:** an isolation test asserting tenant A's client returns zero of tenant B's products, orders, and coupons across `findMany`/`findFirst`/`update`/`delete`. Requires a test database — not yet written.

### M2 — Tenant resolution · 1 day · mostly done

`proxy.ts` (Next 16 naming) implementing fixes 0.1, 0.7, 0.8, 0.11. Node runtime → direct Prisma lookup for custom domains behind an in-process LRU with 5-minute TTL, negative results expiring in 30s so a newly-attached domain goes live quickly. `/api/internal/resolve-domain` deleted. Reserved-subdomain list. `{slug}.localhost` for dev. `src/app/sites/[tenant]/layout.tsx` re-resolves from the URL segment — that part of the reference code is right and is the defence-in-depth.

Pure hostname parsing lives in `src/lib/domains/hostname.ts`, separate from the database half in `resolve.ts`. That split came out of a failing test: the pure helpers were unusable in isolation because importing them pulled in the Prisma client.

**Remaining:** the header-stripping test below needs a request-level harness.

**Exit:** a test proving a forged `x-tenant-slug` header is stripped on _every_ branch, including the platform early return. Currently covered by construction (`sanitizedHeaders()` is the only way a response is built) but not yet asserted.

### M3 — Auth · 2 days

**Clerk for identity, `TenantUser` for tenancy** (D3). `ClerkProvider` at the root layout; `clerkMiddleware` wraps **platform routes only** — storefronts are public and must not pay an auth check on every product-page view.

Authorization helpers are in place (`requireUser`, `requireTenantMember`, `requireStoreOwner`, `requirePlatformAdmin`, `listMyStores`). Membership is always a database check against the slug in the URL, never a claim read off the session.

**Remaining:** sign-in/up pages are Clerk defaults and unstyled; the staff-invite flow is unbuilt (~half a day, the cost of not using Organizations); `/api/webhooks/clerk` for user sync is stubbed but empty.

**Exit:** tenant A's authenticated session receives 403 on every tenant B admin route and API endpoint.

### M4 — Tenant admin dashboard · 4 days

Products (CRUD, image upload, CSV bulk import), orders (list, filter, detail, status transitions), coupons, delivery zones, store settings/branding. Follows the `AGENT.md` feature-folder shape (`index.tsx` / `create/` / `detail/` / `constants.ts` / `types.ts`), React Query + `useFilters`, route constants in `src/constant/routes.ts`.

The **CSV import is worth building early, not last** — §4 of the pricing doc names it as the thing that saves hours per client, and it's what makes 1–3h onboarding realistic.

**Exit:** onboard a demo tenant end to end through the UI alone, no SQL.

### M5 — Storefront · 4 days

Tenant-branded layout (colors/logo from the `Tenant` record), product listing + detail, Zustand cart persisted to localStorage, checkout form (RHF + Zod), order confirmation page. Mobile-first.

**Exit:** Lighthouse mobile ≥ 90 on a seeded storefront. Page speed is an explicit selling point in the pitch (§2.2) — treat it as a requirement, not a nice-to-have.

### M6 — Checkout + payments · 3 days ✅ DONE — exit met against the live gateway

Rewrite `app/api/checkout/route.ts` with Zod validation, quantity merging, and **server-side Paystack initialize** (0.2, 0.3, 0.6). Rewrite `verify-order.ts` with guarded stock decrement and conditional coupon increment (0.4, 0.5). Webhook with `WebhookEvent` logging, `timingSafeEqual`, and retry-on-failure semantics (0.9). Rate limits on checkout and coupon preview (0.10).

**Exit:** the manual E2E from `AGENT.md`'s Change Safety section — add to cart → checkout → test card → order `PAID` → stock decremented — **plus** these adversarial cases:

- negative quantity → rejected ✅
- forged `x-tenant-slug` → rejected ✅
- duplicate webhook delivery → single fulfillment ✅
- abandoned payment → stock unchanged ✅
- concurrent purchase of the last unit → no negative stock, second order flagged ✅

Automated in `e2e/checkout.spec.ts` against a real dev server and the real Paystack test gateway — no gateway stub, deliberately: all three defects this milestone exists to close live at the boundary between our server and theirs, which is exactly where a mock hides them. Chromium runs with `--host-resolver-rules` so tenant hostnames resolve locally and every request goes through `proxy.ts` for real.

#### 6.1 Two defects the live run found that no unit test could

**The popup never reported completion.** `resumePaystackTransaction` called `resumeTransaction(accessCode)` with no callbacks. The `callback_url` sent at initialize is honoured only by the redirect flow — in the inline popup the browser never leaves the page, so completion arrives through `onSuccess`/`onCancel`/`onError` and nowhere else. Customers paid successfully (confirmed `status=success` on Paystack) and were dropped back on the checkout form with a full cart and no confirmation, while the order sat `PENDING` until the webhook landed. Money arrived; the customer could not tell, and would reasonably pay again. Fixed by passing callbacks and navigating to the confirmation route on success.

**Fulfillment was not concurrency-safe.** `verifyAndFulfillOrder` claimed to be "idempotent by construction" via an early `if (order.status !== PENDING) return`. That is a read, not a lock. The webhook and the browser's verify call routinely arrive within milliseconds; both read `PENDING`, both ran the decrements. Observed live: stock fell 40 → **38** for a single order of quantity 1, and a single-use coupon would likewise burn two uses. Fixed by making the status transition itself the lock — a conditional `updateMany` from `PENDING` to `PAID` that exactly one caller wins, with the decrements gated on `count === 1`. Regression covered by the `concurrent verifies` spec, which fires three simultaneously.

Also fixed while getting there: `allowedDevOrigins` in `next.config.js`. Storefronts are served from tenant subdomains, so in development every `_next` asset request is cross-origin relative to `localhost` and the dev server answered `403` — leaving pages rendered but never hydrated, which makes every client component look silently broken.

### M7 — Onboarding + platform admin · 2 days · core done ✅, two pieces deferred

Tenant creation wizard, **Paystack subaccount creation via API** (§12 of the doc names this as a missing piece — it writes `Tenant.paystackSubaccountCode`), custom domain attach via the Vercel Domains API, branding upload, platform-wide tenant list.

**Exit — met.** A tenant onboarded through this flow was verified to reach a live storefront and take a real payment: `/api/checkout` returned an `access_code`, and Paystack held ₦15,000 against subaccount `ACCT_vnzi21uogs2b4k5` with the amount pinned server-side. Elapsed time was under a minute, not thirty.

**Built:** `GET|POST /api/platform/tenants`, `GET /api/platform/banks`, `/dashboard/platform` (estate list, flagging any tenant whose subaccount is missing or a `ACCT_seed_*` placeholder), `/dashboard/platform/tenants/create` (onboarding form), `resolveAccount()` in the Paystack lib, and `/dashboard/unauthorized` — a page `ROUTES.unauthorized` had always pointed at but which did not exist, so a staff member hitting an owner-only action got a 404 that read as a broken app rather than a refusal.

**Deferred, and why:** custom-domain attach needs a Vercel API token that is not in `.env`; branding upload needs M8's Cloudinary upload path, which does not exist yet.

#### 7.1 Ordering, and one thing Paystack forced

Paystack is called **before** anything is written locally. The reverse order leaves a tenant that exists, resolves at its subdomain, and 503s at checkout whenever the API call fails — visible to shoppers, invisible to us. This way a failure means no tenant was created and the operator simply retries.

Account resolution is a **typo-catcher, not a gate**. Paystack rate-limits `/bank/resolve` (test mode allows three live resolves a day, which the build hit), and a 429 says nothing about whether an account is real — refusing to onboard on one would block a legitimate merchant over an unrelated quota. A 429 is therefore tolerated and the tenant is created without a verified name; every other failure still stops the flow before a subaccount is created against a bad account.

Two Paystack test-mode quirks worth recording, both found the hard way: bank code `001` resolves but is **rejected by `/subaccount`**, so the documented workaround for the resolve limit does not carry over; and email addresses on `.test` TLDs are rejected outright by `/transaction/initialize` with `invalid_email_address`.

#### 7.2 The bootstrap gap

`requirePlatformAdmin()` reads `PlatformUser`, and nothing in the app writes that table — deliberately, since a self-serve "make me an admin of everything" endpoint is the one route worth never having. The first operator is created out of band:

```bash
pnpm grant:admin <clerkUserId> <email>
```

Until that runs, `/dashboard/platform` correctly refuses everyone, including you.

### M8 — Ops · 2 days

Transactional email (Resend): order confirmation to customer, new-order notification to tenant. Neither exists anywhere in the current design and both are table stakes. Sentry, structured logging, uptime check, a failed-webhook replay tool.

### M9 — Test suite · 2 days

Vitest for units (pricing math, coupon validation, tenant scoping, signature verification). Playwright for the full purchase journey against a seeded tenant. `AGENT.md` mandates coverage on checkout, payments, and tenant resolution — this is where that debt gets paid.

### M10 — Pilot · 1 day

One real tenant, real money, small catalogue. Watch it for a week before onboarding a second.

**Deferred to post-v1:** Flutterwave (build the provider interface in M6 so it slots in), courier APIs (an upsell per §6.2, not base scope), WhatsApp/IG sync, multi-currency, category-scoped coupons.

---

## Part 5 — Sequencing

```
M0 → M1 → M2 → M3 ─┬→ M4 ─┐
                   └→ M5 ─┴→ M6 → M7 → M8 → M9 → M10
```

M4 and M5 are independent once auth exists — parallelize them if a second pair of hands is available. Everything before M3 is strictly serial. **M6 must not start before M1 and M2 are proven**, because guarded stock decrements and tenant-scoped queries are its foundation.

---

## Part 6 — Risk register

| Risk                                       | Mitigation                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Cross-tenant leak                          | Extension-based `tenantDb` (M1) + URL re-resolution (M2) + isolation tests. Three independent layers.                    |
| Paid-but-unfulfilled order                 | Server-side initialize (0.3) + webhook retry (0.9) + `hasStockIssue` flag (0.4)                                          |
| Free-tier surprise                         | Neon paid tier from day one. §7.5's ~$25–69/mo is the plan, not an upgrade path.                                         |
| One bug hits 50 tenants at once            | The flip side of shared infrastructure. Preview deploys, E2E gate on the checkout path, staged rollout.                  |
| Paystack subaccount rejected at onboarding | Onboarding must tolerate a pending subaccount — tenant can build their catalogue while verification clears.              |
| CBN/regulatory                             | Architecture is already correct: funds never touch a platform account. Do not add a "temporary" balance-holding feature. |

---

## Part 7 — First actions

1. Answer **D1** (admin location) — it changes the route tree, so it must be settled before M0.
2. Confirm **D2/D3/D4**.
3. M0 scaffold.
4. Amend `AGENT.md`: `middleware.ts` → `proxy.ts` throughout, the D1 admin path if changed, and add `WebhookEvent` + `tenantDb`-extension notes to Key Files.

---

## Appendix — Verified dependency versions (Aug 2026)

| Package                 | Version       | Note                                           |
| ----------------------- | ------------- | ---------------------------------------------- |
| next                    | 16.3.0        | `middleware.ts` → `proxy.ts`, Node runtime     |
| react                   | 19.2.8        |                                                |
| prisma / @prisma/client | 7.9.1         | See D2 — generator + config changes            |
| better-auth             | 1.6.26        | Recommended (D3)                               |
| next-auth               | 5.0.0-beta.32 | Still beta — the reason for D3                 |
| zod                     | 4.4.3         |                                                |
| @tanstack/react-query   | 5.101.4       |                                                |
| zustand                 | 5.0.14        |                                                |
| tailwindcss             | 4.3.3         | v4 — CSS-first config, no `tailwind.config.js` |
