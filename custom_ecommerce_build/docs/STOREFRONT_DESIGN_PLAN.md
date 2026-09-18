# Storefront design plan — from "basic" to a theme a merchant would pay for

Written after studying the reference screenshots (Shopify Theme Store: Helix,
Radian, Soft, Egoiste) against what we actually render today.

**On the references.** These are commercial themes. What we take from them is
*structure and interaction patterns* — announcement bars, mega menus, shoppable
heroes, sticky add-to-cart, drawer carts, section-composed pages. Those are
industry vocabulary, not anyone's property. What we do not take is their visual
identity: their wordmarks, photography, exact palettes and copy. Our themes get
their own names, type pairings and colour work.

---

## Part 1 — Why ours looks basic

Not a styling problem. There is almost nothing on the page to style.

| Reference storefronts have | We have | Where |
| --- | --- | --- |
| Announcement bar (rotating, free-shipping progress) | nothing | — |
| Mega menu with promo imagery; mobile full-screen menu | **no navigation at all** — logo and cart icon only | `components/Layouts/Storefront/index.tsx` |
| Hero: image/video, headline, CTAs, shoppable hotspots | nothing — the home page is a bare product grid | `app/sites/[tenant]/page.tsx` (34 lines) |
| 8–14 composable marketing sections per page | one grid, fixed | `components/pages/storefront/home/index.tsx` |
| Ranked "Top 10", tabbed carousels, countdowns, lookbooks, press strip, FAQ, UGC grid, bundles | none | — |
| Drawer cart with progress bar, upsells, notes, discount | a full page reload to `/cart` | `components/pages/storefront/cart/index.tsx` |
| Sticky add-to-cart, gallery thumbnails, swatch chips, size grid, low-stock urgency, "pairs well with", description accordion, share, payment icons | single image, plain variant buttons, one CTA | `components/pages/storefront/product-detail/index.tsx` |
| Footer: newsletter, 3–4 link columns, giant wordmark, currency + language, socials, payment icons | store name, tagline, email, WhatsApp | shell, lines 126–150 |
| Mobile: bottom tab bar, filter sheet, density toggle, story rails | desktop layout, narrower | — |
| Motion: reveals, parallax, marquees, hover states, page transitions | one hover scale on a card | grid |

Merchant control today is five fields: `name`, `tagline`, `logoPublicId`,
`theme`, `primaryColor` (`packages/core/src/validation/store-settings.ts`).
A merchant cannot change a single word of the home page.

**The constraint we keep.** `AGENT.md` forbids a per-tenant component tree —
one cart, one checkout, one fulfilment path, verified once. That stays. The way
to get theme-store richness without forking per tenant is not more themes; it is
**sections**: one component library, composed and configured as data.

---

## Part 2 — The design system (foundation)

### 2.1 Tokens, widened

Today a theme sets ~12 CSS variables. The reference looks need roughly 40,
grouped so a merchant never edits CSS:

| Group | Tokens | Why it matters visually |
| --- | --- | --- |
| Colour roles | `--st-bg`, `--st-surface`, `--st-ink`, `--st-ink-muted`, `--st-line`, `--st-accent`, `--st-accent-ink`, `--st-sale`, `--st-success` | Radian is ink-on-black with white surfaces; Helix is white with a chartreuse accent. One `--brand` cannot express either. |
| Type | `--st-font-display`, `--st-font-body`, `--st-scale-ratio`, `--st-heading-transform`, `--st-heading-tracking`, `--st-heading-weight` | The Radian look is *entirely* wide uppercase display type; Soft is rounded lowercase. |
| Shape | `--st-radius-card`, `--st-radius-control`, `--st-radius-media`, `--st-border-width` | Pill buttons vs hard 0px edges is most of the "expensive" feeling. |
| Density | `--st-section-y`, `--st-gap`, `--st-container`, `--st-grid-min` | Editorial breathes; utility packs. |
| Media | `--st-media-ratio` (portrait 3:4, square, landscape), `--st-media-fit` | Fashion is portrait; toys/electronics are square on white. |
| Motion | `--st-ease`, `--st-duration`, `--st-reveal-distance` | Section 5. |

### 2.2 Palette derivation, per merchant

"Colours depending on what the merchant sells" should not be a colour picker
they get wrong.

1. **Vertical presets.** Onboarding already asks what the store sells. Map that
   to a preset: `fashion-dark`, `fashion-light`, `sports`, `kids-toys`,
   `beauty`, `home`, `electronics`, `food`.
2. **Logo-derived accent.** Cloudinary returns dominant colours for an uploaded
   asset. When a merchant sets a logo we propose an accent from it, contrast-
   checked against the surface (WCAG AA, 4.5:1 for text, 3:1 for large/UI) and
   snapped to the nearest passing shade. They can accept or override.
3. **Guardrails.** The accent is used on controls, badges, rules and hovers —
   never as a full-bleed background, unless the preset was built for it
   (`fashion-dark`). This keeps the existing rule in `storefront-themes.ts`
   intact while letting a good colour do more work.

### 2.3 Four presets, drawn from the references

