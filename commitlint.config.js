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
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(?:\(([\w$.\-*/ ]*)\))?!?:\s(.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
};
