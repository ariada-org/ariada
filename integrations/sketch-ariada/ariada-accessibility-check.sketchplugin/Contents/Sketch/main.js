'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */
/* global module, require */

const sketch = require('sketch/dom');
const Settings = require('sketch/settings');
const UI = require('sketch/ui');

const { auditSelection, formatIssueList } = require('./audit');

/**
 *
 */
function onRun() {
  const document = sketch.getSelectedDocument();
  if (!document) {
    UI.message('Ariada: open a document before running the selection audit.');
    return;
  }

  const selectedLayers = document.selectedLayers && document.selectedLayers.layers ? document.selectedLayers.layers : [];
  if (selectedLayers.length === 0) {
    UI.message('Ariada: select one or more layers or artboards first.');
    return;
  }

  const result = auditSelection(selectedLayers.map(toDesignNode));
  const title = result.issues.length === 0 ? 'Ariada selection audit' : `Ariada found ${result.issues.length} issue(s)`;

  UI.alert(title, formatIssueList(result));
  UI.message(`Ariada checked ${result.scannedNodes} layer(s), ${result.issues.length} issue(s).`, document);
}

/**
 *
 */
function toDesignNode(layer) {
  const frame = layer.frame || {};
  return {
    altText: getLayerAltText(layer),
    children: (layer.layers || []).map(toDesignNode),
    fills: getFills(layer),
    fontSize: getFontSize(layer),
    hasFlow: Boolean(layer.flow && layer.flow.targetId),
    height: Number(frame.height) || 0,
    id: layer.id || '',
    name: layer.name || '',
    textColor: getTextColor(layer),
    type: layer.type || '',
    width: Number(frame.width) || 0
  };
}

function getLayerAltText(layer) {
  return Settings.layerSettingForKey(layer, 'ariada.altText') || Settings.layerSettingForKey(layer, 'altText') || '';
}

function getTextColor(layer) {
  if (layer.type !== 'Text' || !layer.style) return undefined;
  return layer.style.textColor;
}

function getFontSize(layer) {
  if (layer.type !== 'Text' || !layer.style) return undefined;
  return typeof layer.style.fontSize === 'number' ? layer.style.fontSize : undefined;
}

function getFills(layer) {
  if (!layer.style || !Array.isArray(layer.style.fills)) return [];

  const fills = [];
  for (const fill of layer.style.fills) {
    if (!fill || fill.enabled === false) continue;

    if (isSolidFill(fill)) {
      fills.push({
        color: fill.color,
        type: 'SOLID',
        visible: true
      });
    } else if (isImageFill(fill)) {
      fills.push({
        type: 'IMAGE',
        visible: true
      });
    }
  }
  return fills;
}

function isSolidFill(fill) {
  return fill.fillType === 'Color' || fill.type === 'Color' || (typeof fill.color === 'string' && !isImageFill(fill));
}

function isImageFill(fill) {
  return fill.fillType === 'Pattern' || fill.type === 'Pattern' || fill.image || fill.pattern;
}

module.exports = {
  onRun,
  toDesignNode
};
