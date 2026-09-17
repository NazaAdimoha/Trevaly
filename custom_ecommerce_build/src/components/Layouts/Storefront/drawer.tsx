'use client';

import { X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * The slide-over every storefront panel is built from — cart, search, menu.
 *
 * Written by hand rather than reached for from a library because the behaviour
 * a shopper judges it by is small and specific: it opens from the side they
 * expect, Escape closes it, the page behind does not scroll, and focus goes
 * into the panel and stays there until it closes. A drawer that loses focus to
 * the page behind is unusable with a keyboard and invisible to a screen reader,
 * and that is most of what a component library would be sold to us for.
 *
 * Animation is CSS on a data attribute, so a browser that ignores it still
 * shows an open panel rather than an empty one.
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  labelledBy,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'left' | 'top';
  title?: string;
  /** For a panel whose heading is inside `children`. */
  labelledBy?: string;
  children: ReactNode;
  /** Pinned to the bottom, outside the scrolling area — a checkout button. */
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      // Focus trap. Without it, tabbing walks into the page behind the
      // backdrop, where clicks do nothing — the panel looks broken.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    // Into the panel, not onto the close button: a screen reader should hear
    // what this panel is before it hears how to dismiss it.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKeyDown);
      // Back to whatever opened it, so the keyboard does not start from the top
      // of the document again.
      returnFocusTo.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className='fixed inset-0 z-50' role='presentation'>
      <button
        type='button'
        aria-label='Close'
        onClick={onClose}
        className='st-backdrop absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]'
      />

      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-side={side}
        className={cn(
          'st-panel absolute flex flex-col outline-none',
          side === 'right' && 'inset-y-0 right-0 w-full max-w-md',
          side === 'left' && 'inset-y-0 left-0 w-full max-w-md',
          side === 'top' && 'inset-x-0 top-0 max-h-[85vh]',
          className,
        )}
        style={{ background: 'var(--st-bg)', color: 'var(--st-ink)' }}
      >
        {title ? (
          <header className='st-hairline flex items-center justify-between border-b px-5 py-4'>
            <h2 className='st-display text-lg'>{title}</h2>
            <button
              type='button'
              onClick={onClose}
              aria-label='Close'
              className='st-control -m-2 p-2 transition-opacity hover:opacity-60'
            >
              <X className='size-5' />
            </button>
          </header>
        ) : null}

        <div className='flex-1 overflow-y-auto overscroll-contain'>{children}</div>

        {footer ? (
          <footer className='st-hairline border-t px-5 py-4'>{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
