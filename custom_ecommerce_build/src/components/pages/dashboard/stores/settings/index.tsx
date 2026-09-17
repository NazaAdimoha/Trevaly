'use client';

import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import type { StorefrontTheme } from '@core/enums';

import { api, apiFetcher, handleApiError } from '@/lib/api';

import Button from '@/components/buttons/Button';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';
import { STOREFRONT_THEME_OPTIONS } from '@/constant/storefront-themes';

type Settings = {
  name: string;
  slug: string;
  tagline: string | null;
  primaryColor: string | null;
  theme: StorefrontTheme;
  logoPublicId: string | null;
  logoUrl: string | null;
};

/**
 * Store settings.
 *
 * This page is what four dead links in the mobile app pointed at. Everything
 * here is a PATCH of one section rather than one big form: a merchant changing
 * their theme should not have to re-submit their tagline, and two people
 * editing different sections should not overwrite each other.
 *
 * The logo is uploaded from the MOBILE app, which has a camera. Here it is
 * shown and can be removed — a desktop merchant almost always has the file on
 * their phone, and building a second upload path to serve the rarer case is
 * work that would sit unused.
 */
export default function StoreSettingsView({
  storeSlug,
  storefrontUrl,
}: {
  storeSlug: string;
  storefrontUrl: string;
}) {
  const { data, isLoading, mutate } = useSWR<Settings>(
    `/stores/${storeSlug}/settings`,
    apiFetcher,
  );

  const [savingTheme, setSavingTheme] = useState<StorefrontTheme | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    const { data: updated } = await api.patch<Settings>(
      `/stores/${storeSlug}/settings`,
      body,
    );
    void mutate(updated, { revalidate: false });
    return updated;
  };

  const chooseTheme = async (theme: StorefrontTheme) => {
    setSavingTheme(theme);
    try {
      await patch({ theme });
      toast.success('Theme updated — refresh your storefront to see it');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSavingTheme(null);
    }
  };

  const removeLogo = async () => {
    try {
      await patch({ logoPublicId: null });
      toast.success('Logo removed');
    } catch (err) {
      handleApiError(err);
    }
  };

  if (isLoading || !data) {
    return (
      <div className='text-grey-500 flex items-center gap-2 p-6 text-sm'>
        <Loader2 className='size-4 animate-spin' /> Loading settings…
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Store settings'
        description='Your name, look and address. Changes appear on your storefront immediately.'
        url={ROUTES.store.base(storeSlug)}
      />

      {/* ── Details ─────────────────────────────────────────────────────── */}
      {/* Its own component so the fetched values are its INITIAL state rather
          than something an effect copies in. Seeding state from a prop in an
          effect costs a second render on every load and, worse, silently
          discards anything the merchant typed while the request was in
          flight. */}
      <DetailsForm
        initialName={data.name}
        initialTagline={data.tagline ?? ''}
        onSave={async (next) => {
          await patch(next);
        }}
      />

      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <section className='border-grey-100 rounded-lg border bg-white p-5'>
        <h2 className='text-forest-900 mb-1 text-base font-semibold'>Logo</h2>
        <p className='text-grey-500 mb-4 text-sm'>
          Upload a logo from the merchant app on your phone — your photos are
          already there.
        </p>
        <div className='flex items-center gap-4'>
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an already-optimised Cloudinary URL; next/image would re-process it
            <img
              src={data.logoUrl}
              alt={`${data.name} logo`}
              className='border-grey-100 size-20 rounded-lg border object-contain'
            />
          ) : (
            <div className='border-grey-100 text-grey-400 flex size-20 items-center justify-center rounded-lg border border-dashed text-xs'>
              No logo
            </div>
          )}
          {data.logoUrl ? (
            <Button variant='outline' onClick={() => void removeLogo()}>
              Remove logo
            </Button>
          ) : null}
        </div>
      </section>

      {/* ── Theme ───────────────────────────────────────────────────────── */}
      <section className='border-grey-100 rounded-lg border bg-white p-5'>
        <h2 className='text-forest-900 mb-1 text-base font-semibold'>
          Storefront theme
        </h2>
        <p className='text-grey-500 mb-4 text-sm'>
          Changes the layout and typography of your shop. Your products, prices
          and orders are untouched, and you can switch back at any time.
        </p>
        <div className='grid gap-3 sm:grid-cols-3'>
          {STOREFRONT_THEME_OPTIONS.map((option) => {
            const active = option.value === data.theme;
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => void chooseTheme(option.value)}
                disabled={savingTheme !== null}
                aria-pressed={active}
                className={`rounded-lg border p-4 text-left transition-colors disabled:opacity-60 ${
                  active
                    ? 'border-primary bg-primary-50'
                    : 'border-grey-100 hover:border-primary'
                }`}
              >
                <span className='flex items-center justify-between'>
                  <span className='text-forest-900 font-medium'>
                    {option.label}
                  </span>
                  {savingTheme === option.value ? (
                    <Loader2 className='text-primary size-4 animate-spin' />
                  ) : active ? (
                    <Check className='text-primary size-4' />
                  ) : null}
                </span>
                <span className='text-grey-600 mt-1 block text-xs leading-relaxed'>
                  {option.description}
                </span>
                <span className='text-grey-500 mt-2 block text-xs'>
                  Best for {option.suitedTo}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Address ─────────────────────────────────────────────────────── */}
      <section className='border-grey-100 rounded-lg border bg-white p-5'>
        <h2 className='text-forest-900 mb-1 text-base font-semibold'>
          Your storefront address
        </h2>
        <p className='text-grey-500 mb-4 text-sm'>
          This is the link you send customers. It never changes, so it is safe
          to print.
        </p>
        <div className='flex flex-wrap items-center gap-3'>
          <code className='border-grey-100 bg-grey-25 rounded border px-3 py-2 text-sm'>
            {storefrontUrl}
          </code>
          <a
            href={storefrontUrl}
            target='_blank'
            rel='noreferrer'
            className='text-primary-700 inline-flex items-center gap-1.5 text-sm font-medium hover:underline'
          >
            Visit store <ExternalLink className='size-3.5' />
          </a>
          <button
            type='button'
            onClick={() => {
              void navigator.clipboard.writeText(storefrontUrl);
              toast.success('Link copied');
            }}
            className='text-grey-600 hover:text-forest-900 text-sm font-medium'
          >
            Copy link
          </button>
        </div>
        <p className='text-grey-500 mt-4 text-xs'>
          Want your own domain like adaobistore.com? Message support and we will
          buy, point and secure it for you.
        </p>
      </section>
    </div>
  );
}

/**
 * Name and tagline.
 *
 * Holds its own state, seeded from props exactly once. The parent only renders
 * it after `data` arrives, so there is no empty-then-populated flicker and no
 * effect to keep in sync.
 */
function DetailsForm({
  initialName,
  initialTagline,
  onSave,
}: {
  initialName: string;
  initialTagline: string;
  onSave: (next: { name: string; tagline: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error('Give your store a name');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), tagline: tagline.trim() || null });
      toast.success('Store details saved');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className='border-grey-100 rounded-lg border bg-white p-5'>
      <h2 className='text-forest-900 mb-4 text-base font-semibold'>Details</h2>
      <div className='flex flex-col gap-4 sm:max-w-lg'>
        <label>
          <span className='text-grey-600 mb-1.5 block text-sm'>Store name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
          />
        </label>
        <label>
          <span className='text-grey-600 mb-1.5 block text-sm'>Tagline</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={140}
            placeholder='Order online and pay securely.'
            className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
          />
          <span className='text-grey-500 mt-1 block text-xs'>
            Shown under your store name and in search results.
          </span>
        </label>
        <div>
          <Button onClick={() => void submit()} isLoading={saving}>
            Save details
          </Button>
        </div>
      </div>
    </section>
  );
}