| Preset | Feel | Drawn from | Suited to |
| --- | --- | --- | --- |
| **Momentum** | Light, energetic, chartreuse accent, rounded controls, ranked carousels, badge-heavy | Helix | Sportswear, sneakers, gear |
| **Obsidian** | Black canvas, wide uppercase display, floating pill header, outline type, editorial restraint | Radian | Fashion, streetwear, jewellery |
| **Playful** | Pastel blocks, rounded everything, sticker badges, wavy dividers | Soft | Kids, toys, gifts, party |
| **Atelier** | Warm neutral, serif display, generous whitespace, large imagery | Egoiste | Luxury, heritage, tailoring |

Presets are token bundles **plus a default section arrangement** — a new store
lands on a complete-looking home page instead of an empty grid.

---

## Part 3 — The section system (the core change)

### 3.1 Data model

```
StorefrontLayout            one row per tenant
  tenantId      unique
  draft         Json        what the merchant is editing
  published     Json        what shoppers see
  publishedAt   DateTime?
  version       Int         optimistic concurrency for the app
```

A layout is `{ tokens: {...}, pages: { home: Section[], product: Section[],
collection: Section[] }, header: {...}, footer: {...} }`, where each section is
`{ id, type, visible, settings: {...}, blocks?: [...] }`.

Draft/published split is what makes a **preview** possible, and means a
half-finished edit on a phone never reaches a shopper.

### 3.2 The registry — one definition, three consumers

`packages/core/src/storefront/registry.ts` defines every section type once:
its label, icon, limits, and a **typed field list** (`text`, `richtext`,
`image`, `video`, `color`, `select`, `toggle`, `number`, `range`, `link`,
`product`, `collection`, `blocks`).

- **Web** renders it (`components/pages/storefront/sections/<type>.tsx`).
- **API** validates it — a Zod schema generated from the same field list, so an
  unknown type or a bad setting is rejected, not stored.
- **Mobile** *builds the editing form from it automatically.* This is the part
  that makes the app feature affordable: adding "Countdown bar" ships a web
  component and a registry entry, and the phone gets a working editor for free.

### 3.3 The section library (v1)

Each maps to something visible in the screenshots.

**Global**

| Section | Settings | Reference |
| --- | --- | --- |
| Announcement bar | messages[], rotate speed, link, dismissible, free-shipping progress | Helix "$50.00 away from free shipping" |
| Header | layout (classic / centred / floating pill), transparent-over-hero, menu (mega / simple), search, account, currency | Radian floating pill; Helix mega menu |
| Footer | newsletter, link columns[], giant wordmark toggle, socials, payment icons, currency + language | both |
| Mobile bottom bar | items (home, menu, search, shop, cart, account) | Helix mobile |
| Marquee strip | messages, speed, direction, separator | "Free Shipping · 30-Day Returns" |

**Home**

| Section | Settings | Reference |
| --- | --- | --- |
| Hero | media (image/video/GIF), overlay, eyebrow, heading, body, up to 2 CTAs, alignment, height, **hotspots[]** (x, y, product) with "Add all to cart" | Radian shoppable hero |
| Slideshow | slides[] (hero settings each), autoplay, dots/arrows | Helix |
| Collection row | collection, layout (grid / carousel / ranked "Top 10"), count, card style, swatches, quick add | Helix "Top 10 trending" |
| Tabbed products | tabs[] (label + collection), carousel | Radian "New arrivals / Best sellers / Sale" |
| Category tiles | items[] (image, label, link), shape (square / circle / cut-out), columns | Radian LEATHERS/BOTTOMS/TOPS |
| Featured collections accordion | items[] with preview image | Helix Running/Hiking/Tennis |
| Promo tiles | tiles[] (image, label, link, hover treatment), 2–4 up | Radian JUMPSUIT / BLAZER / HOODIES |
| Countdown | heading, end time, style (bar / block), post-expiry behaviour | Radian "SAVE 10% FOR" |
| Image with text | image side, heading, body, CTA | common |
| Rich text | heading, body, alignment, annotation (circle/underline SVG) | Radian "REFINED BASICS" |
| Press strip | quote, logos[] | Helix "In the press" |
| Testimonials | quotes[], layout | common |
| Lookbook rail | circular story avatars → collection or product | Radian |
| UGC / gallery | images[] (+ optional product tag), handle, columns | Helix @helixstore |
| FAQ | items[], open-first | Helix |
| Video | source (file/YouTube/Vimeo), poster, autoplay-muted, aspect | common |
| Bundle builder | collection, pick count, discount, "one checkout" summary | Radian "4 PIECES, ONE CHECKOUT" |
| Newsletter | heading, body, incentive, consent text | both |

**Product page** — gallery (thumbs left/below/stacked), title block, price with
compare-at, swatches (colour chips from variant images), size grid + size chart
link, quantity, add-to-cart + Buy it now, low-stock urgency, trust badges,
payment icons, share, description accordion, "pairs well with" carousel with
quick buy, recently viewed, sticky add-to-cart bar.

**Collection page** — banner, filter drawer/sheet, sort, density toggle
(2-up/4-up), circular sub-collection pills, infinite or paged.

### 3.4 Rendering

`SectionRenderer` maps `type → component`, renders server-side (SEO intact),
and lazy-loads only interactive ones (`next/dynamic`) so a page of static
sections still ships almost no JavaScript. Unknown type → skipped, never a
crash: an app on an old build must not be able to white-screen a storefront.

