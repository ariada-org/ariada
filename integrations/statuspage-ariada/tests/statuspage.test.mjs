// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The lost package had no tests, or none that survived. These are the argument
// that reading it back was faithful: each states something the compiled output
// did, and each fails if the reconstruction got it wrong.
//
// Nothing here reaches the network. The transport is an interface and the tests
// supply their own, which is the reason the interface exists.

import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  ARIADA_CLI_SCHEMA,
  AtlassianStatuspageProvider,
  ProviderError,
  ValidationError,
  buildRegressionIncidentPayload,
  classifyAriadaResult,
  createStatusUpdatePlan,
  parseAriadaCliJson,
  parseAriadaCliResult,
  parseCliConfig,
  parseStatuspageConfig,
  runCli,
  updateStatusComponent,
} from '../dist/index.js';

const STARTED = '2026-09-02T09:00:00.000Z';
const COMPLETED = '2026-09-02T09:00:04.000Z';

function result(overrides = {}) {
  const base = {
    $schema: ARIADA_CLI_SCHEMA,
    url: 'https://example.org/',
    startedAt: STARTED,
    completedAt: COMPLETED,
    durationMs: 4000,
    summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
    report: {},
    exitCode: 0,
  };
  return { ...base, ...overrides };
}

function findings(counts, exitCode = 0) {
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0, ...counts };
  const total = byImpact.critical + byImpact.serious + byImpact.moderate + byImpact.minor;
  return result({ summary: { total, byImpact }, exitCode });
}

const ENV = {
  STATUSPAGE_PAGE_ID: 'page123',
  STATUSPAGE_COMPONENT_ID: 'comp456',
};

// ---------------------------------------------------------------- parsing ---

test('a well-formed result is accepted, and the optional field stays optional', () => {
  const parsed = parseAriadaCliResult(result());
  assert.equal(parsed.url, 'https://example.org/');
  assert.equal(parsed.scanId, undefined);
  assert.equal(parseAriadaCliResult(result({ scanId: 'abc' })).scanId, 'abc');
});

test('a field nobody recognises is refused, not ignored', () => {
  assert.throws(
    () => parseAriadaCliResult(result({ extra: 1 })),
    (error) => error instanceof ValidationError && /unknown field: extra/u.test(error.message),
  );
});

test('a missing field names itself', () => {
  const { url, ...withoutUrl } = result();
  assert.throws(() => parseAriadaCliResult(withoutUrl), /missing required field: url/u);
});

test('the total must equal what the counts add up to', () => {
  // A file that disagrees with itself is what a truncated write looks like.
  const wrong = result({ summary: { total: 5, byImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 } } });
  assert.throws(() => parseAriadaCliResult(wrong), /must equal the sum of byImpact counts/u);
});

test('the duration must match the two timestamps', () => {
  assert.throws(
    () => parseAriadaCliResult(result({ durationMs: 9999 })),
    /must match completedAt minus startedAt/u,
  );
});

test('a timestamp must be canonical, not merely parseable', () => {
  // Two runs of one scan must not be able to disagree about what time it was.
  assert.throws(
    () => parseAriadaCliResult(result({ startedAt: '2026-09-02T09:00:00Z' })),
    /canonical ISO-8601/u,
  );
});

test('stopping the build while finding nothing is refused', () => {
  assert.throws(() => parseAriadaCliResult(result({ exitCode: 1 })), /requires at least one finding/u);
});

test('an address that is not a web address is refused', () => {
  assert.throws(() => parseAriadaCliResult(result({ url: 'file:///etc/hosts' })), /HTTP or HTTPS/u);
});

test('text that is not JSON is refused before anything else', () => {
  assert.throws(() => parseAriadaCliJson('{'), /must be valid JSON/u);
});

// --------------------------------------------------------------- mapping ---

test('what a scan amounted to', () => {
  assert.equal(classifyAriadaResult(parseAriadaCliResult(result())), 'pass');
  assert.equal(classifyAriadaResult(parseAriadaCliResult(findings({ minor: 2 }))), 'partial');
  assert.equal(classifyAriadaResult(parseAriadaCliResult(findings({ critical: 1 }, 1))), 'fail');
});

// ------------------------------------------------------------ validation ---

test('an identifier that could change a request path is refused', () => {
  assert.throws(() => parseStatuspageConfig({ ...ENV, STATUSPAGE_PAGE_ID: 'a/../b' }), /may contain only/u);
});

test('a padded identifier is refused rather than trimmed', () => {
  // Trimming a trailing newline silently makes the next paste mistake harder to find.
  assert.throws(() => parseStatuspageConfig({ ...ENV, STATUSPAGE_PAGE_ID: 'page123\n' }), /without surrounding whitespace/u);
});

