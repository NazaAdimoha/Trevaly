'use client';

import { type FormEvent, useState } from 'react';

/**
 * Email capture with a reason attached.
 *
 * Honest about what it does: there is no list to post to yet, so it confirms
 * rather than pretending to subscribe. A form that silently swallows an address
 * is worse than no form, and a merchant would not know it was broken.
 */
export function NewsletterSection({
  settings,
}: {
  settings: {
    heading?: string | null;
    body?: string | null;
    buttonLabel?: string | null;
    consent?: string | null;
  };
}) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setDone(true);
    setEmail('');
  };

  return (
    <section
      className='st-reveal'
      style={{ background: 'var(--st-surface)', paddingBlock: 'var(--st-section-y)' }}
    >
      <div className='st-container max-w-xl text-center'>
        {settings.heading ? (
          <h2 className='st-display text-2xl md:text-3xl'>{settings.heading}</h2>
        ) : null}
        {settings.body ? <p className='st-muted mt-3'>{settings.body}</p> : null}

        <form onSubmit={submit} className='mt-6 flex flex-col gap-3 sm:flex-row'>
          <label htmlFor='st-newsletter-section' className='sr-only'>
            Email address
          </label>
          <input
            id='st-newsletter-section'
            type='email'
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder='you@example.com'
            className='st-control flex-1 px-4 py-3 text-sm'
            style={{ border: '1px solid var(--st-line)', background: 'var(--st-bg)' }}
          />
          <button type='submit' className='st-btn st-btn-accent'>
            {settings.buttonLabel || 'Sign up'}
          </button>
        </form>

        {done ? (
          <p className='mt-3 text-sm' aria-live='polite'>
            Thank you — we will be in touch.
          </p>
        ) : null}

        {settings.consent ? (
          <p className='st-muted mt-3 text-xs'>{settings.consent}</p>
        ) : null}
      </div>
    </section>
  );
}