---

## Part 4 — Cart and checkout

| Now | Target |
| --- | --- |
| `/cart` page reload | **Drawer** on both desktop and mobile: free-shipping progress bar, line items with variant + qty stepper, "You may also like" rail, order note, discount code, estimated total, sticky Checkout with lock icon, payment icons, empty state with "Are you looking for?" collection tiles (Radian) |
| Checkout form, single column | Two-column on desktop (form left, sticky summary right), single column with collapsible summary on mobile; express wallets on top; inline field validation; delivery zone as cards, not a select |
| Order confirmation | Keep the current honesty about pending payments; add order summary, next steps, continue-shopping rail |

Add-to-cart from anywhere (quick add, hotspot, bundle) opens the drawer with the
new line highlighted. Optimistic update, rollback on failure.

---

## Part 5 — Motion

A motion budget, not decoration. Tokens: `--st-ease` (`cubic-bezier(.16,1,.3,1)`),
`--st-duration` (180ms controls / 420ms reveals / 700ms hero), `--st-stagger` 60ms.

| Where | Motion |
| --- | --- |
| Section entry | Fade + 16px rise, staggered per child, once. CSS `animation-timeline: view()` where supported (already the marketing pattern), IntersectionObserver fallback only for browsers without it |
| Product card | Image cross-fade to second image, swatch hover, quick-add slide-up |
| Header | Shrink on scroll; pill header lifts off the hero; hide-on-scroll-down for mobile |
| Drawer / sheets | Spring slide, backdrop blur fade, focus trap |
| Hero hotspots | Pulsing ring, label expands on hover/tap |
| Marquee | Duplicated track, GPU transform, pauses on hover |
| Countdown | Digit flip on second change |
| Page transitions | View Transitions API for product → collection continuity; no-op where unsupported |
| Text annotation | SVG stroke draw-on for the circle/underline marks |

**Rules.** Everything under `prefers-reduced-motion: no-preference`. No motion
library — CSS plus a ~2KB observer helper. Nothing animates layout properties
(transform/opacity only). Hero media never blocks LCP; reveals never delay
first paint.

---

## Part 6 — Media

- **Cloudinary art direction:** per-breakpoint crops (`c_fill` with gravity
  `auto`), AVIF/WebP via `f_auto`, `q_auto`. Portrait on mobile, landscape on
  desktop, from one public ID.
- **GIF → video.** Cloudinary converts an uploaded GIF to MP4/WebM
  (`f_auto,vc_auto`) — typically 90% smaller. Merchants upload the GIF they
  have; shoppers get a looping muted video.
- **Video sections:** poster frame always, `preload="none"`, autoplay only when
  muted and in view, pause off-screen.
- **Blur-up placeholders** from a 20px Cloudinary thumbnail, so a slow Nigerian
  3G connection sees shape immediately instead of grey boxes.
- **Aspect discipline:** every media box has a fixed ratio from tokens — zero
  cumulative layout shift.

---

## Part 7 — Merchant configuration in the mobile app

The ask: a merchant customises all of this from their phone and it appears on
their storefront. Because every section's fields come from the shared registry,
the app needs a handful of screens, not one per section.

### 7.1 Screens

```
Store → Design
  Appearance        preset picker (live thumbnails), palette (accent from logo
                    or picker, contrast-checked), typography pairing, corner
                    style, density, media shape
  Pages             Home / Product / Collection  → section list
    Section list    drag to reorder, toggle visible, duplicate, delete,
                    "+ Add section" from the registry (grouped, with previews)
    Section editor  form generated from the registry field list
  Header & footer   menu builder, footer columns, socials, payment icons
  Preview           the real storefront, draft mode, phone/tablet/desktop widths
  Publish           diff summary ("3 sections added, palette changed"), publish,
                    revert to published, version history (last 10)
```

### 7.2 Field controls (the whole editor surface)

| Field | Control |
| --- | --- |
| text / richtext | input / lightweight rich text with bold, italic, link |
| image | camera roll or camera → Cloudinary direct upload (existing `uploadProductImage` path), crop to the section's ratio |
| video / gif | picker with size warning, converted server-side |
| color | swatch row from the palette + custom picker, contrast warning inline |
| select / toggle / number / range | native segmented control, switch, stepper, slider |
| product / collection | searchable picker reusing the products list the app already has |
| link | menu of routes (collection, product, page, URL) |
| blocks | nested reorderable list (slides, tiles, FAQ items, hotspots) |

**Hotspot editor:** tap a point on the hero image to drop a dot, then attach a
product — the phone is genuinely the better device for this.

### 7.3 Preview

A WebView on `{storefront}/?preview={token}`, where the token is short-lived and
signed by the API. It renders the **draft** layout. Edits push a message to the
WebView to re-render without a round trip where possible; otherwise reload.
Width chips simulate phone/tablet/desktop.

### 7.4 API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/stores/:slug/storefront` | draft + published + version |
| `PUT /api/stores/:slug/storefront/draft` | save draft (optimistic `version`; 409 on conflict) |
| `POST /api/stores/:slug/storefront/publish` | draft → published, keep history |
| `POST /api/stores/:slug/storefront/revert` | published → draft, or roll back to a version |
| `POST /api/stores/:slug/storefront/preview-token` | signed, 30 min |
| `GET /api/storefront/:slug/layout` | public, published only (cached) |

