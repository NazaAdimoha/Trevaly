# Project Guidelines

> Supersedes `files (1)/AGENT.md`, which was written before the stack was
> settled. Where they disagree, this file wins. Rationale for every change is in
> `BUILD_PLAN.md`.

## Project Context

- Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4,
  Prisma 7 + PostgreSQL (Neon), SWR, Formik, Yup, Zod, Zustand, Radix UI.
- Package manager: pnpm.
- Auth: **Clerk for identity only.** Tenancy lives in our own `TenantUser`
  table — Clerk Organizations are deliberately not used (see BUILD_PLAN D3).
- Payments: Paystack (primary), Flutterwave (later), both via Subaccounts /
  split payments. The platform never holds client funds.
- Architecture: one multi-tenant application. One deployment, one shared
  database, every business isolated by `tenantId`. No per-client deployments,
  no per-client databases.
- Path aliases: `@/*` -> `src/*`, `~/*` -> `public/*`

### Two form/fetch stacks, on purpose

The admin dashboard is ported from the Ceviant back-office, so it uses **SWR +
Formik + Yup** — that is what all 30+ `src/components/ui/**` primitives and 16
`src/components/fields/**` components are already written against. Rewriting
them for React Query + React Hook Form would discard the entire reason for
reusing that codebase.

**Zod is for server boundaries only** — API route input, webhook payloads,
env parsing. Never for admin form validation; never use Yup on the server.

## Build And Validation

- Install: `pnpm install`
- Dev: `pnpm dev` · Build: `pnpm build` · Start: `pnpm start`
- Lint: `pnpm lint` · Fix: `pnpm lint:fix` · Strict: `pnpm lint:strict`
- Type-check: `pnpm typecheck`
- Test: `pnpm test` · E2E: `pnpm test:e2e`
- Format: `pnpm format`
- Prisma: `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:deploy` · `pnpm db:seed`

Validation sequence for code changes:

1. `pnpm lint`
2. `pnpm lint:fix`
3. `pnpm typecheck`
4. `pnpm db:generate` (only if `schema.prisma` changed)

## Code Organization

Mirrors the Ceviant back-office convention: thin route files, real work in
`src/components/pages/**`.

- Route pages: `src/app/**/page.tsx` — these should be ~5 lines (metadata +
  render a view component). No data fetching, no JSX beyond the view.
- Feature views: `src/components/pages/**`
  - `dashboard/stores/**` — a single tenant's admin
  - `dashboard/platform/**` — platform operator surface (your team)
  - `storefront/**` — public storefront views
  - `marketing/**` — the public marketing site on the root domain
- Reusable primitives: `src/components/ui/**`
- Formik-bound form fields: `src/components/fields/**`
- Layout shells: `src/components/Layouts/{Auth,Dashboard,Marketing,Storefront}/**`
- Shared constants: `src/constant/**` · hooks: `src/hooks/**` · utilities: `src/lib/**`
- Domain enums: never re-declare. Import from `@/generated/prisma/enums` in
  anything that can reach the browser — components, and `src/lib/**` modules a
  client component imports (`validation/tenant.ts` is one). `@/generated/prisma/client`
  is server-only; pulling it into a client chunk drags the Prisma runtime and
  fails the build on `node:module`. ESLint enforces this for components only,
  so the `src/lib` case is on you.
- Payment logic: `src/lib/payments/**`
- Server-side Zod schemas: `src/lib/validation/**`
- Prisma schema: `prisma/schema.prisma` · seed: `prisma/seed.ts`

Each feature view folder contains:

- `index.tsx` — list/landing view
- `create/index.tsx` — create form view
- `detail/index.tsx` — detail view
- `constants.tsx` — UI-only option sets (labels, select options, badge maps)
- `create/types.ts` — Yup schema + Formik initial values

## Routing Conventions

- `src/constant/routes.ts` is the source of truth. Never hardcode a dashboard path.
- Tenant admin routes are slug-parameterised: `ROUTES.store.products.base(slug)`.
- Storefront URLs are resolved from the hostname by `src/proxy.ts`, not from
  route constants. `STOREFRONT_ROUTES` holds the tenant-relative paths.
- New admin route: update route constants first, then consume them.

