# Merchant app

React Native (Expo) for iOS and Android. The four things a merchant does away
from a desk: see what sold, mark orders shipped, add a product they just
photographed, and check what is running out.

Everything else — coupons, delivery areas, CSV import, branding — stays on the
web dashboard and is deep-linked from Settings. That is deliberate: every screen
here is a screen maintained twice, forever.

## Running it

```bash
cp .env.example .env      # then fill in the Clerk key from the web app's .env
npm start
```

The web app must be running (`pnpm dev` in `custom_ecommerce_build`).

**On a simulator** `localhost` reaches the host machine, so the default works.
**On a real device** set `EXPO_PUBLIC_API_BASE_URL` to the machine's LAN address
— `http://192.168.x.x:3000` — or the app will look permanently offline.

## The shared core

Domain logic comes from `../packages/core`, compiled from source, the same files
the Next.js app uses. Order transitions, variant pricing, stock availability and
money formatting are defined once so the phone and the browser cannot disagree.

Metro needs telling where it is — see `metro.config.js`. That is the mobile twin
of the `turbopack.root` setting the web app needs, and the fourth of five tools
that has to be taught the alias independently.

## Auth

Clerk, the same instance as the web app, so a merchant has one account. The
session token goes out as `Authorization: Bearer` on every request; the API
verifies it with no special handling, because tenant membership is a database
check against the slug in the URL and never cared how the caller authenticated.

Tokens live in `expo-secure-store` — the Keychain on iOS, EncryptedSharedPreferences
on Android. Never AsyncStorage: that is plaintext on disk.

## If it takes forever to launch

Metro's cache is the whole story. Measured on this project:

| | |
| --- | --- |
| Cold bundle (empty cache) | ~24s, ~9 MB |
| Warm bundle | ~0.1s |

So:

- **Use `npm start`.** Never `--clear` out of habit — it discards the cache and
  buys you the 24-second path every time. `npm run start:reset` exists for when
  you genuinely need it (after changing `metro.config.js`, or when resolution
  goes strange).
- **Leave Metro running** between reloads. Shaking the device and reloading hits
  the warm path; restarting the server does not.
- **First scan after a cold start is the slow one.** Give it a minute rather
  than assuming it has hung. Loading the bundle once from this machine warms the
  cache for the device.

Two things in `metro.config.js` reduce the cost:

- `inlineRequires` defers module initialisation until first use, so Clerk, zod
  and every unopened screen do not run their top-level code before the first
  frame. This is the standard React Native startup fix and matters most on the
  mid-range Android hardware this app targets.
- A `zod` alias pinned to one physical copy. `nodeModulesPaths` lists both this
  app and the core package, so zod was being bundled twice — 314 KB of pure
  duplication that also initialised twice.

## Checks

```bash
npm run typecheck      # tsc
npm run bundle:check   # full Metro bundle — catches resolution failures tsc cannot
```

`bundle:check` is the one that matters. TypeScript resolves `@core/*` through
`tsconfig` paths and will happily pass while Metro fails to resolve the same
import at runtime.
