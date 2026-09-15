#!/usr/bin/env bash
# Render build for the API. Runs from the REPO ROOT, not `api/`: Render makes
# files outside a service's rootDir unavailable at build and run time, and the
# API compiles `packages/core` from source.
#
# pnpm is pinned and run through npx rather than relying on the platform to
# detect it — the same command works on a fresh clone anywhere, which is how
# this script is tested.
set -euo pipefail

PNPM="npx --yes pnpm@10.32.1"

# Core is source-only, but `tsc` resolves its imports (zod) from its own
# directory, so its dependencies must be installed for the typecheck to pass.
$PNPM --dir packages/core install --frozen-lockfile
$PNPM --dir api install --frozen-lockfile

# The generated client is gitignored; build it from the schema in this commit.
$PNPM --dir api db:generate
$PNPM --dir api build
