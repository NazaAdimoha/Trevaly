# Security audit — mobile app and public storefront

Audited 2026-09-03 against the code, not from memory. Every finding below was
confirmed by reading the route or component that carries it.

## Already covered (verified, no action)

Worth stating, because knowing what is *not* a gap is half of an audit.

| Control | Where |
|---|---|
| Inbound `x-tenant-slug` stripped on every path | `proxy.ts` |
| Cross-tenant DB reads blocked by a Prisma extension | `tenantDb()` |
| Webhook HMAC-SHA512 verified with `timingSafeEqual` | `webhooks/paystack` |
| Webhook idempotency on `(provider, providerEventId)` | same |
| Checkout prices computed **server-side**, never trusted from the client | `api/checkout` |
| Coupon redemption is atomic raw SQL — `maxUses` cannot be overrun | `verify-order` |
| Product image public IDs checked with `isOwnedBy` before write | `products` routes |
| Cloudinary upload folder derived from the authorized tenant | `uploads/signature` |
| JSON-LD escapes `<` — tenant strings cannot close the script tag | `JsonLd.tsx` |
| Storefront reads filter `isActive` (11 call sites) | `app/sites/**` |
| CSV import capped at 500 rows | `products/import` |
| Mobile session tokens in `expo-secure-store`, never AsyncStorage | `token-cache.ts` |
| Only the Clerk **publishable** key reaches the app bundle | `mobile/.env` |
| Response cache cleared on sign-out | `settings.tsx` |
| Order lookup by reference is tenant-scoped | `sites/[tenant]/order` |

## Findings

### 1. The upload signature signs arbitrary parameters — HIGH, FIXED

`uploads/signature` validates only `paramsToSign.folder`. `signUploadParams`
then signs **every** key it was handed. A merchant can therefore have us sign
any Cloudinary upload parameter, including:

- `notification_url` — Cloudinary makes an HTTP callback to an attacker-chosen
  URL, using our account's reputation
- `eager` — arbitrarily expensive transformation chains, billed to us
- `public_id` + `overwrite` — deterministic overwrite of their own assets
  (limited, but not intended)

A signature is a capability. We currently sign a blank cheque as long as one
field on it matches.

**Fix:** allowlist the signable keys. Anything else is rejected, not stripped —
silently dropping a parameter the client then uploads with produces a signature
mismatch that looks like a bug.

### 2. Arbitrary file types could be stored on our Cloudinary account — HIGH

The signature covers `folder` and `timestamp` and is endpoint-agnostic: the
client picks the URL it POSTs to, so the same signature worked against
`/image/upload`, `/video/upload` and `/raw/upload`. A merchant could store
arbitrary files — executables included — in our account and serve them from our
CDN domain.

**Fix — and a correction to my first attempt.** I initially tried to pin
`resource_type: 'image'` into the signed parameters. Testing against the live
API showed that is impossible: Cloudinary EXCLUDES `resource_type` from the
signed string (along with `file`, `cloud_name`, `api_key` and, as it turns out,
`max_file_size`), so signing it produces a guaranteed mismatch and breaks every
upload.

What actually works is `allowed_formats`, which IS signed and therefore binding.
It refuses a disallowed extension whichever endpoint the file is sent to.
Verified end to end:

| Attempt | Result |
|---|---|
| Legitimate PNG via `/image/upload` | accepted |
| `payload.sh` via `/raw/upload`, valid signature | **refused — "Raw file format sh not allowed"** |
| Client drops `allowed_formats` to bypass | **refused — Invalid Signature** |

### 3. File size cannot be enforced by the signature — MEDIUM, PARTIALLY FIXED

`max_file_size` is on Cloudinary's exclusion list too, so it cannot be signed
and a client is free to omit it. The 10 MB check now in the mobile upload helper
is a courtesy to the merchant's data bill, **not a control** — anyone calling
the API directly can ignore it.

A durable cap is an account-level setting in the Cloudinary console
(Settings → Upload → max file size). Flagged rather than pretended, because a
limit that only exists in the client is not a limit.

SVG is excluded from `allowed_formats` regardless: it is a script-bearing
document, and one served from a CDN origin and opened directly is stored XSS.

### 4. The mobile client does not validate what it is uploading — MEDIUM, FIXED

`uploadProductImage` sends `file.mimeType ?? 'image/jpeg'` — an unchecked value
defaulted to a lie. The picker is configured for images, but the function is
exported and reachable with any file.

**Fix:** validate the MIME type and size in the upload helper, where every
caller passes through, rather than trusting each screen's picker config.

### 5. No security headers on any route — MEDIUM, FIXED

`next.config.js` sets `X-Robots-Tag` and `Cache-Control` on `/dashboard` and
nothing else. Missing across the storefront that takes card payments:

- `X-Frame-Options` / `frame-ancestors` — the checkout can be framed and
  clickjacked