All validated against the registry schema in `packages/core`, so the app, the
API and the web app cannot disagree about what a section is.

### 7.5 Offline and safety

- Draft edits queue locally and sync — a merchant on a bad connection keeps working.
- Publish is explicit, reversible, and shows what changed.
- A section referencing a deleted product renders nothing rather than erroring.

---

## Part 8 — Guardrails

- **Lighthouse mobile ≥ 90** on a seeded store, per preset, per page type. This
  is a gate, not an aspiration: the current storefront is fast because it is
  empty, and sections are how that gets lost.
- **JS budget:** ≤ 60KB gzipped on a home page with 8 sections.
- **No per-tenant CSS or JS.** Tokens are inline custom properties, exactly as
  today.
- **Accessibility:** keyboard reachable, focus-visible on every control, drawers
  trap focus, contrast enforced at configuration time, tap targets ≥ 44px.
- **One checkout.** No preset or section may alter money handling.
- **SEO:** sections render server-side; structured data still derives from the
  same data the page renders.

---

## Part 9 — Delivery

Each phase ships something a merchant can see.

| Phase | Scope | Outcome |
| --- | --- | --- |
| **1. Foundation** ✅ **done 2026-09-17** | Widened tokens, 4 presets, motion primitives, `StorefrontLayout` model + registry + API, section renderer | Stores render from their own layout; palettes, type and spacing come from a preset |
| **2. Chrome** ✅ **done 2026-09-17** | Header (3 layouts, mega menu, mobile overlay), announcement bar, footer, mobile bottom bar, drawer cart, search | The store stops looking like a demo; navigation exists |
| **3. Home sections** ✅ **done 2026-09-17** | Hero (+ hotspots), collection row (+ ranked), tabbed products, category tiles, promo tiles, marquee, countdown, rich text, image+text, FAQ, press, testimonials, gallery, newsletter | Composed home pages, seeded per preset |
| **4. Product & collection** (~1 wk) | Gallery, swatches, size grid, sticky ATC, urgency, trust, pairs-well-with, description accordion; filters, sort, density, sub-collection pills | The two pages that convert |
| **5. Mobile editor** (~1.5 wk) | Design section of the app: appearance, section list with reorder, generated forms, image/hotspot pickers, preview WebView, publish/revert | The ask: a merchant designs their store from their phone |
| **6. Polish** (~1 wk) | Page transitions, annotations, bundle builder, lookbook, video, performance pass against the budget, a11y audit | The details that make it feel bought, not built |

Roughly **7 weeks** of focused work. Phases 1–2 alone remove most of the "basic
and ugly" feeling; 5 is the one that scales, because after it a merchant changes
their storefront without us.

---

## Phase 1 — what shipped (2026-09-17)

| Piece | Where |
| --- | --- |
| Colour maths: contrast, readable ink, accent proposed from a logo | `packages/core/src/storefront/color.ts` |
| 40 tokens, 4 presets, legacy-theme mapping, CSS variable output | `packages/core/src/storefront/tokens.ts` |
| Section registry — labels, fields, generated Zod schemas, defaults | `packages/core/src/storefront/registry.ts` |
| Layout schema, forgiving parse, media-id walker, seeded default | `packages/core/src/storefront/layout.ts` |
| `StorefrontLayout` table (draft + published + version) | `api/prisma/migrations/…_storefront_layout` |
| Merchant endpoints: read, save draft, publish, revert | `api/src/modules/storefront/layout.{service,controller}.ts` |
| Public `GET /api/storefront/:slug/layout` | storefront controller |
| Token-driven storefront CSS, reveal/stagger/hover motion | `src/styles/globals.css` |
| Section renderer + `collection-row` (grid, carousel, ranked) + `rich-text` | `src/components/pages/storefront/sections/` |

Verified: 20 core tests, 10 live API tests (draft invisible until published, stale
version refused, another store's images refused, unknown section named, a broken
stored layout degrades to an empty page rather than an error), and the dev store
rendering its own palette end to end.

Decisions taken while building, worth knowing:

- **The brand colour is now the accent** rather than a hairline, but it is passed
  through `ensureContrast` first — a merchant's colour is nudged along its own
  hue until a label on it is readable, never swapped for a different colour.
- **Old themes map onto presets** (`CLASSIC`/`UTILITY` → Momentum, `EDITORIAL` →
  Atelier), so existing stores improve without anyone touching a setting.
- **A layout never fails closed.** Unknown sections and malformed settings are
  dropped with a logged reason; the page still renders.
- **Media ids in a layout are ownership-checked**, closing the same hole product
  images and logos already close.

---

## Phase 2 — what shipped (2026-09-17)

The store now has the parts a shopper uses on every visit, none of which
existed before.

