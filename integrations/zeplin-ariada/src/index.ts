import { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan } from './adapter.js';
import type { ZeplinLayer, ZeplinSnapshot, ZeplinTextStyle } from './types.js';

function snapshotFromContext(context: Record<string, unknown>, layers: readonly ZeplinLayer[] = []): ZeplinSnapshot {
  const project = context['project'];
  const screen = context['screen'];
  const styleguide = context['styleguide'];
  const projectName = project && typeof project === 'object' && 'name' in project ? String((project as { name?: unknown }).name) : 'Zeplin project';
  const screenName = screen && typeof screen === 'object' && 'name' in screen ? String((screen as { name?: unknown }).name) : 'Selected screen';
  const textStyles = Array.isArray((styleguide as { textStyles?: unknown } | undefined)?.textStyles) ? (styleguide as { textStyles: ZeplinTextStyle[] }).textStyles : [];
  return { projectName, screenName, source: 'local-extension', colors: [], textStyles, layers };
}

export function layer(context: Record<string, unknown>, selectedLayer: ZeplinLayer) {
  return buildZeplinExtensionSnippet(snapshotFromContext(context, [selectedLayer]));
}

export function screen(context: Record<string, unknown>, selectedScreen?: { layers?: readonly ZeplinLayer[] }) {
  return buildZeplinExtensionSnippet(snapshotFromContext(context, selectedScreen?.layers ?? []));
}

export function colors(context: Record<string, unknown>) {
  return { code: JSON.stringify(summarizeAriadaScan(snapshotFromContext(context)), null, 2), language: 'json' as const };
}

export function textStyles(context: Record<string, unknown>) {
  return { code: renderZeplinScanTarget(snapshotFromContext(context)), language: 'html' as const };
}

export { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan };
export type { AriadaFindingLike, AriadaScanEnvelope, ZeplinColor, ZeplinLayer, ZeplinPanelResult, ZeplinSnapshot, ZeplinTextStyle } from './types.js';
export default { layer, screen, colors, textStyles };
