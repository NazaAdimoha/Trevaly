/** @type {import('next').NextConfig} */
const path = require('path');

/**
 * The shared core lives OUTSIDE this app, at ../packages/core, so the Expo app
 * can consume the same source. Turbopack scopes module resolution to the
 * project root by default and will not follow a tsconfig path above it — the
 * import fails at runtime with "Module not found" even though `tsc` resolves it
 * happily. Pointing `turbopack.root` at the repository root is what widens that
 * boundary; `outputFileTracingRoot` does the same for the server build's file
 * tracing.
 */
const repoRoot = path.join(__dirname, '..');

const nextConfig = {
  reactStrictMode: true,

  turbopack: {
    root: repoRoot,
  },
  outputFileTracingRoot: repoRoot,

  // Dev only. Storefronts are served from tenant subdomains, so in development
  // every `_next` asset request is cross-origin relative to localhost and the
  // dev server rejects it with a 403 — which leaves the page rendered but never
  // hydrated, so client components look broken for no visible reason.
  allowedDevOrigins: [
    process.env.ROOT_DOMAIN ?? 'yourbrand.com',
    `*.${process.env.ROOT_DOMAIN ?? 'yourbrand.com'}`,
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },

  // Storefronts are public and cacheable; the tenant admin never is.
  async headers() {
    /**
     * Applied everywhere. None of these were set before, on a storefront that
     * takes card payments.
     *
     * `nosniff` matters more than usual here: merchants upload files that we
     * serve from a CDN, and without it a browser may sniff one into script.
     *
     * `Referrer-Policy` is not housekeeping either — an order confirmation URL
     * contains the payment reference, which IS the credential for that page,
     * and a full `Referer` header hands it to every third party the page talks
     * to.
     */
    const baseline = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        // The storefront needs none of these. Camera stays available to the
        // dashboard, which uses it for product photos.
        value: 'geolocation=(), microphone=(), payment=(), usb=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ];

    return [
      { source: '/:path*', headers: baseline },
      {
        source: '/dashboard/:path*',
        headers: [
          ...baseline,
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
          // A framed dashboard is a clickjacked dashboard: an invisible overlay
          // over "delete product" or a status change is a real attack on a
          // merchant who is already signed in.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
      {
        // Checkout is the other page nobody may frame — the classic
        // clickjacking target is a payment confirmation.
        source: '/sites/:tenant/checkout',
        headers: [
          ...baseline,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