| Piece | Behaviour worth knowing |
| --- | --- |
| Header (`header.tsx`) | Three layouts — classic, centred, floating pill. Transparent over a hero until the shopper scrolls. Mega menu opens on hover **and focus**, so it is reachable without a mouse. The cart control never moves between layouts. |
| Navigation | Merchant menu if they built one, **their categories if they did not** — the fallback matters more than the builder, because until now a store had no navigation at all. |
| Announcement bar | Rotates through messages, links, dismissible per browser. Read through `useSyncExternalStore`, so it does not render and then vanish on hydration. |
| Cart drawer (`cart-drawer.tsx`) | Opens over the page instead of navigating. Free-delivery progress bar from the merchant's own threshold, quantity steppers, stock ceiling message, subtotal, checkout. Empty state offers products rather than dead-ending. `/cart` still works as a URL. |
| Search | New `GET /storefront/:slug/search` (name, SKU, description; two-character minimum) plus a `/search?q=` page — a shareable URL, `noindex`. |
| Mobile menu | Full-height panel, sections expand in place, with the merchant's imagery when a menu has any. |
| Mobile bottom bar | Home, Menu, Search, Cart — where a thumb already is. `account` stays out of the default: there are no customer accounts, and a tab that leads nowhere is worse than one fewer tab. |
| Footer | Newsletter, link columns, contact, socials, oversized wordmark, payment marks drawn inline (six logo files is six requests for reassurance). |
| Drawer primitive (`drawer.tsx`) | Escape closes, focus is trapped inside and returned to whatever opened it, the page behind does not scroll. Hand-written, because that behaviour is the whole of what a library would sell us. |

Verified by `e2e/storefront-chrome.spec.ts` (4 tests, real browser): navigation
reaches a category, adding to the cart opens the drawer **without leaving the
page**, Escape returns focus to the cart button, search lands on a shareable
URL, and on a 390px viewport the bottom bar and full-screen menu work. The
checkout suite still passes 7/7 against the real Paystack test gateway.

Two changes the tests caught, both worth keeping:

- **The cart control is a button now, not a link.** It opens the drawer. The
  checkout E2E asserted the old role and had to be updated — a real contract
  change, not a test fix.
- **Two "Email" labels on the checkout page** once the footer gained a
  newsletter field. The footer's is now "Email address for updates"; an
  ambiguous label is an accessibility problem before it is a test problem.

---

## Phase 3 — what shipped (2026-09-17)

Fourteen sections render, and the merchant's arrangement decides the page.

| Section | Notes |
| --- | --- |
| Hero | Image or video (a GIF is converted to video by Cloudinary), overlay, two CTAs, and **shoppable hotspots** — each dot a real button labelled with its product, so the photograph is keyboard-navigable. "Add all to cart" skips anything that needs a size chosen. |
| Collection row | Grid, carousel, or ranked "Top 10" with oversized numerals. |
| Product tabs | Switches without a request: every tab's products come from the catalogue the page already fetched. |
| Category tiles | Square, circle (the story-rail shape) or tall; scrolls sideways on a phone. |
| Promo tiles | Labels visible on touch, lifted on hover — a reveal a phone can never trigger is a label nobody reads. |
| Countdown | Says what happens when it ends, and means it. Digits start blank so the server and the browser never disagree. |
| Marquee | Duplicated track, CSS only, pauses on hover, second copy `aria-hidden`. |
| FAQ | `<details>`/`<summary>` — opens, is keyboard operable, announced correctly, and findable by the browser's own find-in-page, with **zero JavaScript**. |
| Press, testimonials, gallery, image+text, rich text, newsletter | Presentational; gallery photos can be tagged with the product in them. |

Verified by `e2e/storefront-sections.spec.ts` (5 tests): a hotspot names its
product and opens, "add all" fills the cart, tabs switch without navigating,
the FAQ opens natively, and the countdown actually counts.

### The performance pass — what measuring found

The plan set a budget of 60KB gzipped JavaScript. Measured against a production
build, the storefront home page was **268KB**. The product page was the same
size, which was the clue: the sections were not the cost, the baseline was.

| Cause | Fix | Saved (gzipped) |
| --- | --- | --- |
| `next-cloudinary`'s `CldImage` bundles `@cloudinary-util/url-loader`, which bundles **its own copy of Zod** — to build a URL we already build in `packages/core` | Our own `<img>` with a Cloudinary `srcSet`; also no longer a Client Component, so the catalogue ships no JS for images at all | **46KB** |
| `@core/storefront/tokens` held a Zod schema, and the shell imports that module for its colours | Schema moved to `token-schema.ts`; the token maths is dependency-free | **63KB** |
| `@/lib/utils` exports date helpers, so importing `cn` from it dragged in `date-fns` | `cn` lives in its own leaf module | ~13KB |
| `<Toaster/>` in the root layout put the toast runtime on every storefront page, where nothing toasts (checkout shows errors inline, deliberately) | Moved to the dashboard layout | ~12KB |

**268KB → 159KB gzipped, a 41% cut**, and a phone now fetches the 320px image
variant rather than a desktop-sized one.

**The budget was wrong, and should be restated.** Next's App Router baseline —
React, the router, hydration — is ~130KB gzipped here before a line of our code.
The honest target is **≤30KB of our own JavaScript** on top of that, which is
where we now sit. Getting materially below the framework floor would mean
static-rendering storefront pages with no client runtime at all: worth
considering, but it is a different project from this one.

---

