import type { Metadata } from 'next';

import MarketingHomeView from '@/components/pages/marketing/home';

import { BRAND, demoStoreUrl } from '@/constant/marketing';

export const metadata: Metadata = {
  title: 'Online stores for Nigerian businesses',
  description:
    'Take orders and get paid on your own online store. Cart, card and transfer checkout, delivery fees by area and coupon codes — with Paystack settling every sale straight to your bank account.',
  alternates: { canonical: '/' },
  openGraph: {
    title: `Take the order. Get paid. Straight to your bank. | ${BRAND.name}`,
    description:
      'A real online store for Nigerian sellers — cart, checkout, delivery zones and coupons. Paystack settles every sale directly to your own bank account.',
    url: '/',
  },
};

export default function HomePage() {
  return <MarketingHomeView demoUrl={demoStoreUrl()} />;
}
