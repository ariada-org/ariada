// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { compareLiveDeploy, reconcileTargets } from '../src/index.js';

describe('reconcileTargets', () => {
  it('checks and fixes typed source-to-target drift without changing stable bytes', () => {
    const source = { label: 'ariada', version: '0.1.0' };
    const target = {
      id: 'readme-version',
      path: 'README.md',
      current: 'version: old\n',
      render: (fact: typeof source) => `version: ${fact.version}\n`,
    };

    const checked = reconcileTargets(source, [target], { mode: 'check' });
    expect(checked.ok).toBe(false);
    expect(checked.drift).toHaveLength(1);
    expect(checked.writes).toHaveLength(0);

    const fixed = reconcileTargets(source, [target], { mode: 'fix' });
    expect(fixed.ok).toBe(true);
    expect(fixed.writes).toEqual([{ path: 'README.md', content: 'version: 0.1.0\n' }]);

    const stable = reconcileTargets(
      source,
      [{ ...target, current: 'version: 0.1.0\n' }],
      { mode: 'fix' },
    );
    expect(stable.drift).toHaveLength(0);
    expect(stable.writes).toHaveLength(0);
  });
});

describe('compareLiveDeploy', () => {
  it('emits a live-deploy-drift fact when rendered bytes diverge from the current build', () => {
    const fact = compareLiveDeploy({
      surfaceId: 'ariada-org-home',
      currentBuild: '<main>current</main>',
      liveRendered: '<main>stale</main>',
      currentBuildRef: 'git:abc123',
      liveRef: 'https://example.invalid/',
    });

    expect(fact).toMatchObject({
      kind: 'live-deploy-drift',
      surfaceId: 'ariada-org-home',
      currentBuildRef: 'git:abc123',
      liveRef: 'https://example.invalid/',
    });
    expect(fact?.currentBuildHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fact?.liveRenderedHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