## What shipped — Phase 4: the product and collection pages

These are the two pages that convert. Everything below answers a question that
otherwise sends a shopper back to the catalogue or into WhatsApp.

### The product page

| What | Why it is there |
| --- | --- |
| Gallery with thumbnails — beside the image from `md`, beneath it on a phone | "What does it look like from the other side" was previously unanswerable: the page showed one photograph |
| Breadcrumbs, with the collection in them | A shopper who arrives from Google has no way back into the shop otherwise |
| Size grid, sold-out options **struck through rather than hidden** | Hiding a size makes a shopper wonder whether the store stocks it at all; striking it through tells them it exists and is gone |
| "Only N left", shown only under 10 | Urgency that is sometimes false is worse than none |
| Quantity stepper, add-to-cart → drawer, Buy-it-now → checkout | The drawer IS the confirmation — it shows the line, the running total and the way out |
| Delivery / returns / Paystack, next to the button | The three questions asked after "does it fit" |
| Native share with a clipboard fallback | On a phone the native sheet means WhatsApp, which is how these links actually travel |
| Sticky buy bar, appearing only once the real button scrolls away | Never duplicates a control already on screen |
| "More in {collection}" | Arrives on the same API response as the product, so a dead end becomes a second page view for the cost of markup |
| Merchant sections under `pages.product` | The size guide, the care note, the delivery promise — whatever that shop needs to say about every product |

The sticky bar's button used to read "Choose size" and be **disabled**. That
names the problem and then refuses to help with it; on a phone it means
scrolling back up hunting for the control it meant. It now scrolls the sizes
into view and focuses the first one that can actually be bought.

### The collection page

Sub-collection pills, an item count, sort, an in-stock filter, and a density
toggle — **every one of them a link, and the whole toolbar a Server Component.**

That is not purity. A filtered collection has to be a URL: it is how a merchant
sends "the bags under ₦20,000" to a customer, how the back button behaves, and
how the page gets indexed. A client-side filter would also be *lying* — it can
only reorder the products already on the page, so "price, low to high" over the
first 60 of 200 products shows the cheapest of a slice, not the cheapest in the
shop. Sorting and filtering are therefore the API's job:
`/catalog?sort=&inStock=&limit=` now does both, and returns `total` counted
**before** the limit, so a collection of 90 does not announce "60 items".

Density is three custom properties on a wrapper — the grid already reads its
column counts from tokens, so "show me more per row" costs no CSS and no
JavaScript.

The sort and filter parameters are deliberately left **out of the canonical
URL**: they are the same products in a different order, and indexing each
permutation splits a page's ranking between four copies of itself.

### What proved it

`test/storefront-catalog.test.ts` (8 tests) builds its own fixture rather than
using the seed store, because the interesting cases are the ones a healthy shop
does not have: something sold out, something whose parent stock is zero but
which still has a live size, something whose only in-stock variant has been
switched off. **A filter is only proved by what it excludes**, and the seeded
catalogue excludes nothing. `e2e/storefront-shopping.spec.ts` (6 tests) checks
that a sort really reorders the grid rather than decorating a button, that
density changes the column count, and that the sticky bar waits its turn.

### The JavaScript cost

Measured against production builds of this commit and of Phase 3, summing every
chunk the page loads, gzipped — **excluding Next's `nomodule` polyfill bundle,
which no browser that supports modules ever downloads.** (Counting it inflates
every figure by 38.5KB; it is the difference between the numbers below and a
naive "sum the script tags" reading.)

| Page | Phase 3 | Phase 4 | Δ |
| --- | --- | --- | --- |
| Home | 158.8KB | 158.9KB | +0.1KB |
| Collection | 155.3KB | 158.9KB | +3.6KB |
| Product | 157.5KB | 161.5KB | +4.0KB |
| Cart | 156.7KB | 156.8KB | +0.1KB |
| Checkout | 253.3KB | 253.4KB | +0.1KB |

The collection page's +3.6KB is the section renderer's import graph, not the
toolbar, which ships nothing. The product page's +4.0KB is the gallery, the
sticky bar and the intersection observer that drives it. Still inside the
restated ≤30KB-of-our-own-code target.

---

## What shipped — the order confirmation page

The last page of the session, and the one that looked least like the shop: a
grey tick, an order number, a total, and a link. Everything on it was hardcoded
`text-gray-600` rather than the store's tokens, so a shopper who had just sent
money landed on a page that looked nothing like the shop they sent it to.

### The API had to change first

A confirmation page cannot be made good with only a number and a total, so
`/storefront/:slug/orders/:reference` now returns the receipt: the lines bought
with their snapshots, the subtotal, discount, delivery zone and fee, the date,
and the first name.

**The reference in the URL IS the credential** — a customer who has just paid
has no account — so the field list is a security decision and is drawn
explicitly in the endpoint's own comment:

- **In:** what the customer themselves just typed or chose, and can already see
  on their bank statement.
- **Out:** the full email (masked, so the earlier audit finding cannot regress
  over the wire), the phone number, and the street address. The address was the
  judgement call — showing it back answers "did I type it right", but a link
  forwarded into a WhatsApp group would then carry someone's home address. The
  zone name confirms the right choice was made and costs nothing if the link
  leaks.
