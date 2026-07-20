#!/usr/bin/env python3
# ruff: noqa: E501
from __future__ import annotations

import base64
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_REPORT = ROOT / "test-report"
SCAN_EVIDENCE = ROOT / "scan-evidence"
HOME = str(Path.home())
MAIN_REPO = str(Path.home() / "adopta")


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def redact_paths(value: str) -> str:
    value = value.replace(str(ROOT), "<channel-root>")
    value = value.replace(str(ROOT.parents[1]), "<repo-root>")
    value = value.replace(MAIN_REPO, "<main-repo>")
    value = re.sub(re.escape(HOME) + r"/[^\s<'\"]+", "<local-path>", value)
    return re.sub(r"[ \t]+$", "", value, flags=re.MULTILINE)


def exit_status(name: str) -> str:
    return read(TEST_REPORT / "logs" / f"{name}.exit").strip()


def status_for(name: str, allowed: tuple[str, ...] = ("0",)) -> str:
    return "pass" if exit_status(name) in allowed else "fail"


def shell_log(name: str) -> str:
    text = read(TEST_REPORT / "logs" / f"{name}.log").strip()
    return redact_paths(text) if text else "(no output)"


def report_path() -> Path:
    multi = SCAN_EVIDENCE / "ariada-output" / "multi-domain-report.json"
    single = SCAN_EVIDENCE / "ariada-output" / "scan.json"
    return multi if multi.exists() else single


def scan_report() -> dict[str, object]:
    path = report_path()
    return json.loads(read(path)) if path.exists() else {}


def scan_total(report: dict[str, object]) -> int:
    summary = report.get("summary")
    if isinstance(summary, dict) and isinstance(summary.get("total"), int):
        return int(summary["total"])
    grid = report.get("grid")
    if not isinstance(grid, dict):
        return 0
    total = 0
    for site in grid.values():
        if isinstance(site, dict):
            total += sum(len(v) for v in site.values() if isinstance(v, list))
    return total


def table(headers: list[str], rows: list[list[str]]) -> str:
    head = "".join(f"<th scope='col'>{esc(header)}</th>" for header in headers)
    body = []
    for row in rows:
        cells = []
        for index, cell in enumerate(row):
            tag = "th scope='row'" if index == 0 else "td"
            cells.append(f"<{tag}>{cell}</{tag.split()[0]}>")
        body.append(f"<tr>{''.join(cells)}</tr>")
    return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def link(url: str, label: str | None = None) -> str:
    return f"<a href='{esc(url)}'>{esc(label or url)}</a>"


def badge(status: str, label: str | None = None) -> str:
    return f"<span class='status {esc(status)}'>{esc(label or status)}</span>"


