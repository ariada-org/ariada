import { scanDesignSelection, type DesignNode, type DesignPaint } from './scanner.js';

declare const __html__: string;

const pluginDataKeys = ['role', 'alt', 'aria-label', 'description', 'decorative', 'headingLevel'];

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });
postSelectionScan();

figma.on('selectionchange', () => {
  postSelectionScan();
});

figma.ui.onmessage = (message: unknown): void => {
  if (!isRecord(message)) {
    return;
  }

  if (message['type'] === 'scan-selection') {
    postSelectionScan();
  }

  if (message['type'] === 'close-plugin') {
    figma.closePlugin();
  }
};

function postSelectionScan(): void {
  const selection = figma.currentPage.selection.map(toDesignNode);
  const result = scanDesignSelection(selection);
  figma.ui.postMessage({ type: 'scan-result', result });
}

function toDesignNode(node: SceneNode): DesignNode {
  const children = 'children' in node ? node.children.map(toDesignNode) : [];

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: typeof node.width === 'number' ? node.width : 0,
    height: typeof node.height === 'number' ? node.height : 0,
    visible: typeof node.visible === 'boolean' ? node.visible : true,
    fills: readPaints(node, 'fills'),
    strokes: readPaints(node, 'strokes'),
    characters: 'characters' in node && typeof node.characters === 'string' ? node.characters : undefined,
    fontSize: readFontSize(node),
    pluginData: readPluginData(node),
    children,
  };
}

function readPaints(node: SceneNode, key: 'fills' | 'strokes'): DesignPaint[] {
  let paints: unknown = [];
  if (key === 'fills' && 'fills' in node) {
    paints = node.fills;
  } else if (key === 'strokes' && 'strokes' in node) {
    paints = node.strokes;
  }
  if (!Array.isArray(paints)) {
    return [];
  }

  return paints.flatMap((paint): DesignPaint[] => {
    if (paint.visible === false) {
      return [];
    }

    if (paint.type === 'SOLID') {
      return [
        {
          type: 'SOLID',
          color: paint.color,
          opacity: paint.opacity,
          visible: paint.visible,
        },
      ];
    }

    if (paint.type === 'IMAGE') {
      return [{ type: 'IMAGE', visible: paint.visible }];
    }

    if (paint.type.startsWith('GRADIENT')) {
      return [{ type: 'GRADIENT', visible: paint.visible }];
    }

    return [{ type: 'OTHER', visible: paint.visible }];
  });
}

function readFontSize(node: SceneNode): number | undefined {
  return typeof node.fontSize === 'number' ? node.fontSize : undefined;
}

function readPluginData(node: SceneNode): Record<string, string> {
  return Object.fromEntries(
    pluginDataKeys
      .map((key) => ({ key, value: node.getPluginData(key) }))
      .filter((entry) => entry.value.trim().length > 0)
      .map((entry) => [entry.key, entry.value]),
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
