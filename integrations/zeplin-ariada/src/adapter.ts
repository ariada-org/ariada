import type { AriadaFindingLike, AriadaScanEnvelope, ZeplinLayer, ZeplinPanelResult, ZeplinSnapshot, ZeplinTextStyle } from './types.js';

function esc(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function cssColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{3,8}$/i.test(value) ? value : fallback;
}

function style(snapshot: ZeplinSnapshot, name: string | undefined): ZeplinTextStyle | undefined {
  return snapshot.textStyles.find((item) => item.name === name);
}

function flatten(layers: readonly ZeplinLayer[]): ZeplinLayer[] {
  return layers.flatMap((layer) => [layer, ...(layer.children ? flatten(layer.children) : [])]);
}

function renderLayer(snapshot: ZeplinSnapshot, layer: ZeplinLayer): string {
  const textStyle = style(snapshot, layer.textStyleName);
  const width = Math.max(32, layer.width ?? 280);
  const height = Math.max(24, layer.height ?? 56);
  const background = cssColor(layer.backgroundColor ?? textStyle?.backgroundColor, '#ffffff');
  const foreground = cssColor(layer.color ?? textStyle?.color, '#1d2433');
  const fontSize = textStyle?.fontSize ?? 16;
  const fontFamily = textStyle?.fontFamily ?? 'Inter, system-ui, sans-serif';
  const fontWeight = textStyle?.fontWeight ?? 400;
  if (layer.type === 'text') {
    return `<section class="handoff-layer" aria-label="${esc(layer.name)}" style="background:${background};width:${width}px;min-height:${height}px"><p style="color:${foreground};font:${fontWeight} ${fontSize}px/1.35 ${fontFamily}">${esc(layer.text ?? layer.name)}</p><small>Zeplin text layer: ${esc(layer.name)}</small></section>`;
  }
  if (layer.type === 'image') {
    return `<section class="handoff-layer image-layer" aria-label="${esc(layer.name)}" style="width:${width}px;min-height:${height}px"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23e8edf4'/%3E%3Ctext x='20' y='68' font-size='20' fill='%23515c6f'%3EZeplin image export%3C/text%3E%3C/svg%3E"><small>Image layer from Zeplin: ${esc(layer.name)}</small></section>`;
  }
  const children = layer.children?.map((child) => renderLayer(snapshot, child)).join('\n') ?? '';
  return `<section class="handoff-layer" aria-label="${esc(layer.name)}" style="background:${background};width:${width}px;min-height:${height}px"><strong>${esc(layer.name)}</strong>${children}</section>`;
}

export function renderZeplinScanTarget(snapshot: ZeplinSnapshot): string {
  const swatches = snapshot.colors.map((color) => `<li><span class="swatch" style="background:${cssColor(color.hex, '#777777')}"></span>${esc(color.name)} <code>${esc(color.hex)}</code></li>`).join('\n');
  const textRows = snapshot.textStyles.map((item) => `<tr><th scope="row">${esc(item.name)}</th><td>${esc(item.fontFamily)}</td><td>${item.fontSize}px</td><td><code>${esc(item.color)}</code> on <code>${esc(item.backgroundColor ?? '#ffffff')}</code></td></tr>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ariada Zeplin scan target</title><style>body{margin:0;background:#f5f7fb;color:#1d2433;font:16px/1.5 Inter,system-ui,sans-serif}main{max-width:1120px;margin:0 auto;padding:28px}.panel{background:#fff;border:1px solid #d8dde8;border-radius:8px;padding:18px;margin:0 0 18px}.grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(360px,1.4fr);gap:18px;align-items:start}.swatches{list-style:none;margin:0;padding:0;display:grid;gap:8px}.swatch{display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid #aeb7c6;margin-right:8px;vertical-align:middle}.handoff-layer{box-sizing:border-box;border:1px dashed #aeb7c6;border-radius:8px;padding:12px;margin:10px 0}.handoff-layer p{margin:0 0 8px}.image-layer img{display:block;max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d8dde8;padding:8px;text-align:left}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}</style></head><body><main><h1>Ariada Zeplin extension-panel fixture</h1><p>This page is generated from Zeplin handoff data and scanned by <code>@ariada-org/cli</code>. The adapter does not implement WCAG rules locally.</p><section class="grid"><aside class="panel"><h2>Zeplin project</h2><p><strong>${esc(snapshot.projectName)}</strong><br>${esc(snapshot.screenName)}<br>Source: ${esc(snapshot.source)}</p><h3>Color tokens</h3><ul class="swatches">${swatches}</ul></aside><section class="panel"><h2>Exported layer surface</h2>${snapshot.layers.map((layer) => renderLayer(snapshot, layer)).join('\n')}</section></section><section class="panel"><h2>Text styles exported from Zeplin</h2><table><thead><tr><th>Style</th><th>Font</th><th>Size</th><th>Color pair</th></tr></thead><tbody>${textRows}</tbody></table></section></main></body></html>`;
}

export function buildZeplinExtensionSnippet(snapshot: ZeplinSnapshot): { code: string; language: 'json' } {
  const layers = flatten(snapshot.layers);
  return { language: 'json', code: JSON.stringify({ project: snapshot.projectName, screen: snapshot.screenName, exportedLayers: layers.length, textLayers: layers.filter((layer) => layer.type === 'text').length, nextStep: 'Export this Zeplin handoff fixture and run ariada-zeplin scan-fixture to invoke @ariada-org/cli.' }, null, 2) };
}

function findings(envelope: AriadaScanEnvelope): AriadaFindingLike[] {
  const found = envelope.report?.findings;
  return !found ? [] : Array.isArray(found) ? [...found] : Object.values(found).flat();
}

export function summarizeAriadaScan(snapshot: ZeplinSnapshot, envelope?: AriadaScanEnvelope): ZeplinPanelResult {
  if (!envelope) return { title: `Ariada evidence for ${snapshot.screenName}`, status: 'needs-scan', totalFindings: 0, contrastFindings: 0, copy: ['Run the exported fixture through @ariada-org/cli before treating this Zeplin panel as an accessibility verdict.'] };
  const flat = findings(envelope);
  const contrastFindings = flat.filter((finding) => /contrast/i.test(`${finding.ruleId ?? ''} ${finding.message ?? ''}`)).length;
  const totalFindings = envelope.summary?.total ?? flat.length;
  return { title: `Ariada evidence for ${snapshot.screenName}`, status: totalFindings > 0 ? 'fail' : 'pass', totalFindings, contrastFindings, copy: [`${totalFindings} finding(s) came from the shared @ariada-org/cli scan output.`, `${contrastFindings} finding(s) are contrast-related and map back to Zeplin colors/text styles.`] };
}
