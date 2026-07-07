# @ariada-org/loop-runner

`@ariada-org/loop-runner` connects existing Ariada engines into one local
remediation fact:

1. Run the content policy gate over public-bound files.
2. Attribute each blocking finding to the supplied commit context.
3. Build a draft remediation plan.
4. Record the resulting loop facts as JSONL for downstream checks.

The package does not execute a rollback, force-push, or open a remote pull
request. It returns structured facts and draft remediation text for a
human-controlled pipeline.

## API

```ts
import { runSelfRegulatingLoop, writeLoopFactsJsonl } from '@ariada-org/loop-runner';

const result = await runSelfRegulatingLoop({
  filePaths: ['README.md'],
  commit: {
    sha: 'abc1234',
    authorName: 'Alexander Brichkin',
    authorEmail: 'git@ariada.org',
    timestampUtc: '2026-07-04T09:00:00.000Z',
    message: 'docs: update README',
  },
});

writeLoopFactsJsonl(result.facts, 'var/loop-facts.jsonl');
```

Each persisted record includes `schemaVersion: 1` so readers can reject unknown
shapes. Use this package for internal automation around public-bound content
gates; it is not a hosted service or a replacement for human review.
