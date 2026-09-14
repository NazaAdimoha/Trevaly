'use client';

import { FieldArray, useFormikContext } from 'formik';
import { Plus, Trash2 } from 'lucide-react';

import { InputField } from '@/components/fields/InputField';

import { emptyVariant, type IProductFormValues } from './types';

const PRESETS: ReadonlyArray<{
  label: string;
  option: string;
  values: string[];
}> = [
  { label: 'Clothing sizes', option: 'Size', values: ['S', 'M', 'L', 'XL'] },
  {
    label: 'Shoe sizes',
    option: 'Size',
    values: ['39', '40', '41', '42', '43', '44'],
  },
  { label: 'Weights', option: 'Weight', values: ['5kg', '10kg', '25kg'] },
];

/**
 * The options editor.
 *
 * A product either sells as one thing or by option, never half of each — so
 * adding the first option hides the product-level stock field, because stock
 * then lives per option and two places to type it is two places to get it
 * wrong. The same rule is enforced server-side in `variantRejectionReason`.
 *
 * The presets exist because onboarding time is the business model: typing S,
 * M, L, XL for thirty products is the kind of thing that turns a one-hour
 * setup into three.
 */
export default function VariantsField() {
  const { values, setFieldValue } = useFormikContext<IProductFormValues>();
  const variants = values.variants ?? [];
  const optionLabel = values.optionName.trim() || 'Option';

  return (
    <FieldArray name='variants'>
      {({ push, remove }) => (
        <fieldset className='rounded-lg border p-4'>
          <legend className='px-1 text-sm font-medium'>Options</legend>

          {variants.length === 0 ? (
            <>
              <p className='mt-1 text-xs text-gray-600'>
                Add options if this product comes in sizes, colours or weights.
                Stock is then counted per option, so selling the last size 42
                does not mark size 40 sold out.
              </p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type='button'
                    onClick={() => {
                      void setFieldValue('optionName', preset.option);
                      void setFieldValue(
                        'variants',
                        preset.values.map((value) => ({
                          ...emptyVariant,
                          value,
                        })),
                      );
                    }}
                    className='border-grey-100 hover:border-primary hover:text-primary-700 rounded border px-3 py-1.5 text-xs font-medium transition-colors'
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type='button'
                  onClick={() => push({ ...emptyVariant })}
                  className='border-grey-100 hover:border-primary hover:text-primary-700 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors'
                >
                  <Plus className='size-3.5' />
                  Add manually
                </button>
              </div>
            </>
          ) : (
            <div className='mt-3 space-y-4'>
              <InputField
                name='optionName'
                label='What varies'
                required
                placeholder='Size'
                hint='Shown to shoppers above the choices.'
              />

              <div className='space-y-3'>
                {variants.map((variant, index) => (
                  <div
                    key={variant.id ?? `new-${index}`}
                    className='border-grey-100 grid grid-cols-2 items-start gap-3 rounded border p-3 sm:grid-cols-[1.2fr_1fr_0.8fr_auto]'
                  >
                    <InputField
                      name={`variants.${index}.value`}
                      label={optionLabel}
                      placeholder='M'
                    />
                    <InputField
                      name={`variants.${index}.price`}
                      label='Price (₦)'
                      placeholder={values.price || 'Same as product'}
                      hint='Leave blank to match the product price.'
                    />
                    <InputField
                      name={`variants.${index}.stock`}
                      label='Stock'
                    />
                    <button
                      type='button'
                      onClick={() => remove(index)}
                      aria-label={`Remove ${variant.value || 'this option'}`}
                      className='mt-7 justify-self-end p-2 text-gray-400 hover:text-red-600'
                    >
                      <Trash2 className='size-4' />
                    </button>
                  </div>
                ))}
              </div>

              <div className='flex items-center justify-between'>
                <button
                  type='button'
                  onClick={() => push({ ...emptyVariant })}
                  className='border-grey-100 hover:border-primary hover:text-primary-700 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors'
                >
                  <Plus className='size-3.5' />
                  Add {optionLabel.toLowerCase()}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    void setFieldValue('variants', []);
                    void setFieldValue('optionName', '');
                  }}
                  className='text-xs text-gray-500 underline underline-offset-4 hover:text-gray-900'
                >
                  Remove all options
                </button>
              </div>

              <p className='text-xs text-gray-500'>
                An option that has already been ordered is hidden from the store
                rather than deleted, so past receipts keep working.
              </p>
            </div>
          )}
        </fieldset>
      )}
    </FieldArray>
  );
}
