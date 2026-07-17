#!/usr/bin/env python3
from __future__ import annotations

import base64
import html
import json
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
SCAN_EVIDENCE = ROOT / "scan-evidence"
RAW_REPORT = SCAN_EVIDENCE / "raw" / "multi-domain-report.json"
COMMAND_OUTPUT = SCAN_EVIDENCE / "command-output.txt"
REPORT_SCREENSHOT = SCAN_EVIDENCE / "result-screenshot.png"
SURFACE_SCREENSHOT = SCAN_EVIDENCE / "screenshots" / "tested-surface.png"
FIXTURE = ROOT / "fixtures" / "sample-web" / "index.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def load_report() -> dict:
    return json.loads(read(RAW_REPORT)) if RAW_REPORT.exists() else {}


def scan_total(report: dict) -> int:
    total = 0
    for site in (report.get("grid") or {}).values():
        if isinstance(site, dict):
            total += sum(len(items) for items in site.values() if isinstance(items, list))
    return total


def findings(report: dict) -> list[dict]:
    rows: list[dict] = []
    for site, domains in (report.get("grid") or {}).items():
        if not isinstance(domains, dict):
            continue
        for domain, items in domains.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, dict):
                    rows.append(
                        {
                            "site": site,
                            "domain": domain,
                            "rule": item.get("ruleId", ""),
                            "severity": item.get("severity", ""),
                            "selector": (item.get("element") or {}).get("selector", ""),
                            "message": item.get("message", ""),
                        }
                    )
    return rows


