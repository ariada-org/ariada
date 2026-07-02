import { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan } from './adapter.js';
import type { ZeplinLayer } from './types.js';
export declare function layer(context: Record<string, unknown>, selectedLayer: ZeplinLayer): {
    code: string;
    language: "json";
};
export declare function screen(context: Record<string, unknown>, selectedScreen?: {
    layers?: readonly ZeplinLayer[];
}): {
    code: string;
    language: "json";
};
export declare function colors(context: Record<string, unknown>): {
    code: string;
    language: "json";
};
export declare function textStyles(context: Record<string, unknown>): {
    code: string;
    language: "html";
};
export { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan };
export type { AriadaFindingLike, AriadaScanEnvelope, ZeplinColor, ZeplinLayer, ZeplinPanelResult, ZeplinSnapshot, ZeplinTextStyle } from './types.js';
declare const _default: {
    layer: typeof layer;
    screen: typeof screen;
    colors: typeof colors;
    textStyles: typeof textStyles;
};
export default _default;
//# sourceMappingURL=index.d.ts.map