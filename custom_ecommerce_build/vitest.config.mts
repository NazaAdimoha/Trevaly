import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '~': resolve(import.meta.dirname, './public'),
      // Shared domain logic lives outside this app so the Expo app can compile
      // the same source. Vitest resolves independently of tsconfig paths, so
      // the alias has to be repeated here or every test importing core fails
      // with "Cannot find package".
      '@core': resolve(import.meta.dirname, '../packages/core/src'),
    },
  },
});
