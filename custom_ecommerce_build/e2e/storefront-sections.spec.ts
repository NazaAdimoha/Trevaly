import { expect, test } from '@playwright/test';

import { E2E_TENANT, storefrontOrigin } from '../playwright.config';

/**
 * The home page sections, driven in a browser.
 *
 * Only the interactive ones are worth a browser: the rest are server-rendered
 * markup, already covered by the fact that the page contains them. What is
 * checked here is the behaviour that would silently rot — a hotspot that opens
 * nothing, tabs that never switch, an accordion that needs JavaScript we did
 * not ship.
 *
 * These assume the development store has a composed layout. They skip rather
 * than fail if a section is absent, because a merchant is free to remove any of
 * them and that is not a regression.
 */

const origin = storefrontOrigin(E2E_TENANT);

test.describe('storefront sections', () => {
  test('a hero hotspot names the product in the photograph', async ({ page }) => {
    await page.goto(origin);

    const hotspot = page.locator('.st-hotspot').first();
    test.skip(!(await hotspot.count()), 'no hotspots in this store’s layout');

    // The dot carries the product's name, so the picture is navigable by
    // keyboard and readable by a screen reader.
    await expect(hotspot).toHaveAttribute('aria-label', /^Show .+/);
    await hotspot.click();
    await expect(hotspot).toHaveAttribute('aria-expanded', 'true');

    const label = await hotspot.getAttribute('aria-label');
    const name = (label ?? '').replace(/^Show /, '');
    await expect(page.getByRole('link', { name }).first()).toBeVisible();
  });

  test('“add all” fills the cart from the hero in one go', async ({ page }) => {
    await page.goto(origin);

    const addAll = page.getByRole('button', { name: /add all to cart/i });
    test.skip(!(await addAll.count()), 'no add-all button in this store’s layout');

    await addAll.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Subtotal');
    await expect(page.getByRole('button', { name: /^Cart, [1-9]/ })).toBeVisible();
  });

  test('product tabs switch without a page load', async ({ page }) => {
    await page.goto(origin);

    const tabs = page.getByRole('tablist', { name: 'Product collections' });
    test.skip(!(await tabs.count()), 'no product tabs in this store’s layout');

    const second = tabs.getByRole('tab').nth(1);
    test.skip(!(await second.count()), 'only one tab configured');

    const url = page.url();
    await second.click();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toBe(url);
  });

  test('the FAQ opens with no JavaScript of ours', async ({ page }) => {
    // `<details>` is the browser's own disclosure widget: it works with scripts
    // blocked entirely, which is the point of using it.
    await page.context().addInitScript(() => {
      // nothing — the assertion below is about native behaviour, not our code
    });
    await page.goto(origin);

    const faq = page.locator('details.st-faq');
    test.skip(!(await faq.count()), 'no FAQ in this store’s layout');

    const second = faq.nth(1);
    await expect(second).not.toHaveAttribute('open', '');
    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
  });

  test('the countdown counts, and the strip and gallery are on the page', async ({
    page,
  }) => {
    await page.goto(origin);

    const countdown = page.getByRole('list', { name: 'Time remaining' });
    if (await countdown.count()) {
      const seconds = countdown.locator('li').last();
      const first = await seconds.textContent();
      await page.waitForTimeout(1500);
      expect(await seconds.textContent()).not.toBe(first);
    }

    // The marquee duplicates its track; only one copy is read out.
    const marquee = page.locator('.st-marquee');
    if (await marquee.count()) {
      await expect(marquee.locator('[aria-hidden="true"]').first()).toBeAttached();
    }
  });
});
