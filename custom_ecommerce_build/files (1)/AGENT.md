# Project Guidelines

## Project Context

- Stack: Next.js App Router, React, TypeScript (strict), Tailwind CSS, Prisma ORM, PostgreSQL (Neon/Supabase), React Query, Zustand, Zod.
- Package manager: pnpm.
- Payments: Paystack (primary) and Flutterwave (secondary), both via Subaccounts/Split Payments — the platform never holds client funds directly.
- Architecture: single multi-tenant application. One deployment, one shared database, every business ("tenant") isolated by `tenantId` on every owned table. No per-client deployments, no per-client databases.
- Path aliases:
  - `@/*` -> `src/*`

## Build And Validation

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Production build: `pnpm build`
- Start production build: `pnpm start`
- Lint: `pnpm lint`
- Lint fix: `pnpm lint:fix`
- Type-check: `pnpm typecheck`
- Test: `pnpm test`
- Format: `pnpm format`
- Prisma — generate client: `pnpm prisma generate`
- Prisma — apply migrations (dev): `pnpm prisma migrate dev`
- Prisma — apply migrations (deploy): `pnpm prisma migrate deploy`

Use this validation sequence for code changes unless the request says otherwise:

1. `pnpm lint`
2. `pnpm lint:fix`
3. `pnpm typecheck`
4. `pnpm prisma generate` (only if `schema.prisma` changed)

## Code Organization

- Keep route pages in `src/app/**/page.tsx` for the platform's own marketing/admin surface.
- Keep tenant storefront pages under the shared dynamic segment `src/app/_sites/[tenant]/**` — this is the one codebase every tenant's storefront renders through (see Multi-Tenant Conventions).
- Keep API route handlers in `src/app/api/**`.
- Keep reusable primitives in `src/components/ui/**`.
- Keep storefront-facing components in `src/components/storefront/**`.
- Keep tenant admin dashboard components in `src/components/admin/**`.
- Keep shared constants in `src/constant/**`.
- Keep shared hooks in `src/hooks/**`.
- Keep shared library utilities in `src/lib/**`.
- Keep the Prisma schema at `prisma/schema.prisma`; keep seed scripts in `prisma/seed.ts`.
- Keep payment-provider logic (Paystack/Flutterwave clients, verification helpers) in `src/lib/payments/**`.

When adding an admin dashboard feature, follow existing structure:

- App route entry in `src/app/_sites/[tenant]/admin/.../page.tsx`
- View implementation in `src/components/admin/...`

Each admin feature view folder typically contains:

- `index.tsx` — list/landing view
- `create/index.tsx` — create form view
- `detail/index.tsx` — detail view
- `constants.ts` — UI-only option sets (labels, select options)
- `types.ts` — Zod validation schema + form default values

## Routing Conventions

- Use `src/constant/routes.ts` as the source of truth for both platform routes and admin-dashboard routes.
- Avoid hardcoded dashboard URLs in components when a route constant exists.
- When introducing a new admin route, update route constants first, then consume them from UI and navigation code.
- Storefront URLs are resolved by the tenant-routing middleware (`middleware.ts`), not by route constants — see Multi-Tenant Conventions.

## TypeScript Conventions

- Avoid creating a named interface or type alias for simple, single-use component props. Use an inline type instead:
  - One prop: `({ id }: { id: string })`
  - Few props: `({ id, name }: { id: string; name: string })`
- Only introduce a named props interface when the type is reused, exported, or complex enough to warrant a name.
- Prefer TypeScript enums over string unions for domain values with limited options (order status, coupon type, delivery method). Keep enums defined in `prisma/schema.prisma` as the source of truth; import the generated Prisma enum types directly in application code — do not re-declare parallel string unions.
- Do not use non-null assertions (`!`). Narrow types explicitly using conditional checks or by computing a narrowed local variable before rendering.

## Multi-Tenant Conventions

This is the most important section in this file. Getting it wrong leaks one business's data to another.

- Every table that stores tenant-owned data carries a `tenantId` column and a `@@index([tenantId])` (see `prisma/schema.prisma`). Never add a tenant-owned table without both.
- Never call the base Prisma client directly from a route handler or Server Component that operates on tenant data. Use the `tenantDb(tenantId)` wrapper in `src/lib/tenant-db.ts`, which injects the `tenantId` filter automatically. A route handler that imports `prisma` directly for a tenant-scoped query is a bug.
- The tenant for a request is resolved in exactly two places, and both must agree:
  - `middleware.ts` reads the hostname (subdomain or custom domain) and rewrites storefront requests into `/_sites/[tenant]/**`, and sets `x-tenant-slug` on API requests.
  - `src/app/_sites/[tenant]/layout.tsx` re-resolves the `Tenant` record from the URL segment itself — never trust the header alone for anything that touches the database.
