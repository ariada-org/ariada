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
 * New rules start as warnings and are promoted to errors package by package
 * once the code they report on is clean. The documentation rule is the
 * exception: it is off until the backfill is done, for the reason given beside
 * it.
 */

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import promise from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
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
      // The underscore prefix means "deliberately unused" for arguments and
      // variables; a caught error named `_error` means the same thing and was
      // reported anyway, because the caught-binding case has its own option and
      // was never given one.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // NAMING DISCIPLINE (2026-05-20) — what is checked is the names
      // themselves, not comments explaining them.
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
            // Replacements list for abbreviations. Universal JS
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

      // JSDoc — the backfill is still owed, and it is owed honestly.
      //
      // This rule's fixer writes an empty block, and an empty block satisfies
      // the rule. So running it turns "documentation is missing" into
      // "documentation is present" automatically, without anyone choosing to,
      // and the next reader sees documented exports and moves on. The fixer
      // is off: a rule that cannot be satisfied honestly must not be able to
      // satisfy itself dishonestly.
      //
      // With nothing being manufactured, the rule has to be off rather than a
      // warning, because the commit gate allows no warnings and several hundred
      // exports are undocumented. Left as a warning it would block work on
      // every one of them until each was written; that is the backfill, and the
      // backfill is a decision, not a side effect of this comment.
      'jsdoc/require-jsdoc': ['off', {
        enableFixer: false,
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
    files: [
      'packages/overlay/src/**/*.js',
      'packages/*/src/lib/overlay/**/*.js',
      // The course-page script of the Open edX block runs in the page too, and
      // the platform calls its top-level function by name — so the name is used
      // by something this configuration cannot see.
      'integrations/openedx-ariada/src/openedx_ariada/static/**/*.js',
      // Recorded exports from design tools are page scripts that assign onto
      // `window`. They are read as fixtures, never run by us, but they are ours
      // to keep readable — so they are declared rather than ignored, which would
      // also hide any fixture we do execute.
      'integrations/*/fixtures/**/*.js',
    ],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    // A block's course-page script declares one top-level function, and the
    // platform calls it by that name. Nothing in this repository calls it, so
    // the rule is right about what it can see and wrong about what happens.
    files: ['integrations/openedx-ariada/src/openedx_ariada/static/**/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // A commerce cartridge is loaded by the platform's own module system, which
    // is CommonJS and has no other mode. `require` there is not a legacy style
    // that could be modernised — it is the only way the platform hands a
    // cartridge its dependencies, and the files are never bundled by anything
    // of ours. The rule is right everywhere it can see and does not reach here.
    files: ['integrations/sfcc-ariada/cartridges/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // A recovered source has one job: to compile to the module it was read out
    // of, checked token by token. Both rules below fight that job rather than
    // the code.
    //
    // The loop rule is the sharper of the two, because its fixer acts. Running
    // it would rewrite a `forEach` the original compiled from, and the
    // comparison would fail — the source improved into one that no longer
    // produces its module. A fixer that can do that must not be pointed at these
    // files.
    //
    // The complexity here is the compiler's rather than an author's: a recovery
    // reads back code already inlined and flattened, so it inherits a shape
    // nobody wrote. Untangling it would break the same comparison. What to do
    // about that is a real question and it is open; silencing the warning does
    // not hide it, because the code-quality analysis applies its own threshold
    // to these files regardless.
    //
    // A third rule joins the two below for the same reason. The entry point of
    // one recovered package ends with a `then` that sets an exit code and
    // returns nothing; adding the return this rule asks for changes what the
    // module compiles to, and the comparison is the only check these packages
    // have.
    //
    // The fourth is the narrowest and the most instructive. A severity threshold
    // arrives as a plain string and is checked against a frozen list of the four
    // allowed ones with `.some(t => t === value)`. This rule asks for
    // `.includes(value)` — which reads better and does not compile, because the
    // list's element type is the four literals and the value being checked is not
    // yet one of them. That is the whole point of the check. Its fixer would
    // produce a type error, so it is off here rather than argued with per file.
    files: ['integrations/*/src/**/*.ts'],
    rules: {
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-includes': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'promise/always-return': 'off',
    },
  },
  {
    // The release-candidate tooling that two workflows run. Two rules error on
    // code that is doing its job here:
    //
    // The control-character rule fires on the expression that STRIPS control
    // characters from a message before it is reported. Writing the range any
    // other way either stops matching what it must match or hides it from a
    // reader; the rule is right about regular expressions in general and wrong
    // about the one whose whole subject is that class.
    //
    // The unused-argument rule fires on a callback parameter the platform's
    // signature supplies. Renaming it to satisfy the pattern changes a file for
    // the sake of a name nothing reads.
    //
    // Three more are warnings rather than errors, and the staged-file run treats
    // a warning as a stop, so the distinction does not help here. The import
    // ordering rule has a fixer and would rewrite the head of every one of these
    // files; the two shape rules describe code written to a settled standard.
    // All three are off for this directory only, and none of them is hidden: the
    // code-quality analysis reads its own thresholds and judges these files too.
    files: ['ci/**/*.mjs'],
    rules: {
      'no-control-regex': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/order': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },

  // Module scripts. They used to sit in the ignore list, so the linter never
  // looked at a couple of hundred files — nearly every evidence generator the
  // integrations ship, the code that produces what a package offers as proof it
  // works. An unused variable in any of them drew "file ignored", not an
  // error.
  //
  // Lifting the ignore is not enough. With no environment declared, the
  // undefined-name rule reports `URL`, `fetch`, `setTimeout`, `Buffer` — names
  // these files use correctly — and a rule that says "wrong" with the same
  // confidence as "right" means nothing. So each kind gets the runtime it has:
  // `.mjs` is a module, `.cjs` is CommonJS, and `require` and `__dirname` in the
  // latter are not mistakes but how the file is built.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Scripts that drive a browser and hand it code to run inside a page. That
  // code is written here and executes there, so `document` and `window` in it
  // are legitimate — and statically indistinguishable from a typo. Without a
  // declared environment the undefined-name rule reports each of them.
  //
  // Named one by one rather than by pattern: driving a browser is a property of
  // what a file does, not of where it sits, and a pattern would one day cover a
  // file with no business using those names and hide a real typo in it.
  {
    files: [
      'packages/ariada-extension/scripts/shot-docked.mjs',
      'packages/ariada-extension/scripts/shot-real.mjs',
      'packages/ariada-extension/scripts/test-highlight-e2e.mjs',
      'scripts/audit-rendered-smoke.mjs',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        document: 'readonly',
        window: 'readonly',
        chrome: 'readonly',
        DOMParser: 'readonly',
        sessionStorage: 'readonly',
        getComputedStyle: 'readonly',
        scrollX: 'readonly',
        scrollY: 'readonly',
      },
    },
  },
);
