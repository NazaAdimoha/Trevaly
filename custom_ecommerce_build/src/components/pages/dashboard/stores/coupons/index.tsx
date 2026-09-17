'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { CouponType } from '@core/enums';

import { api, apiFetcher, handleApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

import Button from '@/components/buttons/Button';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderKobo: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
};

/**
 * Coupon codes.
 *
 * `value` means two different things depending on `type` — a percentage, or an
 * amount in kobo — which is the single easiest thing to get wrong here. The
 * input switches unit with the type and the conversion happens once on submit,
 * so a merchant typing "10" gets 10% or ₦10 and never 1000% or ₦0.10.
 *
 * A used code can be turned off but not edited or deleted: it is a promise
 * already made to customers, and rewriting what SAVE10 meant would change the
 * terms of orders already placed under it.
 */
export default function CouponsView({ storeSlug }: { storeSlug: string }) {
  const { data, isLoading, mutate } = useSWR<{ items: Coupon[] }>(
    `/stores/${storeSlug}/coupons`,
    apiFetcher,
  );

  const [code, setCode] = useState('');
  const [type, setType] = useState<CouponType>(CouponType.PERCENTAGE);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const coupons = data?.items ?? [];
  const percentage = type === CouponType.PERCENTAGE;

  const create = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(trimmed)) {
      toast.error('Codes are 3–40 letters, numbers, hyphens or underscores');
      return;
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error(percentage ? 'Enter a percentage' : 'Enter an amount');
      return;
    }
    if (percentage && amount > 100) {
      toast.error('A percentage discount cannot exceed 100');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/stores/${storeSlug}/coupons`, {
        code: trimmed,
        type,
        // Percentages are whole numbers; fixed amounts are kobo, like every
        // other amount in the system.
        value: percentage ? Math.round(amount) : Math.round(amount * 100),
      });
      toast.success(`${trimmed} created`);
      setCode('');
      setValue('');
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: Coupon) => {
    setBusyId(coupon.id);
    try {
      await api.patch(`/stores/${storeSlug}/coupons/${coupon.id}`, {
        isActive: !coupon.isActive,
      });
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(`Delete ${coupon.code}?`)) return;

    setBusyId(coupon.id);
    try {
      await api.delete(`/stores/${storeSlug}/coupons/${coupon.id}`);
      toast.success(`${coupon.code} deleted`);
      void mutate();
    } catch (err) {
      // The API refuses to delete a used code and explains why; surfacing its
      // message beats a generic failure the merchant cannot act on.
      handleApiError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Coupon codes'
        description='Discounts customers type at checkout. Codes are checked on our server, so they cannot be faked from the browser.'
        url={ROUTES.store.base(storeSlug)}
      />

      <div className='border-grey-100 rounded-lg border bg-white p-5'>
        <h2 className='text-forest-900 mb-4 text-base font-semibold'>
          Create a code
        </h2>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <label className='flex-1'>
            <span className='text-grey-600 mb-1.5 block text-sm'>Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder='LAUNCH10'
              autoCapitalize='characters'
              className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm uppercase outline-none'
            />
          </label>
          <label className='sm:w-44'>
            <span className='text-grey-600 mb-1.5 block text-sm'>Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CouponType)}
              className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
            >
              <option value={CouponType.PERCENTAGE}>Percentage off</option>
              <option value={CouponType.FIXED}>Fixed amount off</option>
            </select>
          </label>
          <label className='sm:w-36'>
            <span className='text-grey-600 mb-1.5 block text-sm'>
              {percentage ? 'Percent (%)' : 'Amount (₦)'}
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode='decimal'
              placeholder={percentage ? '10' : '2000'}
              className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
            />
          </label>
          <Button
            onClick={() => void create()}
            isLoading={saving}
            leftIcon={Plus}
            className='h-11'
          >
            Create
          </Button>
        </div>
      </div>

      <div className='border-grey-100 overflow-hidden rounded-lg border bg-white'>
        {isLoading ? (
          <div className='text-grey-500 flex items-center gap-2 p-6 text-sm'>
            <Loader2 className='size-4 animate-spin' /> Loading codes…
          </div>
        ) : coupons.length === 0 ? (
          <div className='p-8 text-center'>
            <p className='text-forest-900 font-medium'>No coupon codes yet</p>
            <p className='text-grey-500 mt-1 text-sm'>
              A launch code is the cheapest way to get the first orders in.
            </p>
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-grey-25 text-grey-600 border-grey-100 border-b'>
              <tr>
                <th className='px-5 py-3 text-left font-medium'>Code</th>
                <th className='px-5 py-3 text-left font-medium'>Discount</th>
                <th className='px-5 py-3 text-left font-medium'>Used</th>
                <th className='px-5 py-3 text-left font-medium'>Expires</th>
                <th className='px-5 py-3 text-left font-medium'>Active</th>
                <th className='px-5 py-3' />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className='border-grey-50 border-b last:border-0'
                >
                  <td className='text-forest-900 px-5 py-3.5 font-mono font-medium'>
                    {coupon.code}
                  </td>
                  <td className='px-5 py-3.5'>
                    {coupon.type === CouponType.PERCENTAGE
                      ? `${coupon.value}% off`
                      : `${formatCurrency(coupon.value)} off`}
                  </td>
                  <td className='px-5 py-3.5'>
                    {coupon.usedCount}
                    {coupon.maxUses ? ` of ${coupon.maxUses}` : ''}
                  </td>
                  <td className='text-grey-600 px-5 py-3.5'>
                    {coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Never'}
                  </td>
                  <td className='px-5 py-3.5'>
                    <button
                      type='button'
                      role='switch'
                      aria-checked={coupon.isActive}
                      aria-label={`${coupon.isActive ? 'Turn off' : 'Turn on'} ${coupon.code}`}
                      disabled={busyId === coupon.id}
                      onClick={() => void toggle(coupon)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        coupon.isActive ? 'bg-primary' : 'bg-grey-100'
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                          coupon.isActive ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className='px-5 py-3.5 text-right'>
                    <button
                      type='button'
                      onClick={() => void remove(coupon)}
                      disabled={busyId === coupon.id}
                      aria-label={`Delete ${coupon.code}`}
                      className='text-grey-400 hover:text-error p-1.5 disabled:opacity-50'
                    >
                      <Trash2 className='size-4' />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
