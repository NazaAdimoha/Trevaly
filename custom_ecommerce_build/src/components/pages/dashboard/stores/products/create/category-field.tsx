'use client';

import { useField } from 'formik';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

import { slugifyCategory } from '@core/validation/category';

import { api, apiFetcher, extractErrorMessage } from '@/lib/api';

import { FieldWrapper } from '@/components/fields/FieldWrapper';

type Category = { id: string; name: string; slug: string };

/**
 * Category picker with inline create.
 *
 * The inline create is the point. A merchant adding thirty products in one
 * sitting should never have to abandon a half-filled form to go and define
 * "Dresses" somewhere else and come back — that round trip is exactly the kind
 * of friction that turns a one-hour onboarding into three, and it is why the
 * catalogue currently has no categories at all despite the column existing
 * since the first migration.
 */
export default function CategoryField({ storeSlug }: { storeSlug: string }) {
  const [field, , helpers] = useField<string>('categoryId');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, mutate } = useSWR<{ items: Category[] }>(
    `/stores/${storeSlug}/categories`,
    apiFetcher,
  );
  const categories = data?.items ?? [];

  const create = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      setError('Give the category a name');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data: created } = await api.post<Category>(
        `/stores/${storeSlug}/categories`,
        { name, slug: slugifyCategory(name), position: categories.length },
      );
      await mutate();
      void helpers.setValue(created.id);
      setNewName('');
      setCreating(false);
    } catch (err) {
      // Inline, not a toast: the operator is looking at this field and the
      // likely failure is a duplicate name they need to change.
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FieldWrapper
      name='categoryId'
      label='Category'
      subtitle='Groups this product on the storefront. Optional.'
    >
      {creating ? (
        <div className='space-y-2'>
          <div className='flex gap-2'>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void create();
                }
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder='Dresses'
              aria-label='New category name'
              className='border-grey-100 focus:border-primary h-10 flex-1 rounded border px-3 text-sm outline-none'
            />
            <button
              type='button'
              onClick={() => void create()}
              disabled={saving}
              className='bg-primary hover:bg-primary-600 h-10 rounded px-4 text-sm font-medium text-white disabled:opacity-60'
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button
              type='button'
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className='text-grey-600 hover:text-grey-900 h-10 px-2 text-sm'
            >
              Cancel
            </button>
          </div>
          {newName.trim() ? (
            <p className='text-grey-500 text-xs'>
              Storefront URL: /categories/{slugifyCategory(newName)}
            </p>
          ) : null}
          {error ? (
            <p role='alert' className='text-error text-xs'>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className='flex gap-2'>
          <select
            {...field}
            value={field.value ?? ''}
            className='border-grey-100 focus:border-primary h-10 flex-1 rounded border px-3 text-sm outline-none'
          >
            <option value=''>No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={() => setCreating(true)}
            className='border-grey-100 hover:border-primary hover:text-primary-700 inline-flex h-10 items-center gap-1.5 rounded border px-3 text-sm font-medium transition-colors'
          >
            <Plus className='size-4' />
            New
          </button>
        </div>
      )}
    </FieldWrapper>
  );
}
