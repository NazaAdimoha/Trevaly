import 'dotenv/config';

/**
 * Verifies the Paystack credentials in .env without printing them.
 *
 * Run after adding your keys:  pnpm check:paystack
 *
 * Checks, in order:
 *  1. secret key is present and authenticates
 *  2. it is a TEST key (a live key here means real money in development)
 *  3. public key is present and matches the same mode
 *  4. the bank list is reachable — needed by tenant onboarding
 */
async function main() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  if (!secret) {
    console.error('✗ PAYSTACK_SECRET_KEY is not set in .env');
    process.exit(1);
  }

  const mode = secret.startsWith('sk_live_')
    ? 'LIVE'
    : secret.startsWith('sk_test_')
      ? 'TEST'
      : 'UNKNOWN';

  if (mode === 'UNKNOWN') {
    console.error('✗ PAYSTACK_SECRET_KEY does not look like a Paystack key');
    process.exit(1);
  }

  const res = await fetch(
    'https://api.paystack.co/bank?country=nigeria&currency=NGN',
    {
      headers: { Authorization: `Bearer ${secret}` },
    },
  );

  if (res.status === 401) {
    console.error(
      '✗ Paystack rejected the secret key (401). Check it was copied in full.',
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`✗ Paystack returned ${res.status}`);
    process.exit(1);
  }

  const body = (await res.json()) as { data: unknown[] };

  console.log(`✓ Secret key authenticates (${mode} mode)`);
  console.log(
    `✓ Bank list reachable — ${body.data.length} Nigerian banks available`,
  );

  if (mode === 'LIVE') {
    console.warn(
      '⚠ This is a LIVE key. Use sk_test_… until you are ready to take real payments.',
    );
  }

  if (!publicKey) {
    console.warn(
      '⚠ NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set (needed by the checkout popup)',
    );
  } else if (!publicKey.startsWith(mode === 'LIVE' ? 'pk_live_' : 'pk_test_')) {
    console.error(
      '✗ Public key mode does not match the secret key — payments will fail',
    );
    process.exit(1);
  } else {
    console.log('✓ Public key present and mode matches');
  }
}

main().catch((err) => {
  console.error(
    '✗ Could not reach Paystack:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
