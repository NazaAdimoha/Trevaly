import { NextResponse } from 'next/server';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { getStoreOverview } from '@/lib/stores/overview';
import { parsePeriod, parseRange } from '@/lib/stores/period';

type RouteContext = { params: Promise<{ storeSlug: string }> };

/**
 * The numbers a merchant sees first, for the app's Today screen.
 *
 * The query set lives in `@/lib/stores/overview` and is shared with the
 * dashboard home, which previously computed it inline in its page component
 * and so left nothing for a mobile client to call.
 */
export async function GET(req: Request, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    // Unrecognised values fall back to a default rather than erroring: a query
    // string is not worth a 400 when a sane window exists.
    const query = new URL(req.url).searchParams;
    const period = parsePeriod(query.get('period'));
    const custom = parseRange(query.get('from'), query.get('to'));

    return NextResponse.json(await getStoreOverview(tenant, period, custom));
  });
}
