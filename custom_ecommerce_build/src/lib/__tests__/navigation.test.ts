import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { platformMenu, storeMenu } from '@/constant/menu';

/**
 * Every sidebar link must land on a page.
 *
 * Three did not: Orders in the store menu, and BOTH entries in the operator
 * menu (Tenants, Webhook Events). A merchant's first click into orders 404'd,
 * and so did an operator's first click of any kind. Nothing failed — no type
 * error, no build error — because a menu is just strings. This is the check
 * that would have caught all three.
 */
const APP = join(import.meta.dirname, '..', '..', 'app', '(platform)');
const SAMPLE_SLUG = 'sample-store';

function pageFileFor(url: string): string {
  const route = url.replace(`/stores/${SAMPLE_SLUG}`, '/stores/[storeSlug]');
  return join(APP, route, 'page.tsx');
}

describe('dashboard navigation', () => {
  it.each(storeMenu(SAMPLE_SLUG).map((item) => [item.title, item.url]))(
    'store menu "%s" (%s) has a page',
    (_title, url) => {
      expect(existsSync(pageFileFor(url))).toBe(true);
    },
  );

  it.each(platformMenu.map((item) => [item.title, item.url]))(
    'operator menu "%s" (%s) has a page',
    (_title, url) => {
      expect(existsSync(pageFileFor(url))).toBe(true);
    },
  );
});
