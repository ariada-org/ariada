# Ariada Streamlit

Streamlit helper package that scans a running Streamlit app URL with the shared Ariada CLI.

The package does not implement accessibility scanning. It passes the served app URL to `@ariada-org/cli` and can render the latest summary inside a Streamlit app when `streamlit` is installed.

## Usage

```bash
streamlit run app.py
streamlit-ariada scan http://localhost:8501 --cli ariada --no-fail
```

Optional in-app summary:

```python
from streamlit_ariada import render_summary

render_summary({"totalFindings": 3, "reportPath": "ariada-output/multi-domain-report.json"})
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Scanning a deployed Streamlit Cloud app requires a deployed app URL and account access. Local served-surface evidence is complete.
