'use strict';

const BACKGROUND_NODE_TYPES = new Set(['Frame', 'Page', 'Section', 'Stack', 'Group', 'Component', 'Instance']);
const IMAGE_NODE_TYPES = new Set(['Image', 'Picture', 'SVG']);
const INTERACTIVE_NAME_PATTERN = /\b(button|checkbox|close|control|field|hotspot|icon|input|link|menu|radio|switch|tab)\b/i;

function auditDesignNodes(nodes, options = {}) {
  const settings = {
    minTargetSize: 44,
    minimumTargetSize: 24,
    ...options
  };
  const issues = [];
  let scannedNodes = 0;

  for (const node of nodes) {
    walk(normalizeNode(node), undefined, []);
  }

  return {
    issues,
    scannedNodes,
    summary: summarize(issues)
  };

  function walk(node, inheritedBackground, path) {
    scannedNodes += 1;
    const currentPath = [...path, node.name || node.id || node.type || 'node'];
    issues.push(...auditNode(node, inheritedBackground, settings, currentPath));

    const childBackground = backgroundForChildren(node, inheritedBackground);
    for (const child of node.children) {
      walk(normalizeNode(child), childBackground, currentPath);
    }
  }
}

function auditNode(node, background, settings, path = []) {
  const issues = [];
  const textColor = parseColor(node.textColor) || firstSolidFill(node);

  if (node.type === 'Text' && textColor && background) {
    const threshold = node.fontSize >= 24 ? 3 : 4.5;
    const ratio = contrastRatio(textColor, background);
    if (ratio < threshold) {
      issues.push(makeIssue(
        node,
        path,
        'contrast',
        'serious',
        `Text contrast is ${ratio.toFixed(2)}:1.`,
        `Raise contrast to at least ${threshold}:1 by changing text or background color.`
      ));
    }
  }

  if (isInteractive(node)) {
    if (node.width < settings.minimumTargetSize || node.height < settings.minimumTargetSize) {
      issues.push(makeIssue(
        node,
        path,
        'target-size',
        'serious',
        `Interactive target is ${round(node.width)} by ${round(node.height)} px.`,
        `Increase the hit area to at least ${settings.minTargetSize} by ${settings.minTargetSize} px.`
      ));
    } else if (node.width < settings.minTargetSize || node.height < settings.minTargetSize) {
      issues.push(makeIssue(
        node,
        path,
        'target-size',
        'moderate',
        `Interactive target is below ${settings.minTargetSize} by ${settings.minTargetSize} px.`,
        'Keep the visual layer if needed, but wrap it in a larger tappable group or hotspot.'
      ));
    }
  }

  if (isImageLike(node) && !hasTextAlternative(node)) {
    issues.push(makeIssue(
      node,
      path,
      'text-alternative',
      'serious',
      'Image-like layer has no text alternative marker.',
      'Add an "Alt: ..." node name, set ariadaAltText metadata, or mark the node "Decorative: ...".'
    ));
  }

  return issues;
}

function normalizeNode(node) {
  const bounds = node.bounds || node.frame || {};
  return {
    ariadaAltText: stringOrEmpty(node.ariadaAltText || node.altText || node.description),
    children: Array.isArray(node.children) ? node.children : [],
    fills: Array.isArray(node.fills) ? node.fills : [],
    fontSize: finiteNumber(node.fontSize, 16),
    hasFlow: Boolean(node.hasFlow || node.link || node.href || node.onTap),
    height: finiteNumber(node.height ?? bounds.height, 0),
    id: stringOrEmpty(node.id),
    name: stringOrEmpty(node.name),
    textColor: node.textColor || node.color,
    type: stringOrEmpty(node.type),
    width: finiteNumber(node.width ?? bounds.width, 0)
  };
}

function backgroundForChildren(node, inheritedBackground) {
  if (!BACKGROUND_NODE_TYPES.has(node.type)) return inheritedBackground;
  return firstSolidFill(node) || inheritedBackground;
}

function firstSolidFill(node) {
  for (const fill of node.fills) {
    if (fill && fill.visible !== false && (fill.type === 'SOLID' || fill.type === 'color')) {
      return parseColor(fill.color || fill.value);
    }
  }
  return undefined;
}

function parseColor(value) {
  if (!value) return undefined;
  if (typeof value === 'object') {
    const red = numberChannel(value.r ?? value.red);
    const green = numberChannel(value.g ?? value.green);
    const blue = numberChannel(value.b ?? value.blue);
    if (red !== undefined && green !== undefined && blue !== undefined) {
      return { b: blue, g: green, r: red };
    }
    return undefined;
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const hex = trimmed.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    return {
      b: Number.parseInt(hex[1].slice(4, 6), 16) / 255,
      g: Number.parseInt(hex[1].slice(2, 4), 16) / 255,
      r: Number.parseInt(hex[1].slice(0, 2), 16) / 255
    };
  }

  const rgb = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i);
  if (!rgb) return undefined;
  return {
    b: Number(rgb[3]) / 255,
    g: Number(rgb[2]) / 255,
    r: Number(rgb[1]) / 255
  };
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color) {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

function linearize(value) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function isInteractive(node) {
  return Boolean(node.hasFlow) || INTERACTIVE_NAME_PATTERN.test(node.name);
}

function isImageLike(node) {
  return IMAGE_NODE_TYPES.has(node.type) || node.fills.some((fill) => fill && fill.visible !== false && fill.type === 'IMAGE');
}

function hasTextAlternative(node) {
  return Boolean(node.ariadaAltText.trim()) || /\b(alt|decorative):/i.test(node.name);
}

function makeIssue(node, path, rule, severity, message, remediation) {
  return {
    id: `${rule}:${node.id || node.name}`,
    message,
    nodeId: node.id,
    nodeName: node.name || '(unnamed node)',
    path: path.join(' > '),
    remediation,
    rule,
    severity
  };
}

function summarize(issues) {
  return issues.reduce(
    (summary, issue) => {
      summary[issue.severity] += 1;
      return summary;
    },
    { minor: 0, moderate: 0, serious: 0 }
  );
}

function formatIssueList(result) {
  if (result.issues.length === 0) {
    return `Ariada checked ${result.scannedNodes} Framer node(s). No design-time issues found.`;
  }

  const lines = [
    `Ariada found ${result.issues.length} issue(s) in ${result.scannedNodes} Framer node(s).`,
    ''
  ];
  for (const issue of result.issues.slice(0, 12)) {
    lines.push(`- [${issue.severity}] ${issue.nodeName}: ${issue.message} ${issue.remediation}`);
  }
  if (result.issues.length > 12) {
    lines.push(`- ${result.issues.length - 12} more issue(s) not shown.`);
  }
  return lines.join('\n');
}

function numberChannel(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value > 1 ? Math.max(0, Math.min(255, value)) / 255 : Math.max(0, Math.min(1, value));
}

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function round(value) {
  return Math.round(value * 10) / 10;
}

module.exports = {
  auditDesignNodes,
  auditNode,
  contrastRatio,
  formatIssueList,
  normalizeNode,
  parseColor
};
