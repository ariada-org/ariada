import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const load = (relative) => JSON.parse(
  readFileSync(new URL(relative, import.meta.url), 'utf8')
);

const catalog = load('../../public/channel-matrix.json');
const catalogSchema = load('../../public/schemas/public-module-catalog/v1.json');
const sourceRegistry = load('../../../../config/ariada-channel-source.json');
const sourceRegistrySchema = load('../../public/schemas/channel-source-registry/v1.json');

function resolveReference(root, reference) {
  assert(reference.startsWith('#/'), 'Only local schema references are supported.');
  return reference.slice(2).split('/').reduce(
    (value, segment) => value[segment.replaceAll('~1', '/').replaceAll('~0', '~')],
    root,
  );
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function validate(value, schema, root, path = '$', errors = []) {
  if (schema === false) {
    errors.push(path + ' is not allowed');
    return errors;
  }
  if (schema === true) return errors;
  if (schema.$ref) {
    return validate(value, resolveReference(root, schema.$ref), root, path, errors);
  }
  if (schema.allOf) {
    for (const branch of schema.allOf) validate(value, branch, root, path, errors);
  }
  if (schema.anyOf) {
    const valid = schema.anyOf.some((branch) => {
      const branchErrors = [];
      validate(value, branch, root, path, branchErrors);
      return branchErrors.length === 0;
    });
    if (!valid) errors.push(path + ' does not match any allowed schema');
    return errors;
  }
  if (Object.hasOwn(schema, 'const')) {
    if (JSON.stringify(value) !== JSON.stringify(schema.const)) {
      errors.push(path + ' does not equal the required constant');
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(path + ' is not an allowed enum value');
    return errors;
  }

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = valueType(value);
    const integerAsNumber = actual === 'integer' && expected.includes('number');
    if (!expected.includes(actual) && !integerAsNumber) {
      errors.push(path + ' expected ' + expected.join('|') + ' but received ' + actual);
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(path + ' is shorter than minLength');
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(path + ' does not match its pattern');
    }
    if (schema.format === 'uri') {
      try {
        new URL(value);
      } catch {
        errors.push(path + ' is not a URI');
      }
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(path + ' is not a date-time');
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(path + ' is below minimum');
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(path + ' is above maximum');
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(path + ' has too few items');
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(path + ' has too many items');
    }
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => JSON.stringify(item)));
      if (unique.size !== value.length) errors.push(path + ' contains duplicate items');
    }
    const prefixItems = schema.prefixItems || [];
    for (let index = 0; index < prefixItems.length && index < value.length; index += 1) {
      validate(value[index], prefixItems[index], root, path + '[' + index + ']', errors);
    }
    for (let index = prefixItems.length; index < value.length; index += 1) {
      if (schema.items !== undefined) {
        validate(value[index], schema.items, root, path + '[' + index + ']', errors);
      }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const required of schema.required || []) {
      if (!Object.hasOwn(value, required)) {
        errors.push(path + ' is missing ' + required);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          errors.push(path + ' has undeclared property ' + key);
        }
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        validate(value[key], propertySchema, root, path + '.' + key, errors);
      }
    }
  }

  return errors;
}

test('public module catalog validates against its published schema', () => {
  assert.equal(catalog.$schema, catalogSchema.$id);
  assert.deepEqual(validate(catalog, catalogSchema, catalogSchema), []);
});

test('channel source registry validates against its published schema', () => {
  assert.equal(sourceRegistry.$schema, sourceRegistrySchema.$id);
  assert.deepEqual(validate(sourceRegistry, sourceRegistrySchema, sourceRegistrySchema), []);
});
