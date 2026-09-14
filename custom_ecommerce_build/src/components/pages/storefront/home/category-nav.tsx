import Link from 'next/link';

import { cn } from '@/lib/utils';

import { STOREFRONT_ROUTES } from '@/constant/routes';

export type CategoryNavItem = { id: string; name: string; slug: string };

/**
 * Category strip above the catalogue.
 *
 * Real links to real routes rather than a client-side filter: these pages are
 * the point. A store with two hundred products and no way to browse them is a
 * worse experience than the DM thread it replaced, and `/categories/{slug}` is
 * also indexable — "your products show up on Google" is something we sell.
 *
 * Renders nothing at all when a store has no categories, which is every store
 * on day one. A nav with one chip in it is noise.
 */
export default function CategoryNav({
  categories,
  activeSlug,
}: {
  categories: CategoryNavItem[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <nav
      aria-label='Product categories'
      className='mx-auto max-w-6xl px-4 pt-6'
    >
      {/* Scrolls rather than wraps: a phone showing eight categories should not
          push the first product off the screen. */}
      <ul className='-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden'>
        <li>
          <Chip href={STOREFRONT_ROUTES.home} active={!activeSlug}>
            All
          </Chip>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Chip
              href={STOREFRONT_ROUTES.category(category.slug)}
              active={category.slug === activeSlug}
            >
              {category.name}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'st-control inline-flex min-h-9 items-center border px-4 text-sm whitespace-nowrap transition-colors',
        active
          ? 'border-transparent text-white'
          : 'border-gray-200 text-gray-700 hover:border-gray-900',
      )}
      // The tenant colour, used the way every theme uses it: as an accent on
      // one small element, never as a large surface.
      style={active ? { backgroundColor: 'var(--brand)' } : undefined}
    >
      {children}
    </Link>
  );
}
