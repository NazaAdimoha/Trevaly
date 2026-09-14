'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { api, apiFetcher, handleApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

import Button from '@/components/buttons/Button';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

type Zone = {
  id: string;
  name: string;
  feeKobo: number;
  position: number;
  isActive: boolean;
};

/**
 * Delivery areas.
 *
 * The fee a customer is charged at checkout comes from exactly this list, so
 * everything here is edited in place rather than behind a create/edit page:
 * a merchant adjusting a Lekki fee after a courier price rise wants to change
 * one number, not walk a form.
 *
 * Money is entered in NAIRA and stored in KOBO. The conversion happens once, on
 * submit, because every other amount in the system is an integer in kobo and a
 * float that leaks in here becomes a rounding error on a real order.
 */
export default function DeliveryZonesView({
  storeSlug,
}: {
  storeSlug: string;
}) {
  const { data, isLoading, mutate } = useSWR<{ items: Zone[] }>(
    `/stores/${storeSlug}/delivery-zones`,
    apiFetcher,
  );

  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const zones = data?.items ?? [];

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Give the area a name');
      return;
    }
    const naira = Number(fee);
    if (!Number.isFinite(naira) || naira < 0) {
      toast.error('Enter a delivery fee, or 0 for free');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/stores/${storeSlug}/delivery-zones`, {
        name: trimmed,
        feeKobo: Math.round(naira * 100),
        position: zones.length,
      });
      toast.success(`${trimmed} added`);
      setName('');
      setFee('');
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const patch = async (zone: Zone, data: Partial<Zone>) => {
    setBusyId(zone.id);
    try {
      await api.patch(`/stores/${storeSlug}/delivery-zones/${zone.id}`, data);
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (zone: Zone) => {
    // Deleting is not the same as turning off, and the difference matters:
    // past orders keep their fee but lose the link to the area they were sent
    // to, which is history a merchant may want.
    if (
      !window.confirm(
        `Delete “${zone.name}”? Past orders keep their fee but lose the link to this area. Turning it off instead keeps the record.`,
      )
    ) {
      return;
    }

    setBusyId(zone.id);
    try {
      const { data: result } = await api.delete<{ orphaned: number }>(
        `/stores/${storeSlug}/delivery-zones/${zone.id}`,
      );
      toast.success(
        result.orphaned > 0
          ? `${zone.name} deleted. ${result.orphaned} past order${result.orphaned === 1 ? '' : 's'} kept its fee.`
          : `${zone.name} deleted`,
      );
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Delivery areas'
        description='What you charge to deliver, by area. Customers pick one at checkout and the fee is added to their total.'
        url={ROUTES.store.base(storeSlug)}
      />

      <div className='border-grey-100 rounded-lg border bg-white p-5'>
        <h2 className='text-forest-900 mb-4 text-base font-semibold'>
          Add an area
        </h2>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <label className='flex-1'>
            <span className='text-grey-600 mb-1.5 block text-sm'>Area name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Lagos Mainland'
              className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
            />
          </label>
          <label className='sm:w-44'>
            <span className='text-grey-600 mb-1.5 block text-sm'>
              Fee (₦)
            </span>
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode='decimal'
              placeholder='1500'
              className='border-grey-100 focus:border-primary h-11 w-full rounded border px-3 text-sm outline-none'
            />
          </label>
          <Button
            onClick={() => void create()}
            isLoading={saving}
            leftIcon={Plus}
            className='h-11'
          >
            Add area
          </Button>
        </div>
        <p className='text-grey-500 mt-2 text-xs'>
          Enter 0 to offer free delivery to an area.
        </p>
      </div>

      <div className='border-grey-100 overflow-hidden rounded-lg border bg-white'>
        {isLoading ? (
          <div className='text-grey-500 flex items-center gap-2 p-6 text-sm'>
            <Loader2 className='size-4 animate-spin' /> Loading areas…
          </div>
        ) : zones.length === 0 ? (
          <div className='p-8 text-center'>
            <p className='text-forest-900 font-medium'>No delivery areas yet</p>
            <p className='text-grey-500 mt-1 text-sm'>
              Until you add one, customers can only choose pickup at checkout.
            </p>
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-grey-25 text-grey-600 border-grey-100 border-b'>
              <tr>
                <th className='px-5 py-3 text-left font-medium'>Area</th>
                <th className='px-5 py-3 text-left font-medium'>Fee</th>
                <th className='px-5 py-3 text-left font-medium'>
                  Offered at checkout
                </th>
                <th className='px-5 py-3' />
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className='border-grey-50 border-b last:border-0'>
                  <td className='text-forest-900 px-5 py-3.5 font-medium'>
                    {zone.name}
                  </td>
                  <td className='px-5 py-3.5'>
                    {zone.feeKobo === 0 ? (
                      <span className='text-primary-700 font-medium'>Free</span>
                    ) : (
                      formatCurrency(zone.feeKobo / 100)
                    )}
                  </td>
                  <td className='px-5 py-3.5'>
                    <button
                      type='button'
                      role='switch'
                      aria-checked={zone.isActive}
                      aria-label={`${zone.isActive ? 'Stop offering' : 'Offer'} ${zone.name} at checkout`}
                      disabled={busyId === zone.id}
                      onClick={() =>
                        void patch(zone, { isActive: !zone.isActive })
                      }
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        zone.isActive ? 'bg-primary' : 'bg-grey-100'
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                          zone.isActive ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className='px-5 py-3.5 text-right'>
                    <button
                      type='button'
                      onClick={() => void remove(zone)}
                      disabled={busyId === zone.id}
                      aria-label={`Delete ${zone.name}`}
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
