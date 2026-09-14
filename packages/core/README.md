# @commerce/core

Domain logic shared by the Next.js web app (`custom_ecommerce_build/`) and the
Expo merchant app (`mobile/`).

## Source-only, on purpose

There is no build step and no published artifact. Consumers compile these
`.ts` files directly through a path alias, which means there is never a stale
`dist/` to be out of date with the source — the failure mode that makes shared
packages quietly wrong.

Consumers must provide `zod`. It is a peer dependency so neither app ends up
with a second copy.

| Consumer | Alias | Bundler config |
| --- | --- | --- |
| Web (Next) | `@core/*` in `tsconfig.json` | `turbopack.root` widened to the repo root |
| Mobile (Expo) | `@core/*` in `tsconfig.json` | `watchFolders` + `extraNodeModules` in `metro.config.js` |

## The one rule

**No React, no Node built-ins, no DOM.** Not `crypto`, not `fs`, not
`document`, not `next/*`. The moment something platform-specific lands here the
package stops being shareable and the arrangement fails silently — the web app
keeps working and the mobile build breaks.

`variants.ts` is the reference: it was written Prisma-free so it could run in a
Client Component, and that property is exactly what lets it run in React
Native untouched.

## `enums.ts` is generated

Do not edit it. It is copied from `src/generated/prisma/enums.ts` by
`pnpm sync:core` in the web app, which `pnpm db:generate` runs automatically.
A schema change therefore reaches both apps in one command.
