import { type NextRequest, NextResponse } from 'next/server';

import { expireStaleOrders } from '@/lib/payments/webhook-events';

/**
 * Cancel PENDING orders nobody ever paid for.
 *
 * Runs on a schedule (Vercel Cron: see `vercel.json`). Deliberately a route
 * rather than something lazy on a read path — a GET that silently cancels
 * orders as a side effect is the kind of behaviour nobody expects and nobody
 * can debug.
 *
 * AUTH: `CRON_SECRET` as a bearer token. This endpoint mutates orders across
 * every tenant, so it must not be callable by anyone who guesses the URL.
 * Vercel sends this header automatically for configured cron jobs. If the
 * secret is unset the route refuses outright rather than defaulting to open —
 * an unauthenticated mass-cancel endpoint is worse than a cron job that does
 * not run.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cancelled } = await expireStaleOrders();
  return NextResponse.json({ cancelled });
}