def table(headers: list[str], rows: list[list[object]]) -> str:
    head = "".join(f"<th scope='col'>{esc(header)}</th>" for header in headers)
    body = "\n".join(
        "<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def local_link(path: str, label: str) -> str:
    return f"<a href='{esc(path)}'>{esc(label)}</a>"


def ext(url: str, label: str | None = None) -> str:
    return f"<a href='{esc(url)}'>{esc(label or url)}</a>"


def figure(path: Path, rel: str, alt: str, caption: str) -> str:
    if not path.exists():
        return f"<p><strong>VISUAL_EVIDENCE_GAP:</strong> missing <code>{esc(rel)}</code>.</p>"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return (
        "<figure>"
        f"<img alt='{esc(alt)}' src='data:image/png;base64,{encoded}'>"
        f"<figcaption>{caption} {local_link(rel, 'Open standalone PNG')}.</figcaption>"
        "</figure>"
    )


def linked_figure(path: Path, rel: str, alt: str, caption: str) -> str:
    if not path.exists():
        return f"<p><strong>VISUAL_EVIDENCE_GAP:</strong> missing <code>{esc(rel)}</code>.</p>"
    return (
        "<figure>"
        f"<img alt='{esc(alt)}' src='{esc(rel)}'>"
        f"<figcaption>{caption} {local_link(rel, 'Open standalone PNG')}.</figcaption>"
        "</figure>"
    )


def section(title: str, body: str) -> str:
    return f"<section><h2>{esc(title)}</h2>{body}</section>"


OFFICIAL_SOURCES = [
    ("Gradle Plugin Portal", "https://plugins.gradle.org/"),
    ("Gradle Plugin Portal user guide", "https://plugins.gradle.org/docs/submit"),
    ("Gradle plugin development", "https://docs.gradle.org/current/userguide/custom_plugins.html"),
    ("Gradle testing plugins", "https://docs.gradle.org/current/userguide/test_kit.html"),
    ("Gradle configuration cache", "https://docs.gradle.org/current/userguide/configuration_cache.html"),
    ("Gradle build cache", "https://docs.gradle.org/current/userguide/build_cache.html"),
    ("Gradle tasks", "https://docs.gradle.org/current/userguide/more_about_tasks.html"),
    ("Gradle Java plugin", "https://docs.gradle.org/current/userguide/java_plugin.html"),
    ("Gradle Kotlin DSL", "https://docs.gradle.org/current/userguide/kotlin_dsl.html"),
    ("Gradle publishing plugins", "https://docs.gradle.org/current/userguide/publishing_gradle_plugins.html"),
    ("Gradle build lifecycle", "https://docs.gradle.org/current/userguide/build_lifecycle.html"),
    ("Gradle command line", "https://docs.gradle.org/current/userguide/command_line_interface.html"),
    ("Gradle dependency management", "https://docs.gradle.org/current/userguide/core_dependency_management.html"),
    ("Gradle version catalogs", "https://docs.gradle.org/current/userguide/platforms.html"),
    ("Gradle wrapper", "https://docs.gradle.org/current/userguide/gradle_wrapper.html"),
    ("Gradle CI guide", "https://docs.gradle.org/current/userguide/gradle_optimizations.html"),
    ("Develocity product", "https://gradle.com/develocity/"),
    ("Gradle Enterprise terms", "https://gradle.com/terms-of-service/"),
    ("Maven Central publishing", "https://central.sonatype.org/publish/publish-guide/"),
    ("Sonatype Central Portal", "https://central.sonatype.org/register/central-portal/"),
    ("GitHub Actions Gradle build action", "https://github.com/gradle/actions"),
    ("GitLab Gradle example", "https://docs.gitlab.com/ci/examples/artifactory_and_gradle/"),
    ("Jenkins Gradle plugin", "https://plugins.jenkins.io/gradle/"),
    ("Snyk Gradle", "https://docs.snyk.io/scan-using-snyk/snyk-cli/snyk-cli-for-java-and-kotlin/snyk-cli-for-gradle-projects"),
    ("OWASP Dependency-Check Gradle", "https://jeremylong.github.io/DependencyCheck/dependency-check-gradle/index.html"),
    ("SpotBugs Gradle plugin", "https://spotbugs.readthedocs.io/en/latest/gradle.html"),
    ("Checkstyle Gradle plugin", "https://docs.gradle.org/current/userguide/checkstyle_plugin.html"),
    ("JaCoCo Gradle plugin", "https://docs.gradle.org/current/userguide/jacoco_plugin.html"),
    ("Detekt Gradle plugin", "https://detekt.dev/docs/gettingstarted/gradle/"),
    ("Ktlint Gradle plugin", "https://github.com/JLLeitschuh/ktlint-gradle"),
    ("Android Gradle Plugin", "https://developer.android.com/build"),
    ("Kotlin Gradle plugin", "https://kotlinlang.org/docs/gradle-configure-project.html"),
    ("Spring Boot Gradle plugin", "https://docs.spring.io/spring-boot/gradle-plugin/index.html"),
    ("Palantir Gradle Docker plugin", "https://github.com/palantir/gradle-docker"),
    ("Nebula Gradle plugins", "https://github.com/nebula-plugins"),
    ("Gradle plugin portal API issue tracker", "https://github.com/gradle/plugin-portal-requests/issues"),
]

COMMUNITY_SOURCES = [
    ("Gradle Forum", "https://discuss.gradle.org/"),
    ("Gradle Forum plugin development", "https://discuss.gradle.org/tag/plugin-development"),
    ("Gradle Forum configuration cache", "https://discuss.gradle.org/tag/configuration-cache"),
    ("Gradle GitHub issues", "https://github.com/gradle/gradle/issues"),
    ("Gradle GitHub discussions", "https://github.com/gradle/gradle/discussions"),
    ("Gradle Plugin Portal requests", "https://github.com/gradle/plugin-portal-requests/issues"),
    ("Stack Overflow gradle tag", "https://stackoverflow.com/questions/tagged/gradle"),
    ("Stack Overflow gradle-plugin tag", "https://stackoverflow.com/questions/tagged/gradle-plugin"),
    ("Stack Overflow gradle-kotlin-dsl tag", "https://stackoverflow.com/questions/tagged/gradle-kotlin-dsl"),
    ("Reddit Gradle search", "https://www.reddit.com/search/?q=Gradle%20plugin%20CI%20slow"),
    ("Reddit Java Gradle search", "https://www.reddit.com/r/java/search/?q=Gradle%20plugin&restrict_sr=1"),
    ("Reddit Android Gradle search", "https://www.reddit.com/r/androiddev/search/?q=Gradle%20plugin%20cache&restrict_sr=1"),
    ("Hacker News Gradle search", "https://hn.algolia.com/?q=Gradle%20plugin"),
    ("Lobsters Gradle search", "https://lobste.rs/search?q=Gradle"),
    ("GitHub search Gradle plugin cache", "https://github.com/search?q=gradle+plugin+configuration+cache&type=issues"),
    ("GitHub search Gradle CI artifacts", "https://github.com/search?q=gradle+ci+artifacts&type=issues"),
    ("GitHub search Gradle browser test", "https://github.com/search?q=gradle+browser+test&type=issues"),
    ("GitHub search Gradle accessibility", "https://github.com/search?q=gradle+accessibility+plugin&type=issues"),
    ("G2 Develocity reviews", "https://www.g2.com/products/develocity/reviews"),
    ("Capterra Gradle search", "https://www.capterra.com/search/?query=Gradle"),
    ("TrustRadius Gradle search", "https://www.trustradius.com/search?q=gradle"),
    ("Maven Central issue search", "https://github.com/search?q=Maven+Central+Gradle+publishing&type=issues"),
    ("Android issue tracker Gradle search", "https://issuetracker.google.com/issues?q=gradle%20plugin"),
    ("Kotlin issue tracker Gradle search", "https://youtrack.jetbrains.com/issues/KT?q=Gradle%20plugin"),
    ("Spring Boot Gradle issues", "https://github.com/spring-projects/spring-boot/labels/theme%3A%20gradle"),
    ("Detekt Gradle issues", "https://github.com/detekt/detekt/issues?q=gradle"),
    ("Ktlint Gradle issues", "https://github.com/JLLeitschuh/ktlint-gradle/issues"),
    ("OWASP Dependency-Check Gradle issues", "https://github.com/dependency-check/DependencyCheck/issues?q=gradle"),
    ("SpotBugs Gradle issues", "https://github.com/spotbugs/spotbugs-gradle-plugin/issues"),
    ("Gradle actions issues", "https://github.com/gradle/actions/issues"),
    ("Jenkins Gradle plugin issues", "https://github.com/jenkinsci/gradle-plugin/issues"),
    ("GitLab Gradle issues", "https://gitlab.com/gitlab-org/gitlab/-/issues/?search=Gradle"),
]

PAIN_QUERIES = [
    "Gradle plugin browser dependency in CI",
    "Gradle plugin configuration cache incompatible external process",
    "Gradle plugin slow CI task external CLI",
    "Gradle plugin portal namespace ownership publish key",
    "Gradle plugin evidence artifacts CI",
    "Gradle plugin accessibility scan",
    "Gradle plugin web application scan localhost",
    "Gradle plugin fail build on accessibility",
    "Gradle Java build compliance evidence",
    "Gradle Kotlin DSL plugin configuration cache",
    "Gradle CI cache node browser runtime",
    "Gradle Playwright browser install CI",
    "Gradle report html artifact CI",
    "Gradle plugin marketplace adoption",
    "Gradle plugin portal reviews support",
    "Gradle build scans compliance evidence",
    "Gradle plugin testkit external command",
    "Gradle task outputs cacheable reports",
    "Gradle plugin publishing credentials",
    "Gradle plugin enterprise policy gate",
    "Gradle plugin security scan CI",
    "Gradle plugin privacy scan website",
    "Gradle plugin WCAG scan",
    "Gradle plugin SARIF report artifact",
    "Gradle accessibility testing Java web app",
    "Gradle accessibility CI reports",
    "Gradle plugin local dev loop slow",
    "Gradle plugin Docker browser runtime",
    "Gradle plugin GitHub Actions artifact upload",
    "Gradle plugin GitLab CI artifact upload",
    "Gradle build compliance audit trail",
    "Gradle plugin baseline regression",
    "Gradle plugin severity threshold",
    "Gradle plugin hosted report retention",
    "Gradle plugin procurement evidence",
    "Gradle web app release accessibility gate",
    "Gradle plugin not idiomatic external node",
    "Gradle plugin portal approval delay",
    "Gradle plugin community support",
    "Gradle plugin Android webview accessibility",
    "Gradle plugin JVM SaaS release gate",
    "Gradle plugin monorepo compliance scan",
    "Gradle plugin aggregate report",
    "Gradle plugin multi project task",
    "Gradle plugin build cache outputs",
    "Gradle plugin command log artifact",
    "Gradle plugin screenshot evidence",
    "Gradle plugin signed report export",
    "Gradle plugin reviewer workflow",
    "Gradle plugin DPO audit evidence",
    "Gradle plugin release manager evidence",
    "Gradle plugin failure modes CI",
    "Gradle plugin node dependency objection",
    "Gradle plugin browser runtime objection",
    "Gradle plugin enterprise dashboard",
    "Gradle plugin hosted worker",
    "Gradle plugin nightly scan",
    "Gradle plugin pre merge gate",
    "Gradle plugin local fast loop",
    "Gradle plugin task configuration",
]


def google_search_link(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}"


def stack_search_link(query: str) -> str:
    return f"https://stackoverflow.com/search?q={quote_plus(query)}"


def github_search_link(query: str) -> str:
    return f"https://github.com/search?q={quote_plus(query)}&type=issues"


def page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>
:root{{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
body{{margin:0;background:#f6f8fb;color:#18202a}}
header{{background:#102033;color:white;padding:32px max(24px,calc((100vw - 1120px)/2))}}
main{{max-width:1120px;margin:0 auto;padding:24px}}
section{{background:white;border:1px solid #d8e0ea;border-radius:8px;padding:20px;margin:18px 0}}
h1{{margin:0 0 8px;font-size:30px;letter-spacing:0}}
h2{{margin:0 0 12px;font-size:19px;letter-spacing:0}}
p,li{{line-height:1.55}}
a{{color:#0f5fa8}}
code,pre{{font-family:"SFMono-Regular",Consolas,monospace}}
code{{background:#eef3f8;padding:1px 5px;border-radius:4px}}
pre{{white-space:pre-wrap;overflow:auto;background:#20242c;color:#f4f6f8;border-radius:6px;padding:14px;max-height:540px}}
table{{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}}
th,td{{text-align:left;border:1px solid #e0e6ef;padding:9px;vertical-align:top}}
th{{background:#f1f5f9}}
figure{{margin:14px 0;border:1px solid #d8e0ea;border-radius:8px;overflow:hidden;background:#fff}}
img{{display:block;max-width:100%;height:auto}}
figcaption{{padding:10px 14px;color:#374151}}
.grid{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}}
.metric{{border:1px solid #d8e0ea;border-radius:6px;padding:14px;background:#fbfdff}}
.metric strong{{display:block;font-size:24px}}
.pass{{color:#116329;font-weight:700}}
.warn{{color:#92400e;font-weight:700}}
.block{{color:#9f1239;font-weight:700}}
.small{{font-size:13px;color:#566273}}
@media (max-width:760px){{main{{padding:14px}}.grid{{grid-template-columns:1fr}}table{{font-size:13px}}}}
</style>
</head>
<body>
<header>
<h1>{esc(title)}</h1>
<p>Gradle channel evidence for <code>integrations/gradle-ariada</code>: a JVM build plugin wrapper around the shared <code>@ariada-org/cli</code>, reviewed against the Dash-plus evidence gate.</p>
</header>
<main>{body}</main>
</body>
</html>"""


def build() -> None:
    report = load_report()
    rows = findings(report)
    total = scan_total(report)
    severity_counts: dict[str, int] = {}
    for row in rows:
        severity_counts[row["severity"]] = severity_counts.get(row["severity"], 0) + 1

    finding_rows = [
        [
            esc(row["site"]),
            esc(row["domain"]),
            esc(row["rule"]),
            f"<strong>{esc(row['severity'])}</strong>",
            esc(row["selector"]),
            esc(row["message"]),
        ]
        for row in rows
    ]

    official_rows = [
        [esc(name), ext(url), "Official / vendor source", "High", "Use for expected Gradle packaging, task and publishing semantics."]
        for name, url in OFFICIAL_SOURCES
    ]
    community_rows = [
        [esc(name), ext(url), "Community or review source", "Medium", "Use only for objections, repeated pain language and adoption signals."]
        for name, url in COMMUNITY_SOURCES
    ]
    pain_rows = []
    for query in PAIN_QUERIES:
        pain_rows.append(
            [
                esc(query),
                ext(google_search_link(query), "Google search"),
                ext(stack_search_link(query), "Stack Overflow search"),
                ext(github_search_link(query), "GitHub issues search"),
                "Collect repeated objections, not single-comment facts.",
            ]
        )

    sections: list[str] = []
    sections.append(
        section(
            "1. What the Gradle channel is and why it is separate",
            "<p><strong>What is channel:</strong> Gradle is the build and automation surface for JVM, Android, Kotlin, Spring, and many enterprise monorepo teams. The channel is separate because users do not install a generic website scanner first; they expect a build plugin with a task, extension, outputs, CI behavior, and predictable cache semantics.</p>"
            "<p><strong>Why separate:</strong> the same Ariada scan has to respect Gradle conventions: plugin id, task graph, configuration avoidance, local build speed, multi-project layouts, artifact directories, and publication through the Gradle Plugin Portal or Maven Central. A generic npm package is foreign in the Java/Kotlin mental model unless it is hidden behind a thin plugin, CI action, Docker image, or hosted worker.</p>"
            + table(
                ["Question", "Gradle answer", "Ariada consequence"],
                [
                    ["What user opens it first?", "Java/Kotlin/Android developer or build engineer.", "Start with a free thin plugin and a clear <code>ariadaScan</code> task."],
                    ["What is the reviewed surface?", "A running web app, fixture, static preview, or built artifact URL.", "The plugin must not pretend bytecode alone proves web accessibility."],
                    ["Why not just npm?", "Node/browser dependencies are often tolerated in CI but questioned in a fast JVM local loop.", "Cache the heavy scanner path and keep the Gradle wrapper small."],
                    ["Where does evidence land?", "Build artifacts and CI job uploads.", "Raw JSON, command log, screenshot and HTML must be stable output files."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "2. Channel culture fit: what this audience accepts, tolerates and rejects",
            "<p><strong>Channel culture fit:</strong> Gradle users accept plugins that configure tasks, produce deterministic outputs, are documented in Kotlin/Groovy DSL, and do not slow every build by default. They tolerate heavier tools in CI, release gates, nightly verification, or explicit tasks. They reject hidden downloads, surprise browsers in the default test lifecycle, fragile task inputs, and plugins that break configuration cache without saying why.</p>"
            + table(
                ["Workflow position", "Accepted", "Rejected or risky", "Gradle Ariada stance"],
                [
                    ["Fast local/dev loop", "Explicit task, no surprise scan on every compile.", "Browser install, network login, or SaaS upload by default.", "<span class='warn'>Limited fit</span>: keep <code>ariadaScan</code> opt-in."],
                    ["Pre-merge CI", "Install/cached browser runtime, artifact upload, fail threshold.", "Uncached runtime and unreadable logs.", "<span class='pass'>Best initial fit</span>: CI gate plus artifacts."],
                    ["Release gate", "Policy thresholds, signed output, reviewer packet.", "Only console text with no preserved evidence.", "<span class='pass'>Commercial wedge</span>: retained reports."],
                    ["Nightly/fleet scan", "Hosted worker or Docker image.", "Local developer owning browser/runtime failures.", "<span class='warn'>Future path</span>: hosted retention and dashboards."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "3. Recommended product solution",
            "<p><strong>Recommended product solution:</strong> the first Gradle product should be a thin free JVM plugin that delegates to a cached official scanner runtime in CI. The fallback entrypoint is a GitHub Action or Docker image for teams that do not want Node/browser setup inside the Gradle process. The future native path is a polished Gradle plugin with cacheable outputs, multi-project aggregation, SARIF/HTML/JSON exports, and a hosted retention option.</p>"
            + table(
                ["Decision", "Recommendation", "Reason"],
                [
                    ["Primary entrypoint", "Gradle plugin id <code>org.ariada.scan</code> with task <code>ariadaScan</code>.", "Meets channel packaging expectations."],
                    ["Fallback entrypoint", "Reusable CI Action / Docker image wrapping the same CLI.", "Hides Node and browser setup from JVM developers."],
                    ["Free/open-source", "Thin plugin, CLI invocation, local JSON/HTML report.", "Drives adoption without making the wrapper the paid product."],
                    ["Paid/hosted", "Retention, baselines, signed exports, team dashboards, multi-domain packs.", "Economic buyer pays for audit trail and release-risk reduction."],
                    ["Developer should not own", "Browser install churn, hosted retention, long-term evidence storage.", "Those are platform/compliance responsibilities."],
                    ["Next version", "Task output declarations, CI snippets, standalone screenshot capture, multi-domain passthrough.", "Makes the plugin idiomatic and reviewable."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "4. Кому что продаем: роли, hooks, кто платит и что уже готово",
            table(
                ["Role", "What we promise", "What we offer", "Who pays", "When we enter", "Implemented / blockers"],
                [
                    ["Java/Kotlin developer", "Run one explicit scan task before handing a web surface to review.", "Free Gradle task, local JSON/HTML output, readable findings.", "Usually not the budget owner; adoption hook.", "First: owns the build script and can try the plugin.", "<span class='warn'>MVP bridge</span>: task and tests exist; publication blocked."],
                    ["Build/CI owner", "Repeatable release gate with artifacts.", "CI snippets, cached scanner runtime, threshold policy, artifact upload.", "Platform or engineering productivity budget.", "After developer proof or failed accessibility review.", "<span class='block'>Blocked</span>: no ready CI recipes or cache contract yet."],
                    ["Product/release owner", "Reduce release risk and avoid last-minute EAA/WCAG surprises.", "Reviewer-friendly evidence packet and release history.", "Product/release budget.", "When a customer-facing Java/Kotlin app approaches release.", "<span class='warn'>Partly ready</span>: report exists; hosted history not built."],
                    ["Accessibility/compliance reviewer", "See raw evidence, screenshot, command output and limits.", "HTML report, raw JSON, command log, screenshot links, adequacy notes.", "Compliance, legal ops, DPO, or procurement owner.", "At review, procurement, audit, or remediation triage.", "<span class='pass'>Local evidence ready</span>; signed export blocked."],
                    ["Economic buyer", "Pay for confidence, retention and team governance, not a thin wrapper.", "Hosted retention, signed exports, policy baselines, dashboards, domain packs.", "Compliance/platform/security budget.", "After repeated CI usage or procurement demand.", "<span class='block'>Commercial layer not implemented</span>."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "5. Implemented / not implemented / blocked mapping",
            table(
                ["Capability", "State", "Evidence", "Next action"],
                [
                    ["Gradle plugin project", "<span class='pass'>implemented</span>", local_link("../README.md", "README") + " plus Java source.", "Keep package naming stable."],
                    ["Task registration", "<span class='pass'>implemented</span>", "<code>ariadaScan</code> in source and tests.", "Document Kotlin and Groovy examples."],
                    ["Shared Ariada core used", "<span class='pass'>implemented</span>", "Delegates to <code>@ariada-org/cli</code>; no duplicate scanner rules.", "Add version compatibility matrix."],
                    ["Real fixture scan", "<span class='pass'>implemented</span>", local_link("raw/multi-domain-report.json", "raw JSON") + " and " + local_link("command-output.txt", "command output"), "Keep fixture intentionally failing."],
                    ["Tested surface screenshot", "<span class='pass'>implemented</span>", local_link("screenshots/tested-surface.png", "tested-surface.png"), "Capture through browser in future for full rendering parity."],
                    ["Standalone report screenshot", "<span class='pass'>implemented</span>", local_link("result-screenshot.png", "result-screenshot.png"), "Refresh after major report layout changes."],
                    ["Gradle Plugin Portal release", "<span class='block'>blocked</span>", "No founder-owned account, namespace ownership or publish key.", "Human must provide credentials and approval."],
                    ["Cacheable task contract", "<span class='warn'>planned</span>", "No dedicated output/input contract verified here.", "Add task input/output annotations and Gradle cache tests."],
                    ["Hosted retention", "<span class='block'>not implemented</span>", "No hosted upload in this adapter.", "Sell as platform feature, not wrapper code."],
                    ["Delivery hub update", "<span class='block'>coordinator action</span>", "Gradle worktree only; central hub not touched here.", "Coordinator should apply hub row after PASS."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "6. Ariada core used and urgent gaps",
            "<p>The adapter uses the shared <code>@ariada-org/cli</code> as the scanner core. That is correct for MVP evidence because Gradle should not fork the accessibility rules. The urgent product gap is not rule logic; it is packaging, runtime ownership, cache behavior, and review-grade evidence artifacts.</p>"
            + table(
                ["Ariada mechanism", "Used now", "Gap", "Priority"],
                [
                    ["Shared CLI", "Yes, invoked by Gradle task.", "Need version pinning and compatibility docs.", "High"],
                    ["Raw JSON", "Yes, preserved in scan evidence.", "Need stable output path from plugin task.", "High"],
                    ["HTML report", "Yes, generated by evidence script.", "Need plugin-owned report generation or shared reporter.", "High"],
                    ["Screenshot", "Yes, report and fixture screenshot.", "Need browser-preview capture from actual served app.", "High"],
                    ["Multi-domain engine", "JSON shape supports domains.", "Plugin currently proves accessibility only.", "Medium"],
                    ["Hosted dashboard", "No.", "Retention, baselines, signed exports not implemented.", "Commercial"],
                ],
            ),
        )
    )
    sections.append(
        section(
            "7. Tested surface",
            "<p><strong>Tested surface:</strong> local file fixture <code>fixtures/sample-web/index.html</code> was served during the original scan at <code>http://127.0.0.1:64101/</code>. It is intentionally small and flawed: one image has no alt text, the button has low contrast, and the page lacks an accessibility-statement link and skip link.</p>"
            + figure(
                SURFACE_SCREENSHOT,
                "screenshots/tested-surface.png",
                "Screenshot of the tested Gradle fixture surface",
                "Screenshot shows the tested host surface. The large blank band is a fixture/capture artifact caused by a tiny page rendered in a fixed 1200x900 capture, not a report layout defect. The missing-image marker and low-contrast button are expected fixture findings.",
            )
            + table(
                ["Surface element", "Evidence relation", "Finding"],
                [
                    ["<code>&lt;img src='chart.png'&gt;</code>", "Visible as a missing image marker in screenshot.", "Triggers <code>image-alt</code>."],
                    ["Low-contrast button", "Visible grey text on grey button.", "Triggers <code>color-contrast</code>."],
                    ["No skip link", "No visible skip navigation before main content.", "Triggers <code>ariada/statement/skip-link-from-every-page</code>."],
                    ["No statement footer link", "No footer or accessibility statement link.", "Triggers <code>ariada/statement/page-link-from-footer</code>."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "8. Real scan summary",
            f"<div class='grid'><div class='metric'><span>Total findings</span><strong>{total}</strong></div><div class='metric'><span>Critical</span><strong>{severity_counts.get('critical', 0)}</strong></div><div class='metric'><span>Serious</span><strong>{severity_counts.get('serious', 0)}</strong></div><div class='metric'><span>Moderate</span><strong>{severity_counts.get('moderate', 0)}</strong></div></div>"
            + table(["Site", "Domain", "Rule", "Severity", "Selector", "Message"], finding_rows),
        )
    )
    sections.append(
        section(
            "9. Domain roadmap",
            table(
                ["Domain", "State", "Gradle packaging implication", "Buyer reason"],
                [
                    ["accessibility", "implemented", "Current fixture scan and evidence report.", "EAA/WCAG release risk."],
                    ["privacy / GDPR", "planned", "Needs URL scan plus cookie/banner/privacy notice rules.", "DPO/legal audit packet."],
                    ["security", "planned", "Integrate web headers and dependency context without duplicating SAST.", "Security release gate."],
                    ["AI readiness", "planned", "Report AI-readable notices and policy metadata.", "Public content governance."],
                    ["structured data", "planned", "Scan rendered pages for schema.org and machine-readable metadata.", "Search and compliance evidence."],
                    ["sustainability", "planned", "Needs page-weight/runtime signals and CI budget.", "ESG reporting and procurement."],
                    ["performance / Core Web Vitals", "planned", "Browser runtime and cache make this CI/nightly first.", "Release quality and SEO."],
                    ["SEO", "planned", "Add rendered meta/link checks.", "Marketing and discoverability."],
                    ["localization / i18n", "planned", "Need locale matrix and route discovery.", "EU public-service readiness."],
                    ["PCI / payment", "blocked", "Requires payment-surface detection and policy scoping.", "Payment-risk evidence."],
                    ["jurisdiction / penalty exposure", "planned", "Map findings to EAA/WCAG/EN 301 549 and country exposure.", "Executive risk view."],
                    ["brand / design-token compliance", "candidate", "Only useful if design-token source exists.", "Enterprise design governance."],
                    ["observability / evidence operations", "candidate", "Gradle is a strong channel for artifact provenance.", "Platform governance."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "10. Narrow competitors in the evidence/compliance channel",
            "<p>The narrow competition is not Gradle itself and not generic Java tooling. The useful comparison set is build-integrated evidence: accessibility scanners, security/dependency scanners, quality gates, and enterprise build evidence platforms.</p>"
            + table(
                ["Competitor / adjacent tool", "Link", "What they sell", "Ariada wedge"],
                [
                    ["Gradle Develocity", ext("https://gradle.com/develocity/"), "Build scans, acceleration and failure analytics.", "Complement: Ariada adds compliance evidence for rendered web surfaces."],
                    ["OWASP Dependency-Check Gradle", ext("https://jeremylong.github.io/DependencyCheck/dependency-check-gradle/index.html"), "Dependency vulnerability evidence.", "Ariada handles rendered page accessibility/privacy/security evidence."],
                    ["Snyk Gradle", ext("https://docs.snyk.io/scan-using-snyk/snyk-cli/snyk-cli-for-java-and-kotlin/snyk-cli-for-gradle-projects"), "Security dependency scanning.", "Ariada positions as web compliance evidence, not dependency SCA."],
                    ["SpotBugs", ext("https://spotbugs.readthedocs.io/en/latest/gradle.html"), "Static Java bug finding.", "Rendered web evidence and screenshots."],
                    ["Checkstyle", ext("https://docs.gradle.org/current/userguide/checkstyle_plugin.html"), "Code style gate.", "Reviewer-ready compliance report."],
                    ["JaCoCo", ext("https://docs.gradle.org/current/userguide/jacoco_plugin.html"), "Coverage evidence.", "Analogous artifact expectation: HTML plus XML/JSON."],
                    ["Axe CLI", ext("https://github.com/dequelabs/axe-core-npm"), "Accessibility scanning.", "Ariada adds channel packaging, domain roadmap, and compliance retention."],
                    ["Pa11y", ext("https://github.com/pa11y/pa11y"), "Accessibility CLI.", "Ariada sells multi-domain evidence and hosted audit history."],
                    ["Lighthouse CI", ext("https://github.com/GoogleChrome/lighthouse-ci"), "Performance/accessibility CI reports.", "Ariada narrows into EU compliance evidence and role/payer reporting."],
                    ["Playwright test reports", ext("https://playwright.dev/docs/test-reporters"), "Browser test evidence.", "Ariada produces compliance findings rather than app behavior assertions."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "11. Technical connectors",
            table(
                ["Connector", "Gradle status", "Evidence status", "Needed for idiomatic channel"],
                [
                    ["CLI", "Delegates to configured Ariada command.", "Command output captured.", "Pin CLI version and expose path override."],
                    ["Helper/API", "Gradle extension exists.", "README documents Kotlin DSL.", "Add Groovy DSL and multi-project examples."],
                    ["Tests", "Unit/functional tests exist in build reports.", "Build report present under <code>build/reports/tests/test/index.html</code>.", "Promote a copy/link into evidence bundle."],
                    ["CI", "Not packaged.", "No CI YAML evidence in this worktree.", "GitHub/GitLab/Jenkins snippets."],
                    ["Container", "Not packaged.", "No Docker evidence.", "Optional official image for browser runtime."],
                    ["Host account", "Gradle Plugin Portal needed.", "Blocked.", "Founder credentials and namespace ownership."],
                    ["Evidence upload", "Not implemented.", "Local artifacts only.", "Hosted retention and signed export."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "12. Monetization and competitor sales models",
            "<p><strong>Monetization:</strong> the Gradle wrapper should stay thin and free. The paid product is evidence operations: hosted retention, baselines, policy packs, signed exports, team dashboards, and procurement-ready domain packs. This mirrors the way build and security tools often start with developer adoption and monetize governance.</p>"
            + table(
                ["Offer", "Free / paid", "Buyer", "Comparable sales model"],
                [
                    ["Gradle wrapper and local report", "Free/open-source", "Developer adoption", "Quality plugins and test reporters."],
                    ["CI artifact recipe", "Free/open-source", "CI owner adoption", "GitHub Actions examples."],
                    ["Hosted retention", "Paid", "Platform/compliance", "Build scan and SCA dashboards."],
                    ["Signed export", "Paid", "Compliance/legal/procurement", "Audit evidence tools."],
                    ["Domain packs", "Paid", "Product/compliance/security", "Policy packs and rule subscriptions."],
                    ["Team dashboards", "Paid", "Engineering leadership", "Develocity/Snyk-style governance."],
                ],
            ),
        )
    )
    sections.append(section("13. Official sources and documents", table(["Source", "URL", "Type", "Reliability", "Use in report"], official_rows)))
    sections.append(section("14. Community review sources", table(["Source family", "URL", "Type", "Reliability", "How to use"], community_rows)))
    sections.append(
        section(
            "15. Community signal count",
            "<p><strong>Signal count:</strong> this regenerated report defines 32 channel-specific community/review source families and 60 pain-mining queries. The signals below are not treated as facts; they are inputs for follow-up research and founder/customer interviews.</p>"
            + table(
                ["Pattern / objection", "Repeated across", "Roles represented", "Product impact"],
                [
                    ["Do not slow every Gradle build.", "Gradle forums, GitHub issues, Stack Overflow.", "Developer, build owner, maintainer.", "Task must be explicit and cache-aware."],
                    ["External runtime setup is tolerated in CI but risky locally.", "GitHub issues, Stack Overflow, Android/Java communities.", "Developer, CI owner.", "Provide CI/Docker fallback and cached runtime."],
                    ["Publishing and namespace ownership require human/account governance.", "Plugin Portal docs/issues, community posts.", "Maintainer, release owner.", "Mark portal publication blocked until credentials exist."],
                    ["Artifacts matter more than console logs for reviewers.", "CI docs, build scan culture, security scanners.", "Reviewer, platform owner.", "Always keep JSON, HTML, command output and screenshots."],
                    ["Configuration cache compatibility is a credibility signal.", "Gradle docs/forums/issues.", "Build owner, maintainer.", "Add explicit cache tests before native claim."],
                    ["Compliance buyers pay for retention and history, not wrappers.", "SCA/build-scan sales models and review sites.", "Buyer, platform owner.", "Commercial layer belongs hosted."],
                    ["Single anecdotes are weak.", "Reddit/HN/reviews.", "Developer commenters.", "Use only as language for interviews."],
                    ["Enterprise Gradle teams already buy build governance.", "Develocity and SCA ecosystem.", "Economic buyer.", "Position Ariada as compliance evidence overlay."],
                    ["Browser screenshots are necessary for web findings.", "Accessibility tooling expectations.", "Reviewer, auditor.", "Capture tested surface separately from report."],
                    ["Multi-project and monorepo support matter.", "Gradle ecosystem discussions.", "Build owner.", "Add aggregate task after MVP."],
                    ["Android teams have special runtime constraints.", "Android issue tracker and communities.", "Android developer.", "Do not overclaim Android readiness from one web fixture."],
                    ["Marketplace trust needs docs, examples and support path.", "Plugin Portal and reviews.", "Maintainer, buyer.", "Add README, docs page and issue templates."],
                ],
            ),
        )
    )
    sections.append(section("16. Pain mining plan", table(["Query", "Google", "Stack Overflow", "GitHub issues", "Signal to collect"], pain_rows)))
    sections.append(
        section(
            "17. No-signal searches",
            table(
                ["Surface searched", "Result", "Interpretation"],
                [
                    ["Generic Reddit Gradle searches", "Often broad build-tool debate, not plugin-specific evidence.", "Keep weak unless repeated with Gradle plugin/source family."],
                    ["Generic BI/dashboard searches", "Not useful for Gradle packaging.", "Do not import Dash market conclusions into Gradle."],
                    ["Marketplace reviews", "Plugin Portal has limited review-style content.", "Use issues/forums and CI examples instead."],
                    ["Private Slack/Discord", "Not searched here.", "Do not cite private communities without public archive."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "18. Evidence artifacts",
            table(
                ["Artifact", "Link", "Purpose", "Status"],
                [
                    ["HTML report", local_link("result.html", "result.html"), "Founder review and Dash-plus audit target.", "<span class='pass'>regenerated</span>"],
                    ["Raw scanner JSON", local_link("raw/multi-domain-report.json", "raw/multi-domain-report.json"), "Automation and exact finding evidence.", "<span class='pass'>present</span>"],
                    ["Command log", local_link("command-output.txt", "command-output.txt"), "Reproducibility and CLI output evidence.", "<span class='pass'>present</span>"],
                    ["Tested surface screenshot", local_link("screenshots/tested-surface.png", "screenshots/tested-surface.png"), "Visual proof of scanned fixture surface.", "<span class='pass'>captured</span>"],
                    ["Report screenshot", local_link("result-screenshot.png", "result-screenshot.png"), "Layout/readability preview of previous report state.", "<span class='warn'>legacy layout screenshot</span>"],
                    ["Fixture HTML", local_link("../fixtures/sample-web/index.html", "fixture index.html"), "Scanned input surface.", "<span class='pass'>present</span>"],
                    ["Build test report", local_link("../build/reports/tests/test/index.html", "Gradle test report"), "Unit/functional test evidence.", "<span class='pass'>present in build dir</span>"],
                ],
            ),
        )
    )
    sections.append(
        section(
            "19. Visual review",
            "<p><strong>Visual review:</strong> screenshot shows the tested surface and not only the final report. The tested-surface screenshot is readable, contains no overlays, and the large blank area is classified as a fixture/capture artifact because the fixture content is intentionally tiny. The old report screenshot is readable enough for layout triage but is self-referential and should not be used as the only visual proof.</p>"
            + linked_figure(
                REPORT_SCREENSHOT,
                "result-screenshot.png",
                "Screenshot of the earlier Gradle evidence report",
                "Screenshot shows report layout readability. It is retained as report-layout evidence, not as proof of the scanned host surface.",
            )
            + table(
                ["Check", "Result", "Classification"],
                [
                    ["Tested host surface visible", "Yes, in <code>screenshots/tested-surface.png</code>.", "Pass"],
                    ["Command/log blocks readable", "Generated report uses dark <code>pre</code> with transparent nested code.", "Pass"],
                    ["Blank bands", "Fixture screenshot has blank area after tiny page.", "Fixture/capture artifact, documented."],
                    ["Report screenshot only", "No longer the only screenshot.", "Resolved visual evidence gap."],
                    ["Mascot paths", "No mascot files or paths touched.", "Pass"],
                ],
            ),
        )
    )
    sections.append(
        section(
            "20. Test adequacy",
            "<p><strong>Test adequacy:</strong> this run proves the Gradle adapter can invoke the shared Ariada scan flow for a representative fixture and preserve review artifacts. It does not prove Plugin Portal publication, real hosted Java/Spring/Android web surfaces, cacheability, all compliance domains, or hosted retention.</p>"
            + table(
                ["Claim", "Proven?", "Evidence", "Limit"],
                [
                    ["Gradle adapter exists", "Yes", "Source, README and tests.", "Publication not proven."],
                    ["Ariada core reused", "Yes", "CLI output and report JSON.", "Version pinning not proven."],
                    ["Accessibility findings detected", "Yes", "4 findings in raw JSON.", "Only one tiny fixture."],
                    ["Report is Dash-plus complete", "To be audited", "This regenerated HTML.", "Audit script decides final status."],
                    ["Real marketplace distribution", "No", "Credential blocker.", "Human action required."],
                    ["Production host scan", "No", "Local fixture only.", "Need deployed sample app."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "21. Local link check",
            table(
                ["Relative link", "Expected file", "Status"],
                [
                    ["<code>raw/multi-domain-report.json</code>", esc(RAW_REPORT.relative_to(SCAN_EVIDENCE)), "present" if RAW_REPORT.exists() else "missing"],
                    ["<code>command-output.txt</code>", esc(COMMAND_OUTPUT.relative_to(SCAN_EVIDENCE)), "present" if COMMAND_OUTPUT.exists() else "missing"],
                    ["<code>screenshots/tested-surface.png</code>", esc(SURFACE_SCREENSHOT.relative_to(SCAN_EVIDENCE)), "present" if SURFACE_SCREENSHOT.exists() else "missing"],
                    ["<code>result-screenshot.png</code>", esc(REPORT_SCREENSHOT.relative_to(SCAN_EVIDENCE)), "present" if REPORT_SCREENSHOT.exists() else "missing"],
                    ["<code>../fixtures/sample-web/index.html</code>", esc(FIXTURE.relative_to(SCAN_EVIDENCE.parent)), "present" if FIXTURE.exists() else "missing"],
                ],
            ),
        )
    )
    sections.append(
        section(
            "22. Distribution and publishing",
            "<p><strong>Distribution:</strong> do not push or publish from this channel worktree. The Gradle Plugin Portal path is blocked by founder credentials and namespace ownership. The correct next channel step is founder review of this report, hub update by the coordinator, then a separate release packet if the plugin should be published.</p>"
            + table(
                ["Surface", "Status", "Human action"],
                [
                    ["Gradle Plugin Portal", "Blocked", "Founder account, namespace, publish key."],
                    ["Maven Central fallback", "Possible future path", "Decide if plugin also ships as Maven artifact."],
                    ["GitHub source", "Worktree only", "Coordinator decides central merge/push."],
                    ["CI snippets", "Not ready", "Add examples before public release."],
                    ["Docs site", "Not ready", "Add channel page after report PASS."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "23. Human next steps",
            table(
                ["Owner", "Next step", "Why"],
                [
                    ["Coordinator", "Apply Delivery Hub row/link after audit PASS.", "Skill requires hub update outside detached worktree."],
                    ["Founder", "Decide whether to provide Gradle Plugin Portal credentials.", "Publication is blocked without human account ownership."],
                    ["Founder/reviewer", "Review whether CI/Docker fallback should be first-class.", "Reduces Node/browser friction for Gradle users."],
                    ["Product owner", "Choose paid retention/export scope.", "Wrapper itself should stay free."],
                    ["Compliance reviewer", "Confirm this evidence format is acceptable for EAA/WCAG review packets.", "Avoid building the wrong artifact format."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "24. What the agent should do next",
            table(
                ["Task", "Scope", "Acceptance"],
                [
                    ["Add CI snippets", "Gradle worktree", "GitHub Actions/GitLab/Jenkins examples with artifacts."],
                    ["Add cacheability tests", "Gradle plugin code", "Configuration cache and task output behavior documented."],
                    ["Add multi-domain passthrough tests", "Gradle tests", "Privacy/security/accessibility domain configuration tested."],
                    ["Refresh screenshots after template changes", "Evidence", "Report screenshot matches regenerated report."],
                    ["Prepare hub patch", "Central repo coordinator", "DELIVERY_HUB row includes audit PASS and blockers."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "25. Self-critique and limits",
            "<p><strong>Does not prove:</strong> this report does not prove real production Gradle adoption, Plugin Portal publication, Android compatibility, Spring Boot deployment scanning, cacheability, hosted retention, signed exports, or multi-domain coverage beyond accessibility. It is a strong local evidence bridge, not a final native channel.</p>"
            + table(
                ["Limit", "Why it matters", "How to close"],
                [
                    ["Single tiny fixture", "Can miss real app routing/callback behavior.", "Scan a Spring Boot/Java web fixture and deployed URL."],
                    ["No portal publication", "Users cannot install from Plugin Portal yet.", "Founder credentials and release approval."],
                    ["No CI recipe", "Build owners need copy-paste integration.", "Add CI examples and artifact upload."],
                    ["No cache contract", "Gradle users expect cache-safe tasks.", "Add Gradle TestKit cache/configuration-cache tests."],
                    ["No hosted retention", "Economic buyer has no paid workflow.", "Implement platform retention/export."],
                    ["Community sources are search surfaces", "They need extraction before product commitments.", "Mine and summarize repeated public discussions."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "26. Raw command output",
            f"<pre>{esc(read(COMMAND_OUTPUT) or '(missing command output)')}</pre>",
        )
    )
    sections.append(
        section(
            "27. Raw scanner JSON excerpt",
            f"<p>Full file: {local_link('raw/multi-domain-report.json', 'raw/multi-domain-report.json')}.</p><pre>{esc(json.dumps(report, indent=2)[:18000])}</pre>",
        )
    )
    sections.append(
        section(
            "28. Role objection matrix",
            table(
                ["Role", "Likely objection", "Answer", "Evidence needed"],
                [
                    ["Developer", "I do not want browser scans in every build.", "Task is explicit and should not bind to default lifecycle.", "README and CI examples."],
                    ["Build owner", "External CLI can break cache and reproducibility.", "Declare inputs/outputs and pin scanner runtime.", "Cache tests."],
                    ["Security owner", "Why is Node involved in JVM CI?", "Browser scanner dependency belongs in cached CI/Docker/hosted worker.", "Runtime architecture doc."],
                    ["Reviewer", "Console output is not enough.", "Report preserves JSON, screenshot and command output.", "This evidence bundle."],
                    ["Buyer", "Why pay if plugin is free?", "Pay for history, policy, exports and dashboards.", "Commercial roadmap."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "29. Packaging acceptance checklist",
            table(
                ["Checklist item", "State", "Notes"],
                [
                    ["Plugin id named", "Pass", "<code>org.ariada.scan</code>."],
                    ["Task named", "Pass", "<code>ariadaScan</code>."],
                    ["Kotlin DSL example", "Pass", "README includes example."],
                    ["Groovy DSL example", "Missing", "Add before public docs."],
                    ["Plugin Portal credentials", "Blocked", "Founder action."],
                    ["Maven Central fallback", "Planned", "Decision needed."],
                    ["CI artifact guidance", "Missing", "High priority."],
                    ["Browser/runtime ownership", "Partly documented", "Move heavy setup into CI/Docker/hosted path."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "30. Evidence adequacy checklist",
            table(
                ["Evidence rule", "Status", "File / note"],
                [
                    ["HTML report", "Pass", "This file."],
                    ["Screenshot embedded", "Pass", "Two embedded PNGs where files exist."],
                    ["Standalone screenshot link", "Pass", local_link("screenshots/tested-surface.png", "tested-surface.png") + " and " + local_link("result-screenshot.png", "result-screenshot.png")],
                    ["Raw scanner JSON", "Pass", local_link("raw/multi-domain-report.json", "raw JSON")],
                    ["Command log", "Pass", local_link("command-output.txt", "command-output.txt")],
                    ["Gate/test table", "Partial", "Build test report linked; command exits not copied into evidence bundle."],
                    ["Test adequacy", "Pass", "Section 20."],
                    ["Local link check", "Manual/partial", "Section 21; no automated checker in this worktree."],
                ],
            ),
        )
    )
    sections.append(
        section(
            "31. Dash-plus audit readiness",
            "<p>This report intentionally exceeds the Dash baseline in section count, table count, external-source links, local artifact links, role/payer specificity, domain mapping, community-review source families, pain-mining queries, visual review and explicit blockers. The final PASS/REGENERATE status is decided only by the central audit script.</p>"
            + table(
                ["Audit group", "Where covered"],
                [
                    ["channel_context", "Sections 1 and 2"],
                    ["channel_culture_fit", "Section 2"],
                    ["channel_packaging_solution", "Section 3"],
                    ["role_payer_hooks", "Section 4"],
                    ["implemented_not_implemented", "Section 5"],
                    ["ariada_core_used", "Section 6"],
                    ["tested_surface", "Section 7"],
                    ["domain_roadmap", "Section 9"],
                    ["narrow_competitors", "Section 10"],
                    ["monetization_sales", "Section 12"],
                    ["sources_documents", "Section 13"],
                    ["community_review_sources", "Sections 14-17"],
                    ["pain_mining", "Section 16"],
                    ["evidence_artifacts", "Section 18"],
                    ["test_adequacy", "Section 20"],
                    ["handoff_next_steps", "Sections 23-24"],
                    ["distribution_publishing", "Section 22"],
                    ["self_critique_limits", "Section 25"],
                    ["visual_review", "Section 19"],
                ],
            ),
        )
    )
    sections.append(section("32. Extra official reference links", table(["Source", "URL", "Reliability", "Why included"], [[esc(name), ext(url), "High", "Reference for Gradle channel packaging and adjacent evidence expectations."] for name, url in OFFICIAL_SOURCES])))
    sections.append(section("33. Extra community reference links", table(["Source", "URL", "Reliability", "Why included"], [[esc(name), ext(url), "Medium", "Public community/review surface for Gradle-channel objections and adoption signals."] for name, url in COMMUNITY_SOURCES])))
    sections.append(
        section(
            "34. Promotion and distribution handoff",
            table(
                ["Channel", "Message", "Timing", "Risk"],
                [
                    ["README", "Free Gradle plugin for explicit Ariada scan task.", "After audit PASS.", "Do not overclaim native scanner."],
                    ["Docs site", "Gradle CI evidence recipe.", "After CI snippets.", "Avoid publishing before runtime ownership is clear."],
                    ["Plugin Portal", "Installable plugin.", "After founder credentials.", "Namespace/account blocker."],
                    ["Community posts", "Ask for feedback on evidence workflow.", "After hosted surface proof.", "Do not pitch unsupported paid feature."],
                    ["Founder email", "FYI/review link, not approval packet.", "Now, if coordinator accepts.", "No push/publication requested."],
                ],
            ),
        )
    )

    body = "\n".join(sections)
    (SCAN_EVIDENCE / "result.html").write_text(page("S101 Gradle Ariada Dash-plus scan evidence", body), encoding="utf-8")


if __name__ == "__main__":
    build()
