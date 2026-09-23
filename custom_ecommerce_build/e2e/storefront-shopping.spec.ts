import { expect, test } from '@playwright/test';

import { E2E_TENANT, storefrontOrigin } from '../playwright.config';

/**
 * The two pages that convert: a collection and a product.
 *
 * What is checked here is the behaviour a shopper would notice losing, not the
 * styling. On a collection that means the controls are real URLs that really
 * reorder the shop — the failure mode worth catching is a sort that decorates
 * the button and leaves the grid alone. On a product it means the gallery
 * changes the picture, the sticky bar appears only once the real button is gone,
 * and a sold-out size is visible but unbuyable.
 */

const origin = storefrontOrigin(E2E_TENANT);

/** Product slugs in the order the page lists them. */
const listed = (page: import('@playwright/test').Page) =>
  page.locator('main a[href^="/products/"]').evaluateAll((links) => [
    ...new Set(
      links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
    ),
  ]);

test.describe('collection page', () => {
  test('sorting is a URL, and it really reorders the grid', async ({ page }) => {
    await page.goto(origin);
    await page.locator('header nav a').first().click();
    await expect(page).toHaveURL(/\/categories\//);

    const before = await listed(page);
    test.skip(before.length < 2, 'this collection has one product — nothing to reorder');

    // The sort options live in a `<details>` — the browser owns opening it.
    await page.getByText(/Sort:/).click();
    await page.getByRole('link', { name: /Price, low to high/ }).click();

    // The sort is in the address bar, so the shopper can send it to someone.
    await expect(page).toHaveURL(/sort=price-asc/);

    const after = await listed(page);
    expect(after.slice().sort()).toEqual(before.slice().sort()); // same products
    expect(after).not.toEqual(before); // different order
  });

  test('the item count is the shop’s count, and the filter changes it', async ({ page }) => {
    await page.goto(`${origin}/categories/dresses`);

    const count = page.locator('main').getByText(/^\d+ items?$/).first();
    await expect(count).toBeVisible();
    const total = Number((await count.textContent())?.match(/\d+/)?.[0] ?? 0);
    expect(total).toBeGreaterThan(0);

    await page.getByRole('link', { name: 'In stock only' }).first().click();
    await expect(page).toHaveURL(/inStock=1/);

    const filtered = Number((await count.textContent())?.match(/\d+/)?.[0] ?? -1);
    expect(filtered).toBeLessThanOrEqual(total);
  });

  test('density changes how many products fit across a row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${origin}/categories/dresses`);

    const columns = () =>
      page
        .locator('main ul.st-grid')
        .first()
        .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);

    const comfortable = await columns();
    await page.getByRole('link', { name: 'Show more per row' }).click();
    await expect(page).toHaveURL(/density=compact/);
    expect(await columns()).toBeGreaterThan(comfortable);
  });
});

test.describe('all products', () => {
  test('/products exists, and is the same page as a collection', async ({ page }) => {
    // It did not exist, and it was reachable: a hero's second button defaults
    // to "Browse all", the section editor offers `/products` as a link, and a
    // published layout pointed two CTAs at it. A shopper following the most
    // prominent link under the headline got a 404.
    const response = await page.goto(`${origin}/products`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'All products', level: 1 })).toBeVisible();
    expect(await listed(page)).not.toHaveLength(0);

    // Every control a category page has, because it is the same component.
    await expect(page.locator('main').getByText(/^\d+ items?$/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'In stock only' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Show more per row' })).toBeVisible();

    // And the "All" pill is the active one here, not a category.
    await expect(page.getByRole('link', { name: 'All', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('sorting works here too, and stays in the URL', async ({ page }) => {
    await page.goto(`${origin}/products`);
    const before = await listed(page);
    test.skip(before.length < 2, 'one product — nothing to reorder');

    await page.getByText(/Sort:/).click();
    await page.getByRole('link', { name: /Price, low to high/ }).click();

    await expect(page).toHaveURL(/\/products\?.*sort=price-asc/);
    const after = await listed(page);
    expect(after.slice().sort()).toEqual(before.slice().sort());
    expect(after).not.toEqual(before);
  });

  test('a category pill narrows it, and leads somewhere real', async ({ page }) => {
    await page.goto(`${origin}/products`);
    const all = await listed(page);

    const pill = page.locator('main a[href^="/categories/"]').first();
    test.skip(!(await pill.count()), 'this store has no categories');
    await pill.click();

    await expect(page).toHaveURL(/\/categories\//);
    expect((await listed(page)).length).toBeLessThanOrEqual(all.length);
  });
});

test.describe('product page', () => {
  test('the gallery swaps the main image, and the sticky bar waits its turn', async ({
    page,
  }) => {
    await page.goto(origin);
    await page.locator('main a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(/\/products\//);

    const buy = page.getByRole('button', { name: 'Buy it now' });
    await expect(buy).toBeVisible();

    // The bar duplicates a control the shopper can already see, so while the
    // real button is on screen there must be exactly one "Add to cart".
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(1);

    const thumbnails = page.getByRole('button', { name: /^Show image 2 of/ });
    if (await thumbnails.count()) {
      const main = page.locator('main img').first();
      const before = await main.getAttribute('src');
      await thumbnails.click();
      await expect(main).not.toHaveAttribute('src', before ?? '');
    }

    await page.locator('footer').scrollIntoViewIfNeeded();
    const bar = page.getByRole('region', { name: 'Quick buy' });
    await expect(bar).toBeVisible();

    // Whatever it says, it does something: adds the item, or — when a size is
    // still unchosen — takes the shopper to the sizes.
    const action = bar.getByRole('button').last();
    await expect(action).toBeEnabled();
    await action.click();

    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await expect(page.getByRole('dialog')).toContainText('Subtotal');
    } else {
      await expect(page.locator('fieldset button[aria-pressed]:not([disabled])').first()).toBeFocused();
    }
  });

  test('a sold-out size stays visible and cannot be bought', async ({ page }) => {
    await page.goto(`${origin}/products/ankara-midi-dress`);

    const sizes = page.locator('fieldset button[aria-pressed]');
    test.skip(!(await sizes.count()), 'this product has no size options');

    const soldOut = sizes.and(page.locator(':disabled'));
    if (await soldOut.count()) {
      // Visible, so the shopper knows the size exists and is gone rather than
      // wondering whether the store stocks it at all.
      await expect(soldOut.first()).toBeVisible();
    }

    // Nothing can be added until a size is picked.
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    await sizes.and(page.locator(':enabled')).first().click();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  test('related products lead somewhere', async ({ page }) => {
    await page.goto(`${origin}/products/ankara-midi-dress`);

    const related = page.getByRole('heading', { name: /More in |You may also like/ });
    test.skip(!(await related.count()), 'nothing else in this collection');

    await expect(related.first()).toBeVisible();
    const link = page
      .locator('main a[href^="/products/"]')
      .filter({ hasNotText: 'ankara-midi-dress' })
      .last();
    await link.click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.locator('h1')).toBeVisible();
  });
});
