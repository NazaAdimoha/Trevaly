import type { StoreOverviewResponse } from '@core/api/contracts';
import { cloudinaryUrl } from '@core/media/folder';

import { tenantOrigin } from '@/lib/domains/canonical';
import { deltaPercent, type Period, windowFor } from '@/lib/stores/period';
import { tenantDb } from '@/lib/tenant-db';

import { OrderStatus, type TenantStatus } from '@/generated/prisma/enums';

/**
 * The store's headline numbers, computed once for every caller.
 *
 * Both the dashboard home (a Server Component) and `GET /overview` (which the
 * mobile app calls) go through here. The page deliberately calls this function
 * rather than its own HTTP endpoint: an RSC fetching its own API pays a round
 * trip and has to re-establish auth it already has. What matters for
 * consolidation is one *definition* of "revenue", not one transport.
 *
 * Revenue counts PAID, SHIPPED and DELIVERED — money that arrived and stayed.
 * Change that here and both surfaces move together.
 */
export async function getStoreOverview(tenant: {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  logoPublicId?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
}, period: Period = 'all',
  custom?: { from: Date; to: Date } | null,
): Promise<StoreOverviewResponse> {
  const db = tenantDb(tenant.id);
  const { from, to, previousFrom, previousTo } = windowFor(period, new Date(), custom);

  // Revenue counts money that arrived and stayed, in every window.
  const EARNED = {
    in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
  };
  const inWindow = from ? { gte: from, ...(to ? { lte: to } : {}) } : undefined;
  const inPrevious =
    previousFrom && previousTo
      ? { gte: previousFrom, lt: previousTo }
      : undefined;

  // tenantId is injected by the wrapper — deliberately absent here.
  const [
    productCount,
    activeProducts,
    paidOrders,
    pendingOrders,
    revenue,
    needsAttention,
    customerEmails,
    previousRevenue,
    previousPaidOrders,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.order.count({
      where: {
        status: OrderStatus.PAID,
        ...(inWindow ? { createdAt: inWindow } : {}),
      },
    }),
    db.order.count({ where: { status: OrderStatus.PENDING } }),
    db.order.aggregate({
      where: { status: EARNED, ...(inWindow ? { createdAt: inWindow } : {}) },
      _sum: { totalKobo: true },
    }),
    // Money has moved and the store must act: paid but unstockable, or paid
    // after the order was cancelled. Same definition as the orders list filter.
    db.order.count({
      where: { OR: [{ hasStockIssue: true }, { paidAfterCancellation: true }] },
    }),

    // Distinct emails rather than a Customer table, which does not exist yet.
    // `groupBy` so the count is of PEOPLE, not orders — a regular who ordered
    // four times this week is one customer.
    db.order.groupBy({
      by: ['customerEmail'],
      where: { status: EARNED, ...(inWindow ? { createdAt: inWindow } : {}) },
    }),

    // The comparison window. Skipped entirely for `all`, which has none.
    inPrevious
      ? db.order.aggregate({
          where: { status: EARNED, createdAt: inPrevious },
          _sum: { totalKobo: true },
        })
      : Promise.resolve(null),
    inPrevious
      ? db.order.count({
          where: { status: OrderStatus.PAID, createdAt: inPrevious },
        })
      : Promise.resolve(null),
  ]);

  return {
    store: {
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      logoUrl: cloudinaryUrl(
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        tenant.logoPublicId,
        { width: 256, height: 256, crop: 'fill' },
      ),
      storefrontUrl: tenantOrigin({
        slug: tenant.slug,
        customDomain: tenant.customDomain ?? null,
        customDomainVerified: tenant.customDomainVerified ?? false,
      }),
    },
    stats: {
      productCount,
      activeProducts,
      paidOrders,
      pendingOrders,
      revenueKobo: revenue._sum.totalKobo ?? 0,
      needsAttention,
      newCustomers: customerEmails.length,
    },
    period,
    range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    deltas: inPrevious
      ? {
          revenuePercent: deltaPercent(
            revenue._sum.totalKobo ?? 0,
            previousRevenue?._sum.totalKobo ?? 0,
          ),
          paidOrdersPercent: deltaPercent(paidOrders, previousPaidOrders ?? 0),
        }
      : null,
  };
}
