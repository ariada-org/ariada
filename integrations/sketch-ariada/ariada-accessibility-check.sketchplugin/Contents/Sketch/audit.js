'use strict';

/* global module */

const BACKGROUND_LAYER_TYPES = new Set(['Artboard', 'Group', 'Shape', 'ShapePath', 'SymbolInstance']);
const IMAGE_LAYER_TYPES = new Set(['Image']);

/**
 *
 */
function auditSelection(nodes, options) {
  const settings = {
    minTargetSize: 44,
    minimumTargetSize: 24,
    ...options
  };
  const issues = [];
  let scannedNodes = 0;

  for (const node of nodes) {
    walk(node, undefined);
  }

  return {
    issues,
    scannedNodes,
    summary: summarize(issues)
  };

  function walk(node, inheritedBackground) {
    scannedNodes += 1;
    issues.push(...auditNode(node, inheritedBackground, settings));

    const childBackground = backgroundForChildren(node, inheritedBackground);
    for (const child of node.children || []) {
      walk(child, childBackground);
    }
  }
}

/**
 *
 */
function auditNode(node, background, settings) {
  const issues = [];
  const textColor = parseColor(node.textColor) || firstSolidFill(node);

  if (node.type === 'Text' && textColor && background) {
    const threshold = (node.fontSize || 16) >= 24 ? 3 : 4.5;
    const ratio = contrastRatio(textColor, background);
    if (ratio < threshold) {
      issues.push(makeIssue(
        node,
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
        'target-size',
        'serious',
        `Interactive target is ${round(node.width)} by ${round(node.height)} px.`,
        `Increase the hit area to at least ${settings.minTargetSize} by ${settings.minTargetSize} px.`
      ));
    } else if (node.width < settings.minTargetSize || node.height < settings.minTargetSize) {
      issues.push(makeIssue(
        node,
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
      'text-alternative',
      'serious',
      'Image-like layer has no text alternative marker.',
      'Add an "Alt: ..." layer name, set ariada.altText plugin data, or mark the layer "Decorative: ...".'
    ));
  }

  return issues;
}

function backgroundForChildren(node, inheritedBackground) {
  if (!BACKGROUND_LAYER_TYPES.has(node.type)) return inheritedBackground;
  return firstSolidFill(node) || inheritedBackground;
}

function makeIssue(node, rule, severity, message, remediation) {
  return {
    id: `${rule}:${node.id || node.name}`,
    message,
    nodeId: node.id || '',
    nodeName: node.name || '(unnamed layer)',
    remediation,
    rule,
    severity
  };
}

function firstSolidFill(node) {
  for (const fill of node.fills || []) {
    if (fill && fill.visible !== false && fill.type === 'SOLID') {
      return parseColor(fill.color);
    }
  }
  return undefined;
}

/**
 *
 */
function parseColor(value) {
  if (!value) return undefined;
  if (typeof value === 'object') {
    const red = numberChannel(value.r);
    const green = numberChannel(value.g);
    const blue = numberChannel(value.b);
    if (red !== undefined && green !== undefined && blue !== undefined) {
      return { b: blue, g: green, r: red };
    }
    return undefined;
  }
  if (typeof value !== 'string') return undefined;

  const match = value.trim().match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!match) return undefined;
  const hex = match[1];
  return {
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    r: Number.parseInt(hex.slice(0, 2), 16) / 255
  };
}

function numberChannel(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
}

/**
 *
 */
function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color) {
  const red = linearize(color.r);
  const green = linearize(color.g);
  const blue = linearize(color.b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function linearize(value) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function isInteractive(node) {
  return Boolean(node.hasFlow) || /\b(button|checkbox|close|control|field|hotspot|icon|input|link|menu|radio|switch|tab)\b/i.test(node.name || '');
}

function isImageLike(node) {
  return IMAGE_LAYER_TYPES.has(node.type) || (node.fills || []).some((fill) => fill.type === 'IMAGE' && fill.visible !== false);
}

function hasTextAlternative(node) {
  return Boolean(String(node.altText || '').trim()) || /\b(alt|decorative):/i.test(node.name || '');
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

/**
 *
 */
function formatIssueList(result) {
  if (result.issues.length === 0) {
    return `Ariada checked ${result.scannedNodes} selected layer(s). No design-time issues found.`;
  }

  const lines = [
    `Ariada found ${result.issues.length} issue(s) in ${result.scannedNodes} selected layer(s).`,
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

function round(value) {
  return Math.round(value * 10) / 10;
}

module.exports = {
  auditNode,
  auditSelection,
  contrastRatio,
  formatIssueList,
  parseColor
};
