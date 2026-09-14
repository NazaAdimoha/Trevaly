import type { Metadata } from 'next';

import CartView from '@/components/pages/storefront/cart';

export const metadata: Metadata = { title: 'Cart' };

export default function CartPage() {
  return <CartView />;
}
