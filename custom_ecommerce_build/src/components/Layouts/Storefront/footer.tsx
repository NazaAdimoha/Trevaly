'use client';

import { type FormEvent, useState } from 'react';

import type { StorefrontLayout } from '@core/storefront/layout';

import { useTenant } from '@/lib/tenant-context';

import { PaymentIcons } from './payment-icons';
import { SocialIcons } from './social-icons';

/**
 * The footer both reference themes end on: a reason to hand over an email
 * address, the links a shopper actually looks for down here (orders, returns,
 * contact), and the store's name at a size that reads as confidence.
 *
 * What ours had instead was the store name, a tagline and two links.
 *
 * The newsletter form is deliberately honest: there is no list to post to yet,
 * so it says so on submit rather than pretending. A form that silently does
 * nothing is worse than no form.
 */
export function StorefrontFooter({ footer }: { footer: StorefrontLayout['footer'] }) {
  const tenant = useTenant();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'noted'>('idle');

  const subscribe = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setState('noted');
    setEmail('');
  };

  return (
    <footer
      className='st-hairline mt-20 border-t'
      style={{ background: 'var(--st-surface)', color: 'var(--st-ink)' }}
    >
      <div className='st-container py-14'>
        <div className='grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]'>
          {footer.newsletter ? (
            <div className='max-w-sm'>
              <h2 className='st-display text-xl'>{footer.newsletterHeading}</h2>
              {footer.newsletterBody ? (
                <p className='st-muted mt-2 text-sm'>{footer.newsletterBody}</p>
              ) : null}

              <form onSubmit={subscribe} className='mt-5'>
                <label htmlFor='st-newsletter' className='st-muted text-xs'>
                  Email address for updates
                </label>
                <div
                  className='mt-1 flex items-center gap-2 border-b pb-2'
                  style={{ borderColor: 'var(--st-line)' }}
                >
                  <input
                    id='st-newsletter'
                    type='email'
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder='you@example.com'
                    className='w-full bg-transparent text-sm outline-none'
                  />
                  <button type='submit' className='text-sm underline underline-offset-4'>
                    Join
                  </button>
                </div>
                {state === 'noted' ? (
                  <p className='st-muted mt-2 text-xs'>
                    Thank you — {tenant.name} will be in touch when the list opens.
                  </p>
                ) : null}
              </form>
            </div>
          ) : (
            <div className='max-w-sm'>
              <h2 className='st-display text-xl'>{tenant.name}</h2>
              {tenant.tagline ? (
                <p className='st-muted mt-2 text-sm'>{tenant.tagline}</p>
              ) : null}
            </div>
          )}

          {footer.columns.slice(0, 2).map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className='st-display mb-3 text-sm'>{column.heading}</h3>
              <ul className='space-y-2'>
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      className='st-muted text-sm transition-opacity hover:opacity-70'
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Contact details stay, wherever the merchant is reachable. A WhatsApp
            number is how most of these stores are actually contacted. */}
        {tenant.contactEmail || tenant.whatsappNumber ? (
          <div className='st-muted mt-10 flex flex-wrap gap-5 text-sm'>
            {tenant.contactEmail ? (
              <a href={`mailto:${tenant.contactEmail}`} className='hover:opacity-70'>
                {tenant.contactEmail}
              </a>
            ) : null}
            {tenant.whatsappNumber ? (
              <a
                href={`https://wa.me/${tenant.whatsappNumber.replace(/\D/g, '')}`}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:opacity-70'
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}

        {footer.socials.length > 0 ? (
          <div className='mt-8'>
            <SocialIcons socials={footer.socials} />
          </div>
        ) : null}
      </div>

      {/* The oversized wordmark. Clipped deliberately at small widths — it is a
          graphic device, not a label, and it is marked hidden from assistive
          tech because the store's name has already been read out above. */}
      {footer.wordmark ? (
        <div
          aria-hidden
          className='st-display overflow-hidden px-4 leading-[0.8] font-bold tracking-tight opacity-90 select-none'
          style={{ fontSize: 'clamp(3rem, 16vw, 14rem)' }}
        >
          {tenant.name}
        </div>
      ) : null}

      <div className='st-hairline border-t'>
        <div className='st-container st-muted flex flex-wrap items-center justify-between gap-4 py-5 text-xs'>
          <p>
            © {new Date().getFullYear()} {tenant.name}
          </p>
          {footer.showPaymentIcons ? <PaymentIcons /> : null}
        </div>
      </div>
    </footer>
  );
}
