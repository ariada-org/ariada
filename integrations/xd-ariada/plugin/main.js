// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* global require, module */

let panel;

function createPanel() {
  const root = document.createElement('div');
  root.innerHTML = `
    <style>
      body{font-family:system-ui,sans-serif;color:#1f2937}
      .ariada-panel{padding:12px;min-width:280px}
      .ariada-panel h1{font-size:18px;margin:0 0 8px}
      .ariada-panel p{font-size:12px;line-height:1.45;margin:0 0 10px}
      .ariada-panel button{background:#1f6feb;color:white;border:0;border-radius:4px;padding:7px 10px;font:inherit}
      .ariada-panel pre{white-space:pre-wrap;background:#f3f4f6;border:1px solid #d1d5db;padding:8px;max-height:220px;overflow:auto}
    </style>
    <section class="ariada-panel">
      <h1>Ariada XD export</h1>
      <p>Exports the selected XD artboard as JSON for the local Ariada CLI export-and-scan adapter.</p>
      <button id="ariada-export">Prepare scan export</button>
      <pre id="ariada-output">Select an artboard or layer group, then prepare an export.</pre>
    </section>
  `;
  root.querySelector('#ariada-export').addEventListener('click', () => {
    const output = root.querySelector('#ariada-output');
    try {
      output.textContent = JSON.stringify(readSelection(), null, 2);
    } catch (error) {
      output.textContent = `Ariada export failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  return root;
}

function readSelection() {
  const scenegraph = require('scenegraph');
  const selection = scenegraph.selection;
  const items = Array.from(selection.items || []);
  return {
    name: 'Adobe XD Ariada panel export',
    width: 960,
    height: 640,
    background: '#ffffff',
    children: items.map(toNode),
  };
}

function toNode(item) {
  const bounds = item.globalBounds || item.localBounds || {};
  return {
    id: item.guid || '',
    name: item.name || item.constructor?.name || 'XD layer',
    type: item.constructor?.name || 'SceneNode',
    text: item.text || '',
    textColor: item.styleRanges?.[0]?.fill || item.fill || undefined,
    fill: item.fill || undefined,
    fontSize: item.styleRanges?.[0]?.fontSize || undefined,
    bounds: {
      x: Number(bounds.x) || 0,
      y: Number(bounds.y) || 0,
      width: Number(bounds.width) || 1,
      height: Number(bounds.height) || 1,
    },
    children: Array.from(item.children || []).map(toNode),
  };
}

module.exports = {
  panels: {
    ariadaPanel: {
      show(event) {
        if (!panel) panel = createPanel();
        event.node.appendChild(panel);
      },
    },
  },
};