- `X-Content-Type-Options: nosniff` — a stored file can be sniffed into script
- `Referrer-Policy` — order references leak to third parties in `Referer`
- `Strict-Transport-Security`
- `Permissions-Policy`

**Fix:** add them globally, with `frame-ancestors 'none'` on the dashboard and
checkout.

### 6. The public order page shows the full customer email — LOW/MEDIUM, FIXED

`sites/[tenant]/order/[reference]` selects `customerEmail` and renders it to
anyone holding the reference. The reference is a cuid and unguessable, so this
is not an enumeration hole — but it is more PII than the page needs, and order
links get forwarded and pasted into WhatsApp groups.

**Fix:** mask to `a•••@gmail.com`. Enough for a customer to recognise their own
order, useless to anyone else.

### 7. The deep-link scheme is generic — LOW, FIXED

`app.json` declares `scheme: "merchant"`. On Android any app may register the
same scheme, and the OS offers a chooser — so a malicious app installed
alongside ours can receive links intended for it.

**Fix:** a scheme unlikely to collide.

### 8. The rate limiter is in-memory — MEDIUM, NOT FIXED HERE

`lib/rate-limit.ts` says so itself: it is a per-process `Map` and the file
already carries a TODO to move to Upstash before relying on it. On serverless
every lambda instance holds its own counter, so the effective limit is the
configured limit multiplied by the number of warm instances — and it resets on
every cold start.

This protects the checkout, coupon preview, CSV import and upload signing.

**Not fixable in code.** It needs a Redis (Upstash) instance and credentials.
Flagged rather than papered over, because a limiter that looks present but does
not hold is worse than a known gap.

### 9. Checkout was a coupon enumeration oracle — MEDIUM, FIXED

Found during the backend migration review (2026-09-14). `/api/coupons/preview`
answered every invalid code identically, by design — but `/api/checkout`
returned the precise reason: "Coupon not found", "This coupon has expired",
"This coupon has been fully used", "below this coupon's minimum". Checkout's
8/min limit only slowed enumeration down (and the limiter is per-instance —
finding 8).

**Fix:** `publicCouponRejection` and `COUPON_NOT_APPLICABLE` in
`packages/core/src/validation/coupon.ts`, now the only thing either endpoint
returns to a shopper. "Below minimum" is uniform too: it proves the code exists,
so a one-item cart would otherwise enumerate every live code.

Verified against the running app with four temporary coupons (removed after):

| Code state | Checkout | Preview |
|---|---|---|
| does not exist, expired, used up, inactive, below minimum | identical `400` | identical `200 {"valid":false}` |
| valid (`WELCOME10`) | — | `200`, discount quoted |

### 10. Finding 6 was only fixed on screen — MEDIUM, FIXED

Found while comparing storefront pages before and after the backend moved to
the API (2026-09-15). The order confirmation page passed the order's full
`customerEmail` into a Client Component and masked it there, so the full
address was serialized into the page source for anyone holding the reference.
The API's `GET /api/storefront/:slug/orders/:reference` now returns only
`maskedEmail`; the full address never leaves the API for this page. Checked
against the rendered HTML: the customer address is gone, the store's own public
contact email is the only address left.

### 11. Internal API reachable through the public proxy — LOW, FIXED

Found during the same verification. The web proxy stamps its internal key on
every request it forwards, so `/api/internal/domains/:host` answered anyone who
called it through the public site (it returned which store a custom domain
belongs to). `proxy.ts` now refuses `/api/internal/*` before forwarding; a
forged key sent straight to the API gets 401.

## Deliberately not changed

- **Cloudinary public IDs are unguessable but public.** Product images are meant
  to be public; signed delivery URLs would break the storefront's caching for no
  real gain.
- **Order references are unauthenticated by design.** A customer who has just
  paid has no account. The reference *is* the credential, which is why it is a
  cuid and why the page should show less.


## Verification

Everything above marked FIXED was checked against the live stack, not just
typechecked.

**Signature endpoint** — every one of these is now refused, and the legitimate
request still signs:

| Probe | Response |
|---|---|
| `notification_url` (Cloudinary callback to an attacker URL) | 400 `Cannot sign: notification_url` |
| `eager` (expensive transforms on our bill) | 400 `Cannot sign: eager` |
| `public_id` + `overwrite` | 400 `Cannot sign: public_id, overwrite` |
| `resource_type` smuggled in | 400 `Cannot sign: resource_type` |
| another store's folder | 403 |
| `folder` + `timestamp` only | 200, signed |

**Cloudinary, end to end** — see the table in finding 2.

**Unit tests** — `src/lib/__tests__/security.test.ts` covers email masking
(including that a long local part cannot be reconstructed) and folder
ownership, including the prefix-confusion case where `adaobi-store-evil` must
not pass as `adaobi-store`.

## Still open

- **Finding 3 (size):** needs a Cloudinary console setting.
- **Finding 8 (rate limiting):** needs Upstash Redis credentials.

Both are infrastructure, not code. Neither is closed by anything in this repo,
and neither should be recorded as done.