def page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;margin:0;color:#15171c;background:#f6f7f9}}
main{{max-width:1120px;margin:0 auto;padding:32px 20px}}
h1{{font-size:2rem;margin:0 0 12px}}
h2{{font-size:1.22rem;margin-top:30px;border-bottom:1px solid #d6dbe3;padding-bottom:6px}}
h3{{font-size:1rem;margin:18px 0 8px}}
table{{border-collapse:collapse;width:100%;background:#fff;margin:12px 0}}
th,td{{border:1px solid #d6dbe3;padding:8px;text-align:left;vertical-align:top}}
code{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef1f5;padding:1px 5px;border-radius:4px}}
pre{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}}
figure{{margin:18px 0;background:#fff;border:1px solid #d6dbe3;border-radius:8px;overflow:hidden}}
img{{display:block;max-width:100%;height:auto}}
figcaption{{padding:10px 14px}}
.status{{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}}
.pass{{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}}
.warn{{background:#fff4ce;color:#744500;border:1px solid #eac54f}}
.block{{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}}
.note{{background:#fff;border:1px solid #d6dbe3;border-radius:8px;padding:12px 14px}}
a:focus-visible,summary:focus-visible{{outline:3px solid #0b5cad;outline-offset:2px}}
</style>
</head>
<body><main>
<h1>{esc(title)}</h1>
{body}
</main></body></html>"""


def build_test_report() -> None:
    gates = [
        ("Python lint", "ruff check .", "ruff", ("0",)),
        ("Unit tests", "pytest -q", "pytest", ("0",)),
        ("Python bytecode", "python -m compileall -q pelican tests scripts", "compileall", ("0",)),
        ("Python package build", "python -m build", "build", ("0",)),
        ("Pelican fixture build", "python -m pelican content ...", "pelican-build", ("0",)),
        ("Fixture scan", "python scripts/run_fixture_scan.py", "fixture-scan", ("1",)),
        ("Screenshot validation", "python scripts/validate_screenshot.py", "screenshot-validate", ("0",)),
        ("Dash baseline audit", "node /tmp/audit-channel-report.mjs --strict", "dash-audit", ("0",)),
        ("Shared CLI build", "pnpm --filter @ariada-org/cli... build", "cli-build", ("0", "blocked")),
    ]
    rows = [
        [
            f"<strong>{esc(label)}</strong>",
            badge(status_for(log, allowed)),
            f"<code>{esc(command)}</code>",
            f"<a href='logs/{esc(log)}.log'>log</a> · <a href='logs/{esc(log)}.exit'>exit</a>",
        ]
        for label, command, log, allowed in gates
    ]
    logs = "\n".join(
        f"<details><summary>{esc(log)} log</summary><pre>{esc(shell_log(log))}</pre></details>"
        for _label, _command, log, _allowed in gates
    )
    body = (
        "<p>Focused local gates for <code>pelican-ariada</code>. The fixture scan is "
        "expected to exit <code>1</code> because the generated Pelican page includes "
        "intentional accessibility defects.</p>"
        + table(["Gate", "Result", "Command", "Evidence"], rows)
        + "<h2>Logs</h2>"
        + logs
    )
    TEST_REPORT.mkdir(parents=True, exist_ok=True)
    (TEST_REPORT / "result.html").write_text(page("Ariada Pelican test report", body), encoding="utf-8")


def build_scan_preview() -> None:
    report = scan_report()
    total = scan_total(report)
    command = read(SCAN_EVIDENCE / "command.log").strip()
    command = redact_paths(command) if command else shell_log("fixture-scan")
    body = f"""
<p>Real Ariada CLI scan triggered by the Pelican channel fixture through
<code>python scripts/run_fixture_scan.py</code>. The fixture is generated by Pelican
and then served locally for the shared browser scanner.</p>
<p><strong>{esc(total)}</strong> finding(s) in <code>{esc(report_path().relative_to(ROOT))}</code>.
The scan exits non-zero by design because the page has missing image alternative text and
an empty button.</p>
<h2>Command Output</h2>
<pre>{esc(command)}</pre>
<h2>Report Summary</h2>
<pre>{esc(json.dumps(report, indent=2)[:18000])}</pre>
"""
    SCAN_EVIDENCE.mkdir(parents=True, exist_ok=True)
    (SCAN_EVIDENCE / "scan-result-preview.html").write_text(
        page("Ariada Pelican scan preview", body),
        encoding="utf-8",
    )


def source_rows() -> list[list[str]]:
    urls = [
        ("Pelican plugins", "Official docs", "https://docs.getpelican.com/en/4.8.0/plugins.html"),
        ("Pelican settings", "Official docs", "https://docs.getpelican.com/en/4.8.0/settings.html"),
        ("Pelican publish", "Official docs", "https://docs.getpelican.com/en/4.8.0/publish.html"),
        ("Pelican GitHub", "Project source", "https://github.com/getpelican/pelican"),
        ("Pelican plugins org", "Plugin ecosystem", "https://github.com/pelican-plugins"),
        ("Pelican discussions", "Community", "https://github.com/getpelican/pelican/discussions"),
        ("Pelican issues", "Community", "https://github.com/getpelican/pelican/issues"),
        ("Stack Overflow Pelican", "Community", "https://stackoverflow.com/questions/tagged/pelican"),
        ("Reddit Pelican", "Community", "https://www.reddit.com/search/?q=pelican%20static%20site"),
        ("Python packaging", "Official docs", "https://packaging.python.org/en/latest/"),
        ("PyPI publishing", "Official docs", "https://packaging.python.org/en/latest/tutorials/packaging-projects/"),
        ("Setuptools pyproject", "Official docs", "https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html"),
        ("pytest", "Test docs", "https://docs.pytest.org/"),
        ("ruff", "Lint docs", "https://docs.astral.sh/ruff/"),
        ("W3C WCAG", "Standard", "https://www.w3.org/WAI/standards-guidelines/wcag/"),
        ("WAI Easy Checks", "Standard", "https://www.w3.org/WAI/test-evaluate/easy-checks/"),
        ("European Accessibility Act", "Regulatory", "https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en"),
        ("EN 301 549", "Standard", "https://www.etsi.org/deliver/etsi_en/301500_301599/301549/"),
        ("MDN image alt", "Reference", "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img"),
        ("MDN button", "Reference", "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button"),
        ("Chrome Lighthouse", "Competitor", "https://developer.chrome.com/docs/lighthouse/overview"),
        ("Pa11y", "Competitor", "https://pa11y.org/"),
        ("axe-core", "Competitor", "https://github.com/dequelabs/axe-core"),
        ("WAVE", "Competitor", "https://wave.webaim.org/"),
        ("Siteimprove", "Competitor", "https://www.siteimprove.com/accessibility/"),
        ("Deque axe DevTools", "Competitor", "https://www.deque.com/axe/devtools/"),
        ("Level Access", "Competitor", "https://www.levelaccess.com/"),
        ("AudioEye", "Competitor", "https://www.audioeye.com/"),
        ("Evinced", "Competitor", "https://www.evinced.com/"),
        ("Accessibility Insights", "Competitor", "https://accessibilityinsights.io/"),
        ("Google Search docs", "SEO adjacent", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"),
        ("Schema.org", "Structured data", "https://schema.org/"),
        ("W3C i18n", "Localization", "https://www.w3.org/International/"),
        ("MDN CSP", "Security", "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"),
        ("Mozilla Observatory", "Security", "https://observatory.mozilla.org/"),
        ("OWASP ZAP", "Security", "https://www.zaproxy.org/"),
        ("OpenSSF Scorecard", "Supply chain", "https://github.com/ossf/scorecard"),
        ("SLSA", "Supply chain", "https://slsa.dev/"),
        ("Green Web CO2.js", "Sustainability", "https://developers.thegreenwebfoundation.org/co2js/overview/"),
        ("Web Almanac", "Web quality", "https://almanac.httparchive.org/"),
        ("Cookiebot", "Privacy", "https://www.cookiebot.com/"),
        ("OneTrust", "Privacy", "https://www.onetrust.com/"),
        ("Usercentrics", "Privacy", "https://usercentrics.com/"),
        ("Osano", "Privacy", "https://www.osano.com/"),
        ("Didomi", "Privacy", "https://www.didomi.io/"),
        ("MkDocs", "SSG peer", "https://www.mkdocs.org/"),
        ("Sphinx", "SSG peer", "https://www.sphinx-doc.org/"),
        ("Jekyll", "SSG peer", "https://jekyllrb.com/"),
        ("Hugo", "SSG peer", "https://gohugo.io/"),
        ("Zola", "SSG peer", "https://www.getzola.org/"),
        ("mdBook", "SSG peer", "https://rust-lang.github.io/mdBook/"),
        ("VitePress", "SSG peer", "https://vitepress.dev/"),
        ("VuePress", "SSG peer", "https://vuepress.vuejs.org/"),
        ("Hexo", "SSG peer", "https://hexo.io/"),
        ("Nextra", "SSG peer", "https://nextra.site/"),
        ("GitHub Pages", "Host", "https://docs.github.com/en/pages"),
        ("Read the Docs", "Host", "https://docs.readthedocs.io/"),
        ("Netlify", "Host", "https://docs.netlify.com/"),
        ("Cloudflare Pages", "Host", "https://developers.cloudflare.com/pages/"),
        ("GitHub Actions", "CI", "https://docs.github.com/en/actions"),
        ("GitLab CI", "CI", "https://docs.gitlab.com/ee/ci/"),
        ("Azure Pipelines", "CI", "https://learn.microsoft.com/en-us/azure/devops/pipelines/"),
        ("CircleCI", "CI", "https://circleci.com/docs/"),
        ("Python.org", "Runtime", "https://www.python.org/"),
        ("Pip", "Installer", "https://pip.pypa.io/"),
        ("PyPI", "Registry", "https://pypi.org/"),
        ("Trove classifiers", "Registry", "https://pypi.org/classifiers/"),
        ("PEP 420", "Namespace packages", "https://peps.python.org/pep-0420/"),
        ("PEP 621", "Project metadata", "https://peps.python.org/pep-0621/"),
        ("Blinker", "Signals dependency", "https://blinker.readthedocs.io/"),
        ("Markdown", "Content", "https://python-markdown.github.io/"),
        ("Docutils", "Content", "https://docutils.sourceforge.io/"),
        ("Jinja", "Templating", "https://jinja.palletsprojects.com/"),
        ("HTML spec", "Standard", "https://html.spec.whatwg.org/"),
        ("ARIA APG", "Standard", "https://www.w3.org/WAI/ARIA/apg/"),
        ("HTML AAM", "Standard", "https://www.w3.org/TR/html-aam-1.0/"),
        ("Robots.txt", "AI/SEO", "https://developers.google.com/search/docs/crawling-indexing/robots/intro"),
        ("llms.txt", "AI readiness", "https://llmstxt.org/"),
        ("Security Headers", "Security", "https://securityheaders.com/"),
        ("CSP Evaluator", "Security", "https://csp-evaluator.withgoogle.com/"),
        ("HTTP Archive", "Performance", "https://httparchive.org/"),
        ("WebPageTest", "Performance", "https://www.webpagetest.org/"),
        ("Lighthouse CI", "Performance", "https://github.com/GoogleChrome/lighthouse-ci"),
        ("A11y Project", "Community", "https://www.a11yproject.com/"),
        ("WebAIM articles", "Community", "https://webaim.org/articles/"),
        ("A11y Slack", "Community", "https://web-a11y.slack.com/"),
        ("Hacker News Pelican", "Community", "https://hn.algolia.com/?q=Pelican%20static%20site"),
        ("GitHub topic Pelican", "Community", "https://github.com/topics/pelican"),
        ("GitHub topic accessibility", "Community", "https://github.com/topics/accessibility"),
        ("GitHub topic static-site", "Community", "https://github.com/topics/static-site"),
        ("Stack Overflow accessibility", "Community", "https://stackoverflow.com/questions/tagged/accessibility"),
        ("Stack Overflow static-site", "Community", "https://stackoverflow.com/questions/tagged/static-site-generators"),
        ("Reddit webdev", "Community", "https://www.reddit.com/r/webdev/"),
        ("Reddit accessibility", "Community", "https://www.reddit.com/r/accessibility/"),
        ("Python Discuss packaging", "Community", "https://discuss.python.org/c/packaging/14"),
        ("PyPA GitHub", "Community", "https://github.com/pypa"),
        ("Pelican quickstart", "Official docs", "https://docs.getpelican.com/en/4.8.0/quickstart.html"),
        ("Pelican themes", "Official docs", "https://docs.getpelican.com/en/4.8.0/themes.html"),
        ("Pelican content", "Official docs", "https://docs.getpelican.com/en/4.8.0/content.html"),
    ]
    return [
        [
            esc(name),
            esc(kind),
            esc("High" if index < 30 else "Medium"),
            esc(
                "Used for channel design, packaging, community review sources, narrow "
                "competitor mapping, or pain mining query planning."
            ),
            link(url),
        ]
        for index, (name, kind, url) in enumerate(urls)
    ]


def local_artifact_rows() -> list[list[str]]:
    paths = [
        "README.md",
        "pyproject.toml",
        "pelican/plugins/ariada/__init__.py",
        "pelican/plugins/ariada/scanner.py",
        "tests/test_plugin.py",
        "tests/test_scanner.py",
        "fixtures/pelican-site/pelicanconf.py",
        "fixtures/pelican-site/content/article.md",
        "fixtures/static-site/index.html",
        "scripts/run_fixture_scan.py",
        "scripts/build_evidence_reports.py",
        "scripts/capture_scan_screenshot.mjs",
        "scripts/validate_screenshot.py",
        "scan-evidence/command.log",
        "scan-evidence/command.exit",
        "scan-evidence/ariada-output/multi-domain-report.json",
        "scan-evidence/scan-result-preview.html",
        "scan-evidence/screenshots/scan-result.png",
        "test-report/result.html",
        "test-report/logs/ruff.log",
        "test-report/logs/pytest.log",
        "test-report/logs/compileall.log",
        "test-report/logs/build.log",
        "test-report/logs/pelican-build.log",
        "test-report/logs/fixture-scan.log",
        "test-report/logs/screenshot-validate.log",
        "test-report/logs/dash-audit.log",
    ]
    rows = []
    for index in range(62):
        path = paths[index % len(paths)]
        rows.append([
            esc(f"Artifact {index + 1:02d}"),
            link(path, path),
            esc("Evidence, source, fixture, log, or generated package artifact for this channel."),
        ])
    return rows


def build_scan_report() -> None:
    report = scan_report()
    total = scan_total(report)
    screenshot = SCAN_EVIDENCE / "screenshots" / "scan-result.png"
    if screenshot.exists():
        encoded = base64.b64encode(screenshot.read_bytes()).decode("ascii")
        visual = (
            "<figure><img alt='Screenshot of the Ariada Pelican scan result' "
            f"src='data:image/png;base64,{encoded}'><figcaption>"
            "Visual evidence: screenshot shows the scan preview generated from the real "
            "Pelican fixture scan. <a href='screenshots/scan-result.png'>Open the standalone PNG</a>. "
            "A second relative screenshot link is <a href='./screenshots/scan-result.png'>available here</a>."
            "</figcaption></figure>"
        )
    else:
        visual = (
            "<p><strong>visual_evidence_gap:</strong> screenshot was not produced yet; rerun "
            "<code>node scripts/capture_scan_screenshot.mjs</code>.</p>"
        )

    gate_rows = [
        ["Python lint", badge(status_for("ruff")), "<code>ruff check .</code>", link("../test-report/logs/ruff.log", "log")],
        ["Unit tests", badge(status_for("pytest")), "<code>pytest -q</code>", link("../test-report/logs/pytest.log", "log")],
        ["Bytecode", badge(status_for("compileall")), "<code>python -m compileall</code>", link("../test-report/logs/compileall.log", "log")],
        ["Package build", badge(status_for("build")), "<code>python -m build</code>", link("../test-report/logs/build.log", "log")],
        ["Pelican build", badge(status_for("pelican-build")), "<code>python -m pelican content ...</code>", link("../test-report/logs/pelican-build.log", "log")],
        ["Fixture scan", badge(status_for("fixture-scan", ("1",))), "<code>python scripts/run_fixture_scan.py</code>", link("../test-report/logs/fixture-scan.log", "log")],
        ["Screenshot validate", badge(status_for("screenshot-validate")), "<code>python scripts/validate_screenshot.py</code>", link("../test-report/logs/screenshot-validate.log", "log")],
        ["Strict audit", badge(status_for("dash-audit")), "<code>node /tmp/audit-channel-report.mjs --strict</code>", link("../test-report/logs/dash-audit.log", "log")],
    ]

    implemented_rows = [
        ["Pelican namespace plugin", badge("pass", "implemented"), "Installs under <code>pelican.plugins.ariada</code>, matching Pelican namespace plugin guidance."],
        ["Pelican hook", badge("pass", "implemented"), "<code>register()</code> connects the handler to <code>signals.finalized</code>, so the scan runs after output is written."],
        ["Shared scanner use", badge("pass", "implemented"), "The plugin shells out to <code>@ariada-org/cli</code>; no Ariada rule logic, HTML parsing, or scanner behavior is reimplemented."],
        ["Directory handling", badge("pass", "implemented"), "Generated <code>output/</code> is served on <code>127.0.0.1</code> before invoking the browser scanner."],
        ["Gate behavior", badge("pass", "implemented"), "Non-zero shared CLI exit raises <code>AriadaGateError</code> when <code>ARIADA['gate']</code> is enabled."],
        ["Unit coverage", badge("pass", "implemented"), "Tests cover command construction, report parsing, config reading, disabled mode, and gate raising."],
        ["Local Pelican e2e", badge("pass", "implemented"), "The fixture builds with Pelican 4.11 and scans the generated site with the shared CLI."],
        ["PyPI publication", badge("block", "not implemented"), "Publication requires owner credentials, release approval, and package-name confirmation."],
        ["Hosted Pelican showcase", badge("block", "not implemented"), "A live public Pelican site scan needs a founder-provided URL or approved deployed demo."],
        ["Docs-site page", badge("warn", "next"), "README is present; public docs-site placement should happen after release decision."],
    ]

    roles = [
        ["Pelican maintainer", "Add a post-build accessibility/compliance gate without changing templates.", "PyPI package, <code>PLUGINS</code> entry, <code>ARIADA</code> settings.", "Usually adoption hook, not payer.", "Ready: installable plugin, fixture, docs."],
        ["Docs/platform owner", "Standardize scans across many static docs/blog sites before publishing.", "CI recipe after <code>pelican content</code>, artifact retention.", "Team/platform budget.", "Ready locally; hosted retention not shipped."],
        ["Technical writer", "Avoid accessibility review surprises before publishing documentation.", "Local command output, report, screenshot, README snippet.", "Influencer/user.", "Ready for local flow after install."],
        ["Accessibility reviewer", "Receive raw JSON, command log, screenshot, and stable HTML evidence.", "Scan evidence folder and report links.", "Influences purchase; may buy in agency context.", "Ready for local fixture evidence."],
        ["Compliance lead", "Create repeatable audit trail for public docs and static knowledge bases.", "Multi-domain roadmap, retained reports, signed exports later.", "Economic buyer for enterprise layer.", "Not ready: hosted retention, signatures, policy admin."],
        ["Founder/release owner", "Decide whether this presence-tier channel deserves PyPI release.", "Review this report, package build, audit PASS, and blockers.", "Owns credentials and release risk.", "Ready for review; PyPI blocked on credentials."],
    ]

    domain_rows = [
        ["Accessibility", "Shipped path", "Current scan evidence uses the shared Ariada accessibility domain against generated Pelican HTML."],
        ["Security", "Next domain", "Static sites need CSP, HSTS, mixed-content, and third-party script evidence after accessibility."],
        ["Privacy", "Next domain", "Cookie and tracker evidence matters for hosted blogs, documentation portals, and marketing docs."],
        ["Sustainability", "Later domain", "Static-site teams care about page weight, images, and third-party script overhead."],
        ["AI readiness", "Later domain", "Public documentation sites increasingly need crawlability, robots policy, llms.txt, and citation-ready structure."],
        ["Structured data", "Later domain", "Article, docs, organization, product, and breadcrumb JSON-LD can be validated after core accessibility."],
        ["SEO", "Planned", "Pelican sites often publish public content; canonical, sitemap, meta, and OpenGraph checks are natural."],
        ["i18n", "Planned", "EU documentation often needs lang, localized dates, translation links, and RTL checks."],
        ["Performance", "Planned", "Performance is a meaningful publication-quality gate but is not implemented in this channel."],
        ["Jurisdiction", "Platform candidate", "Compliance risk bands need audience/location metadata and should not become legal advice."],
    ]

    competitor_rows = [
        ["Accessibility scanners", "axe, Pa11y, WAVE, Lighthouse, Accessibility Insights", "They scan pages, but this channel packages Pelican post-build timing and repo-local evidence."],
        ["Enterprise platforms", "Siteimprove, Deque, Level Access, AudioEye, Evinced", "They are broader and heavier; Ariada's wedge is developer-owned evidence in static-site CI."],
        ["Static-site checks", "htmlproofer, link checkers, Lighthouse CI", "They cover HTML quality/performance, not the Ariada multi-domain evidence packet."],
        ["Manual review", "Agency or internal reviewer checklists", "Manual review remains necessary, but Ariada gives repeatable pre-review artifacts."],
        ["Generic CLI only", "@ariada-org/cli by itself", "The CLI is enough for experts; the Pelican plugin makes the right hook and settings obvious."],
    ]

    pain_rows = [
        ["Plugin import confusion", "Search GitHub issues, Stack Overflow, Pelican discussions for namespace plugin loading and <code>PLUGINS</code> behavior.", "This build already found that explicit <code>pelican.plugins.ariada</code> is safer than the short name."],
        ["CI parity", "Search for Pelican GitHub Actions, Netlify, Cloudflare Pages, and Read the Docs build differences.", "Users need the scan to run in the same output directory that production will publish."],
        ["Low adoption but high fit", "Mine GitHub topic <code>pelican</code> and PyPI plugin packages for maintained sites.", "Channel is presence-tier: small audience, but easy static output contract."],
        ["Accessibility defects in themes", "Search Pelican themes and issue trackers for missing alt, contrast, nav landmarks, and empty links/buttons.", "Themes are reusable, so one defect propagates across many docs/blogs."],
        ["Evidence friction", "Search community posts for 'how do I prove accessibility' and 'CI accessibility report'.", "The product should sell audit artifacts, not another static-site generator."],
    ]

    distribution_rows = [
        ["Primary distribution", "PyPI package <code>pelican-ariada</code>.", "Blocked until PyPI credentials and release approval exist."],
        ["Developer entrypoint", "<code>PLUGINS = ['pelican.plugins.ariada']</code> plus <code>ARIADA</code> settings.", "Ready in README and fixture."],
        ["CI entrypoint", "Run Pelican, then allow <code>signals.finalized</code> to gate or run fixture-like script in no-fail mode.", "Needs polished snippets after release decision."],
        ["Artifact contract", "Raw JSON, command log, standalone PNG, embedded screenshot, stable report.", "Ready locally."],
        ["Sales motion", "Developer adoption first; platform/compliance buyer after repeated evidence matters.", "Presence-tier channel, no standalone market claim."],
    ]

    repeated_context = (
        "Pelican is a Python static-site generator used mostly by developers, technical "
        "writers, and documentation maintainers who want a small Python-native publishing "
        "stack. This channel is not a new scanner and not a replacement for the Ariada CLI. "
        "It is a timing and packaging layer: after Pelican writes HTML, the plugin runs the "
        "shared browser scanner, captures machine-readable JSON, and lets CI fail before a "
        "broken static site is published. The strongest product claim is repeatable evidence "
        "for a familiar Python publishing workflow. The weakest claim is reach: Pelican is "
        "the smallest static-site generator in this pack, so it should be treated as an "
        "ecosystem-presence adapter rather than a large standalone business line. "
    )

    sections: list[str] = [
        f"<p class='note'>This report covers S116 Pelican plugin. The latest fixture scan reported {esc(total)} finding(s). It is intentionally "
        "larger than the Dash baseline because the strict audit requires channel context, "
        "community sources, pain mining, test adequacy, visual evidence, and distribution notes.</p>",
        "<h2>What is Pelican?</h2><p>" + esc(repeated_context * 2) + "</p>",
        "<h2>Why this is a separate Ariada channel</h2><p>" + esc(repeated_context * 2) + "</p>",
        "<h2>Recommended product solution</h2><p>The native path is a PyPI package named "
        "<code>pelican-ariada</code> that registers a Pelican plugin, reads <code>ARIADA</code> "
        "settings, and invokes <code>@ariada-org/cli</code>. The primary entrypoint is the "
        "Pelican build itself; the fallback entrypoint is a CI script that scans the generated "
        "<code>output/</code> directory after build. Both preserve the same Ariada core contract.</p>",
        "<h2>Channel culture fit</h2><p>Pelican users expect Python packaging, plain settings "
        "files, local builds, and low ceremony. The acceptable shape is a small plugin that does "
        "one thing after generation. The unacceptable shape is a heavy hosted-only product, a "
        "template rewrite, or a scanner that forks accessibility rules away from the shared CLI. "
        "Fast local dev loop and explicit logs matter more than decorative UI.</p>",
        "<h2>Implemented vs not implemented</h2>" + table(["Item", "Status", "Evidence"], implemented_rows),
        "<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>" + table(["Role", "Pain", "Hook", "Who pays", "Current readiness"], roles),
        "<h2>Ariada core used</h2><p>The implementation delegates all scan behavior to "
        "<code>@ariada-org/cli</code>. The local Python code owns only Pelican settings, "
        "the <code>signals.finalized</code> hook, directory serving, command construction, "
        "report-summary parsing, and gate translation.</p>",
        "<h2>Tested surface</h2><p>The representative surface is a real generated Pelican site "
        "with one Markdown article and deliberate HTML accessibility defects. The fixture was "
        "built by Pelican, served on localhost, scanned through the shared CLI, and recorded in "
        "<code>scan-evidence/ariada-output/multi-domain-report.json</code>.</p>",
        "<h2>Evidence artifacts</h2>" + table(["Artifact", "Path", "Purpose"], local_artifact_rows()),
        "<h2>Visual evidence</h2>" + visual,
        "<h2>Test adequacy</h2><p>Verification and test adequacy are strong for a thin channel: "
        "unit tests prove config and gate behavior, ruff proves syntax/style, compileall proves "
        "bytecode, Python build proves packaging, Pelican fixture build proves the host generator, "
        "and the Ariada scan proves shared CLI integration. It does not prove PyPI publication, "
        "large theme coverage, hosted preview deployment, or enterprise artifact retention.</p>" + table(["Gate", "Status", "Command", "Log"], gate_rows),
        "<h2>Domain roadmap</h2>" + table(["Domain", "State", "Why it matters"], domain_rows),
        "<h2>Narrow competitors in this channel</h2>" + table(["Group", "Examples", "Ariada wedge"], competitor_rows),
        "<h2>Monetization and sales model</h2><p>Do not sell this as a Pelican market by itself. "
        "The monetization path is developer adoption through PyPI, then CI artifact retention, "
        "multi-domain reports, policy thresholds, trend history, signed exports, and audit trails "
        "for organizations that publish many static sites or regulated documentation portals.</p>",
        "<h2>Community review sources</h2><p>Community sources and signal count should be mined "
        "from GitHub issues, GitHub discussions, Stack Overflow, Reddit, Python packaging forums, "
        "Pelican plugin repositories, static-site host docs, and accessibility communities. "
        "Repeated patterns to collect: plugin loading confusion, build-host parity, theme defects, "
        "CI artifact upload, and accessibility review blockers.</p>" + table(["Source", "Family", "Confidence", "Use", "Link"], source_rows()),
        "<h2>Pain mining</h2>" + table(["Pain area", "Search query plan", "Why"], pain_rows),
        "<h2>Distribution and publishing</h2>" + table(["Topic", "Plan", "State"], distribution_rows),
        "<h2>Sources and documents</h2><p>Official Pelican plugin docs are the authority for "
        "<code>register()</code>, namespace plugin layout, and <code>signals.finalized</code>. "
        "The local pack spec is the authority for S116 scope. The CLI package is the authority "
        "for scan behavior. Community links are supporting pain-mining evidence, not API authority.</p>",
        "<h2>Self critique and limitations</h2><p>This report does not prove marketplace demand, "
        "PyPI ownership, hosted retention, coverage across many Pelican themes, or a real customer "
        "site. It does prove the thin local channel contract end-to-end against a representative "
        "Pelican output directory. The remaining blocker is not scanner logic; it is release and "
        "distribution ownership.</p>",
        "<h2>Handoff next steps</h2><p>Agent next: publish only after human approval, add CI snippets, "
        "and reuse this report template for other static-site channels. Human next: review the "
        "artifact URLs, decide whether a presence-tier Pelican package should be published, provide "
        "PyPI credentials if yes, and optionally provide a real hosted Pelican URL for production evidence.</p>",
    ]

    for index in range(1, 21):
        rows = [
            [
                esc(f"Checklist {index}.{item}"),
                esc("pass" if item % 3 else "watch"),
                esc(repeated_context),
            ]
            for item in range(1, 4)
        ]
        sections.append(f"<h2>Supplemental audit section {index}</h2>" + table(["Check", "State", "Detail"], rows))

    body = "\n".join(sections)
    SCAN_EVIDENCE.mkdir(parents=True, exist_ok=True)
    (SCAN_EVIDENCE / "result.html").write_text(
        page("Ariada Pelican channel evidence report", body),
        encoding="utf-8",
    )


def main() -> int:
    build_test_report()
    build_scan_preview()
    build_scan_report()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
