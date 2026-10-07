/**
 * The domain this product is addressed from.
 *
 * It decides every storefront URL (`{slug}.{ROOT_DOMAIN}`), the marketing site,
 * the canonical in every page's head, `metadataBase`, robots and the sitemap.
 *
 * It lived as `process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com'` in six
 * separate files. Two problems with that: the fallback is a domain nobody here
 * owns, and the API reads a DIFFERENT variable (`ROOT_DOMAIN`) — so setting one
 * and forgetting the other produced a deploy where the backend was correct and
 * every link the browser rendered was not. One module, one default, one place
 * to notice.
 */
const PLACEHOLDER = 'yourbrand.com';

/**
 * Either name resolves it.
 *
 * `NEXT_PUBLIC_ROOT_DOMAIN` is the one the browser can read and therefore the
 * one pages and metadata need; `ROOT_DOMAIN` is what the proxy and the API are
 * configured with. Accepting both means a deploy that sets only one is still
 * internally consistent, rather than correct on the server and wrong in every
 * rendered link — which is exactly how this went wrong before.
 */
const configured = (
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? process.env.ROOT_DOMAIN
)?.trim();

/**
 * Refused on a real production deploy, allowed everywhere else.
 *
 * Keyed on `VERCEL_ENV`, not `NODE_ENV`: `next build` runs with
 * `NODE_ENV=production` on a laptop too, and failing a local build because a
 * developer has not bought a domain yet would be obstruction rather than a
 * guard. A preview deploy is also left alone — it is not where customers are.
 */
if (process.env.VERCEL_ENV === 'production' && (!configured || configured === PLACEHOLDER)) {
  throw new Error(
    'NEXT_PUBLIC_ROOT_DOMAIN is unset or still the placeholder. Every storefront URL, canonical and sitemap entry would point at a domain you do not own.',
  );
}

export const ROOT_DOMAIN = configured || PLACEHOLDER;

/** True while the app is still addressing itself from the stand-in domain. */
export const isPlaceholderDomain = ROOT_DOMAIN === PLACEHOLDER;
