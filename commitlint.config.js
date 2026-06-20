// Conventional commits — subject follows conventional-commits structure.
//
// Examples:
//   feat(core): add scan() option
//   fix(wcag-rules): handle missing role attribute

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],   // allow any case (we use prose subjects sometimes)
    'header-max-length': [2, 'always', 100],
    // Conventional types plus two provenance types used by the review pipeline:
    //   genai-draft(<scope>): machine-assisted draft, pending human verification
    //   review(<scope>):      human verification / retro-review record
    'type-enum': [
      2,
      'always',
      [
        'build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor',
        'revert', 'style', 'test', 'genai-draft', 'review',
      ],
    ],
  },
  parserPreset: {
    parserOpts: {
      // Type group allows hyphens so `genai-draft(...)` parses as one type.
      headerPattern: /^([\w-]+)(?:\(([\w$.\-*/ ]*)\))?!?:\s(.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
};
