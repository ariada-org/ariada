import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const generator = readFileSync(new URL('../scripts/generate.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

function rgbFromHex(hex) {
  return hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16));
}

function hexFromRgb(rgb) {
  return '#' + rgb
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('');
}

function blend(foreground, background, alpha) {
  return foreground.map(
    (channel, index) => channel * alpha + background[index] * (1 - alpha),
  );
}

function relativeLuminance(rgb) {
  const channels = rgb
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(left, right) {
  const luminances = [relativeLuminance(left), relativeLuminance(right)]
    .sort((a, b) => b - a);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

test('generator uses only the app-local worker snapshot and package exports', () => {
  assert.equal(packageJson.dependencies['@agonist/localization'], '0.1.0');
  assert.match(generator, /@agonist\/localization\/wiki-locales\.json/);
  assert.match(generator, /@agonist\/localization\/wiki-messages\.json/);
  assert.doesNotMatch(generator, /with\s*\{\s*type:\s*['"]json['"]\s*\}/);
  assert.match(generator, /path\.resolve\(APP_ROOT, 'data\/channel-matrix\.json'\)/);
  assert.doesNotMatch(generator, /\.\.\/ariada-org|LOCALIZATION_ROOT|--source|--out/);
  assert.doesNotMatch(generator, /EXPECTED_LOCALES|REQUIRED_MESSAGES/);
});

test('generator requires but does not produce its app-local input', () => {
  assert.match(generator, /readJson\(CATALOG_SOURCE\)/);
  assert.match(generator, /existsSync\(file\)/);
  assert.match(generator, /Required file is missing/);
  assert.doesNotMatch(generator, /writeFileSync\(CATALOG_SOURCE|rmSync\(CATALOG_SOURCE/);
});

test('generator emits lowercase module IDs on trailing-slash routes', () => {
  assert.match(generator, /module\.id\.toLowerCase\(\)/);
  assert.match(
    generator,
    /return slug \? `\/\$\{locale\}\/modules\/\$\{slug\}\/` : `\/\$\{locale\}\/modules\/`;/,
  );
});

test('generator consumes the current installation and update fields only', () => {
  assert.match(generator, /typeof channel\.installation === 'string'/);
  assert.match(generator, /channel\.updatedAt === null/);
  assert.match(generator, /module\.updatedAt \?\? matrix\.generatedAt/);
  assert.doesNotMatch(
    generator,
    /lastChangedAt|installation\.(?:status|command|reason|instructionsUrl)|matrix\?\.wiki\?\.baseUrl/,
  );
});

test('dual focus indicator clears 3:1 across real page backgrounds', () => {
  const token = (name) => {
    const match = generator.match(
      new RegExp('--' + name + ':\\s*(#[0-9a-f]{6});', 'i'),
    );
    assert.ok(match, 'Missing color token --' + name);
    return rgbFromHex(match[1]);
  };
  const bodyGradient = generator.match(
    /body \{[\s\S]*?radial-gradient\(circle at 8% 8%, rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\), transparent 28rem\),\s*linear-gradient\(180deg,\s*(#[0-9a-f]{6}) 0,\s*var\(--paper\) 25rem\);/i,
  );
  assert.ok(bodyGradient, 'Unable to read the body gradient.');

  const dark = token('focus-ring-dark');
  const light = token('focus-ring-light');
  const overlay = bodyGradient.slice(1, 4).map(Number);
  const maximumOverlayAlpha = Number(bodyGradient[4]);
  const bodyTop = rgbFromHex(bodyGradient[5]);
  const paper = token('paper');
  const surface = token('surface');
  const blue = token('blue');
  const blueDeep = token('blue-deep');
  const maximumTopTint = blend(
    overlay,
    bodyTop,
    maximumOverlayAlpha,
  );

  assert.equal(hexFromRgb(maximumTopTint), '#f3efe7');
  assert.match(
    generator,
    /outline: 3px solid var\(--focus-ring-light\)/,
  );
  assert.match(
    generator,
    /box-shadow: 0 0 0 5px var\(--focus-ring-dark\) !important/,
  );

  let minimumBodyRatio = Number.POSITIVE_INFINITY;
  let minimumBodyColor = null;
  for (let linearStep = 0; linearStep <= 100; linearStep += 1) {
    const linearBackground = blend(
      paper,
      bodyTop,
      linearStep / 100,
    );
    for (let radialStep = 0; radialStep <= 100; radialStep += 1) {
      const background = blend(
        overlay,
        linearBackground,
        maximumOverlayAlpha * radialStep / 100,
      );
      const ratio = contrastRatio(dark, background);
      if (ratio < minimumBodyRatio) {
        minimumBodyRatio = ratio;
        minimumBodyColor = background;
      }
    }
  }
  assert.ok(
    minimumBodyRatio >= 3,
    `Dark focus ring has only ${minimumBodyRatio.toFixed(2)}:1 against body ${hexFromRgb(minimumBodyColor)}`,
  );

  const cardRatio = contrastRatio(dark, surface);
  assert.ok(
    cardRatio >= 3,
    `Dark focus ring has only ${cardRatio.toFixed(2)}:1 against white cards`,
  );

  let minimumHeaderRatio = Number.POSITIVE_INFINITY;
  let minimumHeaderColor = null;
  for (let step = 0; step <= 100; step += 1) {
    const background = blend(blue, blueDeep, step / 100);
    const ratio = contrastRatio(light, background);
    if (ratio < minimumHeaderRatio) {
      minimumHeaderRatio = ratio;
      minimumHeaderColor = background;
    }
  }
  assert.ok(
    minimumHeaderRatio >= 3,
    `Light focus ring has only ${minimumHeaderRatio.toFixed(2)}:1 against header ${hexFromRgb(minimumHeaderColor)}`,
  );

  for (const background of [maximumTopTint, surface, blue, blueDeep]) {
    const ratio = Math.max(
      contrastRatio(dark, background),
      contrastRatio(light, background),
    );
    assert.ok(
      ratio >= 3,
      `Dual focus indicator has only ${ratio.toFixed(2)}:1 against ${hexFromRgb(background)}`,
    );
  }
});

test('generator has no named foreign-project denylist', () => {
  assert.match(generator, /isForbiddenAuthority/);
  assert.doesNotMatch(generator, /FORBIDDEN_PUBLIC_TEXT/);
});
