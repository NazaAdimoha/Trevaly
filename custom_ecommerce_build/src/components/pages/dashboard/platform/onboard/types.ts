import * as Yup from 'yup';

import { StorefrontTheme } from '@core/enums';
import { RESERVED_SUBDOMAINS } from '@core/reserved';

/**
 * Formik/Yup for the operator filling the form. The API re-validates the same
 * rules with Zod in `@core/validation/tenant` — this layer exists to give fast
 * feedback, not to be trusted.
 */
export interface ITenantOnboardingValues {
  name: string;
  slug: string;
  ownerEmail: string;
  contactEmail: string;
  tagline: string;
  theme: StorefrontTheme;
  bankCode: string;
  accountNumber: string;
  platformFeePercent: string;
}

export const tenantOnboardingInitialValues: ITenantOnboardingValues = {
  name: '',
  slug: '',
  ownerEmail: '',
  contactEmail: '',
  tagline: '',
  // The look that flatters the widest range of catalogues, including an
  // unphotographed one. Switching later is a settings change, not a rebuild.
  theme: StorefrontTheme.CLASSIC,
  bankCode: '',
  accountNumber: '',
  platformFeePercent: '1',
};

export const tenantOnboardingValidationSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Too short').required('Store name required'),
  slug: Yup.string()
    .trim()
    .min(3, 'At least 3 characters')
    .matches(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Lowercase letters, numbers and hyphens only',
    )
    .test('not-reserved', 'That subdomain is reserved', (value) =>
      value ? !RESERVED_SUBDOMAINS.has(value) : true,
    )
    .required('Subdomain required'),
  ownerEmail: Yup.string()
    .trim()
    .email('Enter a valid email')
    .required("The owner's email is required"),
  contactEmail: Yup.string().trim().email('Enter a valid email'),
  tagline: Yup.string().trim().max(200),
  theme: Yup.string()
    .oneOf(Object.values(StorefrontTheme), 'Pick a storefront look')
    .required('Pick a storefront look'),
  bankCode: Yup.string().required('Select the settlement bank'),
  accountNumber: Yup.string()
    .trim()
    .matches(/^\d{10}$/, 'A Nigerian account number is 10 digits')
    .required('Account number required'),
  platformFeePercent: Yup.number()
    .typeError('Enter a percentage')
    .min(0, 'Cannot be negative')
    // Matches the Zod cap. Anything higher is far more likely a typo than an
    // intention, and Paystack applies it to every order without confirming.
    .max(10, 'Cap is 10% — check this is what you mean')
    .required('Platform fee required'),
});
