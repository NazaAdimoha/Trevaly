import type { Metadata } from 'next';

import PricingView from '@/components/pages/marketing/pricing';

import { demoStoreUrl, PRICING } from '@/constant/marketing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `What an online store costs in Nigeria: ${PRICING.buildPrice} once, then ${PRICING.hostingPrice} a month to stay online. No commission on your sales — Paystack settles straight to your own bank account.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'One price for a shop that takes money',
    description: `${PRICING.buildPrice} once, ${PRICING.hostingPrice} a month, and 0% of your sales.`,
    url: '/pricing',
  },
};

export default function PricingPage() {
  return <PricingView demoUrl={demoStoreUrl()} />;
}
