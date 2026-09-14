import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TenantProvider } from '@/lib/tenant-context';

// app/_sites/[tenant]/layout.tsx
// Every storefront page renders through here. The tenant record (branding,
// id) is resolved once per request from the URL segment the middleware
// rewrote into — not from a header alone — so a page can never render with
// the wrong tenant's data even if middleware is ever bypassed in some path.
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenant },
  });

  if (!tenant) {
    notFound();
  }

  return <TenantProvider tenant={tenant}>{children}</TenantProvider>;
}
