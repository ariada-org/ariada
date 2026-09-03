<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/blamer-api-client`

Typed HTTP client for the differential authorship-attribution API. Wraps the
request/response types from `@ariada-org/ai-authorship`, so any pipeline that
needs AI-versus-human authorship analysis of code diffs can call the service
without hand-rolling the wire contract.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Install

```bash
npm install @ariada-org/blamer-api-client
```

Requires Node 22 LTS or newer.

## Usage

```ts
import { BlamerClient } from '@ariada-org/blamer-api-client';

const client = new BlamerClient({ baseUrl: 'https://api.example.com' });
const result = await client.analyzeDiff({ diff, context });
```

The client is standalone: it holds no credentials of its own and makes no calls
until you invoke a method against a base URL you supply.

## Documentation

Full API reference:
<https://github.com/ariada-org/ariada/tree/main/packages/blamer-api-client>.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
