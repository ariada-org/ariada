# Ariada Dash

Dash helper package that scans a running Dash app URL with the shared Ariada CLI.

The package does not implement accessibility scanning. It passes the served app URL to `@ariada-org/cli` and can render the latest summary inside a Dash app when `dash` is installed.

## Minimal Dash app

```python
from dash import Dash, html

app = Dash(__name__)
app.layout = html.Main(
    [
        html.H1("Sales dashboard"),
        html.Img(src="/assets/missing-alt.png"),
        html.Button("", id="empty-action"),
    ]
)

if __name__ == "__main__":
    app.run(debug=True, port=8050)
```

## Usage

```bash
python app.py
dash-ariada scan http://localhost:8050 --cli ariada --no-fail
```

Optional in-app summary:

```python
from dash_ariada import render_summary

app.layout.children.append(
    render_summary({"totalFindings": 3, "reportPath": "ariada-output/multi-domain-report.json"})
)
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Scanning a deployed Dash or Plotly-hosted app requires a deployed app URL and account access. Local served-surface evidence is complete.
