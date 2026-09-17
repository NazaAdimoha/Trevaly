import { config } from 'dotenv';
import { Client } from 'pg';

/**
 * Link a Clerk account to a store as OWNER or STAFF.
 *
 *   pnpm grant:store owner@example.com adaobi-store
 *   pnpm grant:store staff@example.com adaobi-store STAFF
 *
 * This exists because onboarding creates the Tenant but not the membership:
 * `ownerEmail` is collected and stored as `contactEmail`, and nothing turns it
 * into a `TenantUser`. A merchant can therefore have a live storefront taking
 * real money and still get a 404 on their own dashboard.
 *
 * The proper fix is an invite flow — a `TenantUser` created at onboarding with
 * `invitedAt` set and no Clerk id yet, resolved when they accept. That needs
 * `clerkUserId` to be nullable. Until then, this closes the loop by hand.
 */

config({ path: '.env', quiet: true });

const [email, storeSlug, role = 'OWNER'] = process.argv.slice(2);

if (!email || !storeSlug) {
  console.error('Usage: pnpm grant:store <email> <storeSlug> [OWNER|STAFF]');
  process.exit(1);
}

async function findClerkUserId(address: string): Promise<string> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY is not set.');

  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(address)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  if (!res.ok) {
    throw new Error(`Clerk lookup failed (${res.status}): ${await res.text()}`);
  }

  const users = (await res.json()) as Array<{ id: string }>;
  if (users.length === 0) {
    throw new Error(
      `No Clerk user with the email ${address}. They must sign up first.`,
    );
  }
  if (users.length > 1) {
    throw new Error(`${users.length} Clerk users share that email.`);
  }
  return users[0].id;
}

async function main() {
  if (!['OWNER', 'STAFF'].includes(role)) {
    throw new Error(`Unknown role "${role}". Use OWNER or STAFF.`);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const tenant = await client.query(
      `SELECT id, name FROM "Tenant" WHERE slug = $1`,
      [storeSlug],
    );
    if (tenant.rowCount === 0) {
      throw new Error(`No store with the slug "${storeSlug}".`);
    }

    const clerkUserId = await findClerkUserId(email);
    console.log(`· resolved ${email} → ${clerkUserId}`);

    const { rows } = await client.query(
      `INSERT INTO "TenantUser" (id, "tenantId", "clerkUserId", email, role, "acceptedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"TenantRole", now())
       ON CONFLICT ("tenantId", "clerkUserId")
       DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email
       RETURNING email, role`,
      [tenant.rows[0].id, clerkUserId, email, role],
    );

    console.log(
      `✓ ${rows[0].email} is now ${rows[0].role} of ${tenant.rows[0].name}`,
    );
    console.log(`  Open /dashboard/stores/${storeSlug}`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
