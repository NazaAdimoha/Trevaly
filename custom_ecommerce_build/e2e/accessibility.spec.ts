import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { E2E_TENANT, storefrontOrigin } from '../playwright.config';

/**
 * WCAG 2.1 AA across every page a shopper sees, on a laptop and a phone.
 *
 * Run as a test rather than audited once, because accessibility does not stay
 * fixed. All three of the violations this first caught were introduced by
 * ordinary, reasonable-looking work: `aria-pressed` on a link that is a link on
 * purpose, an `opacity-70` on text that was already muted, and a scroll strip
 * whose contents are quotes and therefore has nothing to tab to. None would
 * have been found by reading the diff.
 *
 * Scoped to the violations axe is CERTAIN about. Its "incomplete" results need
 * a human and would make this fail on a maybe — a flaky accessibility test gets
 * skipped, and a skipped one protects nothing.
 *
 * Every scan runs under `prefers-reduced-motion: reduce`, for two reasons. It
 * makes the result deterministic: the storefront's reveals start at `opacity: 0`
 * and axe, sampling mid-fade, measured real text at 1.35:1 against white and
 * called it a contrast failure — of an element that reads perfectly once it has
 * arrived. And it is the honest configuration to audit, because every keyframe
 * in the storefront sits behind `prefers-reduced-motion: no-preference`, so
 * this is exactly what a viewer who asked for less motion is served.
 */
const origin = storefrontOrigin(E2E_TENANT);

const PAGES: [name: string, path: string][] = [
  ['home', '/'],
  ['all products', '/products'],
  ['collection', '/categories/dresses'],
  ['product', '/products/ankara-midi-dress'],
  ['cart', '/cart'],
  ['checkout', '/checkout'],
  ['search', '/search?q=dress'],
];

const VIEWPORTS: [label: string, width: number, height: number][] = [
  ['laptop', 1280, 900],
  // 390 is the iPhone width most of this market is on, and where the layout
  // actually changes — the tab bar appears and rows become scroll strips.
  ['phone', 390, 844],
];

for (const [label, width, height] of VIEWPORTS) {
  test.describe(`accessibility — ${label}`, () => {
    test.use({ viewport: { width, height } });

    for (const [name, path] of PAGES) {
      test(`${name} has no WCAG A or AA violations`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(origin + path);
        await page.waitForLoadState('networkidle');

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // Named in the failure, or the report is "expected 0 to be 3" and
        // someone has to re-run the audit by hand to find out what broke.
        expect(
          violations.map((v) => `${v.impact}: ${v.id} — ${v.nodes.length} node(s)`),
        ).toEqual([]);
      });
    }
  });
}

/**
 * The same pages with something in the cart.
 *
 * An empty cart and an empty checkout are the WEAKER test: they render a
 * heading and a link. With items, checkout renders the whole form — every
 * label, every error, the radio cards and the native select — which is the
 * densest markup in the storefront and the part written by hand.
 *
 * The drawer is audited open, because a dialog is where focus order, the trap
 * and the labelling actually have to hold.
 */
for (const [label, width, height] of VIEWPORTS) {
  test.describe(`accessibility with a cart — ${label}`, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${origin}/products/silk-head-wrap`);
      await page.getByRole('button', { name: 'Add to cart' }).click();
      await expect(page.getByRole('button', { name: /^Cart, [1-9]/ })).toBeVisible();
    });

    const scan = async (page: import('@playwright/test').Page) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      return violations.map((v) => `${v.impact}: ${v.id} — ${v.nodes.length} node(s)`);
    };

    test('the open cart drawer is clean', async ({ page }) => {
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('the cart page with items is clean', async ({ page }) => {
      await page.keyboard.press('Escape');
      await page.goto(`${origin}/cart`);
      await page.waitForLoadState('networkidle');
      expect(await scan(page)).toEqual([]);
    });

    test('the checkout form is clean', async ({ page }) => {
      await page.keyboard.press('Escape');
      await page.goto(`${origin}/checkout`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('button', { name: /pay now/i })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  });
}
