// Conventional commits + tolerate `[<AGENT>]` agent-prefix in subject.
// Message body MUST follow conventional-commits structure.
//
// Examples:
//   feat(core): add scan() option
//   [NOETHER] feat(core): add scan() option   ← also OK (agent prefix)

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],   // allow any case (we use prose subjects sometimes)
    'header-max-length': [2, 'always', 100],
  },
  parserPreset: {
    parserOpts: {
      // Accept optional `[AGENT_NAME]` prefix before conventional type
      headerPattern: /^(?:\[[A-Z]+\]\s)?(\w+)(?:\(([\w$.\-*/ ]*)\))?!?:\s(.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
};