- The **first name only**, capitalised, for the greeting.

`test/storefront-order.test.ts` pins that list, and its most important
assertions are the negative ones: adding a field to a Prisma `select` is a
one-line change that silently starts shipping a phone number to anyone holding
a forwarded link, and nothing else in the system would notice.

### What the page shows now

A mark that **draws itself**, a confetti burst, the total **counting up**, then:
order number and date, a "what happens next" timeline, the lines with
thumbnails and their arithmetic (`₦18,000.00 × 3`, not just `Qty 3`), the
totals, where it is going, and two exits — a human, and the shop.

The timeline says only that payment is confirmed and names the steps that
follow; it does not imply live tracking we do not have. It is there because "I
have paid, now what?" was completely unanswered, and an unanswered question at
that moment becomes a WhatsApp message the merchant answers by hand.

The contact button prefers WhatsApp — it opens with the order number already
typed — and falls back to email. A store with neither gets no button rather
than a dead one. All three of the non-confirmed states (verifying, pending,
paid-after-cancellation) were dead ends with no way out; they now carry the
same two actions.

### A token the system was missing

Presets had `sale` (red) and no success colour, so a confirmation had nothing
correct to be. `--st-success` is now a real token with a value per preset —
lighter on Obsidian's dark ground, muted on Atelier's warm neutrals — plus a
derived `--st-success-wash`. Without it, a shop whose accent is red or orange
would render its one unambiguously good moment in the colour everything else
uses for danger, and **a shopper reads the colour before the words**.

### On the motion

Everything animated is transform, opacity or `stroke-dashoffset` — nothing that
triggers layout, so it runs at frame rate on the mid-range Android most of
these shoppers are holding. Every keyframe lives inside
`@media (prefers-reduced-motion: no-preference)`, and the **finished state is
the default state**: the dash offsets exist only inside the keyframes, so a
viewer who asked for less motion gets a drawn ring and a solid tick rather than
an invisible one. The confetti is eighteen spans that unmount after 2.6s, not a
canvas and not a library.

The count-up is the one piece that checks `prefers-reduced-motion` in
JavaScript rather than CSS, because there the animation *is* the value and
there are no keyframes to leave out. It initialises to the real figure — which
is what the server renders and what a viewer with JavaScript off keeps — so the
HTML can never contain ₦0.00 for a paid order.

---

## What shipped — cart and checkout

The last two pages still on hardcoded greys, and the ones where it cost the
most. A shopper went: designed storefront → designed product page → **a grey
form** → designed confirmation. The single step that handled their money looked
the least like it belonged to the shop.

### Checkout got its own form controls

`@/components/fields/*` belongs to the dashboard. Those components carry
currency masking, left slots, `cva` size variants and a fixed grey palette —
none of which a storefront wants — so restyling them would have dragged the
whole admin UI along, and reusing them as they were is exactly what made this
page look borrowed.

`checkout/fields.tsx` is the storefront's own: a label, a control on the store's
tokens, an error. Thin enough that the merchant's accent, radius and typeface
finally reach the only page where a shopper types. **It also made checkout
41KB lighter** — see the table below.

### The changes that are not paint

| Change | Why |
| --- | --- |
| The summary shows the **items**, not four numbers | Asking someone to trust that the cart they filled ten minutes ago is the cart they are paying for, at the moment their card is in hand |
| On a phone the summary is a `<details>` **pinned above the form** | The total is on screen before any typing, without pushing the first field below the fold. The browser owns the disclosure; we ship no JavaScript for it |
| The coupon field moved **into the summary** | A discount field far from the total is a field people apply and then scroll to verify. Applied state replaces the input, so pressing Apply visibly did something |
| Delivery method is **two cards, not a dropdown** | Two options that change both the rest of the form and the total. A `<select>` hides one behind a tap and has no room to say what each costs |
| The zone picker is a **native `<select>`** | On a phone that is the OS picker — bigger targets, familiar gestures, one-handed. No custom dropdown on this page beats it |
| Every field carries `autoComplete` | It is what lets a phone fill the contact block in one tap. Its absence is measured in abandoned carts, not in style |
| "Delivery zone" → "**Delivery area**" | A zone is our word for it, not a shopper's |
| The **mobile bar is hidden on checkout** | It offered Search and Menu under the shopper's thumb at the moment the shop wants no exits — and being `fixed`, it physically sat over the bottom 56px where "Pay now" is |

### The cart page

Rebuilt to match the drawer control for control — the same stepper, not a
number input, because a spinner on a phone opens a keypad to turn a 1 into a 2
and its arrows are smaller than a fingertip. Arriving from the drawer and
finding different buttons is what makes a shop feel assembled from parts. It
also carries the same three reassurances as the product page, in the same
order, so they read as the shop's policy rather than copy written twice.

### Two bugs the work surfaced

- The quantity badge on each summary thumbnail was **clipped**: it sat inside
  `st-media`, whose `overflow: hidden` rounds the image corners and took the
  corner off the count with it.
- The summary renders **twice** — the phone disclosure and the desktop column
  are both in the DOM at every width, only one displayed — so a literal
  `id="couponCode"` was duplicated on every checkout, silently breaking the
  label-to-input association for whichever copy the browser matched second.
  `useId()` now.

