import * as Yup from 'yup';

/**
 * Formik + Yup for the admin form (the whole ported field layer is Formik-bound).
 * The API re-validates with Zod — Yup guards a human filling a form, Zod guards
 * a hostile client, and only one of those is optional.
 *
 * `price` is in NAIRA here because that is what a store owner types. It is
 * converted with `toMinor()` at submit; the API only ever accepts integer kobo.
 * The same holds for each option's price override.
 */

/** One row of the options editor. Prices are naira strings, like the parent. */
export interface IProductVariantFormValues {
  /** Present when editing an existing option; absent when adding one. */
  id?: string;
  value: string;
  sku: string;
  /** Blank inherits the product price. */
  price: string;
  stock: string;
  isActive: boolean;
}

export interface IProductFormValues {
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string;
  stock: string;
  /** Cloudinary public IDs, not URLs. Order matters — the first is the cover. */
  imageUrls: string[];
  isActive: 'true' | 'false';
  /** Empty string means uncategorised — the API maps it to null. */
  categoryId: string;
  /** Blank means this product has no options and is bought as-is. */
  optionName: string;
  variants: IProductVariantFormValues[];
}

export const emptyVariant: IProductVariantFormValues = {
  value: '',
  sku: '',
  price: '',
  stock: '0',
  isActive: true,
};

export const productInitialValues: IProductFormValues = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  price: '',
  stock: '0',
  imageUrls: [],
  isActive: 'true',
  categoryId: '',
  optionName: '',
  variants: [],
};

export const productValidationSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, 'Too short')
    .required('Product name is required'),
  slug: Yup.string()
    .trim()
    .matches(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Lowercase letters, numbers and hyphens only',
    )
    .required('URL slug is required'),
  sku: Yup.string().trim().max(64),
  description: Yup.string().trim().max(5000),
  price: Yup.number()
    .typeError('Enter a valid amount')
    .moreThan(0, 'Price must be greater than zero')
    .required('Price is required'),
  // Only meaningful without options — when a product sells by option, stock
  // lives on each option and this field is hidden.
  stock: Yup.number()
    .typeError('Enter a whole number')
    .integer('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .required('Stock is required'),
  optionName: Yup.string()
    .trim()
    .max(40)
    .when('variants', {
      is: (variants: unknown[]) => (variants?.length ?? 0) > 0,
      then: (schema) =>
        schema.required('Name what the options are — Size, Colour, Weight'),
    }),
  variants: Yup.array()
    .of(
      Yup.object({
        value: Yup.string().trim().max(60).required('Required'),
        sku: Yup.string().trim().max(64),
        price: Yup.number()
          .typeError('Enter a valid amount')
          .moreThan(0, 'Must be greater than zero')
          .nullable()
          .transform((value, original) =>
            String(original ?? '').trim() === '' ? null : value,
          ),
        stock: Yup.number()
          .typeError('Whole number')
          .integer('Whole number')
          .min(0, 'Cannot be negative')
          .required('Required'),
      }),
    )
    .max(30, 'Up to 30 options')
    .test('unique-values', 'Two options share the same name', (variants) => {
      const values = (variants ?? []).map((v) =>
        (v?.value ?? '').trim().toLowerCase(),
      );
      return new Set(values).size === values.length;
    }),
  imageUrls: Yup.array().of(Yup.string().required()).max(8, 'Up to 8 images'),
  isActive: Yup.string().oneOf(['true', 'false']).required(),
  categoryId: Yup.string(),
});

/** Derives a URL slug from a product name as the owner types. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
