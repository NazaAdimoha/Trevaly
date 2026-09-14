const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
}

type PaystackResponse<T> = { status: boolean; message: string; data: T };

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackResponse<T>> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const body = (await res
    .json()
    .catch(() => null)) as PaystackResponse<T> | null;

  if (!res.ok || !body?.status) {
    throw new PaystackError(
      body?.message ?? `Paystack request failed (${res.status})`,
      res.status,
    );
  }

  return body;
}

export class PaystackError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
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

/**
 * Initialize a transaction server-side.
 *
 * This is what pins the amount. Paystack Inline/Popup takes its amount from the
 * browser, so handing the frontend a public key and a number lets a customer
 * edit what they pay — the charge succeeds, verification then rejects the
 * mismatch, and you are left with real money against an order that will never
 * be fulfilled. Initializing here means the browser only ever receives an
 * opaque `access_code`.
 */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  subaccountCode?: string | null;
  /** Platform cut in kobo, taken via the provider's split at settlement. */
  transactionChargeKobo?: number;
  callbackUrl: string;
  metadata: { tenantId: string; orderId: string; [key: string]: unknown };
}) {
  const { data } = await paystackFetch<{
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

export async function verifyTransaction(
  reference: string,
): Promise<PaystackTransaction> {
  const { data } = await paystackFetch<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return data;
}

/**
 * Created once per tenant at onboarding, against the tenant's own bank account.
 * Settlement goes directly to them; the platform fee is routed automatically by
 * Paystack. No customer or client funds ever pass through a platform account.
 */
export async function createSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  percentageCharge: number; // platform cut, e.g. 1 for 1%
  primaryContactEmail?: string;
}) {
  const { data } = await paystackFetch<{
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

/**
 * Confirm a bank account exists and read back the name on it.
 *
 * Called before `createSubaccount` during onboarding. Paystack will happily
 * create a subaccount against a well-formed but non-existent account number,
 * and the mistake stays invisible until the tenant's first settlement fails —
 * by which point they have taken real orders. Resolving first turns a silent
 * money problem into a form error, and the returned name gives the operator
 * something to eyeball against the business they think they are onboarding.
 */
export async function resolveAccount(params: {
  bankCode: string;
  accountNumber: string;
}) {
  const { data } = await paystackFetch<{
    account_number: string;
    account_name: string;
  }>(
    `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
  );
  return data;
}

/**
 * Nigerian banks, one entry per settlement code.
 *
 * Paystack returns ~277 banks of which a handful repeat a CBN code across two
 * names — usually a microfinance bank listed under both its old and new
 * trading name (`BANKIT MFB` and `BANKIT MICROFINANCE BANK LTD` both being
 * `50572`). Two options sharing a value is meaningless in a picker: whichever
 * the operator clicks submits the same code, and React drops the duplicate
 * anyway. Collapsing them here keeps that quirk out of every consumer.
 *
 * First occurrence wins, preserving Paystack's own ordering.
 */
export async function listBanks() {
  const { data } = await paystackFetch<
    Array<{ name: string; code: string; slug: string }>
  >('/bank?country=nigeria&currency=NGN');

  const byCode = new Map<string, (typeof data)[number]>();
  for (const bank of data) {
    if (!byCode.has(bank.code)) byCode.set(bank.code, bank);
  }
  return [...byCode.values()];
}
