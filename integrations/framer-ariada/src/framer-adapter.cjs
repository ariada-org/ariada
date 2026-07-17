'use strict';

const { auditDesignNodes } = require('./audit.cjs');

async function auditFramerCanvas(framerApi) {
  const nodes = await readCurrentFramerNodes(framerApi);
  return auditDesignNodes(nodes);
}

async function readCurrentFramerNodes(framerApi) {
  if (!framerApi || typeof framerApi !== 'object') {
    throw new Error('Framer Plugin API is not available.');
  }

  if (typeof framerApi.getSelection === 'function') {
    const selection = await framerApi.getSelection();
    if (Array.isArray(selection) && selection.length > 0) {
      return Promise.all(selection.map(toDesignNode));
    }
  }

  if (typeof framerApi.getCurrentPage === 'function') {
    const page = await framerApi.getCurrentPage();
    if (page) return [await toDesignNode(page)];
  }

  if (typeof framerApi.getCanvasRoot === 'function') {
    const root = await framerApi.getCanvasRoot();
    if (root) return [await toDesignNode(root)];
  }

  throw new Error('No selected frame or readable current page was exposed by the Framer Plugin API.');
}

async function toDesignNode(node) {
  const children = await readChildren(node);
  const style = node.style || {};
  const bounds = await readBounds(node);

  return {
    ariadaAltText: readMetadata(node, 'ariadaAltText') || readMetadata(node, 'alt') || readMetadata(node, 'description'),
    children,
    fills: normalizeFills(node.fills || style.fills || node.background || style.background),
    fontSize: readNumber(node.fontSize ?? style.fontSize, 16),
    hasFlow: Boolean(node.link || node.href || node.onTap || readMetadata(node, 'href')),
    height: readNumber(node.height ?? bounds.height, 0),
    id: String(node.id || ''),
    name: String(node.name || node.title || ''),
    textColor: node.textColor || node.color || style.color,
    type: String(node.type || node.kind || ''),
    width: readNumber(node.width ?? bounds.width, 0)
  };
}

async function readChildren(node) {
  const directChildren = node.children;
  if (Array.isArray(directChildren)) return Promise.all(directChildren.map(toDesignNode));
  if (typeof node.getChildren === 'function') {
    const children = await node.getChildren();
    if (Array.isArray(children)) return Promise.all(children.map(toDesignNode));
  }
  return [];
}

async function readBounds(node) {
  if (node.bounds && typeof node.bounds === 'object') return node.bounds;
  if (node.frame && typeof node.frame === 'object') return node.frame;
  if (typeof node.getRect === 'function') return node.getRect();
  if (typeof node.getBounds === 'function') return node.getBounds();
  return {};
}

function normalizeFills(rawFills) {
  const fills = Array.isArray(rawFills) ? rawFills : rawFills ? [rawFills] : [];
  return fills.map((fill) => {
    if (typeof fill === 'string') {
      return { color: fill, type: 'SOLID', visible: true };
    }
    return {
      color: fill.color || fill.value,
      type: fill.type || (fill.image ? 'IMAGE' : 'SOLID'),
      visible: fill.visible !== false
    };
  });
}

function readMetadata(node, key) {
  if (node.metadata && typeof node.metadata[key] === 'string') return node.metadata[key];
  if (node.pluginData && typeof node.pluginData[key] === 'string') return node.pluginData[key];
  if (typeof node.getPluginData === 'function') return node.getPluginData(key);
  return '';
}

function readNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

module.exports = {
  auditFramerCanvas,
  readCurrentFramerNodes,
  toDesignNode
};
