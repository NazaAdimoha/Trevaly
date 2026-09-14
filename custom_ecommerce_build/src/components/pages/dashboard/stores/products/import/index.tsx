'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { importTemplateCsv } from '@core/validation/import';

import { api, extractErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

import Button from '@/components/buttons/Button';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

type RowIssue = { row: number; message: string };

type Preview = {
  mode: 'preview';
  willCreate: number;
  willSkip: number;
  newCategories: string[];
  errors: RowIssue[];
  skipped: RowIssue[];
  sample: Array<{
    name: string;
    priceKobo: number;
    stock: number;
    category: string | null;
    optionName: string | null;
    variantCount: number;
    imageCount: number;
  }>;
};

/**
 * Bulk product import.
 *
 * Always previews before it writes. A merchant pasting a spreadsheet of two
 * hundred products needs to see what will happen — which rows are unreadable,
 * which already exist, which categories are about to be created — before any of
 * it lands, because undoing a bad import by hand is the worst afternoon this
 * product can give someone.
 */
export default function ProductImportView({
  storeSlug,
}: {
  storeSlug: string;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setPreview(null);
    setError(null);
  };

  const run = async (commit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(`/stores/${storeSlug}/products/import`, {
        csv,
        commit,
      });

      if (!commit) {
        setPreview(data as Preview);
        return;
      }

      const result = data as {
        created: number;
        failed: RowIssue[];
        imageWarnings: RowIssue[];
      };
      toast.success(
        `${result.created} product${result.created === 1 ? '' : 's'} imported`,
      );
      if (result.imageWarnings.length > 0) {
        toast.error(
          `${result.imageWarnings.length} image${result.imageWarnings.length === 1 ? '' : 's'} could not be fetched`,
        );
      }
      router.push(ROUTES.store.products.base(storeSlug));
      router.refresh();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([importTemplateCsv()], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storeSlug}-products-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className='mx-auto max-w-3xl px-6 py-10'>
      <PageHeader
        title='Import products'
        description='Upload a spreadsheet instead of filling the form thirty times.'
        url={ROUTES.store.products.base(storeSlug)}
      />

      <div className='mt-8 space-y-6'>
        <section className='rounded-lg border p-4'>
          <h2 className='text-sm font-medium'>1. Start from the template</h2>
          <p className='text-grey-600 mt-1 text-xs'>
            Only <strong>name</strong> and <strong>price</strong> are required.
            Extra columns are ignored, so an existing spreadsheet usually works
            as-is.
          </p>
          <button
            type='button'
            onClick={downloadTemplate}
            className='border-grey-100 hover:border-primary hover:text-primary-700 mt-3 rounded border px-3 py-1.5 text-xs font-medium transition-colors'
          >
            Download template CSV
          </button>

          <dl className='text-grey-600 mt-4 space-y-1.5 text-xs'>
            <div className='flex gap-2'>
              <dt className='w-20 shrink-0 font-medium'>category</dt>
              <dd>Created automatically if it does not exist yet.</dd>
            </div>
            <div className='flex gap-2'>
              <dt className='w-20 shrink-0 font-medium'>option</dt>
              <dd>What varies — Size, Colour, Weight.</dd>
            </div>
            <div className='flex gap-2'>
              <dt className='w-20 shrink-0 font-medium'>variants</dt>
              <dd>
                <code>S=4;M=6;L=3;XL=2@28000</code> — value=stock, and
                <code> @price</code> only where an option costs more.
              </dd>
            </div>
            <div className='flex gap-2'>
              <dt className='w-20 shrink-0 font-medium'>images</dt>
              <dd>
                Public <code>https://</code> links, separated by <code>|</code>.
                We fetch and store them for you.
              </dd>
            </div>
          </dl>
        </section>

        <section className='rounded-lg border p-4'>
          <h2 className='text-sm font-medium'>2. Choose your file</h2>
          <label className='mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-gray-600 hover:bg-gray-50'>
            <Upload className='size-4' />
            {fileName ?? 'Select a CSV file'}
            <input
              type='file'
              accept='.csv,text/csv'
              className='sr-only'
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>

          {csv ? (
            <Button
              type='button'
              className='mt-3'
              isLoading={busy && !preview}
              onClick={() => void run(false)}
            >
              Check the file
            </Button>
          ) : null}
        </section>

        {error ? (
          <p
            role='alert'
            className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'
          >
            {error}
          </p>
        ) : null}

        {preview ? (
          <section className='rounded-lg border p-4'>
            <h2 className='text-sm font-medium'>3. Check, then import</h2>

            <div className='mt-3 flex flex-wrap gap-4 text-sm'>
              <Stat
                label='Will be created'
                value={preview.willCreate}
                tone='good'
              />
              <Stat label='Already exist' value={preview.willSkip} />
              <Stat
                label='Unreadable rows'
                value={preview.errors.length}
                tone={preview.errors.length ? 'bad' : undefined}
              />
            </div>

            {preview.newCategories.length > 0 ? (
              <p className='text-grey-600 mt-3 text-xs'>
                New categories: {preview.newCategories.join(', ')}
              </p>
            ) : null}

            {preview.sample.length > 0 ? (
              <ul className='mt-4 divide-y rounded border text-sm'>
                {preview.sample.map((row) => (
                  <li
                    key={row.name}
                    className='flex flex-wrap gap-x-3 px-3 py-2'
                  >
                    <span className='font-medium'>{row.name}</span>
                    <span className='text-grey-600'>
                      {formatCurrency(row.priceKobo)}
                    </span>
                    {row.optionName ? (
                      <span className='text-grey-500 text-xs'>
                        {row.optionName}: {row.variantCount} options
                      </span>
                    ) : (
                      <span className='text-grey-500 text-xs'>
                        stock {row.stock}
                      </span>
                    )}
                    {row.category ? (
                      <span className='text-grey-500 text-xs'>
                        {row.category}
                      </span>
                    ) : null}
                    {row.imageCount > 0 ? (
                      <span className='text-grey-500 text-xs'>
                        {row.imageCount} image
                        {row.imageCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </li>
                ))}
                {preview.willCreate > preview.sample.length ? (
                  <li className='text-grey-500 px-3 py-2 text-xs'>
                    …and {preview.willCreate - preview.sample.length} more
                  </li>
                ) : null}
              </ul>
            ) : null}

            <IssueList
              title='Rows that will be skipped'
              issues={preview.skipped}
            />
            <IssueList title='Rows we could not read' issues={preview.errors} />

            <Button
              type='button'
              className='mt-4'
              disabled={preview.willCreate === 0}
              isLoading={busy}
              onClick={() => void run(true)}
            >
              Import {preview.willCreate} product
              {preview.willCreate === 1 ? '' : 's'}
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'bad';
}) {
  return (
    <div>
      <p
        className={
          tone === 'good'
            ? 'text-primary-700 text-xl font-semibold'
            : tone === 'bad'
              ? 'text-error text-xl font-semibold'
              : 'text-xl font-semibold'
        }
      >
        {value}
      </p>
      <p className='text-grey-500 text-xs'>{label}</p>
    </div>
  );
}

function IssueList({ title, issues }: { title: string; issues: RowIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className='mt-4'>
      <h3 className='text-grey-700 text-xs font-medium'>{title}</h3>
      <ul className='text-grey-600 mt-1 space-y-1 text-xs'>
        {issues.slice(0, 15).map((issue) => (
          <li key={`${issue.row}-${issue.message}`}>
            Row {issue.row}: {issue.message}
          </li>
        ))}
        {issues.length > 15 ? <li>…and {issues.length - 15} more</li> : null}
      </ul>
    </div>
  );
}
