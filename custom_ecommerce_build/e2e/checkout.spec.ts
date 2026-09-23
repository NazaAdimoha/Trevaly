import { expect, type Page,test } from '@playwright/test';

import {
  getOrder,
  getProductById,
  getVariantById,
  one,
  type OrderRow,
  setStock,
  setVariantStock,
  sql,
} from './db';
import { E2E_TENANT, hostHeader,LOCAL_ORIGIN } from '../playwright.config';

/**
 * M6 exit criteria, run against a live server and the real Paystack test gateway.
 *
 * This deliberately does not stub Paystack. The three defects this milestone
 * exists to close — a client-chosen amount, a forgeable tenant header, and an
 * unguarded stock decrement — are all defects at the boundary between our server
 * and theirs, and a mocked gateway is exactly where they hide.
 */

/** Kobo -> the string Paystack prints on its pay button, e.g. "Pay NGN 6,000". */
const nairaLabel = (kobo: number) =>
  `Pay NGN ${(kobo / 100).toLocaleString('en-US')}`;

/** Paystack separates its amount with U+00A0, which no plain equality survives. */
const normalizeSpaces = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The delivery picker is a NATIVE `<select>` now, not the Radix one.
 *
 * That is deliberate: on a phone a native select is the OS picker — big
 * targets, familiar gestures, usable one-handed — which no custom dropdown on
 * a checkout page beats. It also means `selectOption` applies again, so this
 * helper no longer has to click a listbox open.
 */
async function chooseFromSelect(page: Page, label: string, option: RegExp) {
  const select = page.locator('main').getByLabel(label, { exact: true });
  await select.selectOption({ label: await optionLabel(select, option) });
}

/** The full option text matching `pattern`, since `selectOption` wants exact. */
async function optionLabel(
  select: ReturnType<Page['locator']>,
  pattern: RegExp,
): Promise<string> {
  const labels = await select.locator('option').allTextContents();
  const found = labels.find((text) => pattern.test(text));
  if (!found) throw new Error(`No option matching ${pattern} in ${labels.join(' | ')}`);
  return found;
}

/**
 * The form defaults to ZONE_DELIVERY, which makes the zone and address fields
 * required — leaving them blank fails Yup validation and the submit handler
 * never runs, so no request is ever made.
 */
async function fillCheckoutForm(page: Page) {
  // Scoped to the page's own content: the footer now carries a newsletter
  // field, so an unscoped `getByLabel('Email')` matches two inputs.
  const form = page.locator('main');
  await form.getByLabel('Full name').fill('E2E Buyer');
  await form.getByLabel('Email').fill('e2e-buyer@example.com');
  await form.getByLabel(/phone/i).fill('08031234567');
  // "Delivery area", not "zone" — a zone is our word for it, not a shopper's.
  await chooseFromSelect(page, 'Delivery area', /Lagos Mainland/);
  await form.getByLabel(/delivery address/i).fill('12 Test Close, Yaba, Lagos');
}

/**
 * Completes payment in Paystack's inline popup.
 *
 * In test mode Paystack does not ask for a card at all — it offers a simulator
 * with Success / Bank Authentication / Declined. The popup is a cross-origin
 * iframe, so every locator here is frame-scoped.
 *
 * Returns the amount the popup displayed, which is the only place the customer
 * ever sees a price that we did not render ourselves. Asserting on it is what
 * proves the amount was pinned server-side rather than sent from the browser.
 */
async function payInPopup(page: Page, outcome: 'Success' | 'Declined') {
  const frame = page.frameLocator('iframe[src*="paystack"]').first();

  const payButton = frame.getByRole('button', { name: /^Pay NGN/i });
  await expect(payButton).toBeVisible({ timeout: 45_000 });
  const displayedAmount = normalizeSpaces(
    (await payButton.textContent()) ?? '',
  );

  await frame.getByText(outcome, { exact: true }).click();
  await payButton.click();

  return displayedAmount;
}

