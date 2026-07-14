function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolvePointer(root, reference) {
  if (!reference.startsWith("#/")) {
    throw new Error("Unsupported schema reference: " + reference);
  }
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value[part], root);
}

function validate(value, schema, root, path, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push(path + " is forbidden by schema");
    return;
  }

  if (schema.$ref) {
    validate(value, resolvePointer(root, schema.$ref), root, path, errors);
    return;
  }

  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((branch) => validate(value, branch, root, path, errors));
  }

  if (Array.isArray(schema.anyOf)) {
    const accepted = schema.anyOf.some((branch) => {
      const branchErrors = [];
      validate(value, branch, root, path, branchErrors);
      return branchErrors.length === 0;
    });
    if (!accepted) errors.push(path + " does not match any allowed schema");
    return;
  }

  if (schema.not) {
    const branchErrors = [];
    validate(value, schema.not, root, path, branchErrors);
    if (branchErrors.length === 0) errors.push(path + " matches a forbidden schema");
  }

  if (Object.hasOwn(schema, "const") && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(path + " does not match const");
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    errors.push(path + " is not in enum");
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(path + " has the wrong type");
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(path + " is shorter than minLength");
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(path + " does not match pattern");
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(path + " is not a date-time");
    }
    if (schema.format === "uri") {
      try {
        const parsed = new URL(value);
        if (!parsed.protocol) errors.push(path + " is not an absolute URI");
      } catch {
        errors.push(path + " is not an absolute URI");
      }
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(path + " is below minimum");
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(path + " is above maximum");
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(path + " has too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(path + " has too many items");
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(path + " contains duplicate items");
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => validate(item, schema.items, root, path + "[" + index + "]", errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push(path + " has too few properties");
    }

    for (const required of schema.required || []) {
      if (!Object.hasOwn(value, required)) errors.push(path + " is missing " + required);
    }

    const properties = schema.properties || {};
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        validate(item, properties[key], root, path + "." + key, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(path + " has unexpected property " + key);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validate(item, schema.additionalProperties, root, path + "." + key, errors);
      }

      if (schema.propertyNames) {
        validate(key, schema.propertyNames, root, path + " property " + key, errors);
      }
    }
  }
}

export function assertJsonSchemaValid(value, schema, label) {
  const errors = [];
  validate(value, schema, schema, "$", errors);
  if (errors.length > 0) {
    throw new Error(label + " failed JSON Schema validation:\n" + errors.slice(0, 20).join("\n"));
  }
}