## Multi-Tenant Conventions

**The most important section in this file. Getting it wrong leaks one
business's data to another.**

- Every tenant-owned table carries `tenantId` + `@@index([tenantId])`. Never add
  one without both, and add it to `TENANT_SCOPED_MODELS` in `src/lib/tenant-db.ts`
  in the same change.
- **Never import `prisma` directly in `src/app/**` for tenant-owned data.** Use
  `tenantDb(tenantId)`, which injects the filter automatically. ESLint enforces
  this via `no-restricted-imports`; the only legitimate overrides are tenant
  resolution itself, platform-level queries, and webhook logging — each needs an
  inline disable with a justifying comment.
- Tenant resolution happens in exactly two places, and both must agree:
  - `src/proxy.ts` reads the hostname and rewrites storefront requests into
    `/sites/[tenant]/**`, setting `x-tenant-slug` on the **request** headers.
  - `src/app/sites/[tenant]/layout.tsx` re-resolves the `Tenant` from the URL
    segment. Never trust the header alone for anything touching the database.
- **`x-tenant-slug` is deleted from every inbound request before being set.** An
  inbound value is always hostile. This applies on every branch of `proxy.ts`,
  including ones that never set a replacement.
- Admin authorization always goes through `requireTenantMember(storeSlug)` in
  `src/lib/auth.ts`. Membership is a database check against the slug in the URL —
  never a claim read off the session.
- Per-tenant uniqueness only: `@@unique([tenantId, code])`, `@@unique([tenantId, slug])`.
  Never add a bare global unique on a value a tenant controls.

## Payments & Checkout Conventions

- All money is integer kobo (`priceKobo`, `totalKobo`). Never `Float`. Display
  via `formatCurrency(kobo)` from `src/lib/utils.ts`; convert form input with
  `toMinor`/`toMajor`.
- Checkout totals are always recomputed server-side in
  `src/app/api/checkout/route.ts` from the database. A client-supplied price or
  total is never trusted.
- **Payments are initialized server-side** (`initializeTransaction`). The browser
  receives an opaque `access_code`, never a mutable amount. Handing the frontend
  a public key plus a number lets the customer choose what to pay.
- Fulfillment — marking `PAID`, decrementing stock, incrementing coupon usage —
  happens in exactly one place: `verifyAndFulfillOrder()` in
  `src/lib/payments/verify-order.ts`. Never duplicate it in a caller.
- Stock decrements are conditional (`updateMany` with `stock: { gte: qty }`).
  A plain `decrement` lets concurrent buyers drive stock negative. When stock is
  unavailable at fulfillment, the order is **still marked PAID** and flagged with
  `hasStockIssue` — never drop a payment that actually happened.
- Coupon usage caps need raw SQL (`timesUsed < maxUses` in the WHERE) because
  Prisma cannot compare two columns.
- Webhook handlers verify the signature against the **raw** body with
  `crypto.timingSafeEqual`, persist a `WebhookEvent` **before** processing, and
  return **500 on failure** so the provider retries. Returning 200 on a failed
  fulfillment permanently drops a paid order.
- New providers implement the same contract: verify status AND amount AND
  currency AND reference against the stored order before fulfilling.

## Marketing Site And SEO Conventions

- The marketing site lives in `src/app/(marketing)/**` and is **Clerk-free in
  both directions**: no `ClerkProvider` in the subtree, and `proxy.ts` does not
  run `clerkMiddleware` on it. `auth()` is therefore unavailable there — the
  header reads the presence of a `__session` cookie as a _hint_ only. Never gate
  anything on that hint.
- **Adding a route that calls `auth()` means adding it to `isClerkRoute` in
  `src/proxy.ts`.** A route missing from that matcher fails closed: `auth()`
  throws rather than quietly returning a null user.
- Prices, the brand name and all marketing copy constants live in
  `src/constant/marketing.ts`. The price is not settled — never type a figure
  into a component, and never into a layout that only works at one character
  count.
- Placeholders are written as `[SOMETHING]` on purpose. They are meant to look
  wrong on the page; a plausible fake ships unnoticed.