test.describe('M6 — checkout and payment', () => {
  test('add to cart -> pay -> order PAID -> stock decremented', async ({
    page,
  }) => {
    const before = await setStock(E2E_TENANT, 'silk-head-wrap', 40);

    await page.goto('/products/silk-head-wrap');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    // The cart is client state; navigating before it commits silently starts the
    // checkout with an empty cart. Since the drawer replaced the cart page link,
    // the header control is a button that opens it.
    await expect(page.getByRole('button', { name: /cart, 1 item/i })).toBeVisible();

    await page.goto('/checkout');
    await fillCheckoutForm(page);

    const checkoutResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/checkout') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /pay now/i }).click();
    const reference = (await (await checkoutResponse).json())
      .reference as string;

    // The order exists and is PENDING before a naira has moved, and its total is
    // the server's arithmetic — one unit plus the Lagos Mainland zone fee.
    const zone = await one<{ feeKobo: number }>(
      `SELECT z."feeKobo" FROM "DeliveryZone" z JOIN "Tenant" t ON t.id = z."tenantId"
        WHERE t.slug = $1 AND z.name = 'Lagos Mainland'`,
      [E2E_TENANT],
    );
    const pending = await getOrder(reference);
    expect(pending.status).toBe('PENDING');
    expect(pending.totalKobo).toBe(before.priceKobo + zone.feeKobo);

    // The gateway must quote the server's total, not anything the browser held.
    const quoted = await payInPopup(page, 'Success');
    expect(quoted).toBe(nairaLabel(pending.totalKobo));

    // The popup redirects to the callback URL, which verifies on mount.
    await page.waitForURL(new RegExp(`/order/${reference}`), {
      timeout: 90_000,
    });
    await expect(page.getByText(/paid|confirmed/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const paid = await getOrder(reference);
    expect(paid.status).toBe('PAID');
    expect(paid.paidAmountKobo).toBe(pending.totalKobo);
    expect(paid.hasStockIssue).toBe(false);

    const after = await getProductById(before.id);
    expect(after.stock).toBe(before.stock - 1);
  });

  test('a variant purchase decrements that option, and only that option', async ({
    page,
  }) => {
    // 'Ankara Midi Dress' sells by Size. Two options are seeded with stock so
    // the assertion can prove the untouched one did not move.
    const bought = await setVariantStock(
      E2E_TENANT,
      'ankara-midi-dress',
      'M',
      6,
    );
    const untouched = await setVariantStock(
      E2E_TENANT,
      'ankara-midi-dress',
      'L',
      3,
    );

    await page.goto('/products/ankara-midi-dress');

    // Add-to-cart stays disabled until a size is chosen — the server rejects a
    // variant product with no variantId, so the UI must not let it be sent.
    await expect(
      page.getByRole('button', { name: 'Add to cart' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(
      page.getByRole('button', { name: /cart, 1 item/i }),
    ).toBeVisible();

    await page.goto('/checkout');
    await fillCheckoutForm(page);

    const checkoutResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/checkout') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /pay now/i }).click();
    const reference = (await (await checkoutResponse).json())
      .reference as string;

    const zone = await one<{ feeKobo: number }>(
      `SELECT z."feeKobo" FROM "DeliveryZone" z JOIN "Tenant" t ON t.id = z."tenantId"
        WHERE t.slug = $1 AND z.name = 'Lagos Mainland'`,
      [E2E_TENANT],
    );
    const product = await getProductById(bought.productId);
    const pending = await getOrder(reference);

    // M has no price override, so the line is priced from the parent product.
    expect(pending.status).toBe('PENDING');
    expect(pending.totalKobo).toBe(product.priceKobo + zone.feeKobo);

    // The order line carries the variant and a human-readable snapshot.
    const line = await one<{ variantId: string; variantLabel: string }>(
      `SELECT "variantId", "variantLabel" FROM "OrderItem" WHERE "orderId" = $1`,
      [pending.id],
    );
    expect(line.variantId).toBe(bought.id);
    expect(line.variantLabel).toBe('Size: M');

    const quoted = await payInPopup(page, 'Success');
    expect(quoted).toBe(nairaLabel(pending.totalKobo));

    await page.waitForURL(new RegExp(`/order/${reference}`), {
      timeout: 90_000,
    });
    await expect(page.getByText(/paid|confirmed/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const paid = await getOrder(reference);
    expect(paid.status).toBe('PAID');
    expect(paid.hasStockIssue).toBe(false);

    // The bought size went down by one; the other size did not move. Getting
    // this wrong is an oversell that looks like nothing went wrong.
    expect((await getVariantById(bought.id)).stock).toBe(bought.stock - 1);
    expect((await getVariantById(untouched.id)).stock).toBe(untouched.stock);
  });

  test('concurrent verifies of one reference decrement stock once', async ({
    request,
  }) => {
    const paid = await one<OrderRow>(
      `SELECT * FROM "Order" WHERE status = 'PAID' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const item = await one<{ productId: string; variantId: string | null }>(
      `SELECT "productId", "variantId" FROM "OrderItem" WHERE "orderId" = $1 LIMIT 1`,
      [paid.id],
    );

    // Whichever row fulfillment actually decrements — the variant when the line
    // has one, the product otherwise. Reading the product unconditionally used
    // to pass only because no order had variants; now that some do, picking the
    // wrong row would make this assert on a number nothing touched.
    const stockOf = () =>
      item.variantId
        ? getVariantById(item.variantId).then((v) => v.stock)
        : getProductById(item.productId).then((p) => p.stock);

    // Re-open the order so both callers race from PENDING, which is the state
    // the webhook and the browser's verify call actually contend over.
    await sql(
      `UPDATE "Order" SET status = 'PENDING', "paidAmountKobo" = NULL,
          "paymentVerifiedAt" = NULL WHERE id = $1`,
      [paid.id],
    );
    const before = await stockOf();

    const fire = () =>
      request.post(`${LOCAL_ORIGIN}/api/payments/verify`, {
        headers: hostHeader(E2E_TENANT),
        data: { reference: paid.paymentReference },
      });
    const results = await Promise.all([fire(), fire(), fire()]);
    for (const res of results) expect(res.status()).toBe(200);

    expect(await stockOf()).toBe(before - 1);
  });

  test('a second verify of the same reference does not decrement twice', async ({
    request,
  }) => {
    const paid = await one<OrderRow>(
      `SELECT * FROM "Order" WHERE status = 'PAID' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const item = await one<{ productId: string; variantId: string | null }>(
      `SELECT "productId", "variantId" FROM "OrderItem" WHERE "orderId" = $1 LIMIT 1`,
      [paid.id],
    );
    // Same reasoning as the concurrency test: assert on the row fulfillment
    // would actually touch, not on whichever one the seed data happened to use.
    const stockOf = () =>
      item.variantId
        ? getVariantById(item.variantId).then((v) => v.stock)
        : getProductById(item.productId).then((p) => p.stock);
    const before = await stockOf();

    const res = await request.post(`${LOCAL_ORIGIN}/api/payments/verify`, {
      headers: hostHeader(E2E_TENANT),
      data: { reference: paid.paymentReference },
    });
    expect(res.status()).toBe(200);

    expect(await stockOf()).toBe(before);
  });
});

test.describe('M6 — adversarial', () => {
  test('a forged x-tenant-slug cannot act as another store', async ({
    request,
  }) => {
    const body = {
      items: [{ productId: 'anything', quantity: 1 }],
      customerName: 'Attacker',
      customerEmail: 'attacker@example.com',
      customerPhone: '08031234567',
      deliveryMethod: 'PICKUP',
    };

    // On the platform host the header is stripped, and there is no checkout at
    // all: the API only has store-addressed checkout, which the proxy builds
    // from a store's hostname. (Before the API move this was a 400 "Missing
    // tenant context" from web's own route.)
    const onPlatform = await request.post(`${LOCAL_ORIGIN}/api/checkout`, {
      headers: { ...hostHeader(), 'x-tenant-slug': E2E_TENANT },
      data: body,
    });
    expect(onPlatform.status()).toBe(404);

    // On a tenant host the store comes from the hostname, placed in the API
    // path by the proxy, so naming a different tenant changes nothing: the
    // order is attempted under the host's store, where the other store's
    // product does not exist.
    const chidiProduct = await one<{ id: string }>(
      `SELECT p.id FROM "Product" p JOIN "Tenant" t ON t.id = p."tenantId"
        WHERE t.slug = 'chidi-electronics' LIMIT 1`,
    );
    const crossTenant = await request.post(`${LOCAL_ORIGIN}/api/checkout`, {
      headers: {
        ...hostHeader(E2E_TENANT),
        'x-tenant-slug': 'chidi-electronics',
      },
      data: { ...body, items: [{ productId: chidiProduct.id, quantity: 1 }] },
    });
    expect(crossTenant.status()).toBe(409);
  });

  test('/sites/** is not reachable as a public URL', async ({ request }) => {
    const res = await request.get(`${LOCAL_ORIGIN}/sites/${E2E_TENANT}`, {
      headers: hostHeader(),
    });
    expect(await res.text()).toContain('not-found');
  });

  test('quantity bounds are enforced at the boundary', async ({ request }) => {
    for (const quantity of [-5, 0, 100, 1.5]) {
      const res = await request.post(`${LOCAL_ORIGIN}/api/checkout`, {
        headers: hostHeader(E2E_TENANT),
        data: {
          items: [{ productId: 'x', quantity }],
          customerName: 'Attacker',
          customerEmail: 'attacker@example.com',
          customerPhone: '08031234567',
          deliveryMethod: 'PICKUP',
        },
      });
      expect(res.status(), `quantity ${quantity} must be rejected`).toBe(400);
    }
  });
});
