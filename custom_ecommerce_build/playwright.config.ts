import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against a real dev server and the real Paystack test gateway.
 *
 * Tenant hosts are resolved in the browser, not faked with headers: Chromium is
 * launched with `--host-resolver-rules` so `adaobi-store.yourbrand.com` points
 * at the local server. Every request therefore goes through `proxy.ts` exactly
 * as it would in production — a test that set `x-tenant-slug` directly would
 * skip the one piece of routing most worth proving.
 */

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'yourbrand.com';
const PORT = Number(process.env.E2E_PORT ?? 3000);

export const E2E_TENANT = process.env.E2E_TENANT ?? 'adaobi-store';

/** Browser-facing origins. Only these are subject to `--host-resolver-rules`. */
export const storefrontOrigin = (slug: string = E2E_TENANT) =>
  `http://${slug}.${ROOT_DOMAIN}:${PORT}`;
export const platformOrigin = `http://${ROOT_DOMAIN}:${PORT}`;

/**
 * Origin for Playwright's `request` fixture.
 *
 * That fixture issues requests from Node, not the browser, so the resolver rules
 * above do not apply to it — pointing it at `yourbrand.com` sends real traffic to
 * whoever owns that domain. API-level tests therefore address `localhost` and
 * carry the tenant in a `Host` header, which is what the proxy reads anyway.
 */
export const LOCAL_ORIGIN = `http://localhost:${PORT}`;
export const hostHeader = (slug?: string) => ({
  host: slug ? `${slug}.${ROOT_DOMAIN}` : ROOT_DOMAIN,
});

export default defineConfig({
  testDir: './e2e',
  // Paystack's hosted flow is slow and rate-limits parallel test traffic.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: storefrontOrigin(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        `--host-resolver-rules=MAP *.${ROOT_DOMAIN} 127.0.0.1, MAP ${ROOT_DOMAIN} 127.0.0.1`,
        // The MAP rules above would otherwise be ignored for these hosts.
        '--ignore-certificate-errors',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
