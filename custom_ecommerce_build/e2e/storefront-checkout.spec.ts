import { expect, type Page,test } from '@playwright/test';

import { E2E_TENANT, storefrontOrigin } from '../playwright.config';

/**
 * The cart and checkout pages, as a shopper meets them.
 *
 * Not the payment path — `checkout.spec.ts` owns that, against the real
 * gateway. What is checked here is the part of checkout that loses sales
 * before a card is ever produced: whether the total is visible without
 * hunting, whether a discount code visibly does something, whether choosing
 * pickup actually stops asking for an address, and whether the chrome gets out
 * of the way of the pay button on a phone.
 */

const origin = storefrontOrigin(E2E_TENANT);

/** Puts one item in the cart, the way a shopper would. */
async function addOneItem(page: Page) {
  await page.goto(`${origin}/products/silk-head-wrap`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('button', { name: /^Cart, [1-9]/ })).toBeVisible();
  await page.keyboard.press('Escape');
}

/** The first naira figure in a chunk of text, in kobo. */
const nairaIn = (text: string | null) => {
  const match = /₦([\d,]+(?:\.\d{2})?)/.exec(text ?? '');
  return match ? Math.round(Number((match[1] ?? '0').replace(/,/g, '')) * 100) : null;
};

test.describe('cart page', () => {
  test('the stepper changes the line and the subtotal together', async ({ page }) => {
    await addOneItem(page);
    await page.goto(`${origin}/cart`);

    const subtotal = page.locator('main').getByText(/^₦[\d,]/).last();
    const before = nairaIn(await subtotal.textContent());
    if (before === null) throw new Error('No subtotal on the cart page');
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: /^Increase quantity/ }).first().click();

    await expect
      .poll(async () => nairaIn(await subtotal.textContent()))
      .toBe(before * 2);
  });

  test('removing the last item leaves a way back into the shop', async ({ page }) => {
    await addOneItem(page);
    await page.goto(`${origin}/cart`);

    await page.getByRole('button', { name: /^Remove/ }).first().click();

    await expect(page.getByRole('heading', { name: /cart is empty/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start shopping' })).toBeVisible();
  });
});

test.describe('checkout page', () => {
  test('a phone sees the total before typing anything', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await addOneItem(page);
    await page.goto(`${origin}/checkout`);

    // The collapsed summary is pinned above the form, so the figure is on
    // screen without scrolling past three fields to find it.
    const disclosure = page.getByText(/Order summary/).first();
    await expect(disclosure).toBeInViewport();
    expect(nairaIn(await disclosure.locator('xpath=..').textContent())).toBeGreaterThan(0);

    // And it opens to the lines it is the total of.
    await disclosure.click();
    await expect(page.getByText('Silk Head Wrap').first()).toBeVisible();
  });

  test('the bottom bar gets out of the way of the pay button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await addOneItem(page);

    // It is there everywhere else…
    await page.goto(origin);
    await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible();

    // …and gone here, where it would sit on top of "Pay now" and offer three
    // ways to leave at the moment the shop wants none.
    await page.goto(`${origin}/checkout`);
    await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pay now/i })).toBeVisible();
  });

  test('choosing pickup stops asking for an address and drops the fee', async ({ page }) => {
    await addOneItem(page);
    await page.goto(`${origin}/checkout`);

    await expect(page.locator('main').getByLabel('Delivery address')).toBeVisible();

    await page.getByRole('radio', { name: /Pick up in store/ }).check();

    await expect(page.locator('main').getByLabel('Delivery address')).toHaveCount(0);
    await expect(page.locator('main').getByLabel('Delivery area')).toHaveCount(0);
    // Free, and said so rather than left as an em dash.
    await expect(page.locator('aside').getByText('Free')).toBeVisible();
  });

  test('a discount code visibly changes the total before paying', async ({ page }) => {
    await addOneItem(page);
    await page.goto(`${origin}/checkout`);

    const summary = page.locator('aside');
    const total = summary.getByText(/^₦[\d,]/).last();
    const before = nairaIn(await total.textContent());
    if (before === null) throw new Error('No total in the order summary');

    await summary.getByLabel('Discount code').fill('WELCOME10');
    await summary.getByRole('button', { name: 'Apply' }).click();

    // The applied state replaces the field, so the shopper cannot wonder
    // whether pressing Apply did anything. It is announced as a status, and
    // the discount also appears as its own line above the total — hence the
    // role, rather than a text match that finds both.
    await expect(summary.getByRole('status')).toContainText('WELCOME10');
    await expect(summary.getByText(/^Discount · WELCOME10/)).toBeVisible();
    await expect
      .poll(async () => nairaIn(await total.textContent()))
      .toBeLessThan(before);
  });

  test('an unknown code says so and leaves the total alone', async ({ page }) => {
    await addOneItem(page);
    await page.goto(`${origin}/checkout`);

    const summary = page.locator('aside');
    const total = summary.getByText(/^₦[\d,]/).last();
    const before = nairaIn(await total.textContent());

    await summary.getByLabel('Discount code').fill('NOPE-NOT-REAL');
    await summary.getByRole('button', { name: 'Apply' }).click();

    await expect(summary.getByRole('alert')).toBeVisible();
    expect(nairaIn(await total.textContent())).toBe(before);
  });

  test('an empty cart cannot reach a payment', async ({ page }) => {
    await page.goto(`${origin}/checkout`);

    await expect(page.getByRole('heading', { name: /cart is empty/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pay now/i })).toHaveCount(0);
  });
});
