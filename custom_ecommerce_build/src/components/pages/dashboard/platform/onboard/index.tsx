'use client';

import { Form, Formik, type FormikHelpers, useFormikContext } from 'formik';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api, extractErrorMessage } from '@/lib/api';
import { slugifyTenantName } from '@/lib/validation/tenant';

import Button from '@/components/buttons/Button';
import { InputField } from '@/components/fields/InputField';
import { SelectField } from '@/components/fields/SelectField';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

import ThemeField from './theme-field';
import {
  type ITenantOnboardingValues,
  tenantOnboardingInitialValues,
  tenantOnboardingValidationSchema,
} from './types';

type Bank = { name: string; code: string };

/** Mirrors the product form: derive the slug until the operator edits it. */
function SlugSync() {
  const { values, setFieldValue, touched } =
    useFormikContext<ITenantOnboardingValues>();
  const lastAuto = useRef('');

  useEffect(() => {
    if (touched.slug) return;
    const next = slugifyTenantName(values.name);
    if (next === lastAuto.current) return;
    lastAuto.current = next;
    void setFieldValue('slug', next);
  }, [touched.slug, values.name, setFieldValue]);

  return null;
}

function StorefrontPreview() {
  const { values } = useFormikContext<ITenantOnboardingValues>();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com';

  if (!values.slug) return null;

  return (
    <p className='text-sm text-gray-600'>
      Storefront will be live at{' '}
      <code className='font-medium'>
        {values.slug}.{rootDomain}
      </code>
    </p>
  );
}

export default function OnboardTenantView({ banks }: { banks: Bank[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (
    values: ITenantOnboardingValues,
    { setSubmitting }: FormikHelpers<ITenantOnboardingValues>,
  ) => {
    setServerError(null);

    try {
      const { data } = await api.post<{
        tenant: { slug: string; name: string };
        accountName: string | null;
      }>('/platform/tenants', {
        ...values,
        platformFeePercent: Number(values.platformFeePercent),
      });

      // The resolved account name is the one thing the operator could not have
      // known before submitting, so it is worth surfacing rather than a bare
      // "created" — it is their last chance to spot the wrong bank account. It
      // is absent when Paystack rate-limited the lookup, which is not an error.
      toast.success(
        data.accountName
          ? `${data.tenant.name} onboarded — settling to ${data.accountName}`
          : `${data.tenant.name} onboarded — account name could not be verified`,
      );
      router.push(ROUTES.platform.base);
    } catch (err) {
      // Inline rather than a toast: a rejected bank account needs the operator
      // to correct a field they are still looking at.
      setServerError(extractErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className='mx-auto max-w-2xl px-6 py-10'>
      <PageHeader
        title='Onboard a store'
        description='Creates the Paystack subaccount, then the tenant. Settlement goes straight to the merchant.'
        url={ROUTES.platform.base}
      />

      <Formik
        initialValues={tenantOnboardingInitialValues}
        validationSchema={tenantOnboardingValidationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form className='mt-8 space-y-5'>
            <SlugSync />

            <InputField name='name' label='Store name' required />
            <InputField
              name='slug'
              label='Subdomain'
              required
              hint='Becomes the storefront address. Cannot be changed later.'
            />
            <StorefrontPreview />

            <InputField
              name='ownerEmail'
              label="Owner's email"
              type='email'
              required
              hint='Who will run the store. They sign up with this address.'
            />
            <InputField
              name='contactEmail'
              label='Public contact email'
              type='email'
              hint="Shown on the storefront. Defaults to the owner's email."
            />
            <InputField name='tagline' label='Tagline' />

            <ThemeField />

            <div className='rounded-lg border p-4'>
              <h2 className='text-sm font-medium'>Settlement account</h2>
              <p className='mt-1 text-xs text-gray-600'>
                Verified with Paystack before the store is created. Money from
                every order settles here directly.
              </p>

              <div className='mt-4 space-y-4'>
                <SelectField
                  name='bankCode'
                  label='Bank'
                  required
                  placeholder='Select the bank'
                  options={banks.map((bank) => ({
                    label: bank.name,
                    value: bank.code,
                  }))}
                />
                <InputField
                  name='accountNumber'
                  label='Account number'
                  required
                  placeholder='0123456789'
                />
                <InputField
                  name='platformFeePercent'
                  label='Platform fee (%)'
                  required
                  hint='Taken from each order at settlement.'
                />
              </div>
            </div>

            {serverError ? (
              <p
                role='alert'
                className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'
              >
                {serverError}
              </p>
            ) : null}

            <Button type='submit' isLoading={isSubmitting}>
              {isSubmitting ? 'Creating subaccount…' : 'Onboard store'}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
}
