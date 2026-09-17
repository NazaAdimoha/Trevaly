import { Inject, Injectable } from '@nestjs/common';

import type { StoreOverviewResponse } from '@core/api/contracts';
import { cloudinaryUrl } from '@core/media/folder';

import { tenantOrigin } from '../../common/tenant-origin';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { tenantDb } from '../../database/tenant-db';
import { OrderStatus, type TenantStatus } from '../../generated/prisma/enums';

import { deltaPercent, type Period, windowFor } from './period';

/**
 * The store's headline numbers — web's `getStoreOverview`, one definition of
 * revenue for the dashboard and the app. Revenue counts PAID, SHIPPED and
 * DELIVERED: money that arrived and stayed.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async getStoreOverview(
    tenant: {
      id: string;
      name: string;
      slug: string;
      status: TenantStatus;
      logoPublicId?: string | null;
      customDomain?: string | null;
      customDomainVerified?: boolean;
    },
    period: Period = 'all',
    custom?: { from: Date; to: Date } | null,
  ): Promise<StoreOverviewResponse> {
    const db = tenantDb(this.prisma, tenant.id);
    const { from, to, previousFrom, previousTo } = windowFor(period, new Date(), custom);

    const EARNED = { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED] };
    const inWindow = from ? { gte: from, ...(to ? { lte: to } : {}) } : undefined;
    const inPrevious =
      previousFrom && previousTo ? { gte: previousFrom, lt: previousTo } : undefined;

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
        where: { status: OrderStatus.PAID, ...(inWindow ? { createdAt: inWindow } : {}) },
      }),
      db.order.count({ where: { status: OrderStatus.PENDING } }),
      db.order.aggregate({
        where: { status: EARNED, ...(inWindow ? { createdAt: inWindow } : {}) },
        _sum: { totalKobo: true },
      }),
      // Money has moved and the store must act. Same as the orders list filter.
      db.order.count({
        where: { OR: [{ hasStockIssue: true }, { paidAfterCancellation: true }] },
      }),
      // Distinct people, not orders.
      db.order.groupBy({
        by: ['customerEmail'],
        where: { status: EARNED, ...(inWindow ? { createdAt: inWindow } : {}) },
      }),
      inPrevious
        ? db.order.aggregate({
            where: { status: EARNED, createdAt: inPrevious },
            _sum: { totalKobo: true },
          })
        : Promise.resolve(null),
      inPrevious
        ? db.order.count({ where: { status: OrderStatus.PAID, createdAt: inPrevious } })
        : Promise.resolve(null),
    ]);

    return {
      store: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        logoUrl: cloudinaryUrl(this.env.CLOUDINARY_CLOUD_NAME, tenant.logoPublicId, {
          width: 256,
          height: 256,
          crop: 'fill',
        }),
        storefrontUrl: tenantOrigin(
          {
            slug: tenant.slug,
            customDomain: tenant.customDomain ?? null,
            customDomainVerified: tenant.customDomainVerified ?? false,
          },
          this.env,
        ),
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
}
