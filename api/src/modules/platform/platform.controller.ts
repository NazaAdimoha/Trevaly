import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query } from '@nestjs/common';

import { webhookEventsQuerySchema } from '@core/validation/platform';
import { type TenantOnboardingPayload, tenantOnboardingSchema } from '@core/validation/tenant';

import { PlatformAdmin } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { tenantOrigin } from '../../common/tenant-origin';
import { ZodPipe } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { TenantStatus, WebhookStatus } from '../../generated/prisma/enums';
import { PaystackError, PaystackService } from '../../integrations/paystack.service';

/** Platform operator endpoints. Every route: SUPER_ADMIN only. */
@Controller('platform')
@PlatformAdmin()
export class PlatformController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Nigerian banks for the settlement picker. Behind platform auth although
   * public: it spends our Paystack rate limit.
   */
  @Get('banks')
  @HttpCode(200)
  @Header('Cache-Control', 'private, max-age=3600')
  async banks() {
    const banks = await this.paystack.listBanks();
    return { banks: banks.map(({ name, code }) => ({ name, code })) };
  }

  /** Every tenant on the platform, newest first. */
  @Get('tenants')
  @HttpCode(200)
  async tenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        customDomain: true,
        customDomainVerified: true,
        paystackSubaccountCode: true,
        platformFeePercent: true,
        createdAt: true,
        _count: { select: { products: true, orders: true } },
      },
    });

    return {
      tenants: tenants.map(({ customDomainVerified, ...tenant }) => ({
        ...tenant,
        storefrontUrl: tenantOrigin(
          { slug: tenant.slug, customDomain: tenant.customDomain, customDomainVerified },
          this.env,
        ),
      })),
    };
  }

  /**
   * Onboard a tenant. Bank account resolved, subaccount created at Paystack,
   * and only then the Tenant row — so a Paystack failure leaves no half-made
   * store that 503s at checkout.
   */
  @Post('tenants')
  @HttpCode(201)
  async onboard(
    @Body(new ZodPipe(tenantOnboardingSchema, 'Invalid tenant details'))
    body: TenantOnboardingPayload,
  ) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ApiException(409, `The subdomain "${body.slug}" is already taken`);
    }

    let accountName: string | null = null;
    let subaccountCode: string;

    try {
      // A typo-catcher, not a gate: a 429 from Paystack says nothing about
      // whether the account exists.
      try {
        const account = await this.paystack.resolveAccount({
          bankCode: body.bankCode,
          accountNumber: body.accountNumber,
        });
        accountName = account.account_name;
      } catch (err) {
        if (!(err instanceof PaystackError) || err.statusCode !== 429) throw err;
      }

      const subaccount = await this.paystack.createSubaccount({
        businessName: body.name,
        bankCode: body.bankCode,
        accountNumber: body.accountNumber,
        percentageCharge: body.platformFeePercent,
        primaryContactEmail: body.contactEmail || body.ownerEmail,
      });
      subaccountCode = subaccount.subaccount_code;
    } catch (err) {
      if (err instanceof PaystackError) {
        // Paystack's wording is what the operator can act on.
        throw new ApiException(422, err.message);
      }
      throw err;
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: body.name,
        slug: body.slug,
        status: TenantStatus.ACTIVE,
        contactEmail: body.contactEmail || body.ownerEmail,
        tagline: body.tagline || null,
        theme: body.theme,
        paystackSubaccountCode: subaccountCode,
        platformFeePercent: body.platformFeePercent,
      },
      select: { id: true, name: true, slug: true, status: true, theme: true },
    });

    return { tenant, accountName };
  }

  /**
   * Webhook deliveries, newest first — the dead-letter queue's read side. The
   * raw payload is never returned: it carries the shopper's details.
   */
  @Get('webhook-events')
  @HttpCode(200)
  async webhookEvents(
    @Query(new ZodPipe(webhookEventsQuerySchema, 'Invalid query'))
    query: { status?: WebhookStatus; page: number; pageSize: number },
  ) {
    const { status, page, pageSize } = query;
    const where = status ? { status } : {};

    const [items, total, byStatus] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          provider: true,
          eventType: true,
          reference: true,
          tenantId: true,
          status: true,
          error: true,
          attempts: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      this.prisma.webhookEvent.count({ where }),
      this.prisma.webhookEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts = Object.fromEntries(
      Object.values(WebhookStatus).map((s) => [
        s,
        byStatus.find((row) => row.status === s)?._count._all ?? 0,
      ]),
    ) as Record<WebhookStatus, number>;

    return { items, total, page, pageSize, counts };
  }
}
