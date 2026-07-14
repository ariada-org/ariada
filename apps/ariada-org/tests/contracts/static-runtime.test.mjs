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

test('channel matrix has no runtime script or polling path', () => {
  assert.doesNotMatch(matrix, /<script\b/);
  assert.doesNotMatch(matrix, /fetch\s*\(|setInterval|visibilitychange/);
  assert.match(matrix, /Verified build snapshot/);
  assert.match(matrix, /snapshot\.snapshotHash/);
  assert.match(matrix, /snapshot\.generatedAt/);
  assert.match(matrix, /channel\.updatedAt/);
  assert.doesNotMatch(matrix, /snapshotId|lastChangedAt/);
});

test('detail page renders every public evidence tier', () => {
  assert.match(detail, /channel\.developmentEvidenceUrl/);
  assert.match(detail, /channel\.deliveryEvidenceUrls/);
  assert.match(detail, /channel\.evidenceUrl/);
  assert.match(detail, /data-evidence-kind="development"/);
  assert.match(detail, /data-evidence-kind="delivery"/);
  assert.match(detail, /data-evidence-kind="production"/);
  assert.match(detail, /deliveryEvidenceUrls\.length/);
  assert.match(detail, /snapshot\.snapshotHash/);
  assert.match(detail, /channel\.updatedAt/);
  assert.match(detail, /channel\.installation/);
  assert.doesNotMatch(
    detail,
    /snapshotId|lastChangedAt|channel\.installation\.(?:status|command|reason|instructionsUrl)/,
  );
});
