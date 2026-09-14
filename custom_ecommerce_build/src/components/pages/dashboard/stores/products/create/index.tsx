'use client';

import { Form, Formik, type FormikHelpers, useFormikContext } from 'formik';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { api, handleApiError } from '@/lib/api';
import { toMajor, toMinor } from '@/lib/utils';

import Button from '@/components/buttons/Button';
import { ImageUploadField } from '@/components/fields/ImageUploadField';
import { InputField } from '@/components/fields/InputField';
import { SelectField } from '@/components/fields/SelectField';
import { TextAreaField } from '@/components/fields/TextAreaField';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

import CategoryField from './category-field';
import {
  type IProductFormValues,
  productInitialValues,
  productValidationSchema,
  slugify,
} from './types';
import VariantsField from './variants-field';
import { PRODUCT_STATUS_OPTIONS } from '../constants';

/**
 * Keeps the slug in step with the product name while the slug is still
 * untouched. Lives as a component rather than an onChange handler because the
 * ported InputField is Formik-bound and does not expose one.
 */
function SlugSync({ enabled }: { enabled: boolean }) {
  const { values, setFieldValue, touched } =
    useFormikContext<IProductFormValues>();
  const lastAuto = useRef('');

  useEffect(() => {
    if (!enabled || touched.slug) return;
    const next = slugify(values.name);
    if (next === lastAuto.current) return;
    lastAuto.current = next;
    void setFieldValue('slug', next);
  }, [enabled, touched.slug, values.name, setFieldValue]);

  return null;
}

type ExistingProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  imageUrls: string[];
  isActive: boolean;
  categoryId: string | null;
  optionName: string | null;
  variants?: Array<{
    id: string;
    value: string;
    sku: string | null;
    priceKobo: number | null;
    stock: number;
    isActive: boolean;
  }>;
};

/**
 * Create and edit share one form. The only differences are the initial values
 * and the HTTP verb, so splitting them would duplicate the validation schema and
 * the naira/kobo conversion — the two things that must never drift.
 */
export default function ProductFormView({
  storeSlug,
  product,
}: {
  storeSlug: string;
  product?: ExistingProduct;
}) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const initialValues: IProductFormValues = product
    ? {
        name: product.name,
        slug: product.slug,
        sku: product.sku ?? '',
        description: product.description ?? '',
        price: String(toMajor(product.priceKobo)),
        stock: String(product.stock),
        imageUrls: product.imageUrls,
        isActive: product.isActive ? 'true' : 'false',
        categoryId: product.categoryId ?? '',
        optionName: product.optionName ?? '',
        variants: (product.variants ?? []).map((variant) => ({
          id: variant.id,
          value: variant.value,
          sku: variant.sku ?? '',
          price:
            variant.priceKobo === null
              ? ''
              : String(toMajor(variant.priceKobo)),
          stock: String(variant.stock),
          isActive: variant.isActive,
        })),
      }
    : productInitialValues;

  const handleSubmit = async (
    values: IProductFormValues,
    { setSubmitting }: FormikHelpers<IProductFormValues>,
  ) => {
    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      sku: values.sku.trim(),
      description: values.description.trim(),
      // Naira in the form, integer kobo on the wire. Never send a float.
      priceKobo: toMinor(values.price),
      // Meaningless once options exist — stock is then per option, and the
      // server ignores this. Sent as 0 so nothing reads a stale number.
      stock: values.variants.length > 0 ? 0 : Number(values.stock),
      imageUrls: values.imageUrls,
      isActive: values.isActive === 'true',
      categoryId: values.categoryId,
      optionName: values.variants.length > 0 ? values.optionName.trim() : '',
      variants: values.variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        value: variant.value.trim(),
        sku: variant.sku.trim(),
        // Blank means "same as the product", which is null on the wire — not 0.
        priceKobo: variant.price.trim() === '' ? null : toMinor(variant.price),
        stock: Number(variant.stock),
        isActive: variant.isActive,
      })),
    };

    try {
      if (isEdit && product) {
        await api.patch(`/stores/${storeSlug}/products/${product.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post(`/stores/${storeSlug}/products`, payload);
        toast.success('Product created');
      }
      router.push(ROUTES.store.products.base(storeSlug));
      router.refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='flex flex-col space-y-3.5'>
      <PageHeader
        title={isEdit ? 'Edit product' : 'Add product'}
        description={
          isEdit
            ? 'Changes apply to the storefront immediately. Past orders keep the price they were placed at.'
            : 'Add something customers can buy from this store.'
        }
        url={ROUTES.store.products.base(storeSlug)}
      />

      <div className='rounded-lg bg-white p-6'>
        <Formik
          initialValues={initialValues}
          validationSchema={productValidationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting, values }) => (
            <Form className='max-w-2xl space-y-5'>
              <InputField
                name='name'
                label='Product name'
                required
                placeholder='Ankara Midi Dress'
              />
              {/* Derives the slug from the name until the owner edits it
                  themselves — a deliberate slug is never overwritten. */}
              <SlugSync enabled={!isEdit} />

              <InputField
                name='slug'
                label='URL slug'
                required
                subtitle={`Storefront URL: /products/${values.slug || 'your-product'}`}
                placeholder='ankara-midi-dress'
              />

              <InputField name='sku' label='SKU' placeholder='Optional' />

              <CategoryField storeSlug={storeSlug} />

              <TextAreaField
                name='description'
                label='Description'
                rows={4}
                placeholder='What is it, what size, what material...'
              />

              <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
                <InputField
                  name='price'
                  label='Price (₦)'
                  required
                  format='currency'
                  currency='₦'
                  placeholder='25,000'
                />
                {/* Hidden once options exist: stock is then counted per option,
                    and two places to type it is two places to get it wrong. */}
                {values.variants.length === 0 ? (
                  <InputField
                    name='stock'
                    label='Stock'
                    required
                    type='number'
                    placeholder='0'
                  />
                ) : null}
              </div>

              <VariantsField />

              <ImageUploadField
                name='imageUrls'
                label='Images'
                storeSlug={storeSlug}
                subtitle='JPG, PNG, WebP or AVIF, up to 10MB each.'
              />

              <SelectField
                name='isActive'
                label='Status'
                required
                options={PRODUCT_STATUS_OPTIONS}
                placeholder='Select status'
              />

              <div className='flex gap-3 pt-2'>
                <Button type='submit' isLoading={isSubmitting}>
                  {isEdit ? 'Save changes' : 'Create product'}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
