'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { StorefrontLayout } from '@core/storefront/layout';

const DISMISSED_EVENT = 'st-announcement-dismissed';

/**
 * The strip above the header: a promise, an offer, or a deadline.
 *
 * Rotates when there is more than one message, because a merchant always has
 * more than one thing to say and a stack of bars pushes the shop off the
 * screen. Dismissal is remembered per browser — a shopper who closed it does
 * not want it back on the next page, and a bar that reappears reads as broken.
 */
export function AnnouncementBar({
  announcement,
  storeSlug,
}: {
  announcement: StorefrontLayout['announcement'];
  storeSlug: string;
}) {
  const messages = announcement.messages.filter(Boolean);
  const [index, setIndex] = useState(0);
  const storageKey = `st-announcement:${storeSlug}`;

  /**
   * Whether this browser already closed the bar.
   *
   * Read through `useSyncExternalStore` rather than in an effect: the server
   * cannot know what is in localStorage, so the server snapshot is "not
   * dismissed" and the client's real answer arrives on hydration. Doing it with
   * `useEffect` + `setState` renders the bar and then rips it away, which is
   * both a flash and a cascading render React 19 rightly complains about.
   */
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener('storage', notify);
    window.addEventListener(DISMISSED_EVENT, notify);
    return () => {
      window.removeEventListener('storage', notify);
      window.removeEventListener(DISMISSED_EVENT, notify);
    };
  }, []);

  const dismissed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storageKey) === '1';
      } catch {
        // Private mode, or storage disabled. Showing the bar is the safe default.
        return false;
      }
    },
    () => false,
  );

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (!announcement.enabled || messages.length === 0 || dismissed) return null;

  const message = messages[index] ?? messages[0];

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Not remembering it is better than failing to close it.
    }
    // `storage` only fires in OTHER tabs, so this tab needs its own nudge.
    window.dispatchEvent(new Event(DISMISSED_EVENT));
  };

  return (
    <div
      className='relative overflow-hidden text-center'
      style={{ background: 'var(--st-accent)', color: 'var(--st-accent-ink)' }}
    >
      <div className='st-container flex items-center justify-center gap-3 py-2 text-sm'>
        {/* `aria-live` polite rather than assertive: a rotating promotion should
            never interrupt someone mid-sentence. */}
        <p aria-live='polite' className='truncate'>
          {announcement.href ? (
            <Link href={announcement.href} className='underline-offset-4 hover:underline'>
              {message}
            </Link>
          ) : (
            message
          )}
        </p>

        {announcement.dismissible ? (
          <button
            type='button'
            onClick={dismiss}
            aria-label='Dismiss'
            className='absolute right-3 p-1 transition-opacity hover:opacity-70'
          >
            <X className='size-4' />
          </button>
        ) : null}
      </div>
    </div>
  );
}
