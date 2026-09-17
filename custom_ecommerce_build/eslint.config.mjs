import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config. Next 16 removed `next lint`, and eslint-config-next 16
 * requires ESLint >= 9, so the eslintrc format the Ceviant repo uses cannot
 * carry over verbatim — the rules below are the same, ported. eslint-config-next
 * 16 ships a native flat config, so no FlatCompat shim is needed.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**', // Prisma output
      'files (1)/**', // reference material, not source
      'next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextCoreWebVitals,

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/jsx-curly-brace-presence': [
        'warn',
        { props: 'never', children: 'never' },
      ],

      // Convention: narrow explicitly instead of asserting.
      '@typescript-eslint/no-non-null-assertion': 'error',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      'simple-import-sort/exports': 'warn',
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            // The negative lookahead keeps `@core` out of the third-party
            // group — it is our own domain logic that merely happens to live
            // outside this app, and it reads with `@/lib`, not with `react`.
            ['^(?!@core)@?\\w', '^\\u0000'],
            ['^.+\\.s?css$'],
            ['^@core'],
            ['^@/lib', '^@/hooks'],
            ['^@/data'],
            ['^@/components', '^@/container'],
            ['^@/store'],
            ['^@/'],
            ['^\\./?$', '^\\.(?!/?$)', '^\\.\\./?$', '^\\.\\.(?!/?$)'],
            ['^@/types'],
            ['^'],
          ],
        },
      ],
    },
  },

  {
    // The web app has no database and no payment or media secrets: every read
    // and write goes through the NestJS API (`@/lib/server-api` on the server,
    // `@/lib/api` in the browser). This keeps it that way.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/*', 'pg', '@/generated/*', '**/generated/prisma/*'],
              message:
                'The web app does not talk to the database. Call the API: @/lib/server-api (server) or @/lib/api (browser).',
            },
          ],
        },
      ],
    },
  },

  {
    /**
     * Components ported from the Ceviant back-office, which ran on Next 15 and
     * never saw React 19's newer hook rules.
     *
     * `set-state-in-effect` fires on their mount-time initialisation. For
     * `useFilters` in particular this is deliberate: `queryString` starts null
     * and becomes a string after mount, which is exactly the signal every list
     * view uses to gate its SWR key (`queryString !== null`). "Fixing" it would
     * silently change fetch timing across every table in the dashboard.
     *
     * Warn here, error everywhere else. Revisit as a deliberate refactor with
     * the list views in scope — not as a lint cleanup.
     */
    files: [
      'src/hooks/use-filters.ts',
      'src/hooks/use-mobile.tsx',
      'src/components/ui/table-factory.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },

  {
    files: ['prisma/**/*.ts', '*.config.{ts,mts,js,mjs}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