### The JavaScript cost

| Page | Before | After | Δ |
| --- | --- | --- | --- |
| Checkout | 253.4KB | **212.1KB** | **−41.3KB** |
| Cart | 156.8KB | 157.8KB | +1.0KB |

Checkout is still the heaviest page in the storefront — Formik, Yup and the
Paystack popup are all real — but it no longer pays for the dashboard's form
stack on top of them. The cart's extra kilobyte is the payment icons.

### What proved it

`e2e/storefront-checkout.spec.ts` (8 tests) covers what loses sales before a
card ever appears: the total visible on a phone without hunting, a discount
code that visibly changes it, an unknown code that says so and changes nothing,
pickup actually stopping the address questions, the bottom bar clearing the pay
button, and an empty cart that cannot reach a payment.
`e2e/checkout.spec.ts` (7 tests, real Paystack) still passes — its select
helper changed with the control, from clicking a Radix listbox to
`selectOption`.

---

## What shipped — Phase 5: the Design editor in the mobile app

The other half of the original ask: *"can the tenant configure all of these
from the mobile app and have them show up on the storefront"*. They can now.
Settings → **Design your storefront** opens a three-level stack — appearance,
a page's sections, one section's settings — with a publish bar on every screen.

### There is no per-section screen, and there never will be

Every control on the settings form is **generated from the section's registry
entry**. The same `fields` array that the API validates against and the web
renderer reads is what the phone builds a form from. `src/ui/fields.tsx` has
one control per field type — text, textarea, toggle, stepper, chips, colour,
Cloudinary image, date-time, and repeatable blocks — and that is the whole
editor.

Adding "Countdown bar" ships one web component and one registry entry. The
phone gets a working editor for it **with no app release**. That is the reason
the registry has the shape it has, and this is the file that cashes it in.

### Decisions worth recording

| Decision | Why |
| --- | --- |
| Reorder is **two arrows**, not drag-and-drop | A long-press drag inside a scrolling list is the most failure-prone interaction on a phone — it fights the scroll, needs a gesture handler, and is close to unusable with a motor impairment. Arrows are unambiguous, one-handed, and work with a screen reader |
| Presets are described by **who they are for** | "Fashion, shot on a model" lands; "high-contrast editorial" does not |
| Blocks render **inline**, not behind another push | Someone writing five FAQ entries should see five entries, not five screens. Depth is what makes a phone editor feel slower than a laptop one |
| Text commits **on blur** | The draft is a shared store; writing per keystroke re-renders the section list and publish bar too |
| Autosave is **one module-level timer** | The Design screens are a stack, so all three are mounted at once. An effect per screen would fire three saves, and the second and third would carry a version the first had already spent — 409 on the merchant's own edit |
| Reads are **not** cached through `useQuery` | That hook trades staleness for a non-blank screen, which is right for read-only screens. Here a stale layout carries a stale `version`, and the first save would be refused over work the merchant cannot see |

### Four bugs caught before they shipped

- **`publish-bar.tsx` became a route.** expo-router turns every file under
  `app/` into a navigable screen, and `/design/publish-bar` really did appear in
  the generated route types. Components live in `src/`.
- **`design/` would have become a fifth tab** — it needed `href: null` like the
  other Settings sub-pages.
- **`structuredClone` is not in Hermes.** It would have crashed on the
  merchant's first edit rather than at build time. A JSON round trip is exact
  for a layout in any case, since that is how it is stored and sent.
- **Discard was offered on stores that had never published.** `revert` restores
  the *published* layout, so it answers 409 when there is none — a button that
  could only fail.

### What is not in yet

Honest list, so nobody discovers these by tapping: the announcement bar, header,
footer and phone tab bar are shown as read-only state rather than edited (they
are not sections and need their own screen); hero hotspots cannot be placed by
tapping a photo; product and collection fields take a slug rather than offering
a picker; and there is no in-app preview of the draft — publishing is still the
way to see it, which is what makes the draft/published split and the Discard
button carry the weight for now.

### What proved it

`tsc --noEmit` clean, and `expo export` bundles — which is the real test here,
because it is what proves `@core/storefront/*` (written for Node and the web,
Zod and all) resolves into a React Native bundle at all. On the API side the
ten live layout tests pass against a real database and a real Clerk session:
seeding on first open, a draft staying invisible to shoppers, a stale version
being refused rather than overwriting the other editor, another store's images
being refused, and a broken stored layout never taking a storefront down.

---

## Part 10 — Decisions I need from you

1. **Presets:** are the four above the right bets for the merchants you are
   selling to, or is there a fifth vertical you expect first?
2. **How much control?** Full section composition (a merchant can build a bad
   page) versus curated arrangements (safer, less expressive). My recommendation:
   full composition, but every preset ships a good default and "Reset to preset"
   is one tap.
3. **Sample content.** Great themes demo well because of photography. Do we seed
   new stores with placeholder imagery, or require a merchant's own?
4. **Scope order.** Phase 5 (the mobile editor) can move ahead of Phase 4 if
   configurability matters more than the product page right now.
5. **Where does the web dashboard fit?** Same editor, bigger canvas — worth
   building after the phone version, reusing the same registry.