- Every route sets `alternates.canonical`. **Storefront canonicals come from
  `tenantOrigin()` in `src/lib/domains/canonical.ts` and nowhere else** — a
  tenant with a verified custom domain is reachable at two hosts serving
  identical HTML, and one canonical host is what stops the two competing.
- Structured data goes through `<JsonLd>` and is always derived from the same
  data the page renders. A second, hand-maintained copy drifts, and Google
  flags the mismatch rather than ignoring it.
- Any route handler under `src/app/sites/[tenant]/**` that returns tenant data
  must set `export const dynamic = 'force-dynamic'`. Without it the build
  prerenders one tenant's output against a placeholder segment and serves it on
  every store's domain.
- Marketing motion is CSS only — the utilities in `globals.css`
  (`animate-rise`, `reveal`, `animate-flow`, `animate-soft-pulse`,
  `hover-lift`), all inside `prefers-reduced-motion: no-preference`. No
  animation library, and no IntersectionObserver: `reveal` uses
  `animation-timeline: view()` behind an `@supports` guard so unsupported
  browsers get visible content rather than content stuck at opacity 0.

## Product Variants

`Product.optionName` + `ProductVariant` let one product sell in sizes, colours
or weights. **One axis, not a matrix** — see the schema comment for why.

- **Stock lives on the variant when a product has any.** `Product.stock` is
  then meaningless and must never be summed into or read for a purchase
  decision. Everything asking "what does this cost" or "can this be bought"
  goes through `src/lib/products/variants.ts`, so the storefront's answer and
  the server's answer are the same function.
- Checkout rejects a variant mismatch in **both** directions: a variant product
  with no `variantId`, and a `variantId` on a product without variants. Never
  silently ignore the second — it hides a stale cart or a probe behind a
  successful order.
- A variant is resolved by searching the already-loaded, tenant-scoped
  `product.variants`. Never look one up by id on its own: that is how a variant
  from another product (or tenant) gets priced into an order.
- `verifyAndFulfillOrder` decrements the **variant** row when the line has one,
  under the same conditional `stock: { gte: qty }` guard. Decrementing the
  parent instead is an oversell that leaves no trace.
- `OrderItem` snapshots `variantLabel` ("Size: Small") whole, so a receipt
  survives the option being renamed or retired.
- A variant that appears on an order is retired with `isActive: false`, never
  deleted — `OrderItem.variant` is `Restrict`. One with no order history is
  deleted so re-adding the same value does not hit `@@unique([productId, value])`.
- Cart lines are keyed by product **and** variant (`lineKey`). Keying on the
  product alone collapses a Small and a Large into one line and ships the wrong
  size. The persisted cart is versioned; bump it if the item shape changes again.

## Categories And Media

- Categories are tenant-scoped with `@@unique([tenantId, slug])`. The slug is
  public (`/categories/{slug}`), so it is supplied and validated rather than
  re-derived from the name — deriving it would silently change a live URL when
  a merchant fixes a typo.
- **`Product.categoryId` is a plain foreign key and does not know about
  tenancy.** Postgres will accept another tenant's category id. Every route
  that writes it resolves the category through `tenantDb` first.
- Deleting a category is `onDelete: SetNull` — it un-files products rather than
  deleting them. The route returns the orphaned count so the UI can confirm.
- Category pages are real routes, not a query filter: they carry their own
  canonical, and they lead the tenant sitemap because a category is the
  broadest term a store will rank for.
- **Images are stored as Cloudinary public IDs, never delivery URLs.** A stored
  URL freezes the transformation applied at upload time; a public ID lets
  `CldImage` derive format, quality and crop at render.
- The upload folder is the security boundary. `/uploads/signature` derives the
  folder from the authorized tenant and rejects any other — a signature is a
  capability, and signing a client-supplied folder lets one store overwrite
  another's assets. `isOwnedBy()` closes the same hole on the write path.

## Bulk Import

- `POST /api/stores/{slug}/products/import` **always previews first**. Nothing
  is written until `commit: true`. Undoing a bad import of two hundred products
  by hand is the worst afternoon this product can give someone.
- `src/lib/csv.ts` is a hand-written RFC-4180 reader, not a dependency. A split
  on commas corrupts the first product whose description contains one — which
  is most of them. It also strips the BOM Excel writes, which otherwise becomes
  part of the first header so `name` silently fails to match.
