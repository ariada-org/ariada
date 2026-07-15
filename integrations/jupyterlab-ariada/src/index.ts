type NotebookPanel = {
  context: {
    model: {
      toJSON(): unknown;
    };
  };
};

type JupyterFrontEnd = {
  commands: {
    addCommand(id: string, options: { label: string; execute: () => Promise<void> }): void;
  };
  shell: {
    currentWidget: unknown;
  };
};

type AriadaScanResponse = {
  totalFindings: number;
  exitCode: number;
  reportPath?: string;
};

function isNotebookPanel(widget: unknown): widget is NotebookPanel {
  const candidate = widget as NotebookPanel;
  return typeof candidate?.context?.model?.toJSON === 'function';
}

async function scanActiveNotebook(app: JupyterFrontEnd): Promise<void> {
  const widget = app.shell.currentWidget;
  if (!isNotebookPanel(widget)) {
    window.alert('Open a notebook before running Ariada.');
    return;
  }

  const response = await fetch('/ariada/scan-notebook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      notebook: widget.context.model.toJSON(),
      noFail: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Ariada scan failed: HTTP ${response.status}`);
  }
  const result = (await response.json()) as AriadaScanResponse;
  window.alert(
    `Ariada found ${result.totalFindings} issue(s); exit ${result.exitCode}. ` +
      `Report: ${result.reportPath ?? 'not written'}`,
  );
}

const plugin = {
  id: 'jupyterlab-ariada:plugin',
  autoStart: true,
  activate(app: JupyterFrontEnd): void {
    app.commands.addCommand('ariada:scan-notebook-output', {
      label: 'Scan notebook output for accessibility',
      execute: async () => scanActiveNotebook(app),
    });
  },
};

export default plugin;
