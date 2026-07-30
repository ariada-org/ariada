import { describe, expect, it } from 'vitest';

import {
  ADMIN_GRID_ACTION_EFFECT,
  DEFAULT_WIKI,
  barContent,
  escapeHtml,
  formatByKind,
  formatInteger,
  formatRowValue,
  rampColor,
  rampContent,
  rampVariant,
  rowLabel,
  statusColor,
  tagColor,
  toNumber,
  wikiHref,
} from './format';

describe('numbers', () => {
  it('groups integers the way the grid does', () => {
    expect(formatInteger(9300)).toBe('9,300');
    expect(formatInteger(-3120.4)).toBe('-3,120');
  });

  it('coerces unknown cell values without throwing', () => {
    expect(toNumber(12)).toBe(12);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('nope')).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('colour ramp', () => {
  it('interpolates red -> green and clamps outside 0..1', () => {
    expect(rampColor(0).fg).toBe('rgb(220,38,38)');
    expect(rampColor(1).fg).toBe('rgb(5,150,105)');
    expect(rampColor(-4).fg).toBe(rampColor(0).fg);
    expect(rampColor(9).fg).toBe(rampColor(1).fg);
  });

  it('emits a translucent chip background alongside the foreground', () => {
    expect(rampColor(1).bg).toBe('rgba(5,150,105,0.12)');
  });

  it('resolves the ramp variant from the CONTRACT, never from a column name', () => {
    expect(rampVariant({ kind: 'ratio' })).toBe('ratio');
    expect(rampVariant({ kind: 'percent', colorRamp: { good: 'low' } })).toBe('low-percent');
    expect(rampVariant({ kind: 'count' })).toBe('signed');
    expect(rampVariant({ kind: 'count', colorRamp: { good: 'high' } })).toBe('signed');
  });

  it('renders each ramp variant on its own scale', () => {
    expect(rampContent('ratio', 1.482).text).toBe('1.48');
    expect(rampContent('low-percent', 1).text).toBe('1%');
    expect(rampContent('signed', 3120).text).toBe('+3,120');
    expect(rampContent('signed', -3120).text).toBe('-3,120');
    expect(rampContent('signed', 0).text).toBe('0');
  });
});

describe('bar cell', () => {
  it('clamps the fill to 0..100 but keeps the true label', () => {
    expect(barContent(42.6)).toMatchObject({ percent: 42.6, text: '43' });
    expect(barContent(140).percent).toBe(100);
    expect(barContent(-8).percent).toBe(0);
  });
});

describe('status and tag palettes', () => {
  it('maps known severities and falls back to neutral', () => {
    expect(statusColor('active')).toBe('#059669');
    expect(statusColor('banned')).toBe('#dc2626');
    expect(statusColor('paused')).toBe('#d97706');
    expect(statusColor('who-knows')).toBe('#94a3b8');
    expect(statusColor(undefined)).toBe('#94a3b8');
  });

  it('maps tags and falls back to slate', () => {
    expect(tagColor('feeder')).toBe('#2563eb');
    expect(tagColor('mystery')).toBe('#64748b');
  });
});

describe('formatByKind', () => {
  it('formats each metric kind', () => {
    expect(formatByKind(0.232, 'percent')).toBe('23.2%');
    expect(formatByKind(4.5, 'currency')).toBe('$4.50');
    expect(formatByKind(90, 'duration')).toBe('90s');
    expect(formatByKind(9300, 'count')).toBe('9,300');
    expect(formatByKind(1.482, 'ratio')).toBe('1.48');
    expect(formatByKind(76.4, 'score')).toBe('76');
    expect(formatByKind('x', 'text')).toBe('x');
  });
});

describe('formatRowValue — renderer wins over kind', () => {
  // The regression this function exists for: a column declared kind:'percent'
  // that carries a 0-100 value. The grid's ramp renderer prints "1%"; a
  // kind-only formatter multiplies by 100 again and prints "100.0%".
  const fraudPct = { key: 'fraudPct', kind: 'percent', renderer: 'ramp', colorRamp: { good: 'low' } } as const;

  it('prints the ramp value, not the kind value', () => {
    expect(formatRowValue(1, fraudPct)).toBe('1%');
    expect(formatByKind(1, 'percent')).toBe('100.0%');
  });

  it('agrees with the grid for every renderer in the contract', () => {
    expect(formatRowValue(1.482, { kind: 'ratio', renderer: 'ramp' })).toBe('1.48');
    expect(formatRowValue(3120, { kind: 'count', renderer: 'ramp' })).toBe('+3,120');
    expect(formatRowValue(76.4, { kind: 'score', renderer: 'bar' })).toBe('76');
    expect(formatRowValue(9300, { kind: 'count' })).toBe('9,300');
    expect(formatRowValue(0.232, { kind: 'percent' })).toBe('23.2%');
  });

  it('handles empty, boolean and text values', () => {
    expect(formatRowValue(null, { kind: 'count' })).toBe('—');
    expect(formatRowValue('', { kind: 'text' })).toBe('—');
    expect(formatRowValue(true, { kind: 'enum' })).toBe('yes');
    expect(formatRowValue('feeder', { kind: 'enum', renderer: 'tag' })).toBe('feeder');
  });
});

describe('wiki links', () => {
  it('uses the column key when the contract omits a slug', () => {
    expect(wikiHref(DEFAULT_WIKI, { description: 'x' }, 'owedRatio'))
      .toBe('https://wiki.klarads.com/en/metrics/owedRatio');
  });

  it('honours slug, anchor, language and a trailing-slash base', () => {
    expect(wikiHref({ base: 'https://wiki.klarads.com/', lang: 'ru' }, { description: 'x', wikiSlug: 'owed-ratio', wikiAnchor: 'formula' }, 'owedRatio'))
      .toBe('https://wiki.klarads.com/ru/metrics/owed-ratio#formula');
  });
});

describe('row helpers', () => {
  it('labels a row from its own fields, falling back to the row key', () => {
    expect(rowLabel({ title: 'T', name: 'N', id: '1' })).toBe('T');
    expect(rowLabel({ name: 'N', id: '1' })).toBe('N');
    expect(rowLabel({ id: '1' })).toBe('1');
    expect(rowLabel({ slug: 'abc' }, 'slug')).toBe('abc');
  });

  it('publishes the optimistic action-effect table', () => {
    expect(ADMIN_GRID_ACTION_EFFECT.ban).toBe('banned');
    expect(ADMIN_GRID_ACTION_EFFECT.stop_trade).toBe('paused');
    expect(Object.isFrozen(ADMIN_GRID_ACTION_EFFECT)).toBe(true);
  });

  it('escapes values interpolated into a vanilla renderer', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});
