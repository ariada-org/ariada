export interface ZeplinColor {
  readonly name: string;
  readonly hex: string;
}

export interface ZeplinTextStyle {
  readonly name: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight?: number | string;
  readonly color: string;
  readonly backgroundColor?: string;
}

export interface ZeplinLayer {
  readonly id: string;
  readonly name: string;
  readonly type: 'text' | 'rectangle' | 'image' | 'component' | 'group';
  readonly text?: string;
  readonly textStyleName?: string;
  readonly color?: string;
  readonly backgroundColor?: string;
  readonly width?: number;
  readonly height?: number;
  readonly children?: readonly ZeplinLayer[];
}

export interface ZeplinSnapshot {
  readonly projectName: string;
  readonly screenName: string;
  readonly source: 'fixture' | 'zeplin-export' | 'local-extension';
  readonly colors: readonly ZeplinColor[];
  readonly textStyles: readonly ZeplinTextStyle[];
  readonly layers: readonly ZeplinLayer[];
}

export interface AriadaFindingLike {
  readonly ruleId?: string;
  readonly severity?: string;
  readonly message?: string;
}

export interface AriadaScanEnvelope {
  readonly summary?: { readonly total?: number; readonly byImpact?: Record<string, number> };
  readonly report?: { readonly findings?: Record<string, AriadaFindingLike[]> | AriadaFindingLike[] };
  readonly exitCode?: number;
}

export interface ZeplinPanelResult {
  readonly title: string;
  readonly status: 'pass' | 'fail' | 'needs-scan';
  readonly totalFindings: number;
  readonly contrastFindings: number;
  readonly copy: readonly string[];
}
