/** JSX identifier node shape used by espree-compatible parsers. */
export interface JsxIdentifier {
  type: 'JSXIdentifier';
  name: string;
}

/** JSX member expression node shape for namespaced component names. */
export interface JsxMemberExpression {
  type: 'JSXMemberExpression';
  property: JsxIdentifier;
}

/** Supported JSX element name variants for source-only rules. */
export type JsxName = JsxIdentifier | JsxMemberExpression;

/** Static literal value carried by JSX attributes. */
export interface LiteralValue {
  type: 'Literal';
  value: string | number | boolean | null;
}

/** JSX expression container with an optionally static literal expression. */
export interface JsxExpressionContainer {
  type: 'JSXExpressionContainer';
  expression: LiteralValue | unknown;
}

/** JSX attribute node shape needed by the rules. */
export interface JsxAttribute {
  type: 'JSXAttribute';
  name: JsxIdentifier;
  value?: LiteralValue | JsxExpressionContainer | null;
}

/** JSX opening element node shape needed by the rules. */
export interface JsxOpeningElement {
  type: 'JSXOpeningElement';
  name: JsxName;
  attributes: unknown[];
}

/** JSX element node shape needed for child traversal. */
export interface JsxElement {
  type: 'JSXElement';
  openingElement: JsxOpeningElement;
  children: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsxAttribute(value: unknown): value is JsxAttribute {
  if (!isRecord(value) || value['type'] !== 'JSXAttribute' || !isRecord(value['name'])) {
    return false;
  }
  return value['name']['type'] === 'JSXIdentifier' && typeof value['name']['name'] === 'string';
}

/** Return true when an unknown AST node is a JSX opening element. */
export function isJsxOpeningElement(node: unknown): node is JsxOpeningElement {
  return isRecord(node) && node['type'] === 'JSXOpeningElement' && Array.isArray(node['attributes']);
}

/** Return true when an unknown AST node is a JSX element. */
export function isJsxElement(node: unknown): node is JsxElement {
  return isRecord(node) && node['type'] === 'JSXElement' && isJsxOpeningElement(node['openingElement']);
}

/** Extract the terminal element name from JSX identifier/member syntax. */
export function elementName(name: JsxName): string {
  if (name.type === 'JSXIdentifier') return name.name;
  return name.property.name;
}

/** Extract the element tag name from a JSX opening element. */
export function openingElementName(node: JsxOpeningElement): string {
  return elementName(node.name);
}

/** Find a JSX attribute by exact source name. */
export function jsxAttribute(node: JsxOpeningElement, name: string): JsxAttribute | undefined {
  for (const attribute of node.attributes) {
    if (isJsxAttribute(attribute) && attribute.name.name === name) return attribute;
  }
  return undefined;
}

/** Return static string text from a JSX attribute when it can be known. */
export function attributeStaticText(attribute: JsxAttribute | undefined): string | undefined {
  if (!attribute) return undefined;
  if (!attribute.value) return '';
  if (attribute.value.type === 'Literal') {
    return typeof attribute.value.value === 'string' ? attribute.value.value : undefined;
  }
  if (
    attribute.value.type === 'JSXExpressionContainer' &&
    isRecord(attribute.value.expression) &&
    attribute.value.expression['type'] === 'Literal' &&
    typeof attribute.value.expression['value'] === 'string'
  ) {
    return attribute.value.expression['value'];
  }
  return undefined;
}

/** Check whether a JSX element has a non-empty static attribute. */
export function hasNonEmptyStaticAttribute(node: JsxOpeningElement, name: string): boolean {
  const value = attributeStaticText(jsxAttribute(node, name));
  return value !== undefined && value.trim().length > 0;
}

/** Search JSX descendants for any element in a target tag-name set. */
export function containsElement(node: JsxElement, names: ReadonlySet<string>): boolean {
  const stack: unknown[] = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (isJsxElement(current)) {
      if (names.has(openingElementName(current.openingElement))) return true;
      stack.push(...current.children);
    }
  }
  return false;
}
