import { config } from 'dotenv';
import { Client } from 'pg';

/**
 * Grant a Clerk account platform-operator rights.
 *
 * Bootstrapping problem: `requirePlatformAdmin()` reads `PlatformUser`, but
 * nothing in the app can write that table — by design, since a self-serve route
 * to "make me an admin of everything" is the one endpoint worth never having.
 * The first operator therefore has to be created out of band.
 *
 *   pnpm grant:admin you@example.com              # looks the id up via Clerk
 *   pnpm grant:admin user_2abc123 you@example.com # or pass it directly
 *
 * The lookup needs `CLERK_SECRET_KEY`. Without it, pass the id yourself — it is
 * on the user's page in the Clerk dashboard, or `window.Clerk.user.id` in the
 * browser console while signed in.
 */

config({ path: '.env', quiet: true });

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Usage: pnpm grant:admin <email> [SUPER_ADMIN|SUPPORT]\n' +
      '       pnpm grant:admin <clerkUserId> <email> [SUPER_ADMIN|SUPPORT]',
  );
  process.exit(1);
}

const looksLikeClerkId = (value: string) => value.startsWith('user_');

/** Resolve a Clerk user id from an email via Clerk's Backend API. */
async function findClerkUserId(email: string): Promise<string> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'CLERK_SECRET_KEY is not set, so the email cannot be looked up.\n' +
        '  Pass the id directly: pnpm grant:admin <clerkUserId> <email>',
    );
  }

  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );

  if (!res.ok) {
    throw new Error(`Clerk lookup failed (${res.status}): ${await res.text()}`);
  }

  const users = (await res.json()) as Array<{ id: string }>;
  if (users.length === 0) {
    throw new Error(
      `No Clerk user with the email ${email}. Sign up first, then re-run this.`,
    );
  }
  if (users.length > 1) {
    throw new Error(
      `${users.length} Clerk users share that email — pass the id explicitly.`,
    );
  }

  return users[0].id;
}

async function main() {
  let clerkUserId: string;
  let email: string;
  let role: string;

  if (looksLikeClerkId(args[0])) {
    [clerkUserId, email, role = 'SUPER_ADMIN'] = args as [
      string,
      string,
      string?,
    ];
    if (!email) throw new Error('An email is required alongside the id.');
  } else {
    [email, role = 'SUPER_ADMIN'] = args as [string, string?];
    clerkUserId = await findClerkUserId(email);
    console.log(`· resolved ${email} → ${clerkUserId}`);
  }

  if (!['SUPER_ADMIN', 'SUPPORT'].includes(role)) {
    throw new Error(`Unknown role "${role}". Use SUPER_ADMIN or SUPPORT.`);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query(
      `INSERT INTO "PlatformUser" (id, "clerkUserId", email, role)
       VALUES (gen_random_uuid()::text, $1, $2, $3::"PlatformRole")
       ON CONFLICT ("clerkUserId")
       DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role
       RETURNING "clerkUserId", email, role`,
      [clerkUserId, email, role],
    );

    console.log(`✓ ${rows[0].email} is now ${rows[0].role}`);
    console.log('  Open /dashboard/platform to onboard tenants.');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
