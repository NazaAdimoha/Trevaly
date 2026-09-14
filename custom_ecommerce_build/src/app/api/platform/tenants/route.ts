import { type NextRequest, NextResponse } from 'next/server';

import { authorizePlatform, handleApiRoute } from '@/lib/auth-api';
import { tenantOrigin } from '@/lib/domains/canonical';
import {
  createSubaccount,
  PaystackError,
  resolveAccount,
} from '@/lib/payments/paystack';
// eslint-disable-next-line no-restricted-imports -- platform-scoped: this route operates across all tenants by definition, so there is no tenant to scope by
import { prisma } from '@/lib/prisma';
import { tenantOnboardingSchema } from '@/lib/validation/tenant';

import { TenantStatus } from '@/generated/prisma/client';

/** Every tenant on the platform, newest first. */
export async function GET() {
  return handleApiRoute(async () => {
    await authorizePlatform();

    const tenants = await prisma.tenant.findMany({
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

    return NextResponse.json({
      tenants: tenants.map(
        ({ customDomainVerified, ...tenant }) => ({
          ...tenant,
          // Resolved here, not in the browser: the list used to print
          // `${slug}.yourbrand.com` — a hardcoded placeholder root domain — which
          // is wrong on every real deployment.
          storefrontUrl: tenantOrigin({
            slug: tenant.slug,
            customDomain: tenant.customDomain,
            customDomainVerified,
          }),
        }),
      ),
    });
  });
}

/**
 * Onboard a tenant.
 *
 * Ordering matters and is deliberate: the bank account is resolved, then the
 * subaccount is created at Paystack, and only then is anything written to our
 * database. Creating the Tenant row first would leave a store that exists,
 * resolves at its subdomain, and returns 503 at checkout whenever the Paystack
 * call fails — visible to shoppers, invisible to us. Doing it this way, a
 * failure means no tenant was created at all and the operator simply retries.
 */
export async function POST(req: NextRequest) {
  return handleApiRoute(async () => {
    await authorizePlatform();

    const parsed = tenantOnboardingSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid tenant details', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const existing = await prisma.tenant.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `The subdomain "${body.slug}" is already taken` },
        { status: 409 },
      );
    }

    let accountName: string | null = null;
    let subaccountCode: string;

    try {
      // Verification is a typo-catcher, not a gate. Paystack rate-limits this
      // endpoint (test mode allows only three live resolves a day), and a 429
      // says nothing about whether the account is real — refusing to onboard on
      // one would block a legitimate merchant over an unrelated quota. Any
      // other failure is a genuine "this account does not exist" and still stops
      // the flow before a subaccount is created against it.
      try {
        const account = await resolveAccount({
          bankCode: body.bankCode,
          accountNumber: body.accountNumber,
        });
        accountName = account.account_name;
      } catch (err) {
        if (!(err instanceof PaystackError) || err.statusCode !== 429)
          throw err;
      }

      const subaccount = await createSubaccount({
        businessName: body.name,
        bankCode: body.bankCode,
        accountNumber: body.accountNumber,
        percentageCharge: body.platformFeePercent,
        primaryContactEmail: body.contactEmail || body.ownerEmail,
      });
      subaccountCode = subaccount.subaccount_code;
    } catch (err) {
      if (err instanceof PaystackError) {
        // The operator can act on Paystack's wording ("Could not resolve
        // account name") far better than on anything we would invent.
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug: body.slug,
        // Settlement is wired up, so the store can take money immediately.
        status: TenantStatus.ACTIVE,
        contactEmail: body.contactEmail || body.ownerEmail,
        tagline: body.tagline || null,
        theme: body.theme,
        paystackSubaccountCode: subaccountCode,
        platformFeePercent: body.platformFeePercent,
      },
      select: { id: true, name: true, slug: true, status: true, theme: true },
    });

    return NextResponse.json({ tenant, accountName }, { status: 201 });
  });
}
