import { describe, expect, it } from 'vitest';

import {
  ADMIN_SURFACE_SCHEMA,
  AdminSurfaceValidationError,
  createLocaleRegistryFromLanguageSupport,
  defineAdminSurface,
  filterLocaleOptions,
  fromColorInputValue,
  isLocaleAllowed,
  localeOptionsForField,
  parseHexRgb,
  toColorInputValue,
} from './index.js';

const languageSupport = {
  productId: 'fixture',
  manifestId: 'fixture.languages',
  languages: [
    {
      locale: 'en-US', englishName: 'English', nativeName: 'English', enabled: true,
      providers: [{ providerId: 'fixture.tts', capabilities: ['speech.synthesis'] }],
    },
    {
      locale: 'ru-RU', englishName: 'Russian', nativeName: 'Русский', enabled: true,
      providers: [{ providerId: 'fixture.stt', capabilities: ['speech.recognition'] }],
    },
    {
      locale: 'sv-SE', englishName: 'Swedish', nativeName: 'Svenska', enabled: false,
      providers: [{ providerId: 'fixture.all', capabilities: ['speech.synthesis', 'speech.recognition'] }],
    },
  ],
} as const;

const helper = {
  summary: 'Controls the persisted application defaults.',
  defaultSemantics: 'The base value is used only when no narrower value exists.',
  precedence: 'Base is resolved before country, role, and exact user overrides.',
  effect: 'The published value changes the next resolved profile response.',
} as const;

function validSurface() {
  return {
    schemaVersion: ADMIN_SURFACE_SCHEMA,
    id: 'fixture.profile-defaults',
    title: 'Fixture profile defaults',
    localeRegistryId: 'fixture.languages',
    blocks: [{
      id: 'voice', title: 'Voice', helper,
      fields: [
        { key: 'locale', label: 'Voice locale', kind: 'locale', requiredCapability: 'speech.synthesis', allowSystem: true },
        { key: 'accentHex', label: 'Accent colour', kind: 'color', wireFormat: 'RRGGBB' },
      ],
    }],
  } as const;
}

describe('@ariada-org/admin-surface', () => {
  it('builds one immutable locale registry from language support and filters it by capability', () => {
    const registry = createLocaleRegistryFromLanguageSupport(languageSupport);
    expect(registry.id).toBe('fixture.languages');
    expect(registry.options.map(({ value }) => value)).toEqual(['en-US', 'ru-RU']);
    expect(filterLocaleOptions(registry, 'speech.synthesis').map(({ value }) => value)).toEqual(['en-US']);
    expect(Object.isFrozen(registry.options)).toBe(true);
  });

  it('adds the typed phone-system option only when locale field metadata explicitly allows it', () => {
    const registry = createLocaleRegistryFromLanguageSupport(languageSupport);
    const ordinary = localeOptionsForField(registry, { kind: 'locale', key: 'target', label: 'Target locale' });
    const native = localeOptionsForField(registry, {
      kind: 'locale', key: 'native', label: 'Native locale', allowSystem: true,
    });
    expect(ordinary.some(({ value }) => value === 'system')).toBe(false);
    expect(native[0]).toMatchObject({ kind: 'system', value: 'system', label: 'Follow phone system' });
    expect(isLocaleAllowed(registry, 'system', undefined, false)).toBe(false);
    expect(isLocaleAllowed(registry, 'system', undefined, true)).toBe(true);
  });

  it('normalizes picker input while preserving a strict uppercase six-digit wire model', () => {
    expect(parseHexRgb('#a1b2c3')).toBe('A1B2C3');
    expect(toColorInputValue('A1B2C3')).toBe('#a1b2c3');
    expect(fromColorInputValue('#f2f2f7')).toBe('F2F2F7');
    expect(() => parseHexRgb('#12345')).toThrow(AdminSurfaceValidationError);
  });

  it('accepts a surface whose locale and colour fields are controlled by the shared contract', () => {
    const surface = defineAdminSurface(validSurface());
    expect(surface).toEqual(validSurface());
    expect(Object.isFrozen(surface.blocks[0]?.fields)).toBe(true);
  });

  it.each([
    ['missing contextual helper', () => ({ ...validSurface(), blocks: [{ ...validSurface().blocks[0], helper: undefined }] })],
    ['free-text locale', () => ({ ...validSurface(), blocks: [{ ...validSurface().blocks[0], fields: [{ key: 'locale', label: 'Locale', kind: 'text' }] }] })],
    ['free-text colour', () => ({ ...validSurface(), blocks: [{ ...validSurface().blocks[0], fields: [{ key: 'accentHex', label: 'Accent colour', kind: 'text' }] }] })],
    ['locale without registry', () => ({ ...validSurface(), localeRegistryId: undefined })],
  ])('rejects %s', (_label, fixture) => {
    expect(() => defineAdminSurface(fixture())).toThrow(AdminSurfaceValidationError);
  });
});
