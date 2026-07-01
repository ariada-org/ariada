/** RGB color channels normalized to Figma's 0..1 paint range. */
export type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a?: number | undefined;
};

/** Minimal paint model used by the local scanner and fixture harness. */
export type DesignPaint =
  | {
      type: 'SOLID';
      color: RgbaColor;
      opacity?: number | undefined;
      visible?: boolean | undefined;
    }
  | {
      type: 'IMAGE';
      visible?: boolean | undefined;
    }
  | {
      type: 'GRADIENT' | 'OTHER';
      visible?: boolean | undefined;
    };

/** Serializable Figma-like node shape consumed by the Ariada design scanner. */
export type DesignNode = {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  visible: boolean;
  fills: DesignPaint[];
  strokes: DesignPaint[];
  characters?: string | undefined;
  fontSize?: number | undefined;
  pluginData: Record<string, string>;
  children: DesignNode[];
};

/** One accessibility finding emitted for a selected Figma node. */
export type AriadaDesignFinding = {
  id: string;
  ruleId: string;
  wcag: string;
  severity: 'error' | 'warning';
  nodeId: string;
  nodeName: string;
  message: string;
  help: string;
  metrics: Record<string, string | number | boolean>;
};

/** Full scanner result shown in the plugin UI and evidence report. */
export type AriadaDesignScanResult = {
  scannedAt: string;
  selectedNodeCount: number;
  visitedNodeCount: number;
  summary: {
    errors: number;
    warnings: number;
    findings: number;
  };
  findings: AriadaDesignFinding[];
};

type ScanContext = {
  findings: AriadaDesignFinding[];
  visited: number;
};

const GENERIC_FRAME_NAMES = new Set(['frame', 'group', 'rectangle', 'vector', 'image', 'photo', 'icon']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);

/** Scan one or more selected Figma-like nodes for design-time accessibility findings. */
export function scanDesignSelection(nodes: DesignNode[], scannedAt: string = new Date().toISOString()): AriadaDesignScanResult {
  const context: ScanContext = { findings: [], visited: 0 };

  for (const node of nodes) {
    scanNode(node, undefined, context);
  }

  const errors = context.findings.filter((finding) => finding.severity === 'error').length;
  const warnings = context.findings.length - errors;

  return {
    scannedAt,
    selectedNodeCount: nodes.length,
    visitedNodeCount: context.visited,
    summary: {
      errors,
      warnings,
      findings: context.findings.length,
    },
    findings: context.findings,
  };
}

/** Parse fixture or adapter input into a checked scanner node. */
export function parseDesignNode(input: unknown): DesignNode {
  if (!isRecord(input)) {
    throw new TypeError('Fixture root must be an object.');
  }

  const childrenValue = input['children'];
  const children = Array.isArray(childrenValue) ? childrenValue.map(parseDesignNode) : [];

  return {
    id: readString(input, 'id'),
    name: readString(input, 'name'),
    type: readString(input, 'type'),
    width: readNumber(input, 'width'),
    height: readNumber(input, 'height'),
    visible: readOptionalBoolean(input, 'visible', true),
    fills: parsePaints(input['fills']),
    strokes: parsePaints(input['strokes']),
    characters: readOptionalString(input, 'characters'),
    fontSize: readOptionalNumber(input, 'fontSize'),
    pluginData: parsePluginData(input['pluginData']),
    children,
  };
}

function scanNode(node: DesignNode, inheritedBackground: RgbaColor | undefined, context: ScanContext): void {
  if (!node.visible) {
    return;
  }

  context.visited += 1;
  const nodeBackground = firstSolidColor(node.fills);
  const background = node.type === 'TEXT' ? inheritedBackground : nodeBackground ?? inheritedBackground;

  checkContrast(node, background, context);
  checkTargetSize(node, context);
  checkTextAlternative(node, context);
  checkStructure(node, context);

  for (const child of node.children) {
    scanNode(child, background, context);
  }
}

function checkContrast(node: DesignNode, background: RgbaColor | undefined, context: ScanContext): void {
  if (node.type !== 'TEXT' || background === undefined) {
    return;
  }

  const foreground = firstSolidColor(node.fills);
  if (foreground === undefined) {
    return;
  }

  const ratio = contrastRatio(foreground, background);
  const largeText = (node.fontSize ?? 0) >= 18;
  const minimum = largeText ? 3 : 4.5;

  if (ratio < minimum) {
    addFinding(context, {
      ruleId: 'ariada.design.contrast.minimum',
      wcag: 'WCAG 1.4.3 Contrast (Minimum)',
      severity: 'error',
      node,
      message: `${node.name} contrast is ${ratio.toFixed(2)}:1, below ${minimum}:1.`,
      help: 'Increase foreground/background contrast before design handoff.',
      metrics: { ratio: Number(ratio.toFixed(2)), minimum, largeText },
    });
  }
}

function checkTargetSize(node: DesignNode, context: ScanContext): void {
  const role = normalizedRole(node);
  const looksInteractive = INTERACTIVE_ROLES.has(role) || /\b(button|link|tap|click|checkbox|switch|tab)\b/i.test(node.name);

  if (!looksInteractive) {
    return;
  }

  const minSide = Math.min(node.width, node.height);
  if (minSide < 24) {
    addFinding(context, {
      ruleId: 'ariada.design.target-size.minimum',
      wcag: 'WCAG 2.5.8 Target Size (Minimum)',
      severity: 'error',
      node,
      message: `${node.name} target is ${node.width}x${node.height}px; minimum side is below 24px.`,
      help: 'Resize interactive controls so the target is at least 24x24px.',
      metrics: { width: node.width, height: node.height, minimumSide: 24 },
    });
    return;
  }

  if (minSide < 44) {
    addFinding(context, {
      ruleId: 'ariada.design.target-size.recommended',
      wcag: 'WCAG 2.5.5 Target Size (Enhanced)',
      severity: 'warning',
      node,
      message: `${node.name} target is ${node.width}x${node.height}px; 44x44px is preferred for touch.`,
      help: 'Prefer a 44x44px touch target where layout permits.',
      metrics: { width: node.width, height: node.height, recommendedSide: 44 },
    });
  }
}

