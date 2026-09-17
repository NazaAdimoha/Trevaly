import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

import { checkoutSchema, couponPreviewSchema, mergeCartItems } from '@core/validation/checkout';
import { computeDiscountKobo, publicCouponRejection } from '@core/validation/coupon';
import { maskEmail } from '@core/validation/store-settings';
import { hasVariants, variantLabel, variantPriceKobo } from '@core/variants';

import { RateLimitService } from '../../cache/rate-limit.service';
import { ApiException } from '../../common/api-exception';
import { clientIp } from '../../common/client-ip';
import { storefrontOrigin } from '../../common/tenant-origin';
import { parseWith } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { tenantDb } from '../../database/tenant-db';
import { DeliveryMethod, OrderStatus, TenantStatus } from '../../generated/prisma/enums';
import { PaystackService } from '../../integrations/paystack.service';

import { StorefrontLayoutService } from './layout.service';
import { StorefrontService } from './storefront.service';

/**
 * Public storefront endpoints, addressed by store slug.
 *
 * The slug in the path is public input — exactly the exposure a tenant hostname
 * already has — and is validated on every call. It replaces web's
 * `x-tenant-slug` header, which a server had to trust (plan Part 2).
 *
 * The reads replace the Server Components' direct Prisma queries, field for
 * field, so pages render what they rendered before.
 */
