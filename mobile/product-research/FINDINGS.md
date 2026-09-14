# Bumpa teardown → what we adopt

36 screenshots of Bumpa (`shoplarahs.bumpa.shop`), a Nigerian merchant app
serving the same seller we do. Reviewed 2026-09-02.

## UI patterns worth taking

| Pattern | Where they use it | Our gap |
|---|---|---|
| Greeting header — avatar, "Hi, {name}", plan badge | Home | We open on "Today" with no identity |
| `Visit store` / `Share link` pills in the header | Home | **We have no way to share the storefront at all** |
| Native share sheet carrying store name + tagline + URL | Share link | Missing |
| Balance card with copyable account number + hide toggle | Home | We show no settlement account |
| Period selector (`This week ⌄`) on the money figure | Home, Analytics | Our revenue has no period at all |
| Four pastel stat tiles | Home | Ours are white cards |
| Quick-action grid (New Order, Add Product, …) | Home | Missing |
| Delta vs previous period (`↗ 0% from last week`) | Analytics | Missing |
| Search field on every list | Products, Orders, Discounts | **Missing everywhere** |
| Status filter chips, filled when active | Products, Orders, Discounts | Orders only, outlined |
| Result count + `Select` for bulk actions | Products | Missing |
| Per-row `⋮` overflow menu | Products | Missing |
| Bottom sheet for a branching choice | Create product: regular vs variations | Missing (we have variants!) |
| Rich empty state: art + headline + body + CTA | Orders | Ours are one grey line |
| Dismissible info banner | Products, Orders | Missing |
| Sectioned settings with icon + chevron rows | More | Ours is a flat list |
| Sign out in red, its own card | More | Ours is a plain button |
| Version pill at the base of settings | More | We show version as grey text |
| Sticky full-width Save pinned to the bottom | Every form | Missing |
| Outlined input with the label notched into the border | Forms | Ours are plain boxes |
| In-app store settings incl. logo upload | Store settings | **Dead link to a web page that does not exist** |

## Features worth taking

1. **Share storefront link** — one tap to the native share sheet. Their whole
   growth loop, and our market lives in WhatsApp. Cheap, and we already have
   the URL.
2. **Record a sale** — manual order entry with a sales-channel picker
   (Instagram, WhatsApp, physical, Jumia, Jiji…). This is the single biggest
   one. Our own marketing page is built on "orders buried under 300 unread
   DMs" — this is the feature that answers it, and without it our dashboard
   only ever reflects website orders, which for most Nigerian sellers is a
   minority of their business.
3. **Store settings + logo upload in-app** — closes a dead link and unblocks
   the logo we just built rendering for on Today.
4. **Delivery areas editable in-app** — another dead link today.
5. **Period comparison** on the headline numbers.

## Deliberately NOT adopted

- **The wallet.** Bumpa holds a stored balance (PiggyVest-backed) with
  withdrawals, interest and KYC tiers. That is a regulated financial product,
  and it is the exact opposite of our architecture: Paystack splits at
  settlement and the money goes straight to the merchant's own bank. Our
  marketing page's central promise is "your money never touches us". We show
  the *settlement account*, never a balance we hold.
- **Messaging campaigns / SMS credits** — a whole marketing product with a
  credits economy. Out of scope.
- **In-app content feed** ("Latest from Bumpa") — needs an editorial pipeline.
- **Expenses, gross profit, KYC tiers, terminal hardware** — a different
  product surface (bookkeeping + POS), not ours.
