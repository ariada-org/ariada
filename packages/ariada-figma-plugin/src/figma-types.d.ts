type FigmaRgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

type FigmaPaint =
  | {
      readonly type: 'SOLID';
      readonly color: FigmaRgb;
      readonly opacity?: number;
      readonly visible?: boolean;
    }
  | {
      readonly type: 'IMAGE';
      readonly visible?: boolean;
    }
  | {
      readonly type: string;
      readonly visible?: boolean;
    };

type SceneNode = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly width?: number;
  readonly height?: number;
  readonly visible?: boolean;
  readonly fills?: ReadonlyArray<FigmaPaint> | symbol;
  readonly strokes?: ReadonlyArray<FigmaPaint> | symbol;
  readonly children?: ReadonlyArray<SceneNode>;
  readonly characters?: string;
  readonly fontSize?: number | symbol;
  getPluginData(key: string): string;
};

declare const figma: {
  readonly currentPage: {
    readonly selection: ReadonlyArray<SceneNode>;
  };
  readonly ui: {
    onmessage: (message: unknown) => void;
    postMessage(message: unknown): void;
  };
  showUI(html: string, options: { readonly width: number; readonly height: number; readonly themeColors: boolean }): void;
  on(event: 'selectionchange', callback: () => void): void;
  closePlugin(): void;
};
