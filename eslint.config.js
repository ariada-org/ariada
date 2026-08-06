// @ts-check
/**
 * Root ESLint flat config — ariada monorepo.
 *
 * Plugins (new additions in warn mode initially; promote to error
 * per-package or globally once baseline noise is triaged):
 *   - typescript-eslint     — TS core
 *   - eslint-plugin-import  — import order + no-cycle
 *   - eslint-plugin-jsx-a11y — JSX accessibility (React parts)
 *   - eslint-plugin-unicorn — modern JS best practices
 *   - eslint-plugin-jsdoc   — JSDoc presence + correctness (retroactive backfill planned)
 *   - eslint-plugin-sonarjs — code smells + cognitive complexity
 *   - eslint-plugin-promise — async/await best practices
 *   - @vitest/eslint-plugin — vitest test patterns
 *
 * Rule promotion path (per master testing strategy PRD §7.2
 * one-tool-per-day pattern):
 *   - v0.1 (now): warn-mode for new rules, doesn't block PRs
 *   - v0.2: promote to error per-package after JSDoc backfill
 *   - v0.3: promote to error globally with CI enforcement
 */

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import promise from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/.astro/**',
      '**/.wrangler/**',
      '**/.next/**',
      '**/.vercel/**',
      '**/.output/**',
      '**/.stryker-tmp/**',
      '.claude/worktrees/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/blob-report/**',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.d.ts',
      'packages/test-fixtures/fixtures/**',
      'packages/ariada-test-fixtures/fixtures/**',
      'tests/acceptance/results/**',
      'tests/production-smoke/**',
      'product/landing/**',
      'research/**',
      'patentomania/**',
      'patents/**',
      'AutoPatent/**',
      'pqai/**',
      '**/reports/mutation/**',
      '**/bundle.min.js',
      '**/bundle.meta.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      unicorn,
      jsdoc,
      sonarjs,
      promise,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Existing TypeScript rules (kept at error)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // NAMING DISCIPLINE (2026-05-20) — founder direction
      // «не на комменты надо проверять а на правильный нейминг».
      //
      // BASELINE (2026-05-20 fresh run): 1008 warnings if turned on globally
      //   - unicorn/prevent-abbreviations  951  (mostly e/i/doc/opts/idx/msg)
      //   - @typescript-eslint/naming-convention  52
      //   - unicorn/filename-case  5
      //
      // Existing lint-staged gate is `--max-warnings=0`, so flipping these
      // to 'warn' would block every commit that touches an offender file.
      // Auto-fix is NOT safe (815 fixable but renames break exported APIs).
      //
      // ROLLOUT PLAN — keep rules CONFIGURED but DISABLED ('off') at root,
      // promote per-package as offenders are remediated. Tracking +
      // promotion happens package by package as each offender set is cleared.
      '@typescript-eslint/naming-convention': [
        'off',
        // variables: camelCase or UPPER_CASE for true constants, PascalCase for component-style
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
        // functions: camelCase, PascalCase allowed (React components, factory fns)
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        // types / classes / interfaces / enums: PascalCase
        { selector: 'typeLike', format: ['PascalCase'] },
        // properties: camelCase, snake_case for external API mappings, UPPER_CASE for constants
        { selector: 'property', format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
        // quoted/string-literal properties: skip entirely (external data, URIs, rule names like
        // 'subject-case', '@typescript-eslint/no-explicit-any', 'ariada-base://X').
        {
          selector: 'objectLiteralProperty',
          format: null,
          modifiers: ['requiresQuotes'],
        },
        // enum members: PascalCase or UPPER_CASE
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        // NOTE: boolean-prefix rule omitted — requires type-aware linting
        // (parserOptions.project), which the root config intentionally skips
        // for perf. If we enable typed linting in v0.2, add the boolean
        // selector with prefix ['is', 'has', 'can', 'should', 'will', 'did',
        // 'was', 'are'] here.
      ],

      // Existing unicorn rule (kept at error)
      'unicorn/prefer-node-protocol': 'error',
      'import/no-default-export': 'off',

      // NEW: unicorn additional best-practice (warn → promote later)
      'unicorn/no-array-for-each': 'warn',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-includes': 'warn',
      'unicorn/prefer-string-starts-ends-with': 'warn',
      'unicorn/throw-new-error': 'warn',

      // NAMING DISCIPLINE — abbreviation hygiene (off until baseline fixed)
            // Replacements list per founder direction 2026-05-20. Universal JS
      // idioms (ctx, req, res, fn, err, props) explicitly allowlisted.
      'unicorn/prevent-abbreviations': [
        'off',
        {
          replacements: {
            mgr: { manager: true },
            dest: { destination: true },
            cfg: { config: true, configuration: true },
            obj: { object: true },
            val: { value: true },
            tmp: { temporary: true },
            arr: { array: true },
            str: { string: true },
            num: { number: true },
            cb: { callback: true },
            // explicitly allowlisted JS idioms
            ctx: false,
            req: false,
            res: false,
            fn: false,
            err: false,
            props: false,
            ref: false,
            refs: false,
            params: false,
            args: false,
            env: false,
            dev: false,
            prod: false,
            dist: false,
            pkg: false,
            db: false,
            url: false,
            uri: false,
            id: false,
            ids: false,
          },
          checkProperties: false, // external API often uses abbreviations
          checkFilenames: false,  // file naming handled separately
        },
      ],
      // Per-package promotion follows below.
      // Rule stays globally `off` above; below scoped overrides flip it to `warn`
      // as each package's offender set is auto-fixed and verified.

      // NAMING DISCIPLINE — prevent blanket eslint-disable comments
      // Safe to promote to error: 0 baseline hits.
      'unicorn/no-abusive-eslint-disable': 'error',

      // NAMING DISCIPLINE — consistent file naming (off; 5 baseline hits)
      // Remediation: rename to kebab-case in a single follow-up commit batch
      // and promote to 'warn' then 'error' once the baseline is clean.
      'unicorn/filename-case': [
        'off',
        {
          cases: { kebabCase: true, pascalCase: true },
          ignore: [
            '^[A-Z_]+\\.md$',   // ALL-CAPS markdown (CLAUDE.md, README.md, etc.)
            'README\\..*',
            'CHANGELOG\\..*',
            'LICENSE.*',
            'NOTICE.*',
          ],
        },
      ],

      // NEW: import order + cycle detection (warn)
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import/no-cycle': ['warn', { maxDepth: 10 }],
      'import/no-duplicates': 'warn',

      // NEW: JSDoc — retroactive backfill planned
      'jsdoc/require-jsdoc': ['warn', {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
        contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
      }],
      // require-description disabled: auto-fix generates empty `/** * */` stubs
      // that trip pre-commit zero-warnings gate. Re-enable when JSDoc backfill
      // adds real descriptions.
      'jsdoc/require-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/check-types': 'off', // TS already checks types
      'jsdoc/no-undefined-types': 'off', // TS handles this
      'jsdoc/tag-lines': 'off', // too opinionated

      // NEW: sonarjs (code smell detection)
      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-useless-catch': 'warn',
      'sonarjs/prefer-immediate-return': 'off',

      // NEW: promise (async/await patterns)
      'promise/always-return': 'warn',
      'promise/no-return-wrap': 'warn',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',

      // NEW: jsx-a11y (warn — relevant where JSX/TSX exists)
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/no-redundant-roles': 'warn',
    },
  },
  // Test files: relax stricter rules + add vitest patterns
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,mts}',
      '**/test/**/*.{ts,tsx}',
      '**/tests/**/*.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
    ],
    plugins: { vitest },
    rules: {
      'jsdoc/require-jsdoc': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'vitest/expect-expect': 'warn',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error', // block .only() in CI
      'vitest/no-identical-title': 'warn',
      'vitest/valid-expect': 'warn',
    },
  },
  // Per-package naming-discipline promotion — first package (2026-05-21).
  // Promotes `unicorn/prevent-abbreviations` to `warn` (not `error`) scoped
  // to wcag-rules-extended only. `warn` keeps lint-staged --max-warnings=0
  // honest while leaving residual cases reviewable; full clean run is
  // verified before this override lands.
  {
    files: ['packages/wcag-rules-extended/**/*.{ts,tsx}'],
    rules: {
      'unicorn/prevent-abbreviations': [
        'warn',
        {
          replacements: {
            mgr: { manager: true },
            dest: { destination: true },
            cfg: { config: true, configuration: true },
            obj: { object: true },
            val: { value: true },
            tmp: { temporary: true },
            arr: { array: true },
            str: { string: true },
            num: { number: true },
            cb: { callback: true },
            // explicitly allowlisted JS idioms (mirror root rule policy)
            ctx: false,
            req: false,
            res: false,
            fn: false,
            err: false,
            props: false,
            ref: false,
            refs: false,
            params: false,
            args: false,
            env: false,
            dev: false,
            prod: false,
            dist: false,
            pkg: false,
            db: false,
            url: false,
            uri: false,
            id: false,
            ids: false,
          },
          checkProperties: false,
          checkFilenames: false,
        },
      ],
    },
  },
  {
    // Overlay painters run inside the page, not in Node. Without the browser
    // globals declared, every `document` and `window` reference reads as an
    // undefined variable and the real defects hide behind the noise.
    files: ['packages/overlay/src/**/*.js', 'packages/*/src/lib/overlay/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
      },
    },
  },
);
