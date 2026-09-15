import { z } from 'zod';

/** A comma-separated list, trimmed, with empty entries dropped. */
const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

/**
 * An optional setting where `KEY=` (present but empty) means unset. Dashboards
 * and `.env` templates routinely leave keys blank; that must not read as a
 * malformed value.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Every setting the API reads, parsed once at boot.
 *
 * The process refuses to start on a bad config (BACKEND_MIGRATION_PLAN, module
 * map). A missing secret discovered at boot is a failed deploy that Render rolls
 * back; the same secret discovered on the first checkout is an outage.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    // The pooled (-pooler) endpoint. Migrations use DIRECT_URL, which the
    // runtime never reads — see prisma.config.ts.
    DATABASE_URL: z.url(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

    REDIS_URL: optional(z.url()),

    CLERK_SECRET_KEY: z.string().startsWith('sk_'),
    CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
    /**
     * Origins a BROWSER-issued session token may come from.
     *
     * Enforced only on tokens that carry an `azp` claim. Clerk's own
     * `authorizedParties` option rejects tokens with no `azp` at all, and
     * tokens that do not come from a browser page — the Expo app's, and ones
     * minted server-side — have none. Setting that option as the migration plan
     * first proposed would lock the mobile app out. See ClerkAuthGuard.
     */
    CLERK_AUTHORIZED_PARTIES: csv,
    /**
     * The instance's PEM public key (Clerk dashboard → API keys → JWT public
     * key). Optional: with it, tokens are verified with no network call; without
     * it, Clerk fetches and caches the JWKS on first use.
     */
    CLERK_JWT_KEY: optional(z.string()),

    ROOT_DOMAIN: z.string().min(1).default('yourbrand.com'),
    CLOUDINARY_CLOUD_NAME: optional(z.string()),
    MOBILE_MINIMUM_VERSION: z.string().min(1).default('1.0.0'),

    CORS_ORIGINS: csv,
    // Load-balancer hops in front of the API. Render terminates TLS at one
    // proxy, so Express should trust exactly one `x-forwarded-for` entry.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  })
  .superRefine((env, ctx) => {
    // An in-memory limiter looks present and does not hold across instances —
    // security audit finding 8. Refuse to run production without the shared
    // store rather than degrade silently.
    if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message:
          'REDIS_URL is required in production (Render Key Value): rate limits must be shared across instances',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parse and cache the environment. Throws with the NAMES of the bad settings
 * only — never their values, which are secrets and end up in deploy logs.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid API configuration:\n${problems}`);
  }

  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test seam: forget the cached env so a test can load a different one. */
export function resetEnvCache(): void {
  cached = undefined;
}
