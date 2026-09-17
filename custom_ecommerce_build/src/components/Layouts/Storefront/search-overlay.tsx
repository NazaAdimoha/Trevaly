'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { useIsOpen, useStorefrontUi } from '@/lib/store/ui';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { Drawer } from './drawer';

/**
 * Search, as a panel that drops from the top.
 *
 * Submitting navigates to a real `/search?q=` URL rather than filtering in
 * place: a shopper who finds something wants to send that link to someone, and
 * a results page is also the page a search engine can index.
 */
export function SearchOverlay({ suggestions }: { suggestions: { name: string; slug: string }[] }) {
  const open = useIsOpen('search');
  const close = useStorefrontUi((s) => s.close);
  const router = useRouter();
  const [query, setQuery] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    close();
    router.push(`${STOREFRONT_ROUTES.search}?q=${encodeURIComponent(term)}`);
  };

  return (
    <Drawer open={open} onClose={close} side='top' title='Search'>
      <form onSubmit={submit} className='px-5 py-6'>
        <div
          className='st-control flex items-center gap-3 px-4 py-3'
          style={{ border: '1px solid var(--st-line)' }}
        >
          <Search className='st-muted size-5 shrink-0' />
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the shopper opened a search panel; anything else means a second tap
            autoFocus
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='What are you looking for?'
            aria-label='Search products'
            className='w-full bg-transparent text-base outline-none'
          />
        </div>

        {suggestions.length > 0 ? (
          <div className='mt-6'>
            <p className='st-muted mb-2 text-xs tracking-[0.18em] uppercase'>Popular right now</p>
            <ul className='flex flex-wrap gap-2'>
              {suggestions.slice(0, 6).map((item) => (
                <li key={item.slug}>
                  <button
                    type='button'
                    onClick={() => {
                      close();
                      router.push(STOREFRONT_ROUTES.product(item.slug));
                    }}
                    className='st-btn st-btn-outline px-3 py-1.5 text-sm'
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </Drawer>
  );
}
