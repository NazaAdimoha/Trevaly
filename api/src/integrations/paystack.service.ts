import { Inject, Injectable } from '@nestjs/common';

import { ENV, type Env } from '../config/config.module';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

type PaystackResponse<T> = { status: boolean; message: string; data: T };

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PaystackError';
  }
}

export type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number; // kobo
  currency: string;
  paid_at: string | null;
  metadata?: Record<string, unknown> | null;
  subaccount?: { subaccount_code?: string } | null;
};

/** Ported from web's `lib/payments/paystack.ts`; behaviour unchanged. */
@Injectable()
export class PaystackService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private async request<T>(path: string, init?: RequestInit): Promise<PaystackResponse<T>> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      // A hung gateway must fail the request, not hold it until the platform's
      // own timeout. Web relied on Vercel's function limit for this.
      signal: AbortSignal.timeout(20_000),
    });

    const body = (await res.json().catch(() => null)) as PaystackResponse<T> | null;
    if (!res.ok || !body?.status) {
      throw new PaystackError(
        body?.message ?? `Paystack request failed (${res.status})`,
        res.status,
      );
    }
    return body;
  }

  /**
   * Initialize a transaction server-side. This is what pins the amount: the
   * browser only ever receives an opaque `access_code`.
   */
  async initializeTransaction(params: {
    email: string;
    amountKobo: number;
    reference: string;
    subaccountCode?: string | null;
    /** Platform cut in kobo, taken via the provider's split at settlement. */
    transactionChargeKobo?: number;
    callbackUrl: string;
    metadata: { tenantId: string; orderId: string; [key: string]: unknown };
  }) {
    const { data } = await this.request<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
        ...(params.subaccountCode
          ? {
              subaccount: params.subaccountCode,
              // The tenant bears Paystack's own transaction fee.
              bearer: 'subaccount',
              ...(params.transactionChargeKobo
                ? { transaction_charge: params.transactionChargeKobo }
                : {}),
            }
          : {}),
      }),
    });
    return data;
  }

  async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    const { data } = await this.request<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return data;
  }

  /** One per tenant, against the tenant's own bank account. */
  async createSubaccount(params: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge: number;
    primaryContactEmail?: string;
  }) {
    const { data } = await this.request<{
      subaccount_code: string;
      account_number: string;
      settlement_bank: string;
    }>('/subaccount', {
      method: 'POST',
      body: JSON.stringify({
        business_name: params.businessName,
        bank_code: params.bankCode,
        account_number: params.accountNumber,
        percentage_charge: params.percentageCharge,
        primary_contact_email: params.primaryContactEmail,
      }),
    });
    return data;
  }

  /** Confirm a bank account exists and read back the name on it. */
  async resolveAccount(params: { bankCode: string; accountNumber: string }) {
    const { data } = await this.request<{ account_number: string; account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
    );
    return data;
  }

  /** Nigerian banks, one entry per settlement code (first occurrence wins). */
  async listBanks() {
    const { data } = await this.request<Array<{ name: string; code: string; slug: string }>>(
      '/bank?country=nigeria&currency=NGN',
    );
    const byCode = new Map<string, (typeof data)[number]>();
    for (const bank of data) {
      if (!byCode.has(bank.code)) byCode.set(bank.code, bank);
    }
    return [...byCode.values()];
  }
}
