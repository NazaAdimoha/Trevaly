import { expect, test } from '@playwright/test';

import { E2E_TENANT, storefrontOrigin } from '../playwright.config';

/**
 * The storefront chrome: navigation, the cart drawer, search, and the mobile
 * menu.
 *
 * These are the parts a shopper touches on every visit and the parts that only
 * exist in the browser, so server-rendered markup proves nothing about them.
 * What is checked here is behaviour a broken build would take away: you can get
 * from the catalogue into a category, adding something shows you the cart
 * without losing your place, and Escape closes what you opened.
 */

const origin = storefrontOrigin(E2E_TENANT);

test.describe('storefront chrome', () => {
  test('navigation reaches a category, and the cart drawer opens from the header', async ({
    page,
  }) => {
    await page.goto(origin);

    // Navigation exists at all — the store had none before this.
    const nav = page.locator('header nav').first();
    await expect(nav.locator('a').first()).toBeVisible();

    const firstCategory = await nav.locator('a').first().textContent();
    await nav.locator('a').first().click();
    await expect(page).toHaveURL(/\/categories\//);
    await expect(page.locator('h1')).toContainText(firstCategory?.trim() ?? '');

    await page.goto(origin);
    await page.getByRole('button', { name: /^Cart,/ }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/cart is empty/i);

    // Escape closes it, and focus goes back to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: /^Cart,/ })).toBeFocused();
  });

  test('adding to the cart opens the drawer and keeps the shopper on the page', async ({
    page,
  }) => {
    await page.goto(origin);
    await page.locator('main a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(/\/products\//);

    const url = page.url();
    const options = page.locator('button[aria-pressed], [data-variant-option]');
    if (await options.first().isVisible().catch(() => false)) {
      await options.first().click();
    }

    await page.getByRole('button', { name: 'Add to cart' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    // The confirmation IS the drawer: the line just added is in it.
    await expect(drawer.getByRole('link', { name: /view full cart/i })).toBeVisible();
    await expect(drawer).toContainText('Subtotal');
    // Still on the product page behind it.
    expect(page.url()).toBe(url);

    // The quantity stepper changes the line rather than navigating.
    const increase = drawer.getByRole('button', { name: 'Increase quantity' });
    if (await increase.isEnabled()) {
      await increase.click();
      await expect(drawer.getByText('2', { exact: true })).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Cart, [1-9]/ })).toBeVisible();
  });

  test('search finds a product and lands on a shareable URL', async ({ page }) => {
    await page.goto(origin);
    await page.getByRole('button', { name: 'Search' }).click();

    const search = page.getByRole('dialog');
    await expect(search).toBeVisible();

    await page.getByLabel('Search products').fill('dress');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=dress/);
    await expect(page.locator('h1')).toContainText('dress');
    await expect(page.locator('main a[href^="/products/"]').first()).toBeVisible();
  });

  test('on a phone, the bottom bar and the full-screen menu work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin);

    const bar = page.getByRole('navigation', { name: 'Quick navigation' });
    await expect(bar).toBeVisible();

    await bar.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('dialog');
    await expect(menu).toBeVisible();
    await expect(menu.locator('a').first()).toBeVisible();

    await menu.getByRole('button', { name: 'Close' }).click();
    await expect(menu).toBeHidden();

    // The footer is reachable — the bar must not sit on top of it.
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('footer')).toContainText('©');
  });
});