test('a base address carrying anything but an origin is refused', () => {
  const bad = ['http://api.statuspage.io', 'https://u:p@api.statuspage.io', 'https://api.statuspage.io/v1'];
  for (const baseUrl of bad) {
    assert.throws(() => parseStatuspageConfig({ ...ENV, STATUSPAGE_BASE_URL: baseUrl }), /baseUrl must be/u, baseUrl);
  }
  assert.equal(parseStatuspageConfig(ENV).baseUrl, 'https://api.statuspage.io');
});

test('the key is demanded only when something will be sent', () => {
  assert.equal(parseStatuspageConfig(ENV).apiKey, undefined);
  assert.throws(() => parseStatuspageConfig(ENV, {}, { requireApiKey: true }), /STATUSPAGE_API_KEY is required/u);
});

// -------------------------------------------------------------- planning ---

test('a plan says everything that would happen, and does none of it', () => {
  const plan = createStatusUpdatePlan(findings({ serious: 3 }), { pageId: 'page123', componentId: 'comp456' });
  assert.deepEqual(plan, {
    pageId: 'page123',
    componentId: 'comp456',
    ariadaStatus: 'partial',
    componentStatus: 'degraded_performance',
  });
});

test('a clean scan drafts no incident, however loudly one is asked for', () => {
  const plan = createStatusUpdatePlan(result(), {
    pageId: 'page123',
    componentId: 'comp456',
    regressionIncident: true,
  });
  assert.equal(plan.incidentPayload, undefined);
  assert.equal(buildRegressionIncidentPayload(result(), { componentId: 'comp456' }), undefined);
});

