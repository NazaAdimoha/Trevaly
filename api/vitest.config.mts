import { fileURLToPath } from 'node:url';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // esbuild (Vite's default) does not emit decorator metadata, and Nest's
  // dependency injection reads it. SWC does.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@core': here('../packages/core/src'),
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.spec.ts'],
    setupFiles: ['dotenv/config'],
    // The suites share one real database and create fixtures by slug.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
