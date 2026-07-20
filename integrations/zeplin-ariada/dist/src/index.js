import { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan } from './adapter.js';
function snapshotFromContext(context, layers = []) {
    const project = context['project'];
    const screen = context['screen'];
    const styleguide = context['styleguide'];
    const projectName = project && typeof project === 'object' && 'name' in project ? String(project.name) : 'Zeplin project';
    const screenName = screen && typeof screen === 'object' && 'name' in screen ? String(screen.name) : 'Selected screen';
    const textStyles = Array.isArray(styleguide?.textStyles) ? styleguide.textStyles : [];
    return { projectName, screenName, source: 'local-extension', colors: [], textStyles, layers };
}
export function layer(context, selectedLayer) {
    return buildZeplinExtensionSnippet(snapshotFromContext(context, [selectedLayer]));
}
export function screen(context, selectedScreen) {
    return buildZeplinExtensionSnippet(snapshotFromContext(context, selectedScreen?.layers ?? []));
}
export function colors(context) {
    return { code: JSON.stringify(summarizeAriadaScan(snapshotFromContext(context)), null, 2), language: 'json' };
}
export function textStyles(context) {
    return { code: renderZeplinScanTarget(snapshotFromContext(context)), language: 'html' };
}
export { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan };
export default { layer, screen, colors, textStyles };
