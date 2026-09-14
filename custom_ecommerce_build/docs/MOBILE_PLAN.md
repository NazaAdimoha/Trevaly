# Merchant Mobile App — Implementation Plan

> **Status: Phases 0–3 are built. The auth gate is RESOLVED and the app bundles
> with the shared core compiled in.** Bearer-token auth works end to end against the running API with no
> change to `authorizeStore()`. What changed against the plan as written is in
> "Build notes" at the end — including two assumptions that were wrong and one
> security property worth a decision.

React Native (Expo) for iOS and Android, sharing one codebase with the existing
Next.js platform.

Written against the working build. Where something is measured, the number came
from this repository, not from an estimate.

---

## The decision this plan is built on

A second client is a permanent cost. `AGENT.md`'s architecture exists so a fix
ships once and every tenant gets it; a mobile app breaks that for the admin
surface, and no amount of tooling fully restores it. The plan below is
structured to make that cost as small as it can be — and the single biggest
lever is **scope**, not technology.

**Build four things, not the dashboard.** A merchant on a phone needs:

1. _Did I get an order?_ — a push notification
2. _Mark it shipped_
3. _Add the thing I just photographed_
4. _What is running out?_

Coupons, delivery zones, CSV import, store settings, branding and the platform
admin are desk tasks done once at setup. They stay on the web, reachable from
the app by deep link. Four screens is a tractable second codebase; twenty is a
second product.

---

## Part 1 — What is already portable

Measured across `src/lib/**` and `src/constant/**`.

### Tier 1 — moves to the shared package unchanged

| Module                       | Why it already works                                      |
| ---------------------------- | --------------------------------------------------------- |
| `lib/products/variants.ts`   | Written Prisma-free on purpose. Pricing + availability    |
| `lib/validation/product.ts`  | Zod only                                                  |
| `lib/validation/category.ts` | Zod only                                                  |
| `lib/validation/import.ts`   | Zod + pure parsing                                        |
| `lib/csv.ts`                 | Pure string handling                                      |
| `lib/domains/hostname.ts`    | Pure                                                      |
| `lib/media/folder.ts`        | Pure — the upload folder boundary, needed by both clients |

`variants.ts` is the proof the boundary is real: it was written without Prisma
imports so it could run in a Client Component, and that same property makes it
run in React Native untouched.

### Tier 1b — moves after a small, worthwhile change