@Controller('storefront/:slug')
export class StorefrontController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly layouts: StorefrontLayoutService,
    private readonly rateLimit: RateLimitService,
    private readonly paystack: PaystackService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The store's branding and canonical fields (layout, metadata, JSON-LD). */
  @Get()
  @HttpCode(200)
  tenant(@Param('slug') slug: string) {
    return this.storefront.publicTenant(slug);
  }

  /**
   * How this store is designed: preset, tokens and the sections of each page.
   *
   * Separate from the tenant read because it is the one thing a merchant
   * changes often, and because the storefront asks for it on every page — a
   * shopper who has just been redesigned around should see it immediately, so
   * this is deliberately not cached.
   */
  @Get('layout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async layout(@Param('slug') slug: string) {
    const tenant = await this.storefront.publicTenant(slug);
    return { layout: await this.layouts.published(tenant) };
  }

  /**
   * Categories and up to 60 active products, newest first — home grid, or one
   * category's grid when `?category=` is given.
   */
  @Get('catalog')
  @HttpCode(200)
  async catalog(@Param('slug') slug: string, @Query('category') categorySlug?: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const db = tenantDb(this.prisma, tenant.id);

    const category =
      typeof categorySlug === 'string' && categorySlug
        ? await db.category.findFirst({ where: { slug: categorySlug, isActive: true } })
        : null;
    if (typeof categorySlug === 'string' && categorySlug && !category) {
      throw new ApiException(404, 'Category not found');
    }

    const [categories, products] = await Promise.all([
      db.category.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true },
      }),
      db.product.findMany({
        where: { isActive: true, ...(category ? { categoryId: category.id } : {}) },
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
    ]);

    return { category, categories, products };
  }

  /**
   * Product search within one store.
   *
   * Name, SKU and description, case-insensitive. Deliberately not a full-text
   * index: these catalogues are tens to hundreds of products, `contains` is
   * served fine by Postgres at that size, and a search that needs no extra
   * infrastructure is a search that cannot be down.
   *
   * A term under two characters returns nothing rather than the whole
   * catalogue — "a" matching every product is not a search result.
   */
  @Get('search')
  @HttpCode(200)
  async search(@Param('slug') slug: string, @Query('q') q?: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const query = typeof q === 'string' ? q.trim().slice(0, 80) : '';
    if (query.length < 2) return { query, products: [] };

    const products = await tenantDb(this.prisma, tenant.id).product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });

    return { query, products };
  }

  @Get('products/:productSlug')
  @HttpCode(200)
  async product(@Param('slug') slug: string, @Param('productSlug') productSlug: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const product = await tenantDb(this.prisma, tenant.id).product.findFirst({
      where: { slug: productSlug, isActive: true },
      include: { variants: true },
    });
    if (!product) throw new ApiException(404, 'Product not found');
    return product;
  }

  @Get('delivery-zones')
  @HttpCode(200)
  async deliveryZones(@Param('slug') slug: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const items = await tenantDb(this.prisma, tenant.id).deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { feeKobo: 'asc' }],
      select: { id: true, name: true, feeKobo: true },
    });
    return { items };
  }

  /**
   * Order confirmation. The reference is the credential (a customer who just
   * paid has no account), so the page gets only what it shows — and the email
   * leaves this API already masked, so security audit finding 6 cannot regress
   * over the wire. Scoped: another store's reference does not resolve here.
   */
  @Get('orders/:reference')
  @HttpCode(200)
  async order(@Param('slug') slug: string, @Param('reference') reference: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const order = await tenantDb(this.prisma, tenant.id).order.findFirst({
      where: { paymentReference: reference },
      select: {
        orderNumber: true,
        status: true,
        totalKobo: true,
        customerEmail: true,
        paidAfterCancellation: true,
      },
    });
    if (!order) throw new ApiException(404, 'Order not found');

    const { customerEmail, ...rest } = order;
    return { ...rest, maskedEmail: maskEmail(customerEmail) };
  }

  /** Data for `sitemap.xml`; the web route builds the XML from canonical URLs. */
  @Get('sitemap')
  @HttpCode(200)
  async sitemap(@Param('slug') slug: string) {
    const tenant = await this.storefront.publicTenant(slug);
    const db = tenantDb(this.prisma, tenant.id);
    const [categories, products] = await Promise.all([
      db.category.findMany({
        where: { isActive: true },
        select: { slug: true },
        orderBy: { position: 'asc' },
        take: 200,
      }),
      db.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      }),
    ]);
    return { categories, products };
  }

  /**
   * Shows a shopper what a coupon is worth before paying. Strictly a UX
   * affordance — checkout recomputes everything. Rate limited and uniform in
   * its refusals, because it is an oracle over short, guessable codes.
   */
  @Post('coupons/preview')
  @HttpCode(200)
  async couponPreview(@Param('slug') slug: string, @Req() req: Request, @Body() raw: unknown) {
    await this.rateLimit.enforce(
      `coupon:${slug}:${clientIp(req, this.env)}`,
      { limit: 10, windowSeconds: 60 },
      'Too many attempts. Please wait a moment.',
    );

    const { code, subtotalKobo } = parseWith(couponPreviewSchema, raw, 'Invalid request', {
      withIssues: false,
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) throw new ApiException(404, 'Store not found');

    const coupon = await tenantDb(this.prisma, tenant.id).coupon.findFirst({
      where: { code: code.toUpperCase() },
    });

    const rejection = publicCouponRejection(coupon, subtotalKobo);
    if (rejection || !coupon) {
      // Never distinguish "no such code" from "expired".
      return { valid: false, error: rejection };
    }

    return {
      valid: true,
      code: coupon.code,
      discountKobo: computeDiscountKobo(coupon, subtotalKobo),
    };
  }

  /**
   * Creates a PENDING order with a server-computed total, then initializes the
   * payment server-side. The client sends ids and quantities; it never says
   * what anything costs and never sees a mutable amount.
   */
  @Post('checkout')
  @HttpCode(200)
  async checkout(@Param('slug') slug: string, @Req() req: Request, @Body() raw: unknown) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new ApiException(404, 'Store not found');
    }
    if (!tenant.paystackSubaccountCode) {
      throw new ApiException(503, 'This store is not yet set up to receive payments');
    }

    // Every attempt writes an Order and hits Paystack.
    await this.rateLimit.enforce(
      `checkout:${slug}:${clientIp(req, this.env)}`,
      { limit: 8, windowSeconds: 60 },
      'Too many checkout attempts. Please wait a moment.',
    );

    const body = parseWith(checkoutSchema, raw, 'Invalid checkout details');
    const db = tenantDb(this.prisma, tenant.id);

    // ── Re-price every line from the database ──────────────────────────────
    const items = mergeCartItems(body.items);
    const products = await db.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, isActive: true },
      include: { variants: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    let subtotalKobo = 0;
    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      productName: string;
      variantLabel: string | null;
      unitPriceKobo: number;
    }> = [];

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) throw new ApiException(409, 'One or more items are no longer available');

      const sellsByVariant = hasVariants(product);
      // A mismatch in either direction is a stale cart or a probe.
      if (sellsByVariant && !item.variantId) {
        throw new ApiException(400, `Choose a ${product.optionName ?? 'option'} for ${product.name}`);
      }
      if (!sellsByVariant && item.variantId) {
        throw new ApiException(409, 'One or more items are no longer available');
      }

      // `product.variants` came from a tenant-scoped query for this product, so
      // finding the id in it proves ownership on both axes.
      const variant = item.variantId
        ? (product.variants.find((v) => v.id === item.variantId && v.isActive) ?? null)
        : null;
      if (item.variantId && !variant) {
        throw new ApiException(409, 'One or more items are no longer available');
      }

      const stock = variant ? variant.stock : product.stock;
      const unitPriceKobo = variantPriceKobo(product, variant);
      const label = variant ? variantLabel(product.optionName, variant.value) : null;

      if (stock < item.quantity) {
        throw new ApiException(
          409,
          `${product.name}${label ? ` (${label})` : ''} does not have enough stock`,
        );
      }

      subtotalKobo += unitPriceKobo * item.quantity;
      orderItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity: item.quantity,
        productName: product.name,
        variantLabel: label,
        unitPriceKobo,
      });
    }

    // ── Delivery ───────────────────────────────────────────────────────────
    let deliveryFeeKobo = 0;
    if (body.deliveryMethod === DeliveryMethod.ZONE_DELIVERY) {
      const zone = await db.deliveryZone.findFirst({
        where: { id: body.deliveryZoneId, isActive: true },
      });
      if (!zone) throw new ApiException(400, 'Invalid delivery zone');
      deliveryFeeKobo = zone.feeKobo;
    }

    // ── Coupon ─────────────────────────────────────────────────────────────
    // Same helpers as the preview, so quoted and charged discounts agree, and
    // the same uniform refusal, so checkout is not the oracle preview avoids.
    let discountKobo = 0;
    let couponId: string | null = null;
    if (body.couponCode) {
      const coupon = await db.coupon.findFirst({ where: { code: body.couponCode.toUpperCase() } });
      const rejection = publicCouponRejection(coupon, subtotalKobo);
      if (rejection || !coupon) throw new ApiException(400, rejection);
      discountKobo = computeDiscountKobo(coupon, subtotalKobo);
      couponId = coupon.id;
    }

    const totalKobo = subtotalKobo - discountKobo + deliveryFeeKobo;
    if (totalKobo <= 0) throw new ApiException(400, 'Invalid order total');

    // ── Persist ────────────────────────────────────────────────────────────
    const paymentReference = `ord_${tenant.slug}_${randomUUID()}`;

    // The rate that applied when the order was placed, snapshotted.
    const platformFeePercent = Number(tenant.platformFeePercent);
    const platformFeeKobo = Math.round((totalKobo * platformFeePercent) / 100);

    const order = await this.prisma.$transaction(async (tx) => {
      // Gap-free per-tenant order number under concurrency.
      const { orderSequence } = await tx.tenant.update({
        where: { id: tenant.id },
        data: { orderSequence: { increment: 1 } },
        select: { orderSequence: true },
      });

      return tx.order.create({
        data: {
          tenantId: tenant.id,
          orderNumber: orderSequence,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          deliveryMethod: body.deliveryMethod,
          deliveryZoneId: body.deliveryZoneId ?? null,
          deliveryAddress: body.deliveryAddress ?? null,
          deliveryFeeKobo,
          couponId,
          discountKobo,
          subtotalKobo,
          totalKobo,
          paymentReference,
          platformFeeKobo,
          platformFeePercent: tenant.platformFeePercent,
          items: { create: orderItems },
        },
      });
    });

    // ── Initialize payment (amount pinned server-side) ─────────────────────
    const origin = storefrontOrigin(
      req.header('x-forwarded-host'),
      req.header('x-forwarded-proto'),
      tenant,
      this.env,
    );

    try {
      const transaction = await this.paystack.initializeTransaction({
        email: body.customerEmail,
        amountKobo: totalKobo,
        reference: paymentReference,
        subaccountCode: tenant.paystackSubaccountCode,
        transactionChargeKobo: platformFeeKobo > 0 ? platformFeeKobo : undefined,
        callbackUrl: `${origin}/order/${paymentReference}`,
        // Lets the webhook attribute an event to a tenant without a lookup.
        metadata: { tenantId: tenant.id, orderId: order.id },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reference: paymentReference,
        accessCode: transaction.access_code,
        authorizationUrl: transaction.authorization_url,
      };
    } catch {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, internalNote: 'Payment initialization failed' },
      });
      throw new ApiException(502, 'Could not start payment. Please try again.');
    }
  }
}
