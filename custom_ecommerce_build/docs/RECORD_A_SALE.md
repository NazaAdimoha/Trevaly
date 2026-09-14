# Record a sale — spec

Manual order entry, so the dashboard reflects the whole business rather than
only what came through the website.

**Status:** proposed. Nothing below is built.

## Why

Our own marketing page opens on "orders buried under 300 unread DMs". A Nigerian
seller takes orders on Instagram, WhatsApp, Jumia, Jiji and across a counter,
and settles most of them by transfer. Today none of that reaches the app, so
every number we show — revenue, paid orders, products sold, what is running out
— describes a minority of their trade. A merchant cannot trust a stock count
that ignores the six pairs they sold in the shop this morning.

This is also the feature that makes stock counts true, which is what makes the
storefront safe to sell from.

## The decisions that need your call

Four things below change the product, not just the code. They are called out
because I should not pick them for you.

### 1. Does the platform earn on a manual sale? — **recommend: no**

Online orders carry a `transaction_charge` split: Paystack takes our cut at
settlement and writes a `PlatformEarning` row. A manual sale never touches
Paystack, so there is no split to take and no money we could deduct without
invoicing the merchant separately.

Recommend recording manual sales with `platformFeeKobo: 0` and **no**
`PlatformEarning` row. The alternative — accruing a debt the merchant settles
later — is a billing system, not a feature.

The consequence is worth stating plainly: the more successful this feature is,
the more of a merchant's trade sits outside the fee base. If the business model
is "we take a cut of what flows through us", manual sales are deliberately
outside it, and that is a pricing conversation rather than a technical one.

### 2. Does a manual sale decrement stock? — **recommend: yes**

A sale is a sale; the unit has left the shelf. If manual sales do not decrement,
the storefront will happily sell a product that no longer physically exists,
which is the oversell we already work hard to prevent on the online path.

Uses the same conditional decrement as fulfilment
(`where: { stock: { gte: quantity } }`), so recording a sale for stock that is
not there fails loudly rather than driving stock negative. If the merchant
insists (they sold something they had not counted), they get an explicit
"record anyway, stock will show 0" confirmation which sets `hasStockIssue`.

### 3. Can a manual sale be recorded as unpaid? — **recommend: yes**

The reference app allows it, and a merchant who has shipped goods against a
promised transfer needs somewhere to put it. Recorded as `PENDING` with no
`paymentVerifiedAt`, and it does **not** count toward revenue until marked paid.

Open question: should a PENDING manual order decrement stock? Recommend **yes**,
because the goods have physically gone.

### 4. Does recording a sale create a Customer? — **recommend: not yet**

We have no `Customer` model; orders carry name/email/phone inline. Adding one is
a separate piece of work. For v1 the customer is three optional free-text fields
on the order, exactly like the online path.

## Schema

```prisma
enum OrderSource {
  ONLINE   // placed through our storefront, paid via Paystack
  MANUAL   // recorded by the merchant after the fact
}

enum SalesChannel {
  STOREFRONT     // the default for ONLINE
  INSTAGRAM
  WHATSAPP
  FACEBOOK
  TIKTOK
  PHYSICAL_STORE
  JUMIA
  JIJI
  KONGA
  OTHER
}
```

On `Order`:

```prisma
  source       OrderSource  @default(ONLINE)
  salesChannel SalesChannel @default(STOREFRONT)

  @@index([tenantId, source])
```

Three existing columns need care:

- **`paymentReference String @unique`** is currently required and is what makes
  webhook fulfilment idempotent. A manual order has no gateway reference.
  Generate one anyway — `manual_{cuid}` — rather than making the column
  nullable. Keeping it non-null and unique preserves the idempotency guarantee
  for every code path that assumes it, and a nullable unique column that is null
  for a growing share of rows is a trap for the next person.
- **`paymentProvider`** — add a `MANUAL` variant, or leave as PAYSTACK and rely
  on `source`. Recommend adding `MANUAL`: "paid via Paystack" is false for these
  and something will eventually read that field and believe it.
- **`orderNumber`** — same `tenant.orderSequence` increment as checkout, in the
  same transaction. Manual and online orders share one gap-free sequence; two
  sequences would mean two orders numbered #34.

## API

`POST /api/stores/[storeSlug]/orders`

```ts
{
  salesChannel: SalesChannel,
  orderDate?: string,          // ISO; defaults to now. Backdating is the point.
  paid: boolean,               // false -> PENDING
  customerName?: string,
  customerPhone?: string,
  customerEmail?: string,
  deliveryMethod: 'PICKUP' | 'ZONE_DELIVERY',
  deliveryZoneId?: string,
  deliveryAddress?: string,
  note?: string,
  items: Array<{
    productId: string,
    variantId?: string,
    quantity: number,
    unitPriceKobo?: number,    // override; defaults to the product's price
  }>,
  forceOnInsufficientStock?: boolean,
}
```

Behaviour, all inside one transaction:

1. `authorizeStore(storeSlug)`.
2. Validate every `productId` / `variantId` belongs to this tenant. Ownership
   checks against a client-supplied id are the same class of hole the Cloudinary
   folder check closes.
3. Allocate `orderNumber` from `tenant.orderSequence`.
4. Price server-side from the product record. `unitPriceKobo` is accepted for a
   haggled price, but is clamped to a sane range and recorded — never trusted as
   the only source.
5. Conditional stock decrement per item. Any shortfall aborts unless
   `forceOnInsufficientStock`, which sets `hasStockIssue`.
6. Create the order: `source: MANUAL`, `paymentProvider: MANUAL`,
   `platformFeeKobo: 0`, `status: paid ? PAID : PENDING`,
   `paymentVerifiedAt: paid ? orderDate : null`,
   `paymentReference: 'manual_' + cuid()`.
7. No `PlatformEarning` row. No Paystack call.

Returns the created order in the existing order-detail shape, so the app can
navigate straight to it.

### Things that must not change

- `verifyAndFulfillOrder` must ignore `MANUAL` orders. It is keyed by
  `paymentReference`, and a `manual_` prefix will never collide with a Paystack
  reference — but add an explicit guard rather than relying on that.
- The revenue query in `getStoreOverview` counts PAID/SHIPPED/DELIVERED and will
  pick manual sales up automatically. That is intended. Consider splitting the
  Today tile into online vs total once this ships.

## Mobile UX

New screen `app/(app)/orders/record.tsx`, reached from a `+` on Orders and a
quick action on Today.

1. **Date** — defaults to today, backdatable.
2. **Sales channel** — a grid of tiles, single select, following the reference
   app. Ours is a shorter list: Instagram, WhatsApp, Physical store, Facebook,
   TikTok, Jumia, Jiji, Konga, Other. No logos we do not have rights to; a
   glyph and a label.
3. **Items** — search the existing product list, tap to add, set quantity, edit
   unit price inline. Running subtotal.
4. **Customer** — optional name and phone. Collapsed by default.
5. **Delivery** — pickup or a zone, reusing the existing zones.
6. **Payment** — "Paid" / "Not paid yet" segmented control.
7. Sticky **Record sale** at the bottom.

Offline: this is a write, and per MOBILE_PLAN there is deliberately no write
queue. A failed submit keeps the form populated and lets them retry — it must
never silently disappear.

## Effort

| | |
|---|---|
| Schema + migration + enum sync | half a day |
| `POST /orders` with the transaction and ownership checks | 1 day |
| Unit tests: pricing, stock shortfall, cross-tenant ids, sequence sharing | half a day |
| Mobile screen | 1.5 days |
| Web dashboard equivalent | 1 day (optional for v1) |

Roughly **3.5 days** without the web side.
