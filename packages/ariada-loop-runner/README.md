# @ariada-org/loop-runner

`@ariada-org/loop-runner` is the dogfood loop that connects existing Ariada
engines into one remediation fact:

1. run the content-policy gate over public-bound files;
2. attribute a failing finding to commit metadata through `@ariada-org/ai-authorship`;
3. ask `@ariada-org/reverter-adapter` for a draft remediation plan;
4. return a typed fact that an operator or later queue runner can persist.

The package does not auto-push, force-push, or open a production PR. It produces
evidence and a plan so the protected release path can decide what to do next.

```ts
import { runSelfRegulatingLoop } from '@ariada-org/loop-runner';

const result = await runSelfRegulatingLoop({
  filePaths: ['README.md'],
  commit: {
    sha: 'abc123',
    authorName: 'Alexander Brichkin',
    authorEmail: 'git@ariada.org',
    timestampUtc: '2026-07-04T09:00:00.000Z',
    message: 'docs: update README',
  },
});
```

Use this package for internal dogfood automation around public-bound content
gates. It is not a hosted service or a replacement for human review.