test('an incident names the scan, the address and the counts', () => {
  const payload = buildRegressionIncidentPayload(findings({ critical: 1, minor: 2 }, 1), {
    componentId: 'comp456',
    name: 'Board says no',
  });
  assert.equal(payload.incident.name, 'Board says no');
  assert.equal(payload.incident.impact_override, 'major');
  assert.equal(payload.incident.deliver_notifications, false);
  assert.match(payload.incident.body, /3 total \(1 critical, 0 serious, 0 moderate, 2 minor\)/u);
  assert.match(payload.incident.body, /https:\/\/example\.org\//u);
  assert.deepEqual(payload.incident.component_ids, ['comp456']);
});

test('a partial scan is a minor incident, a failed one is major', () => {
  const partial = buildRegressionIncidentPayload(findings({ minor: 1 }), { componentId: 'comp456' });
  assert.equal(partial.incident.impact_override, 'minor');
});

test('an incident setting of the wrong shape is refused, not read as truthy', () => {
  // Read as truthy, a stray value would file an incident named after itself.
  assert.throws(
    () => createStatusUpdatePlan(findings({ minor: 1 }), { pageId: 'page123', componentId: 'comp456', regressionIncident: 'yes' }),
    /must be a boolean or an options object/u,
  );
  assert.throws(
    () => createStatusUpdatePlan(findings({ minor: 1 }), { pageId: 'page123', componentId: 'comp456', regressionIncident: { nam: 'typo' } }),
    /unknown field: nam/u,
  );
});

// -------------------------------------------------------------- provider ---

function transportReturning(response, seen = []) {
  return {
    async request(request) {
      seen.push(request);
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

test('a successful update is read back before it is believed', async () => {
  const seen = [];
  const provider = new AtlassianStatuspageProvider({
    apiKey: 'key',
    transport: transportReturning({ status: 200, body: { id: 'comp456', status: 'major_outage' } }, seen),
  });
  const receipt = await provider.updateComponent({
    pageId: 'page123',
    componentId: 'comp456',
    status: 'major_outage',
  });
  assert.deepEqual(receipt, { provider: 'atlassian-statuspage', componentId: 'comp456', status: 'major_outage' });
  assert.equal(seen[0].method, 'PATCH');
  assert.equal(seen[0].url, 'https://api.statuspage.io/v1/pages/page123/components/comp456');
  assert.equal(seen[0].headers.Authorization, 'OAuth key');
  assert.deepEqual(seen[0].body, { component: { status: 'major_outage' } });
});

test('a success code about a different component is refused', async () => {
  // The failure this exists for: the board answers yes about something else and
  // the board is left saying something untrue with nothing going red.
  const provider = new AtlassianStatuspageProvider({
    apiKey: 'key',
    transport: transportReturning({ status: 200, body: { id: 'somethingelse', status: 'major_outage' } }),
  });
  await assert.rejects(
    provider.updateComponent({ pageId: 'page123', componentId: 'comp456', status: 'major_outage' }),
    (error) => error instanceof ProviderError && error.code === 'INVALID_RESPONSE',
  );
});

test('a success code about a different state is refused', async () => {
  const provider = new AtlassianStatuspageProvider({
    apiKey: 'key',
    transport: transportReturning({ status: 200, body: { id: 'comp456', status: 'operational' } }),
  });
  await assert.rejects(
    provider.updateComponent({ pageId: 'page123', componentId: 'comp456', status: 'major_outage' }),
    /inconsistent component response/u,
  );
});

test('a refusal and a failure to reach the board are told apart', async () => {
  const refused = new AtlassianStatuspageProvider({
    apiKey: 'key',
    transport: transportReturning({ status: 403, body: {} }),
  });
  await assert.rejects(
    refused.updateComponent({ pageId: 'page123', componentId: 'comp456', status: 'operational' }),
    (error) => error instanceof ProviderError && error.code === 'HTTP_ERROR' && error.statusCode === 403,
  );

  const unreachable = new AtlassianStatuspageProvider({
    apiKey: 'key',
    transport: transportReturning(new Error('socket hang up')),
  });
  await assert.rejects(
    unreachable.updateComponent({ pageId: 'page123', componentId: 'comp456', status: 'operational' }),
    (error) => error instanceof ProviderError && error.code === 'TRANSPORT_ERROR',
  );
});

test('the plan carried out carries the board answer with it', async () => {
  const outcome = await updateStatusComponent(findings({ minor: 1 }), {
    pageId: 'page123',
    componentId: 'comp456',
    provider: {
      name: 'fake',
      async updateComponent(request) {
        return { provider: 'fake', componentId: request.componentId, status: request.status };
      },
    },
  });
  assert.equal(outcome.componentStatus, 'degraded_performance');
  assert.equal(outcome.receipt.status, 'degraded_performance');
});

// ---------------------------------------------------------- command line ---

test('a flag that swallowed the next flag is refused', () => {
  assert.throws(() => parseCliConfig(['--page-id', '--apply'], ENV), /--page-id requires a value/u);
});

test('the same option twice is refused rather than resolved', () => {
  // Whichever rule were chosen, half the people who do it by accident get the other one.
  assert.throws(() => parseCliConfig(['--incident', '--incident'], ENV), /Duplicate CLI option/u);
});

test('naming an incident that will not be filed is refused', () => {
  assert.throws(() => parseCliConfig(['--incident-name', 'x'], ENV), /--incident-name requires --incident/u);
});

test('help stands alone', () => {
  assert.deepEqual(parseCliConfig(['--help'], ENV), { help: true });
  assert.throws(() => parseCliConfig(['--help', '--apply'], ENV), /cannot be combined/u);
});

test('the default run changes nothing and says so', async () => {
  let out = '';
  const code = await runCli(['--input', 'scan.json'], {
    environment: ENV,
    readFile: async () => JSON.stringify(findings({ moderate: 2 })),
    writeOut: (message) => {
      out += message;
    },
    providerFactory: () => {
      throw new Error('a dry run must not build a provider');
    },
  });
  assert.equal(code, 0);
  const printed = JSON.parse(out);
  assert.equal(printed.mode, 'dry-run');
  assert.equal(printed.plan.componentStatus, 'degraded_performance');
});

test('applying sends, and only with a key', async () => {
  let out = '';
  const sent = [];
  const code = await runCli(['--input', 'scan.json', '--apply'], {
    environment: { ...ENV, STATUSPAGE_API_KEY: 'key' },
    readFile: async () => JSON.stringify(findings({ critical: 1 }, 1)),
    writeOut: (message) => {
      out += message;
    },
    providerFactory: () => ({
      name: 'fake',
      async updateComponent(request) {
        sent.push(request);
        return { provider: 'fake', componentId: request.componentId, status: request.status };
      },
    }),
  });
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).mode, 'applied');
  assert.deepEqual(sent[0], { pageId: 'page123', componentId: 'comp456', status: 'major_outage' });
});

test('applying without a key stops before anything is built', async () => {
  let err = '';
  const code = await runCli(['--input', 'scan.json', '--apply'], {
    environment: ENV,
    readFile: async () => JSON.stringify(result()),
    writeError: (message) => {
      err += message;
    },
    providerFactory: () => {
      throw new Error('no provider should be built without a key');
    },
  });
  assert.equal(code, 2);
  assert.equal(JSON.parse(err).error.field, 'STATUSPAGE_API_KEY');
});

test('the caller mistake and the board failure get different exit codes', async () => {
  let err = '';
  const bad = await runCli(['--input', 'scan.json'], {
    environment: ENV,
    readFile: async () => 'not json',
    writeError: (message) => {
      err += message;
    },
  });
  assert.equal(bad, 2);
  assert.equal(JSON.parse(err).error.code, 'VALIDATION_ERROR');

  err = '';
  const refused = await runCli(['--input', 'scan.json', '--apply'], {
    environment: { ...ENV, STATUSPAGE_API_KEY: 'key' },
    readFile: async () => JSON.stringify(findings({ critical: 1 }, 1)),
    writeError: (message) => {
      err += message;
    },
    providerFactory: () => ({
      name: 'fake',
      async updateComponent() {
        throw new ProviderError('HTTP_ERROR', 'nope', { statusCode: 500 });
      },
    }),
  });
  assert.equal(refused, 3);
  assert.equal(JSON.parse(err).error.statusCode, 500);
});
