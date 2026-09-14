import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Node runtime (not Edge) so it can talk to Prisma directly. Middleware
// calls this with the incoming hostname and caches the response for 5
// minutes, so this only actually hits the DB on a cache miss.
export async function GET(req: NextRequest) {
  const hostname = req.headers.get('x-lookup-host');
  if (!hostname) {
    return NextResponse.json({ slug: null }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { customDomain: hostname },
    select: { slug: true },
  });

  return NextResponse.json(
    { slug: tenant?.slug ?? null },
    {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    },
  );
}