- Coupon codes, product slugs, and other "unique-looking" values are unique **per tenant**, not globally (`@@unique([tenantId, code])`, `@@unique([tenantId, slug])`). Never add a bare global-unique constraint on a value a tenant controls.
- When adding a new tenant-scoped model, update: the Prisma schema, the `tenantDb` wrapper, and any admin CRUD screens — in that order.

## Payments & Checkout Conventions

- All monetary amounts are stored and passed between server and database as integers in kobo (e.g. `priceKobo`, `totalKobo`). Never use `Float` for money. Use `formatCurrency(amountKobo)` from `src/lib/utils.ts` for display.
- Checkout totals (subtotal, discount, delivery fee, grand total) are always recalculated server-side in `app/api/checkout/route.ts` from the database. A client-supplied price or total is never trusted or persisted directly.
- Order fulfillment (marking an order `PAID`, decrementing stock, incrementing coupon usage) happens in exactly one place: `verifyAndFulfillOrder()` in `src/lib/payments/verify-order.ts`. Both the client-triggered verify route and the payment-provider webhook call this same function — do not duplicate fulfillment logic in either caller.
- Every `Order.paymentReference` is unique and generated server-side at checkout. This is what makes fulfillment idempotent: a webhook that arrives after the client already verified the order finds a `PAID` order and does nothing further.
- Webhook routes (`app/api/webhooks/**`) must verify the provider's signature against the raw request body before processing any event. Never process a webhook payload before signature verification succeeds.
- New payment provider integrations (e.g. adding Flutterwave alongside Paystack) must implement the same `verifyAndFulfillOrder`-compatible contract — a verify function that checks transaction status AND amount against the stored order total before fulfillment.
- Client funds are never held or routed through a platform-controlled account. Every tenant is onboarded with a payment-provider Subaccount (`Tenant.paystackSubaccountCode` / `Tenant.flutterwaveSubaccountId`); the platform fee is taken via the provider's automatic split, not by manual transfer.

## Data Fetching

- Use the `api` Axios instance from `src/lib/api.ts` for platform/admin API calls (auto-injects Bearer token).
- Fetch admin dashboard data with React Query: `useQuery({ queryKey, queryFn })`.
- Handle errors with `handleApiError(err)` from `src/lib/api.ts` — it calls `toast.error()` automatically.
- Re-fetch after mutations by invalidating the relevant query key, not by manual refetch calls scattered across components.
- Storefront cart state uses Zustand (`src/lib/store/cart.ts`), persisted to `localStorage` so it survives a page refresh — never persist cart state via cookies or a database write until checkout is actually submitted.

## Hooks Reference

| Hook             | Description                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `useFilters`     | Filter-state manager — debounces and serializes a filter object to a query string    |
| `useTabs`        | URL-driven tab state — reads/writes the active tab to a named query param            |
| `useDebounce`    | Returns a debounced copy of a value after a configurable delay                       |
| `useTableExport` | Wraps CSV/PDF export into `exportCsv`/`exportPdf` callbacks with `isExporting` state |
| `useCart`        | Zustand-backed cart hook — `addItem`/`removeItem`/`updateQuantity`/`clear`           |
| `useTenant`      | Reads the current `Tenant` from `TenantProvider` context inside storefront pages     |
| `useIsMobile`    | Returns `true` when viewport width is < 768 px                                       |

## Forms And UI Conventions

- Use React Hook Form + Zod for all forms (checkout, admin CRUD, coupon/delivery-zone config).
- Reuse existing field components in `src/components/fields/**` before introducing new field abstractions.
- For table and list filtering in the admin dashboard, prefer `useFilters` instead of ad-hoc query-string builders.

Critical rule for Select components:

- Do not use an empty string as a Select item value in Radix-based Selects.
- Use a sentinel value (for example `__all__`) and map it back to empty filter state in logic.

Confirmation dialogs:

- Use `<Dialog open={open} onOpenChange={setOpen}>` (Radix) with `<DialogContent>`, `<DialogTitle>`, and action buttons.
- Track loading state locally: `const [loading, setLoading] = useState(false)`.