- Headers are matched case- and space-insensitively and unknown columns are
  ignored, so a merchant's existing spreadsheet usually works untouched. Only
  `name` and `price` are required.
- Money is accepted as `₦25,000.50` or `25000`; a row that cannot be priced,
  named or slugged is **rejected with a reason**, never guessed at.
- Slug collisions are checked inside the file as well as against the database.
  Checking only the database imports the first half and fails mid-run.
- Import images by `https://` URL: **Cloudinary fetches them**, we hand over the
  URL. A 4MB photo never occupies one of our invocations, and a merchant's
  spreadsheet cannot make our server request an internal address. One
  unreachable image warns and leaves the product created without pictures.
- Rows are created one at a time with per-row error capture, so one bad product
  does not abandon the other 199.

## Storefront Themes

`Tenant.theme` selects one of a **bounded enum** of looks. This is the line
between a theme and the per-client codebase the architecture exists to avoid.

- A theme is a set of CSS custom properties (`src/constant/storefront-themes.ts`)
  plus a few structural flags. Every theme ships to every tenant in the same
  bundle. There is no per-tenant stylesheet, no per-theme bundle, and
  **never** a free-text theme name or tenant-supplied CSS — that is an XSS
  vector on a shared domain.
- **A theme may change layout, density, shape and typography. It may not change
  data, routes or business logic.** One cart, one checkout, one fulfillment
  path, verified once. A "theme" that needs its own component tree is a fork;
  do not merge it.
- Visual values go in the theme's `vars` and are consumed by the `st-*` classes
  in `globals.css`. Only put something in the TS config when CSS genuinely
  cannot express it (`showSku`, `headerAlign`, `gridImageSizes`).
- `gridImageSizes` **must** match the theme's own column counts. A mismatch
  fetches every product image at the wrong resolution, which is the easiest way
  to lose the Lighthouse ≥ 90 target.
- The catalogue grid is a Server Component and must stay one — the theme
  arrives as a prop, not from `useTenant()`. Reading the client context there
  would force `'use client'` onto the page search engines index.
- Storefront fonts are declared with `preload: false` so only the family a
  store's theme references is downloaded. Adding a theme with a new face is
  fine; preloading them is not.
- The tenant colour stays a controlled accent even in a theme. A full-bleed
  header in an unreviewed `primaryColor` looks broken for most tenants.

## Data Fetching

- Admin: `useSWR<T>(key, apiFetcher)` with the `api` Axios instance from
  `src/lib/api.ts`. Gate the key on `queryString !== null` so fetching suspends
  until `useFilters` initialises.
- Errors: `handleApiError(err)` — it toasts automatically.
- Re-fetch after mutations via the `mutate()` returned by `useSWR`.
- Storefront: Server Components for catalogue data (SEO). Cart is Zustand
  (`src/lib/store/cart.ts`), persisted to `localStorage` — never cookies, never
  a database write before checkout is submitted.

## Hooks Reference

| Hook             | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `useFilters`     | Filter state — debounces and serializes to a `queryString`     |
| `useTabs`        | URL-driven tab state via a named query param                   |
| `useDebounce`    | Debounced copy of a value                                      |
| `useTableExport` | `exportCsv`/`exportPdf` callbacks with `isExporting`           |
| `useCart`        | Zustand cart — `addItem`/`removeItem`/`updateQuantity`/`clear` |
| `useTenant`      | Current `Tenant` from `TenantProvider` inside storefront pages |
| `useIsMobile`    | `true` when viewport < 768 px                                  |

## Forms And UI Conventions

- Formik + Yup for all admin forms. Reuse `src/components/fields/**` before
  adding a new field abstraction.
- Multi-step forms: one root `<Formik>` wrapping `<Stepper>`, all fields in one
  `initialValues`/`validationSchema`; steps read `useFormikContext()`.
- Lists/tables: `TableFactory` + `FilterPanel` + `useFilters`. Column field is
  `header`; cell renderer is `accessor`. Always pass `rowKey` and `emptyState`.
