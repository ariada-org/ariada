import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const matrix = readFileSync(
  new URL('../../src/components/ChannelMatrix.astro', import.meta.url),
  'utf8',
);
const detail = readFileSync(
  new URL('../../src/pages/modules/[id].astro', import.meta.url),
  'utf8',
);
const catalog = JSON.parse(readFileSync(
  new URL('../../public/channel-matrix.json', import.meta.url),
  'utf8',
));

test('channel matrix has no runtime script or polling path', () => {
  const s2 = catalog.channels.find((channel) => channel.id === 'S2');
  assert.ok(s2);
  assert.equal(s2.state, 'Delivered');
  assert.equal(s2.productionEvidenceUrl, null);
  assert.equal(s2.deliveryEvidenceUrls.length, 2);
  assert.doesNotMatch(matrix, /<script\b/);
  assert.doesNotMatch(matrix, /fetch\s*\(|setInterval|visibilitychange/);
  assert.match(
    matrix,
    /const productionUrl = publicUrl\(channel\.productionEvidenceUrl\)/,
  );
  assert.doesNotMatch(matrix, /channel\.evidenceUrl/);
  assert.match(matrix, /<tr data-channel-id=\{channel\.id\}>/);
  assert.match(
    matrix,
    /\{productionUrl && <a data-evidence-kind="production" href=\{productionUrl\}>Production<\/a>\}/,
  );
  assert.match(matrix, /Verified build snapshot/);
  assert.match(matrix, /snapshot\.snapshotHash/);
  assert.match(matrix, /snapshot\.generatedAt/);
  assert.match(matrix, /channel\.updatedAt/);
  assert.doesNotMatch(matrix, /snapshotId|lastChangedAt/);
});

test('detail page renders every public evidence tier', () => {
  const s2 = catalog.channels.find((channel) => channel.id === 'S2');
  assert.ok(s2);
  assert.equal(s2.state, 'Delivered');
  assert.equal(s2.productionEvidenceUrl, null);
  assert.equal(s2.deliveryEvidenceUrls.length, 2);
  assert.match(detail, /channel\.developmentEvidenceUrl/);
  assert.match(detail, /channel\.deliveryEvidenceUrls/);
  assert.match(
    detail,
    /const productionEvidenceUrl = publicUrl\(channel\.productionEvidenceUrl\)/,
  );
  assert.doesNotMatch(
    detail,
    /productionEvidenceUrl\s*=\s*publicUrl\(channel\.evidenceUrl\)/,
  );
  assert.match(detail, /data-evidence-kind="development"/);
  assert.match(detail, /data-evidence-kind="delivery"/);
  assert.match(detail, /data-evidence-kind="production"/);
  assert.match(
    detail,
    /const evidenceSummary = productionEvidenceUrl\s*\?\s*'Production evidence declared'/,
  );
  assert.match(
    detail,
    /\{productionEvidenceUrl &&\s*<p data-evidence-kind="production">/,
  );
  assert.match(detail, /deliveryEvidenceUrls\.length/);
  assert.match(detail, /snapshot\.snapshotHash/);
  assert.match(detail, /channel\.updatedAt/);
  assert.match(detail, /channel\.installation/);
  assert.doesNotMatch(
    detail,
    /snapshotId|lastChangedAt|channel\.installation\.(?:status|command|reason|instructionsUrl)/,
  );
});