Toast notifications:

- Import `toast` from `sonner`.
- Use `toast.success('message')` for mutations and `toast.error('message')` for failures.
- Do not render inline error text for API errors — use toasts, except for checkout payment failures, which must show inline next to the payment action (a toast alone is too easy to miss mid-checkout).

## Lint And Formatting Conventions

- Respect ESLint import sorting and unused import rules.
- Prefer removing unused imports instead of suppressing warnings.
- Do not use non-null assertions (`!`) — see TypeScript Conventions.
- Always use `formatDate` and `formatCurrency` from `src/lib/utils.ts`; never format dates or money ad hoc in a feature file.
- Before adding a helper function in a feature file, check `src/lib/utils.ts` first.
- If a helper is used across multiple admin or storefront flows, extract it to `src/lib/utils.ts` instead of duplicating it locally.
- Follow Prettier defaults in this repo: single quotes, semicolons, arrow parens always, tab width 2.

## Agent Operating Rules

- Prefer minimal, targeted edits that preserve existing architecture and naming.
- Do not perform broad refactors unless explicitly requested.
- Do not move files or folders unless required by the task.
- Never introduce a per-tenant deployment, database, or codebase branch as a "quick fix" — the multi-tenant architecture is a hard constraint, not a default that can be locally overridden (see Multi-Tenant Conventions).
- Never write order-fulfillment logic (marking paid, decrementing stock) anywhere other than `verifyAndFulfillOrder()`.
- Avoid introducing new dependencies unless necessary and justified by the task.
- If behavior changes around checkout, payments, or tenant resolution, add or update tests — these three areas are the highest-cost places to regress silently.

## Effective Repeated Practices (Session-Proven)

- Money-in-kobo is enforced everywhere: schema fields, API payloads, and form inputs. A PR that introduces a raw Naira float for any monetary value is a bug, not a style preference.
- Tenant resolution is derived from the URL segment (`_sites/[tenant]`) in Server Components, and from `x-tenant-slug` (set by middleware) in Route Handlers — never inferred from request body fields.
- Coupon and delivery-zone validation happens server-side only, inside `app/api/checkout/route.ts`. A discount or fee calculated client-side and merely displayed for UX must be re-verified server-side before being applied to a real order.
- Webhook handlers are idempotent by construction because `Order.paymentReference` is unique and `verifyAndFulfillOrder()` short-circuits on an already-`PAID` order — new webhook integrations must preserve this property.
- Custom-domain tenant resolution is cached at the edge (5 minutes) via `next: { revalidate }` on the fetch to `/api/internal/resolve-domain` — do not replace this with an uncached per-request DB call from middleware.

## Key Files

| Purpose                                           | File                                           |
| ------------------------------------------------- | ---------------------------------------------- |
| Prisma schema (source of truth for enums/models)  | `prisma/schema.prisma`                         |
| Tenant-scoped query wrapper                       | `src/lib/tenant-db.ts`                         |
| Tenant-routing middleware                         | `middleware.ts`                                |
| Custom domain resolver route                      | `src/app/api/internal/resolve-domain/route.ts` |
| Tenant layout (per-storefront root)               | `src/app/_sites/[tenant]/layout.tsx`           |
| Checkout route                                    | `src/app/api/checkout/route.ts`                |
| Shared payment verification/fulfillment logic     | `src/lib/payments/verify-order.ts`             |
| Client-triggered payment verify route             | `src/app/api/payments/verify/route.ts`         |
| Paystack webhook                                  | `src/app/api/webhooks/paystack/route.ts`       |
| Route constants                                   | `src/constant/routes.ts`                       |
| Shared utilities (formatDate, formatCurrency, cn) | `src/lib/utils.ts`                             |
| Axios instance + apiFetcher + handleApiError      | `src/lib/api.ts`                               |
| Cart store (Zustand)                              | `src/lib/store/cart.ts`                        |

## Change Safety

- Before editing, inspect related files for existing patterns.
- After editing, run appropriate validation commands for the scope of change.
- Any change touching `prisma/schema.prisma`, `middleware.ts`, `verify-order.ts`, or `app/api/checkout/route.ts` requires a manual end-to-end checkout test (add to cart → checkout → pay with a test card → confirm order is `PAID` → confirm stock decremented) before being considered done, since these are the highest-blast-radius files in the codebase.
- If validation cannot be run, clearly report what was not verified.