| Module                       | Change needed                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/utils.ts`               | **Split.** `formatCurrency`, `toMinor`, `toMajor`, `formatDate` are pure and belong in shared; `cn()` (clsx + tailwind-merge) is web-only and stays |
| `lib/validation/checkout.ts` | Imports `@/generated/prisma/client`; must import the generated **enums** entry, which the shared package re-exports                                 |
| `lib/validation/coupon.ts`   | Same                                                                                                                                                |

### Tier 2 — server-only, must never reach either client

`media/cloudinary.ts` (reads the API secret, uses `crypto`), `payments/paystack.ts`
(secret key), `rate-limit.ts`, `lib/prisma.ts`, `lib/tenant-db.ts`, `lib/auth*.ts`.

### Tier 3 — web-only, do not attempt to share

`constant/cva.ts` (Tailwind class strings), `constant/storefront-themes.ts` (CSS
custom properties), `lib/export/download.ts` (touches `document`),
`constant/menu.tsx` (JSX).

### What does not port at all

|                                 | Count |
| ------------------------------- | ----- |
| Radix packages                  | 14    |
| UI primitives (`components/ui`) | 36    |
| Formik field components         | 17    |

All DOM-bound. `TableFactory` renders a `<table>`; Tailwind classes are CSS.
Budget for rebuilding **every screen**, and treat any plan that assumes
component reuse as wrong.

### The keystone: generated enums

`src/generated/prisma/enums.ts` is pure TypeScript with **zero imports** — plain
`as const` objects. It is the shared domain vocabulary (`OrderStatus`,
`StorefrontTheme`, `DeliveryMethod`, `PaymentProvider`…) and it is generated
from `schema.prisma`. Re-exporting it from the shared package is what stops the
two apps ever disagreeing about what `PAID` means.

---

## Part 2 — Repository shape

```
custom-ecommerce/
├── pnpm-workspace.yaml
├── package.json                    workspace root
├── packages/
│   └── core/                       @commerce/core — no React, no Node, no DOM
│       ├── enums.ts                re-export of generated Prisma enums
│       ├── money.ts                formatCurrency, toMinor, toMajor
│       ├── date.ts                 formatDate
│       ├── variants.ts             moved from lib/products
│       ├── validation/             product · category · checkout · coupon · import
│       ├── media/folder.ts         upload folder boundary
│       └── api/                    request + response contracts (Part 3)
├── apps/
│   ├── web/                        the current custom_ecommerce_build
│   └── mobile/                     Expo
```

**`packages/core` has one rule: it may not import React, Node built-ins, or
anything DOM.** A lint rule enforces it (`no-restricted-imports` on `next/*`,
`react`, `crypto`, `fs`, `@prisma/client`). The moment that rule is relaxed the
package stops being shareable and the whole arrangement quietly fails.

### On moving `custom_ecommerce_build` → `apps/web`

Recommended, and best done **before** any mobile code exists. It touches:

- `tsconfig.json` path aliases (`@/*` must keep resolving)
- `prisma.config.ts` and the `prisma/` directory location
- `playwright.config.ts`, `vitest.config.mts`
- `.env` location
- **Vercel project root directory** — the one that breaks the deploy if missed

The safety net is the existing gate: `pnpm lint && pnpm typecheck && pnpm test &&
pnpm test:e2e && pnpm build`. The E2E suite runs against the real Paystack test
gateway and would catch a broken move immediately. Do the move as its own
commit, verified by that gate, changing nothing else.

Keeping the folder where it is also works — `pnpm-workspace.yaml` does not care
about names — but `custom_ecommerce_build/` sitting beside `mobile/` will
confuse every future contributor.

---

## Part 3 — The API contract, and the problem nobody plans for

### A mobile client is not versioned by your deploy

This is the single biggest difference from the web dashboard and the source of
most of the pain. The web dashboard is always exactly as fresh as the server. A
phone is not: a merchant on v1.2 will be calling your API three months after you
ship v1.5, because they never opened the App Store.

Four consequences, all non-negotiable:

1. **API responses are additive-only.** Never rename a field, never change a
   type, never remove one. Add and deprecate.
2. **Ship a minimum-version gate before v1.** An endpoint the app calls on
   launch that can answer "you must update". Without it, a breaking change is
   unshippable forever.
3. **Feature-flag from the server**, so a half-built screen can be dark-launched
   and an old build can be told to hide something.
4. **Never assume the client validates anything.** Already true of the
   storefront; it is doubly true when you cannot fix the client.

### How the two clients stay in agreement

Both apps are TypeScript in one workspace, so the cheapest correct mechanism is
also the strongest:

- **Compile time.** Response shapes are declared once in
  `packages/core/api/contracts.ts`. Route handlers are typed against them; the
  mobile client imports the same type. Drift becomes a build error in both
  apps — no codegen, no OpenAPI, no generated client to regenerate.
- **Runtime, for the endpoints mobile depends on.** A Zod response schema per
  endpoint, `.parse()`d in the mobile API client. This catches the case
  compile-time cannot: a **deployed** server that is newer than the installed
  app. Failing loudly on a shape change beats rendering `undefined` in a
  merchant's order list.

### API gaps to close before mobile work starts

The store API is more complete than expected. Existing and reusable as-is:

```
/api/stores/[slug]/products         products/[id]      products/import
/api/stores/[slug]/orders           orders/[id]
/api/stores/[slug]/categories       categories/[id]
/api/stores/[slug]/coupons          delivery-zones
/api/stores/[slug]/uploads/signature
```

Missing:

| Endpoint                          | Why                                                                                                                                                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/stores/[slug]/overview` | The dashboard home runs six aggregate queries **inside `page.tsx`** — product counts, paid/pending order counts, revenue sum, stock-issue count. There is nothing for a mobile client to call. Extract it; the web page should then consume it too, so one query set serves both |
| `GET /api/me/stores`              | The app needs the list of stores this user may act for. `listMyStores()` exists in `lib/auth.ts` but is not exposed                                                                                                                                                              |
| `POST /api/devices`               | Push token registration (Part 5)                                                                                                                                                                                                                                                 |
| `GET /api/app/config`             | Minimum version + feature flags                                                                                                                                                                                                                                                  |

---

## Part 4 — Authentication

**Verify this first. It is the largest unknown in the plan and it gates
everything else.**

Today `authorizeStore()` calls `auth()` from `@clerk/nextjs/server`, which reads
the session cookie that `clerkMiddleware` establishes. A native app has no
cookie jar tied to your domain — it needs a bearer token.

The intended path is `@clerk/clerk-expo`: the app signs in, calls `getToken()`,
and sends `Authorization: Bearer <token>` on every request. `clerkMiddleware`
is designed to accept a session token from that header as well as from a
cookie, which would mean **`authorizeStore()` needs no change at all** — the
tenant-membership check is a database lookup against the URL slug and is
transport-agnostic.

**Verified — this is no longer a risk.** A real Clerk session token was minted
through the Backend API and sent as `Authorization: Bearer <jwt>` against the
running server. Everything works with **no change to `authorizeStore()`**, and
every security property holds:

| Probe                                  | Result                                 |
| -------------------------------------- | -------------------------------------- |
| No header                              | `401 {"error":"Not signed in"}`        |
| Valid bearer token to `/api/me/stores` | `200`, correct store, correct role     |
| Valid bearer token to `/overview`      | `200`, real figures                    |
| Adaobi's owner reaching Chidi's store  | `404 Store not found` — boundary holds |
| Garbage bearer                         | `401`                                  |
| Tampered signature                     | `401`                                  |
| Empty bearer                           | `401`                                  |

The tenant check is a database lookup against the slug in the URL, so it never
cared how the caller authenticated. That is why it needed no change.

Two things to settle at the same time:

- `/api/stores(.*)` is already inside `isClerkRoute` in `proxy.ts`, so middleware
  runs there. Confirm it does not redirect an unauthenticated API request to
  the sign-in page — an app needs a 401, not a 307 into HTML.
- Token refresh and sign-out. Clerk handles the refresh; make sure a revoked
  session actually locks the app out rather than running on a cached token.

---

## Part 5 — Push notifications

The highest-value feature in the app by a distance. "You got an order" is the
reason a merchant installs it.

None of the infrastructure exists yet — there is no email either (still M8), so
this is greenfield.

**Use Expo Push.** One API for APNs and FCM, no per-platform certificate
handling in v1.

New model:

```prisma
model Device {
  id           String   @id @default(cuid())
  tenantId     String
  clerkUserId  String
  expoPushToken String  @unique
  platform     String   // ios | android
  appVersion   String?
  lastSeenAt   DateTime @updatedAt
  createdAt    DateTime @default(now())

  @@index([tenantId])
  @@index([clerkUserId])
}
```

Tenant-owned, so it carries `tenantId` + index and goes into
`TENANT_SCOPED_MODELS` in the same change — per `AGENT.md`.

### The rule that matters

**A push failure must never fail a fulfillment.**

`verifyAndFulfillOrder()` is the most carefully guarded function in the
codebase: a conditional `PENDING → PAID` claim, guarded stock decrements, a
`PlatformEarning` row written with `skipDuplicates` precisely so a bookkeeping
row cannot roll back a payment. A push send must be held to the same standard —
and the safest way is to keep it **outside the transaction entirely**: fire it
after the fulfillment has committed, wrapped so nothing it does can throw into
the caller. A merchant missing a notification is an annoyance; a merchant
losing a paid order is the failure this system exists to prevent.

Trigger from the webhook path, not the browser-verify path, so a customer
closing their tab still produces the notification.

---

## Part 6 — Phases

Estimates assume one developer who has built an Expo app before. They do not
assume familiarity with this codebase.

### Phase 0 — Workspace and shared core · ~1 week

- `pnpm-workspace.yaml`, workspace root `package.json`
- Move `custom_ecommerce_build` → `apps/web`; verify with the full gate
- Create `packages/core`; move Tier 1 modules; split `lib/utils.ts`
- Point `validation/checkout.ts` and `coupon.ts` at the shared enums
- Lint rule banning React/Node/DOM imports inside `packages/core`
- Move the relevant unit tests with the code

**Exit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`
green, with `apps/web` importing everything moved from `@commerce/core`.

### Phase 1 — API readiness · ~1 week

- **Clerk bearer-token spike first** (Part 4). If it fails, stop and re-plan
- `GET /overview`, `GET /api/me/stores`, `GET /api/app/config`
- `packages/core/api/contracts.ts`; type the existing store routes against it
- Zod response schemas for the endpoints mobile will use
- Confirm API routes return 401 JSON, never an HTML redirect

**Exit:** a script authenticates as a merchant with a bearer token and reads
products, orders and the overview.

### Phase 2 — App skeleton · ~1 week

- Expo + expo-router, TypeScript strict
- `@clerk/clerk-expo` sign-in, secure token storage
- API client: base URL, bearer injection, Zod parsing, typed errors
- Store switcher (`/api/me/stores`) — a user may own more than one
- Design tokens ported by hand from `globals.css` (the greens, radii, spacing).
  **Values, not classes**

**Exit:** signs in, picks a store, shows a real product count from the API.

### Phase 3 — The four screens · ~2–3 weeks

| Screen          | Contents                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Today**       | Paid/pending counts, revenue, anything flagged `hasStockIssue`                                          |
| **Orders**      | List with status filter; detail with customer, items (including `variantLabel`), and status transitions |
| **Products**    | List with stock; quick stock edit; per-variant stock                                                    |
| **Add product** | Camera → `expo-image-picker` → existing signature endpoint → direct Cloudinary upload → create          |

The upload flow needs **no server change**: `/uploads/signature` already returns
config over `GET` and signs `paramsToSign` over `POST`, and the folder boundary
is enforced server-side. The app does exactly what the web widget does.

Deep-link out to the web dashboard for coupons, delivery zones, CSV import and
settings.

**Exit:** a merchant photographs a product, publishes it, sees it on their
storefront, and marks a real order shipped — all from the phone.

### Phase 4 — Push · ~1 week

- `Device` model + migration + `TENANT_SCOPED_MODELS`
- `POST /api/devices` on sign-in and on token change
- Send on paid order from the webhook path, outside the fulfillment transaction
- Deep link from the notification to the order
- Quiet hours, and one notification per order — never per webhook delivery

**Exit:** a real test payment on a seeded store rings a physical phone, and the
tap opens that order.

### Phase 5 — Offline and resilience · ~1 week — READS DONE

Nigerian merchants work on patchy data; this is not optional polish.

- [x] Read-through cache so Today, Orders and Products render from last-known
  state — `src/api/cache.ts` (AsyncStorage, `cache:v1:` prefix) behind
  `useQuery`, which is now stale-while-revalidate: paint the cache, refresh
  behind it
- [x] Clear stale-data indicator with a pull-to-refresh — `StaleNotice` in the
  UI kit, shown on all three data screens
- [ ] **No offline write queue in v1.** Queued stock edits and status changes
  applied later against a database that moved on is a data-integrity problem
  wearing a convenience costume. Fail the write, keep the input, let them retry

Two decisions worth keeping:

- **Cached responses are re-parsed with the same Zod schema, never trusted.** A
  cache written by an older build whose shape has since moved is dropped rather
  than rendered, so a contract change cannot ship a crash to anyone with a warm
  cache.
- **The cache is cleared on sign-out.** Keys are namespaced but not user-scoped,
  and a merchant handing the phone to staff must not leave the previous
  session's revenue on screen.

The screens' `if (error) return <ErrorState/>` guard had to become
`if (error && !data)`. Offline-with-cache sets both, and the original ordering
would have hidden the cached data behind a retry button — the exact failure this
phase exists to prevent.

**Exit:** app launches useful with the network off, and no write silently
disappears.

### Phase 6 — Ship · ~1–2 weeks

- EAS Build + EAS Submit
- Store listings, screenshots, privacy declarations
- Apple review: a merchant tool with push, camera and real accounts is not a
  thin wrapper, but budget one rejection round
- Sentry with release tagging; the minimum-version gate switched on

**Total: ~8–10 weeks** to a shipped v1 on both stores.

---

## Part 7 — The rules that stop the two apps drifting

Consolidation is not a one-time restructure; it is a set of rules held over
time. These are the ones that matter.

1. **Domain logic lives in `packages/core` or it does not exist.** If a rule is
   worth having in the app, it is worth having in one place. A pricing rule
   implemented twice is a pricing rule that will disagree.
2. **`packages/core` imports nothing platform-specific.** Enforced by lint,
   not by discipline.
3. **API responses are additive-only.** See Part 3.
4. **The server is the only authority.** Unchanged from `AGENT.md`: totals are
   recomputed server-side, membership is a database check, stock decrements are
   guarded. The app is a view.
5. **A schema change updates the shared enums in the same commit.** They are
   generated; regenerate and commit, so both apps move together.
6. **New tenant-scoped model → `tenantId` + index + `TENANT_SCOPED_MODELS`,
   same change.** `Device` is the first one this plan adds.
7. **Web keeps the long tail.** Any feature used less than weekly stays on the
   web and is deep-linked. Every screen added to the app is a screen maintained
   twice, forever.

---

## Part 8 — Decisions still open

| Question                                                             | Why it matters                                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Does Clerk accept a bearer session token on `clerkMiddleware` in v7? | Gates everything. Spike day one                                                                       |
| Does the merchant app need the **platform** (super-admin) surface?   | Assumed no. It is your team's tool and they have laptops                                              |
| Apple Developer + Google Play accounts                               | ~$99/yr and ~$25 one-off, plus enrolment lead time. Start this early — it blocks Phase 6, not Phase 1 |
| Who maintains the app?                                               | The honest cost is not the 8–10 weeks; it is every subsequent feature shipping twice                  |
| Expo managed or bare?                                                | Managed unless something needs a native module Expo lacks. Nothing in this plan does                  |

---

## Appendix — What this plan deliberately does not do

- **No storefront app.** Shoppers arrive from an Instagram link; an install
  prompt between them and checkout is a conversion killer. Merchant only.
- **No offline writes** (Part 5).
- **No component sharing between web and mobile.** It is not possible here, and
  designing as though it were produces an abstraction that serves neither.
- **No React Native Web.** It would mean rewriting the 36 primitives and 17
  field components that the Ceviant port exists to reuse — the same trade
  BUILD_PLAN D5 already rejected once, for the same reason.

---

## Build notes — Phases 0 and 1

### The web app did not move

`custom_ecommerce_build/` stays where it is, by decision. `packages/core` is
therefore **source-shared** rather than an installed workspace package: the web
app compiles the `.ts` files directly through a `@core/*` alias, and its
`pnpm-lock.yaml` and `node_modules` were never touched.

### Two things the plan got wrong

**Turbopack scopes module resolution to the project root.** A `tsconfig` path
alias pointing at `../packages/core` type-checks perfectly and then fails at
runtime with `Module not found`. The fix is `turbopack.root` (and
`outputFileTracingRoot`) widened to the repository root in `next.config.js`.
Caught by a one-file spike before anything was migrated — worth keeping that
habit for the Metro equivalent.

**A global `zod` path mapping breaks other packages.** Mapping `zod` in the web
`tsconfig` so that `packages/core` could resolve it also hijacked
`@cloudinary-util/url-loader`, which depends on zod 3 — its inferred
`ImageOptions` type collapsed and `CldImage`'s `crop` prop vanished. `paths` is
program-wide, not per-directory. The fix is a scoped install: `packages/core`
has its own `node_modules/zod`, pinned to the exact version the web app uses.

### Resolution has to be taught to four tools, not one

| Tool       | Mechanism                                            |
| ---------- | ---------------------------------------------------- |
| TypeScript | `paths` in `tsconfig.json`                           |
| Turbopack  | `turbopack.root` in `next.config.js`                 |
| Vitest     | `resolve.alias` in `vitest.config.mts`               |
| ESLint     | cannot lint outside its base path at all — see below |

Expect Metro to need its own (`watchFolders` + `extraNodeModules`).

### The purity rule is a script, not a lint rule

ESLint flat config refuses to lint files outside its base path. Rather than a
second ESLint install inside the package, `scripts/check-core-purity.mjs` scans
for banned imports and platform globals, and `pnpm lint` chains it. Verified by
planting a `crypto` import, a `react-native` import and a `document` reference —
all three were caught.

### `/api/me/stores` proved the matcher rule

The first version returned **500, not 401**, because it calls `auth()` and was
not listed in `isClerkRoute` in `proxy.ts`. That is the documented failure mode
from `AGENT.md`, hit by the person who wrote it down. Both new authenticated
endpoints now answer `401 {"error":"Not signed in"}` — JSON an app can parse.

### What is in place

- `packages/core`: variants, csv, hostname, reserved, money, upload folder, the
  five Zod validators, generated enums, and the API contracts
- `pnpm sync:core`, wired into `db:generate`, so a schema change reaches both
  apps in one command
- `GET /api/me/stores`, `GET /api/stores/[slug]/overview`, `GET /api/app/config`
- `getStoreOverview()` shared by the dashboard page and the API, so the phone
  and the browser cannot disagree about revenue
- Gate green: lint 0 errors, typecheck, 101 unit tests, 7/7 E2E against the live
  Paystack gateway, build 44 routes

### The auth gate is resolved

Confirmed by probe (see Part 4). `@clerk/clerk-expo` supplies the token client
side via `getClerkInstance().session?.getToken()`; `clerkMiddleware` accepts it
server side. No application change was required.

### One security property that needs a decision

**A revoked session's token keeps working until it expires.** Measured: after
`POST /v1/sessions/{id}/revoke`, a token minted with a 600-second lifetime still
returned `200`.

That is inherent to JWTs, not a fault in this setup — the token is verified by
signature and expiry, with no per-request lookup. The exposure window is exactly
the token lifetime, and **Clerk's default session-token TTL is 60 seconds**
(measured from `exp - iat`), which `getToken()` refreshes transparently. So in
practice, signing a merchant out or revoking a stolen device's session takes
effect within a minute.

For a merchant admin app that is the right trade. Record it as a conscious
decision rather than discovering it during an incident: if instant revocation is
ever required, it costs a lookup on every authenticated request.

Do not raise the token lifetime to reduce refresh chatter. It is the only thing
bounding that window.

---

## Build notes — Phases 2 and 3

The Expo app lives at `mobile/`. Expo SDK 57, React Native 0.86, React 19.2.

### Metro was the fifth tool, exactly as predicted

`watchFolders` plus `resolver.nodeModulesPaths` and an `extraNodeModules` entry
for `@core`. Without them the bundle fails with "Unable to resolve module" — the
mobile twin of the Turbopack failure in Phase 0. That makes **five** tools that
each had to be taught the alias independently: TypeScript, Turbopack, Vitest,
the purity script, and Metro.

`node-linker=hoisted` in `.npmrc` is also required: Metro's haste map and native
autolinking both assume a flat `node_modules` and cannot follow pnpm's symlinked
store.

### `npm run bundle:check` is the test that counts

`tsc` resolves `@core/*` through tsconfig paths and passes happily while Metro
fails on the same import. A full `expo export` is the only check that proves the
app would actually run. Verified by inspecting the compiled Hermes bundle:
`ALLOWED_ORDER_TRANSITIONS`, `availableStock`, `displayPriceKobo`,
`variantPriceKobo`, `toMinor` and the Prisma enum values are all present — the
shared core is genuinely compiled in, not stubbed.

### One more thing moved into the core

`ALLOWED_TRANSITIONS` was defined inside the orders route handler. It is now
`@core/orders`, imported by both the API and the app. Duplicating it would have
meant the app offering "Mark shipped" on an order the server refuses — the
merchant taps, nothing happens, and nobody can explain why.

### What the app does

| Screen       | Notes                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| Sign in      | Clerk, same instance as the web. No sign-up: stores are created by the operator      |
| Today        | Store picker (auto-selects a single store), revenue, counts, stock-issue alert       |
| Orders       | Status filter, relative timestamps, `hasStockIssue` called out inline                |
| Order detail | Customer, items with `variantLabel`, totals, transitions from the shared table       |
| Products     | Sorted by lowest stock first, per-variant counts, availability from `@core/variants` |
| Add product  | Camera or library, direct-to-Cloudinary upload, publish                              |
| Settings     | Store switcher, deep links to the web for the long tail, sign out                    |

The upload needed **no server change**: `/uploads/signature` already returns the
config over GET and signs params over POST, and the folder is derived from the
authorized tenant.

### Not done, and deliberately

Push notifications (Phase 4), offline cache (Phase 5) and store submission
(Phase 6). The app has never run on a device or simulator — that is the one
verification unavailable here, and the first thing to do next.