- Loading: `<Skeleton>` mirroring the loaded layout. Never bare loading text.
- **Radix Selects: never use an empty string as an item value.** Use a `__all__`
  sentinel and map it back to empty filter state.
- Confirmation dialogs: Radix `<Dialog>` with local `loading` state.
- Toasts: `import { toast } from '@/components/ui/sonner'`. `toast.success` on
  mutations, `toast.error` on failures. Do not render inline error text for API
  errors — **except checkout payment failures, which must appear inline next to
  the pay button**, where a toast is too easy to miss.

## Lint And Formatting

- Respect ESLint import sorting and unused-import rules; remove rather than suppress.
- **No non-null assertions (`!`)** — enforced by ESLint. Narrow explicitly.
- Always use `formatDate` / `formatCurrency` from `src/lib/utils.ts`.
- Check `src/lib/utils.ts` before adding a helper in a feature file; extract
  there if used across more than one flow.
- Prettier: single quotes, JSX single quotes, semicolons, arrow parens always,
  tab width 2.

## Agent Operating Rules

- Prefer minimal, targeted edits preserving existing architecture and naming.
- No broad refactors, no moving files, unless explicitly requested.
- Never introduce a per-tenant deployment, database, or codebase branch. The
  multi-tenant architecture is a hard constraint, not a default to override.
- Never write fulfillment logic outside `verifyAndFulfillOrder()`.
- Never weaken the `x-tenant-slug` sanitising in `proxy.ts`.
- Avoid new dependencies unless justified.
- Changes to checkout, payments, or tenant resolution require tests.

## Key Files

| Purpose                             | File                                             |
| ----------------------------------- | ------------------------------------------------ |
| Prisma schema (enums + models)      | `prisma/schema.prisma`                           |
| Marketing copy, prices, brand       | `src/constant/marketing.ts`                      |
| Storefront theme tokens             | `src/constant/storefront-themes.ts`              |
| Variant pricing + availability      | `src/lib/products/variants.ts`                   |
| CSV reader                          | `src/lib/csv.ts`                                 |
| Import parsing + template           | `src/lib/validation/import.ts`                   |
| Marketing shell (header + footer)   | `src/components/Layouts/Marketing/**`            |
| Canonical host for a tenant         | `src/lib/domains/canonical.ts`                   |
| Structured-data helper              | `src/components/JsonLd.tsx`                      |
| Platform revenue ledger             | `PlatformEarning` (written in `verify-order.ts`) |
| Tenant-scoped query wrapper         | `src/lib/tenant-db.ts`                           |
| Tenant routing (Next 16 `proxy.ts`) | `src/proxy.ts`                                   |
| Hostname -> tenant resolution       | `src/lib/domains/resolve.ts`                     |
| Reserved subdomains                 | `src/lib/domains/reserved.ts`                    |
| Tenant storefront root layout       | `src/app/sites/[tenant]/layout.tsx`              |
| Authorization helpers               | `src/lib/auth.ts`                                |
| Checkout route                      | `src/app/api/checkout/route.ts`                  |
| Fulfillment (single source)         | `src/lib/payments/verify-order.ts`               |
| Paystack client                     | `src/lib/payments/paystack.ts`                   |
| Paystack webhook                    | `src/app/api/webhooks/paystack/route.ts`         |
| Checkout Zod schemas                | `src/lib/validation/checkout.ts`                 |
| Route constants                     | `src/constant/routes.ts`                         |
| Sidebar menus                       | `src/constant/menu.tsx`                          |
| Shared utilities                    | `src/lib/utils.ts`                               |
| Axios + apiFetcher + handleApiError | `src/lib/api.ts`                                 |
| Cart store (Zustand)                | `src/lib/store/cart.ts`                          |

## Change Safety

- Inspect related files for existing patterns before editing.
- Run validation appropriate to the scope after editing.
- Any change touching `prisma/schema.prisma`, `src/proxy.ts`,
  `verify-order.ts`, or `api/checkout/route.ts` requires a manual end-to-end
  test before it is done: add to cart → checkout → test card → order `PAID` →
  stock decremented. These are the highest-blast-radius files in the codebase —
  a bug here hits every tenant at once.
- If validation cannot be run, say clearly what was not verified.