function checkTextAlternative(node: DesignNode, context: ScanContext): void {
  const hasImageFill = node.fills.some((paint) => paint.type === 'IMAGE' && paint.visible !== false);
  const imageLikeName = /\b(image|photo|logo|avatar|icon|illustration)\b/i.test(node.name);
  const imageLikeType = new Set(['RECTANGLE', 'VECTOR', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET']).has(node.type);

  if (!imageLikeType || (!hasImageFill && !imageLikeName)) {
    return;
  }

  if (node.pluginData['decorative'] === 'true' || hasAccessibleText(node)) {
    return;
  }

  addFinding(context, {
    ruleId: 'ariada.design.text-alternative.missing',
    wcag: 'WCAG 1.1.1 Non-text Content',
    severity: 'error',
    node,
    message: `${node.name} looks like meaningful imagery but has no alt or description metadata.`,
    help: 'Add plugin data keys alt, aria-label, or description, or mark decorative=true.',
    metrics: { hasImageFill, imageLikeName },
  });
}

function checkStructure(node: DesignNode, context: ScanContext): void {
  const role = normalizedRole(node);
  const genericName = GENERIC_FRAME_NAMES.has(node.name.trim().toLowerCase());

  if ((role === 'main' || role === 'navigation' || role === 'banner' || role === 'contentinfo') && genericName) {
    addFinding(context, {
      ruleId: 'ariada.design.landmark.name',
      wcag: 'WCAG 1.3.1 Info and Relationships',
      severity: 'warning',
      node,
      message: `${node.name} uses landmark role ${role} but still has a generic layer name.`,
      help: 'Rename landmark frames with purpose, such as Main content or Primary navigation.',
      metrics: { role },
    });
  }

  const headingLevel = headingLevelFor(node);
  if (headingLevel > 0 && !hasAccessibleText(node) && node.characters === undefined) {
    addFinding(context, {
      ruleId: 'ariada.design.heading.label',
      wcag: 'WCAG 2.4.6 Headings and Labels',
      severity: 'warning',
      node,
      message: `${node.name} is marked as heading level ${headingLevel} without text or label metadata.`,
      help: 'Keep heading text in the layer or add aria-label metadata for exported components.',
      metrics: { headingLevel },
    });
  }
}

function addFinding(
  context: ScanContext,
  input: Omit<AriadaDesignFinding, 'id' | 'nodeId' | 'nodeName'> & { node: DesignNode },
): void {
  const { node, ...rest } = input;
  context.findings.push({
    id: `${rest.ruleId}:${node.id}`,
    nodeId: node.id,
    nodeName: node.name,
    ...rest,
  });
}

function contrastRatio(foreground: RgbaColor, background: RgbaColor): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RgbaColor): number {
  const channel = (value: number): number => {
    const normalized = clamp01(value);
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function firstSolidColor(paints: DesignPaint[]): RgbaColor | undefined {
  const solid = paints.find((paint) => paint.type === 'SOLID' && paint.visible !== false);
  if (solid?.type !== 'SOLID') {
    return undefined;
  }

  return solid.color;
}

function normalizedRole(node: DesignNode): string {
  return (node.pluginData['role'] ?? '').trim().toLowerCase();
}

function headingLevelFor(node: DesignNode): number {
  const fromData = Number.parseInt(node.pluginData['headingLevel'] ?? '', 10);
  if (Number.isInteger(fromData) && fromData >= 1 && fromData <= 6) {
    return fromData;
  }

  const match = /(?:^|\b)h([1-6])(?:\b|$)/i.exec(node.name);
  if (match?.[1] === undefined) {
    return 0;
  }

  return Number.parseInt(match[1], 10);
}

function hasAccessibleText(node: DesignNode): boolean {
  return ['alt', 'aria-label', 'description']
    .map((key) => node.pluginData[key])
    .some((value) => value !== undefined && value.trim().length > 0);
}

function parsePaints(input: unknown): DesignPaint[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item): DesignPaint[] => {
    if (!isRecord(item)) {
      return [];
    }

    const type = readString(item, 'type');
    const visible = readOptionalBoolean(item, 'visible', true);
    if (type === 'SOLID') {
      return [
        {
          type,
          color: parseColor(item['color']),
          opacity: readOptionalNumber(item, 'opacity'),
          visible,
        },
      ];
    }

    if (type === 'IMAGE') {
      return [{ type, visible }];
    }

    if (type.startsWith('GRADIENT')) {
      return [{ type: 'GRADIENT', visible }];
    }

    return [{ type: 'OTHER', visible }];
  });
}

function parseColor(input: unknown): RgbaColor {
  if (!isRecord(input)) {
    throw new TypeError('Paint color must be an object.');
  }

  return {
    r: readNumber(input, 'r'),
    g: readNumber(input, 'g'),
    b: readNumber(input, 'b'),
    a: readOptionalNumber(input, 'a'),
  };
}

function parsePluginData(input: unknown): Record<string, string> {
  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value]),
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new TypeError(`${key} must be a string.`);
  }

  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${key} must be a finite number.`);
  }

  return value;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
