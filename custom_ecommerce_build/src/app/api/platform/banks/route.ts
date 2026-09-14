import { NextResponse } from 'next/server';

import { authorizePlatform, handleApiRoute } from '@/lib/auth-api';
import { listBanks } from '@/lib/payments/paystack';

/**
 * Nigerian banks, for the settlement-account picker.
 *
 * Behind `authorizePlatform()` even though the list is public information: the
 * route spends our Paystack rate limit, and an unauthenticated endpoint that
 * proxies a third party is a free amplifier.
 */
export async function GET() {
  return handleApiRoute(async () => {
    await authorizePlatform();

    const banks = await listBanks();

    return NextResponse.json(
      { banks: banks.map(({ name, code }) => ({ name, code })) },
      // The list changes a few times a year at most.
      { headers: { 'Cache-Control': 'private, max-age=3600' } },
    );
  });
}
