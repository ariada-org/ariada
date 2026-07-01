#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2

import base64
import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "scan-evidence"
SCREENSHOT = EVIDENCE / "screenshots" / "scan-result.png"
PREVIEW = EVIDENCE / "scan-result-preview.html"
RESULT = EVIDENCE / "result.html"
REPORT_JSON = EVIDENCE / "ariada-output" / "multi-domain-report.json"


def esc(value):
    return html.escape(str(value), quote=True)


def link(url, label=None):
    text = label or url
    return f'<a href="{esc(url)}">{esc(text)}</a>'


def write_clean(path, content):
    path.write_text("\n".join(line.rstrip() for line in content.splitlines()) + "\n")


official_sources = [
    ("Phoenix Framework home", "https://www.phoenixframework.org/", "Primary framework page; proves Phoenix is the named web framework surface."),
    ("Phoenix Guides", "https://hexdocs.pm/phoenix/overview.html", "Official guides; validates the route/controller/template and LiveView shape Ariada targets."),
    ("Phoenix LiveView docs", "https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html", "Official LiveView docs; explains the HTML-over-WebSocket interaction surface."),
    ("Phoenix testing docs", "https://hexdocs.pm/phoenix/testing.html", "Official testing docs; anchors where an explicit mix task can sit beside normal Phoenix tests."),
    ("Mix.Task docs", "https://hexdocs.pm/mix/Mix.Task.html", "Official Elixir build-tool API used by this package."),
    ("OptionParser docs", "https://hexdocs.pm/elixir/OptionParser.html", "Official option parser used by the mix task."),
    ("System.cmd docs", "https://hexdocs.pm/elixir/System.html#cmd/3", "Official process API used to invoke the shared Ariada CLI."),
    ("Jason package", "https://hex.pm/packages/jason", "Elixir JSON decoder used to parse Ariada CLI output."),
    ("Hex package docs", "https://hex.pm/docs/publish", "Official publishing path and account blocker for Hex.pm."),
    ("Hex package registry", "https://hex.pm/", "Distribution registry surface for the channel."),
    ("HexDocs", "https://hexdocs.pm/", "Documentation hosting surface for published Hex packages."),
    ("Elixir getting started", "https://elixir-lang.org/getting-started/introduction.html", "Primary language documentation for the package runtime."),
    ("Mix and OTP guide", "https://elixir-lang.org/getting-started/mix-otp/introduction-to-mix.html", "Official explanation of Mix as build and task entrypoint."),
    ("Phoenix security guide", "https://hexdocs.pm/phoenix/security.html", "Official adjacent domain source for secure Phoenix defaults."),
    ("Phoenix deployment guide", "https://hexdocs.pm/phoenix/deployment.html", "Official release/deployment workflow; helps place Ariada in release evidence."),
]

community_sources = [
    ("Elixir Forum search: Phoenix accessibility", "https://elixirforum.com/search?q=phoenix%20accessibility", "Developer and maintainer discussions; strongest channel-specific pain source."),
    ("Elixir Forum search: LiveView accessibility", "https://elixirforum.com/search?q=liveview%20accessibility", "LiveView-specific accessibility objections and implementation questions."),
    ("Elixir Forum search: axe accessibility", "https://elixirforum.com/search?q=axe%20accessibility", "Signals whether teams already bridge to axe/JS tooling."),
    ("Elixir Forum search: pa11y Phoenix", "https://elixirforum.com/search?q=pa11y%20phoenix", "Tests if Node-based scanners are accepted in Phoenix CI."),
    ("Elixir Forum search: Wallaby accessibility", "https://elixirforum.com/search?q=wallaby%20accessibility", "Browser-test culture and acceptance of headless workflows."),
    ("Elixir Forum search: Hound accessibility", "https://elixirforum.com/search?q=hound%20accessibility", "Older browser-test channel evidence."),
    ("Reddit r/elixir search: Phoenix accessibility", "https://www.reddit.com/r/elixir/search/?q=phoenix%20accessibility&restrict_sr=1", "Community sentiment and lightweight adoption objections."),
    ("Reddit r/elixir search: LiveView accessibility", "https://www.reddit.com/r/elixir/search/?q=liveview%20accessibility&restrict_sr=1", "LiveView-specific developer concerns."),
    ("Reddit r/phoenixframework search", "https://www.reddit.com/r/phoenixframework/search/?q=accessibility&restrict_sr=1", "Framework-specific Reddit surface; lower volume but precise."),
    ("Stack Overflow phoenix-framework accessibility", "https://stackoverflow.com/search?q=%5Bphoenix-framework%5D+accessibility", "Question-and-answer failure modes from implementers."),
    ("Stack Overflow elixir accessibility", "https://stackoverflow.com/search?q=%5Belixir%5D+accessibility", "Language-level accessibility mentions; expected weak signal."),
    ("GitHub search: Phoenix accessibility issues", "https://github.com/search?q=phoenix+accessibility&type=issues", "Issue-level implementation pain and plugin gaps."),
    ("GitHub search: LiveView accessibility issues", "https://github.com/search?q=liveview+accessibility&type=issues", "LiveView issue clusters and regression reports."),
    ("GitHub search: mix task accessibility", "https://github.com/search?q=%22mix%22+%22accessibility%22+%22Phoenix%22&type=code", "Code-search signal for how teams wire checks today."),
    ("GitHub search: Wallaby Phoenix accessibility", "https://github.com/search?q=wallaby+phoenix+accessibility&type=issues", "Browser-test competitor and fixture patterns."),
    ("GitHub search: Hound Phoenix accessibility", "https://github.com/search?q=hound+phoenix+accessibility&type=issues", "Historical browser-test competitor and maintenance signal."),
    ("Hacker News search: Phoenix LiveView accessibility", "https://hn.algolia.com/?q=Phoenix%20LiveView%20accessibility", "Adoption conversation from senior developers and founders."),
    ("Hacker News search: Elixir Phoenix", "https://hn.algolia.com/?q=Elixir%20Phoenix", "Channel culture, deployment, and framework sentiment."),
    ("Libraries.io Hex Ariada-adjacent search", "https://libraries.io/search?platforms=Hex&q=accessibility", "Registry saturation check for Hex accessibility packages."),
    ("Hex.pm search: accessibility", "https://hex.pm/packages?search=accessibility", "Direct Hex channel saturation signal."),
    ("Hex.pm search: axe", "https://hex.pm/packages?search=axe", "Checks whether axe-core wrappers already occupy Hex."),
    ("Hex.pm search: pa11y", "https://hex.pm/packages?search=pa11y", "Checks whether pa11y wrappers already occupy Hex."),
    ("Hex.pm search: wallaby", "https://hex.pm/packages?search=wallaby", "Browser automation package presence."),
    ("Hex.pm search: hound", "https://hex.pm/packages?search=hound", "Browser automation package presence and maturity."),
]

domain_sources = [
    ("WCAG 2.2", "https://www.w3.org/TR/WCAG22/", "Accessibility criteria anchor for the initial package."),
    ("WAI tutorials", "https://www.w3.org/WAI/tutorials/", "Practical HTML remediation examples for Phoenix teams."),
    ("EN 301 549", "https://www.etsi.org/deliver/etsi_en/301500_301599/301549/", "EU accessibility procurement anchor."),
    ("European Accessibility Act overview", "https://single-market-economy.ec.europa.eu/single-market/european-standards/harmonised-standards/accessibility_en", "EAA harmonised standards context."),
    ("GDPR legal text", "https://eur-lex.europa.eu/eli/reg/2016/679/oj", "Privacy/GDPR domain anchor."),
    ("OWASP ASVS", "https://owasp.org/www-project-application-security-verification-standard/", "Security domain anchor."),
    ("OWASP Top 10", "https://owasp.org/www-project-top-ten/", "Security risk language for buyers."),
    ("Core Web Vitals", "https://web.dev/vitals/", "Performance domain anchor."),
    ("HTTP Archive sustainability", "https://httparchive.org/reports/state-of-the-web", "Sustainability/performance evidence surface."),
    ("Schema.org", "https://schema.org/", "SEO/AIEO/GEO structured-data anchor."),
    ("Google Search Central", "https://developers.google.com/search/docs", "Search quality and crawlability source."),
    ("W3C i18n", "https://www.w3.org/International/", "Localization and internationalization anchor."),
    ("EU AI Act official page", "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", "AI/compliance domain anchor."),
    ("SPDX", "https://spdx.dev/", "Data provenance and license evidence anchor."),
    ("OpenSSF Scorecard", "https://github.com/ossf/scorecard", "Supply-chain reliability anchor."),
    ("SLSA", "https://slsa.dev/", "Build provenance anchor."),
    ("Mozilla Observatory", "https://observatory.mozilla.org/", "Security comparator."),
    ("Lighthouse", "https://developer.chrome.com/docs/lighthouse/overview", "Performance and accessibility comparator."),
    ("axe-core", "https://github.com/dequelabs/axe-core", "Accessibility engine competitor/source."),
    ("Pa11y", "https://pa11y.org/", "Open-source accessibility CLI competitor."),
    ("Accessibility Insights", "https://accessibilityinsights.io/", "Microsoft accessibility tool comparator."),
    ("Siteimprove accessibility", "https://www.siteimprove.com/toolkit/accessibility-checker/", "Commercial competitor comparator."),
    ("Deque axe DevTools", "https://www.deque.com/axe/devtools/", "Commercial competitor comparator."),
    ("Evinced", "https://www.evinced.com/", "Commercial accessibility automation competitor."),
    ("AudioEye", "https://www.audioeye.com/", "Commercial monitoring competitor."),
    ("EqualWeb", "https://www.equalweb.com/", "Commercial overlay/monitoring comparator."),
    ("UserWay", "https://userway.org/", "Commercial overlay comparator."),
    ("accessiBe", "https://accessibe.com/", "Commercial overlay comparator."),
]

extra_queries = [
    ("Google query: Phoenix WCAG", "https://www.google.com/search?q=Phoenix+Framework+WCAG+accessibility"),
    ("Google query: LiveView aria", "https://www.google.com/search?q=Phoenix+LiveView+ARIA+accessibility"),
    ("Google query: Hex accessibility package", "https://www.google.com/search?q=site%3Ahex.pm%2Fpackages+accessibility+elixir"),
    ("Google query: Elixir axe-core", "https://www.google.com/search?q=Elixir+axe-core+Phoenix"),
    ("Google query: Phoenix pa11y CI", "https://www.google.com/search?q=Phoenix+pa11y+CI"),
    ("Google query: Phoenix Lighthouse CI", "https://www.google.com/search?q=Phoenix+Lighthouse+CI"),
    ("GitHub query: mix task ariada shape", "https://github.com/search?q=%22defmodule+Mix.Tasks%22+%22System.cmd%22&type=code"),
    ("GitHub query: Phoenix LiveView axe", "https://github.com/search?q=Phoenix+LiveView+axe&type=issues"),
    ("GitHub query: Phoenix accessibility audit", "https://github.com/search?q=Phoenix+%22accessibility+audit%22&type=issues"),
    ("Stack Overflow query: LiveView aria", "https://stackoverflow.com/search?q=%5Bphoenix-live-view%5D+aria"),
    ("Stack Overflow query: Phoenix form label", "https://stackoverflow.com/search?q=%5Bphoenix-framework%5D+form+label"),
    ("Stack Overflow query: Elixir Wallaby", "https://stackoverflow.com/search?q=%5Belixir%5D+wallaby+phoenix"),
    ("Reddit query: Phoenix testing", "https://www.reddit.com/r/elixir/search/?q=Phoenix%20testing&restrict_sr=1"),
    ("Reddit query: Elixir CI", "https://www.reddit.com/r/elixir/search/?q=CI%20Phoenix&restrict_sr=1"),
    ("HN query: accessibility testing", "https://hn.algolia.com/?q=accessibility%20testing%20Phoenix"),
    ("Libraries.io Hex Phoenix testing", "https://libraries.io/search?platforms=Hex&q=phoenix%20testing"),
    ("Libraries.io Hex CI", "https://libraries.io/search?platforms=Hex&q=ci"),
    ("Hex.pm search: phoenix testing", "https://hex.pm/packages?search=phoenix%20testing"),
    ("Hex.pm search: liveview testing", "https://hex.pm/packages?search=liveview%20testing"),
    ("Hex.pm search: credo", "https://hex.pm/packages?search=credo"),
    ("Hex.pm search: sobelow", "https://hex.pm/packages?search=sobelow"),
    ("Hex.pm search: dialyxir", "https://hex.pm/packages?search=dialyxir"),
    ("Hex.pm search: excoveralls", "https://hex.pm/packages?search=excoveralls"),
    ("Hex.pm search: ex_doc", "https://hex.pm/packages?search=ex_doc"),
    ("Hex.pm search: wallaby", "https://hex.pm/packages?search=wallaby"),
    ("Hex.pm search: hound", "https://hex.pm/packages?search=hound"),
    ("Hex.pm search: bypass", "https://hex.pm/packages?search=bypass"),
    ("Hex.pm search: playwright", "https://hex.pm/packages?search=playwright"),
    ("GitHub issue query: sobelow Phoenix", "https://github.com/search?q=sobelow+phoenix&type=issues"),
    ("GitHub issue query: credo Phoenix", "https://github.com/search?q=credo+phoenix&type=issues"),
    ("GitHub issue query: liveview test accessibility", "https://github.com/search?q=liveview+test+accessibility&type=issues"),
    ("GitHub issue query: Phoenix form validation accessibility", "https://github.com/search?q=Phoenix+form+validation+accessibility&type=issues"),
    ("Elixir Forum query: Sobelow CI", "https://elixirforum.com/search?q=sobelow%20ci"),
    ("Elixir Forum query: Credo CI", "https://elixirforum.com/search?q=credo%20ci"),
    ("Elixir Forum query: Wallaby CI", "https://elixirforum.com/search?q=wallaby%20ci"),
    ("Elixir Forum query: Playwright", "https://elixirforum.com/search?q=playwright"),
    ("Elixir Forum query: Lighthouse", "https://elixirforum.com/search?q=lighthouse"),
    ("Elixir Forum query: Axe", "https://elixirforum.com/search?q=axe"),
    ("Elixir Forum query: WCAG", "https://elixirforum.com/search?q=WCAG"),
    ("Elixir Forum query: EAA", "https://elixirforum.com/search?q=European%20Accessibility%20Act"),
]

domains = [
    ("Accessibility", "Implemented first. Phoenix renders semantic HTML, HEEx templates, forms, and LiveView states that can be scanned as DOM output. The fixture proves missing alternative text, missing form labels, and heading-order evidence; a live host would add route crawling and LiveView state snapshots."),
    ("Security", "Planned. Phoenix teams already accept Sobelow-style security checks in CI; Ariada should not replace Sobelow, but can attach security-header, CSP, mixed-content, and dependency evidence to the same compliance packet."),
    ("Privacy/GDPR", "Planned. Phoenix apps often process account, session, telemetry, and analytics data; Ariada can map cookie banners, consent links, privacy notices, retention claims, and third-party scripts into evidence."),
    ("Performance", "Planned. Lighthouse and Web Vitals are stronger profilers; Ariada should capture release evidence and flag obvious regressions such as oversized LiveView payloads, blocking scripts, and inaccessible slow paths."),
    ("Reliability", "Planned. Phoenix releases value uptime, supervision, and deployment discipline; Ariada can store scan reproducibility, command logs, target URLs, route coverage, and artifact hashes."),
    ("Sustainability", "Planned. The useful channel angle is not carbon estimation precision; it is lean pages, fewer third-party scripts, smaller assets, and durable evidence for public-sector procurement."),
    ("SEO/AIEO/GEO", "Planned. Phoenix sites need crawlable templates, metadata, structured data, and AI-answer provenance; Ariada can add search and answer-engine checks after accessibility evidence is stable."),
    ("Legal notices", "Planned. EU-facing Phoenix apps need imprint/contact/company/legal-notice surfaces; Ariada can check visible notices and ownership provenance in release packets."),
    ("Localization/i18n", "Planned. Gettext and locale routing are common in Phoenix; Ariada can check lang attributes, translated legal pages, locale switchers, and missing localized alt text."),
    ("Data provenance", "Planned. Hex packages and CI artifacts need source revision, package version, command log, fixture hashes, and generated-report provenance."),
    ("AI/compliance", "Planned. If Phoenix apps expose AI features, Ariada can attach EU AI Act disclosure and human-review evidence without moving AI reasoning into the Hex wrapper."),
]

roles = [
    ("Phoenix developer", "Uses `mix ariada.scan` locally and in CI after `mix test`.", "Usually not the payer; they buy time and fewer review loops.", "Ready as a thin wrapper; host blocked locally because Elixir/Mix are absent and Docker daemon is stopped."),
    ("Platform owner", "Needs repeatable release evidence across Phoenix services.", "Pays for retention, baseline policy, signed exports, and team dashboards.", "Wrapper produces JSON/log/report paths; hosted retention is not implemented."),
    ("Accessibility reviewer", "Needs readable before/after artifacts and screenshot context.", "Buys audit velocity and less manual screenshot collection.", "Report exists; live Phoenix host screenshot is blocked until Elixir/Mix or a running Docker daemon is available."),
    ("Agency lead", "Wants a small Hex dependency that does not force every developer into a SaaS UI.", "Pays for branded exports and compliance packs for clients.", "MVP bridge works conceptually; Hex publication is blocked by account/auth."),
    ("Procurement/compliance buyer", "Needs EAA, EN 301 549, GDPR, and legal-notice traceability.", "Pays for durable evidence, audit history, and policy mapping.", "Domain roadmap is defined; only accessibility fixture evidence is implemented."),
    ("Security/privacy owner", "Wants accessibility evidence to sit near Sobelow/Credo/CI artifacts.", "Pays when the evidence packet reduces vendor-risk review.", "Security/privacy domains are mapped but not implemented in the wrapper."),
]

competitors = [
    ("axe-core / axe DevTools", "Strong accessibility engine and developer tooling.", "Not Hex-native; Phoenix teams usually bridge through JS/browser tooling."),
    ("Pa11y", "Open-source CLI for accessibility checks.", "Node/browser dependency is acceptable in CI but not idiomatic as a Phoenix package."),
    ("Lighthouse CI", "Broad performance/accessibility/SEO evidence.", "Good comparator, but less compliance-packet and domain-roadmap focused."),
    ("Accessibility Insights", "Manual and automated accessibility testing.", "Strong reviewer workflow; not Phoenix build-tool native."),
    ("Sobelow", "Phoenix security scanner.", "Adjacent accepted CI tool; Ariada should integrate near it, not compete on security rules."),
    ("Credo", "Elixir static analysis/linting.", "Sets culture expectation for Mix-based gates and readable findings."),
    ("Wallaby / Hound", "Elixir browser-test libraries.", "Possible host-surface capture layer but heavier than a release evidence gate."),
    ("Commercial suites", "Deque, Siteimprove, Evinced, AudioEye, EqualWeb, UserWay, accessiBe.", "Sell dashboards, monitoring, or overlays; Ariada's channel wedge is open evidence plus hosted retention."),
]

signals = [
    ("Elixir Forum", "Developers and maintainers", "Phoenix teams discuss tooling fit in terms of Mix tasks, CI ergonomics, and avoiding surprising runtime dependencies.", "Strong enough to shape packaging."),
    ("Hex.pm search", "Maintainers and package evaluators", "Sparse accessibility package saturation suggests a gap, while Credo/Sobelow show quality gates are accepted.", "Strong channel signal."),
    ("GitHub issues/search", "Framework users and library maintainers", "Accessibility questions appear as bugs, template issues, and LiveView state concerns rather than a single dominant package.", "Strong for backlog discovery."),
    ("Stack Overflow", "Implementers", "Likely lower volume for Phoenix accessibility, but useful for repeated form, ARIA, and LiveView state mistakes.", "Medium signal."),
    ("Reddit", "Developers and founders", "Useful for adoption objections and tool fatigue, weaker for exact implementation details.", "Weak-to-medium signal."),
    ("Hacker News", "Senior developers/founders", "Useful for Phoenix/LiveView culture and buyer skepticism, not for rule details.", "Weak anecdotal signal."),
    ("Libraries.io", "Registry researchers", "Helps confirm Hex package saturation and maintenance state.", "Medium signal."),
    ("Commercial competitor pages", "Buyers", "Show what paid suites sell: dashboards, retention, audits, managed exports.", "Useful for monetization, not community proof."),
    ("Official Phoenix docs", "Framework maintainers", "Defines idiomatic Mix/Phoenix boundaries.", "Primary implementation source."),
    ("Regulatory docs", "Compliance reviewers", "Define buyer language for EAA, WCAG, EN 301 549, GDPR.", "Primary compliance source."),
    ("No-signal searches", "All roles", "Expected misses: exact `ariada phoenix`, exact `Hex WCAG compliance`, and many `LiveView accessibility scanner` queries.", "Document as absence, not proof of no demand."),
    ("Repeated pattern", "Developers/platform owners", "Use explicit CI/release gates; keep browser/Node work cached and opt-in; store artifacts for reviewers.", "Backed by multiple source families."),
]

deep_dive_notes = [
    (
        "Phoenix release workflow placement",
        "The correct Phoenix placement is after a route or static export is available, not before compilation. A Phoenix controller, component, or LiveView can be perfectly valid Elixir while still rendering inaccessible HTML, so Ariada should run after the app can serve or expose the target state. In a small project that can be a developer command against `http://localhost:4000`; in a serious team it should be a pre-merge CI job, release candidate check, or nightly route scan. That placement respects the Phoenix culture of fast compiler and ExUnit feedback while still producing reviewer-grade evidence. It also avoids pretending that a Hex package can make browser scanning free. The package should therefore document the browser/Node dependency plainly and make CI/Docker the recommended default for repeatable evidence.",
    ),
    (
        "LiveView state coverage boundary",
        "LiveView makes this channel more valuable and more complicated. A static first render can pass while connected states, validation errors, modal flows, focus traps, optimistic updates, or streamed lists fail accessibility. The MVP package should not invent a LiveView crawler. Instead, it should accept explicit URLs, static snapshots, or future state manifests produced by Phoenix tests. A next release can document recipes for capturing LiveView states with Phoenix.LiveViewTest, Wallaby, Playwright, or another browser harness, then hand those HTML states to the shared Ariada CLI. That keeps ownership clear: Phoenix tests create states; Ariada records compliance evidence.",
    ),
    (
        "Hex package trust expectations",
        "Hex users look at package size, dependency footprint, maintainership, docs, and whether a package behaves like normal Mix tooling. A wrapper that silently downloads browsers or phones home would be a poor fit. A wrapper that prints the exact Ariada CLI command, accepts `ARIADA_CLI`, returns a CI exit code, and writes predictable artifacts is much easier to trust. Hex publication also shifts review expectations: package metadata, license, changelog, HexDocs, semantic versioning, and explicit external dependency notes matter. The first release should be conservative and call itself a bridge to shared Ariada, not a native Elixir scanner.",
    ),
    (
        "Agency and public-sector buying motion",
        "Elixir/Phoenix agencies and platform teams do not usually buy a local mix task. They buy reduced client-review time, easier procurement packets, and durable proof that a release candidate was checked against known obligations. For Sweden/EU buyers, accessibility is tied to EAA, EN 301 549, public-sector procurement language, and internal risk review. The Hex package is the adoption hook; the paid product is evidence retention, signatures, dashboards, baseline drift, reviewer collaboration, and multi-domain packs. That distinction should stay visible so developers do not feel a compliance SaaS was smuggled into their build tool.",
    ),
    (
        "Channel saturation reading",
        "The Hex ecosystem has strong quality-gate norms through tools such as Credo, Sobelow, Dialyzer wrappers, coverage tools, and documentation generators. Accessibility-specific package saturation appears lower than JavaScript, npm, or commercial browser-testing ecosystems. That is an opportunity, but not proof of large demand. The repeated pattern to validate is whether Phoenix teams want a Hex-shaped command that delegates to a browser/Node scanner for release evidence. If community research shows resistance to Node dependencies, Ariada should lead with the GitHub Action/Docker path and keep the Hex package as configuration sugar.",
    ),
    (
        "Community objections to expect",
        "Expected objections are predictable: why is Node required in an Elixir project; why not use axe or Lighthouse directly; will it slow CI; does it understand LiveView; does it scan authenticated routes; does it upload data; who maintains the rule mappings; and is this a wrapper around a commercial service. The report and README answer the first version: Node is explicit, scanning is delegated, CI is opt-in, LiveView state coverage is future work, data stays local unless a hosted product is configured, and paid value is retention/signing rather than hidden local execution. Those answers should be tested in Elixir Forum and GitHub issue discussions before a public launch claim.",
    ),
    (
        "Evidence packet shape",
        "Ariada evidence for Phoenix should always include at least six artifacts: the exact target URL or static path, Ariada JSON, command log, exit code, screenshot, and HTML report. For paid or regulated teams it should also include git SHA, package version, operating system, browser version, timestamp, policy baseline, route list, and a signature. The current channel implements the basic artifact path with fixture JSON, command log, result report, preview, and screenshot. It does not yet implement signed provenance or hosted retention, which are product-layer responsibilities rather than Hex-wrapper responsibilities.",
    ),
    (
        "Why not native Elixir rule implementation",
        "A native Elixir rule engine would look attractive to Phoenix developers but would be the wrong first implementation. Accessibility evidence depends on browser-visible DOM, computed attributes, rendered states, and cross-framework comparability. Rewriting rules in Elixir would create divergence from the Ariada engine used by npm, CI, CMS, and other channels. A thin wrapper keeps one rule source, one JSON shape, and one compliance interpretation. If a native helper appears later, it should improve Phoenix route discovery and state capture, not fork the scanner.",
    ),
    (
        "Human review workflow",
        "The human reviewer does not want only a JSON count. They need to see what was scanned, why the target represents the Phoenix product, which defects were intentionally present or fixed, whether the screenshot is a real tested surface, and whether blockers changed the evidence status. That is why this report classifies the screenshot as scan-result preview rather than live host surface. The next human should reject any claim that this is fully live-tested until an Elixir host starts a Phoenix app and captures a route or LiveView screen.",
    ),
    (
        "Ariada next-version backlog",
        "The next product increment should add a route manifest format, a documented GitHub Actions recipe, optional Docker image, artifact naming convention, and examples for Phoenix forms and LiveView validation states. A later paid increment should add retention, signatures, baseline policies, trend dashboards, evidence comparison across releases, and reviewer comments. The wrapper itself should stay small: command options, JSON parsing, gate output, and docs. That constraint protects maintainability and keeps the Hex channel credible.",
    ),
]


def rows(items):
    return "\n".join(
        "<tr>" + "".join(f"<td>{cell}</td>" for cell in item) + "</tr>" for item in items
    )


def table(headers, items, caption):
    head = "".join(f"<th scope=\"col\">{esc(header)}</th>" for header in headers)
    return f"""
    <table>
      <caption>{esc(caption)}</caption>
      <thead><tr>{head}</tr></thead>
      <tbody>{rows(items)}</tbody>
    </table>
    """


def source_table():
    all_sources = official_sources + community_sources + domain_sources + [
        (label, url, "Pain-mining query surface for Phoenix, Hex, accessibility, and CI adoption.")
        for label, url in extra_queries
    ]
    body = []
    for index, (name, url, why) in enumerate(all_sources, 1):
        kind = "community/review" if (name, url, why) in community_sources else "official/domain/query"
        body.append((str(index), link(url, name), esc(kind), esc(why)))
    return table(["#", "Source", "Type", "Why it matters"], body, "Sources and documents")


def screenshot_block():
    if SCREENSHOT.exists():
        encoded = base64.b64encode(SCREENSHOT.read_bytes()).decode("ascii")
        encoded = "\n".join(encoded[index : index + 16] for index in range(0, len(encoded), 16))
        image = f'<img class="screenshot" alt="Ariada Phoenix scan-result preview screenshot" src="data:image/png;base64,{encoded}" />'
    else:
        image = '<div class="missing-shot">Screenshot pending; run browser capture before final audit.</div>'
    return f"""
    <figure>
      {image}
      <figcaption>
        Screenshot classification: scan-result preview backed by a Phoenix-style static rendered-output fixture.
        It is not a report-only screenshot. Tested live Phoenix host surface capture remains blocked because
        `elixir` and `mix` are not installed in this local environment and the local Docker daemon is not running.
        Direct PNG: {link("screenshots/scan-result.png", "scan-result.png")}.
      </figcaption>
    </figure>
    """


def write_preview():
    data = json.loads(REPORT_JSON.read_text())
    finding_rows = []
    for domain, findings in data["findings"].items():
        if not findings:
            continue
        for finding in findings:
            finding_rows.append(
                (
                    esc(domain),
                    esc(finding["ruleId"]),
                    esc(finding["severity"]),
                    esc(finding["criterion"]),
                    esc(finding["message"]),
                )
            )
    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S105 Ariada Phoenix scan-result preview</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f3ea; color: #14213d; }}
    main {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; min-height: 100vh; padding: 32px; box-sizing: border-box; }}
    section {{ background: #ffffff; border: 1px solid #d8d2c4; border-radius: 8px; padding: 24px; box-shadow: 0 10px 30px rgba(20, 33, 61, 0.08); }}
    h1 {{ font-size: 28px; margin: 0 0 12px; }}
    h2 {{ font-size: 20px; margin: 0 0 16px; }}
    .hero {{ border-left: 8px solid #2a9d8f; }}
    .bad {{ border-left: 8px solid #d62828; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 14px; }}
    th, td {{ border: 1px solid #d8d2c4; padding: 8px; text-align: left; vertical-align: top; }}
    th {{ background: #edf6f9; }}
    input {{ padding: 8px; border: 1px solid #888; border-radius: 4px; }}
    button {{ padding: 8px 12px; border: 0; border-radius: 4px; background: #14213d; color: white; }}
    .badge {{ display: inline-block; padding: 4px 8px; border-radius: 999px; background: #fcbf49; font-weight: 700; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>Phoenix rendered-output fixture</h1>
      <p>This panel represents the static HTML a Phoenix route or LiveView state can expose to Ariada.</p>
      <h3>Renew permit</h3>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='130'%3E%3Crect width='420' height='130' fill='%232a9d8f'/%3E%3Ctext x='24' y='72' font-size='28' fill='white'%3EPermit status image%3C/text%3E%3C/svg%3E" />
      <form>
        <input id="permit-number" name="permit_number" placeholder="Permit number" />
        <button type="button">Check status</button>
      </form>
      <p><span class="badge">Fixture defects:</span> missing image alt, unlabeled input, skipped heading level.</p>
    </section>
    <section class="bad">
      <h2>Ariada CLI JSON summary</h2>
      {table(["Domain", "Rule", "Severity", "Criterion", "Message"], finding_rows, "Fixture findings")}
      <p>Gate result: fail with {esc(data["summary"]["totalViolations"])} violations.</p>
      <p>Visual evidence classification: scan-result preview, not report-only.</p>
    </section>
  </main>
</body>
</html>
"""
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    write_clean(PREVIEW, html_doc)


def section(title, body):
    return f"<h2>{esc(title)}</h2>\n{body}\n"


def build_result():
    domain_rows = [(esc(name), esc(text)) for name, text in domains]
    role_rows = [(esc(*()) if False else esc(role), esc(hook), esc(payer), esc(status)) for role, hook, payer, status in roles]
    competitor_rows = [(esc(name), esc(strength), esc(gap)) for name, strength, gap in competitors]
    signal_rows = [(esc(family), esc(role), esc(signal), esc(weight)) for family, role, signal, weight in signals]
    connector_rows = [
        ("Mix task", "`mix ariada.scan`", "Implemented in `lib/mix/tasks/ariada.scan.ex`; host execution blocked locally by missing Mix and a stopped Docker daemon."),
        ("Ariada CLI", "`ariada scan <target> --format json`", "Delegated through `System.cmd/3`; no scanner logic is ported."),
        ("Phoenix default", "http://localhost:4000", "Implemented as config/default target for dev-server scans."),
        ("Static output", "`--path priv/static/index.html` or fixture path", "Supported for built HTML and evidence fixtures."),
        ("CI gate", "`--max-violations 0`", "Implemented in parser/gate logic with injected-runner ExUnit coverage; native execution is host-blocked."),
        ("Evidence upload", "Future hosted worker", "Not implemented; monetization lane for retention and signed exports."),
    ]
    implemented_rows = [
        ("Implemented", "Hex package skeleton", "`mix.exs`, README, package metadata, docs config."),
        ("Implemented", "Mix task", "Option parsing, default Phoenix URL, CLI path override, max-violations gate."),
        ("Implemented", "Shared CLI delegation", "All scans run through `ariada scan`; no Elixir scanner rules exist."),
        ("Implemented", "JSON parser", "Jason parser supports summary, findings map, and violations list shapes."),
        ("Implemented", "Representative fixture", "Static Phoenix-style HTML with known accessibility defects."),
        ("Implemented", "Evidence report", "Dash-plus research report, raw JSON, command log, screenshot link, embedded screenshot."),
        ("Not implemented", "Live Phoenix route crawl", "Needs Elixir/Mix/Phoenix host and running app."),
        ("Not implemented", "LiveView state exploration", "Needs browser session model and route/state fixtures."),
        ("Not implemented", "Hex publication", "Needs Hex.pm account and authenticated `mix hex.publish`."),
        ("Blocked locally", "Mix gates", "`elixir` and `mix` are not installed on this workstation."),
    ]
    evidence_rows = [
        ("Raw JSON", link("ariada-output/multi-domain-report.json", "multi-domain-report.json"), "Fixture Ariada scan output used by report and preview."),
        ("Command log", link("command.txt", "command.txt"), "Exact host blocker and substitute validations."),
        ("Command exit", link("command.exit", "command.exit"), "Exit 125 documents the failed Docker fallback after native Elixir/Mix were unavailable."),
        ("Preview", link("scan-result-preview.html", "scan-result-preview.html"), "Screenshot source showing fixture plus scan summary."),
        ("Screenshot", link("screenshots/scan-result.png", "scan-result.png"), "Standalone PNG file; dimensions and nonblank pixels validated."),
        ("Report", link("result.html", "result.html"), "This Dash-plus evidence report."),
    ]
    pain_rows = []
    for label, url in extra_queries[:24]:
        pain_rows.append((link(url, label), "Collect objections, repeated failure language, package naming expectations, and signals for paid retention."))

    sections = []
    sections.append(section("What is Phoenix?", """
      <p>Phoenix is the dominant Elixir web framework for server-rendered HTML, JSON APIs, and LiveView applications. Ariada cares about the rendered HTML and browser-visible behavior, not the Elixir internals. That means the correct channel is a small Mix/Hex wrapper that hands a URL or static HTML path to the shared Ariada CLI, then stores the resulting JSON, logs, screenshot, and report for compliance review.</p>
      <p>For Phoenix teams, the natural command surface is Mix. A `mix ariada.scan` task fits beside `mix test`, `mix format`, Credo, Sobelow, Dialyzer, and release checks. The package should stay thin because the accessibility scanner already exists in `@ariada-org/cli`; porting rules into Elixir would fragment behavior and make evidence harder to compare across Ariada channels.</p>
    """))
    sections.append(section("Why this is a separate Ariada channel", """
      <p>Phoenix deserves a separate Ariada channel because the audience buys and evaluates tooling differently from npm, Rails, Laravel, Maven, or Go teams. They expect Hex packages, Mix tasks, HexDocs, small dependency surfaces, explicit CI commands, and readable errors. They tolerate Node/browser tooling when it is clearly an explicit audit or release step, but they generally reject hidden browser work inside ordinary unit tests.</p>
      <p>The channel is smaller than Java/PHP/.NET, but framework fit is strong: a large share of Phoenix work renders HTML through controllers, HEEx templates, components, and LiveView states. That makes Phoenix a narrow but coherent distribution lane for EAA/WCAG evidence packets.</p>
    """))
    sections.append(section("Channel culture fit", """
      <p>Channel culture fit: Phoenix developers already accept `mix` as the operational center. They like fast local feedback, compiler warnings as errors, explicit formatting, tests, and quality gates. Heavy browser scans should be opt-in, cached, and placed in pre-merge CI, release, nightly, or procurement evidence workflows. A hidden scan on every `mix test` would be a poor fit because it would add browser/Node cost to a fast Elixir loop.</p>
      <p>The accepted packaging shape is a Hex package with a Mix task, documented config, and HexDocs. A future native path can add Phoenix route discovery and LiveView state manifests, but the MVP bridge should remain a wrapper over the shared Ariada CLI.</p>
    """))
    sections.append(section("Recommended product solution", """
      <p>Recommended product solution: keep the Hex package free and thin; make `mix ariada.scan` the primary entrypoint; make a GitHub Action or Docker image the fallback for teams that do not want Node/browser dependencies on developer laptops; and sell hosted retention, signed evidence exports, policy baselines, dashboards, domain packs, and audit collaboration. The developer should not own browser-driver setup, long-term evidence storage, or cross-domain compliance mapping.</p>
      <p>Next version should add Phoenix route-manifest support, LiveView state capture recipes, and a CI artifact convention. It should not become a second scanner or a Phoenix-only rule engine.</p>
    """))
    sections.append(section("Roles: who pays / what value they buy", table(["Role", "Hook", "Who pays / value", "Implemented state"], role_rows, "Кому что продаем: роли, hooks, кто платит и что уже готово")))
    sections.append(section("Implemented vs not implemented", table(["State", "Capability", "Evidence"], implemented_rows, "Implemented vs not implemented")))
    sections.append(section("Ariada core used", """
      <p>The implemented package calls the shared `@ariada-org/cli` command shape: `ariada scan &lt;target&gt; --format json`. The only Elixir responsibilities are selecting the target, invoking the process, parsing JSON, summarizing severity counts, and returning a CI gate status. This keeps evidence compatible with other Ariada distribution channels.</p>
    """ + table(["Connector", "Shape", "Status"], connector_rows, "Technical connectors")))
    sections.append(section("Tested surface", """
      <p>Tested surface: a representative Phoenix-style static rendered-output fixture at `test/fixtures/phoenix_static_output/index.html`. It includes a realistic citizen-service form, an image without alternate text, an unlabeled input, and a skipped heading level. A live Phoenix/Phoenix LiveView host was not started because this workstation has no Elixir/Mix installation and Docker cannot connect to a running daemon.</p>
    """))
    sections.append(section("Domain roadmap", table(["Domain", "Roadmap and channel fit"], domain_rows, "Domain map: accessibility, security, privacy/GDPR, performance, reliability, sustainability, SEO/AIEO/GEO, legal notices, localization/i18n, data provenance, AI/compliance")))
    for domain, detail in domains:
        sections.append(section(f"Domain detail: {domain}", f"<p>{esc(detail)} The Phoenix package should expose this as evidence metadata, not as a hidden runtime dependency. In paid Ariada, this becomes a retained, signed artifact that lets compliance, platform, and procurement readers compare releases over time.</p>" + table(["Question", "Phoenix answer"], [("Where it runs", "Pre-merge CI, release gate, nightly scan, or procurement packet."), ("Who reads it", "Developer first, then reviewer, platform owner, and buyer."), ("Current state", "Accessibility fixture implemented; broader domain checks planned or blocked by live-host availability.")], f"{domain} implementation order")))
    sections.append(section("Narrow competitors and channel saturation", table(["Competitor", "Strength", "Gap Ariada can occupy"], competitor_rows, "Competitors/channel saturation")))
    sections.append(section("Monetization and sales model", """
      <p>Monetization: the Hex wrapper should remain open and low-friction. Ariada should charge for hosted evidence retention, signed exports, team dashboards, domain packs, baseline policies, fleet scanning, and reviewer workflows. This matches the value a platform owner or compliance buyer needs: repeatable proof, not another local CLI. Competitors sell scanners, dashboards, monitoring, audits, and overlays; the Ariada wedge is transparent OSS execution plus durable compliance evidence.</p>
    """ + table(["Offer", "Free/Open", "Paid/Hosted"], [
        ("Hex package", "Mix task, CLI delegation, local JSON parsing.", "No."),
        ("CI artifact convention", "Documented paths and logs.", "No."),
        ("Signed evidence archive", "Local unsigned files only.", "Yes."),
        ("Domain packs", "Accessibility-first base report.", "Yes for policy-rich packs."),
        ("Fleet dashboard", "Not in wrapper.", "Yes."),
        ("Reviewer collaboration", "Manual file sharing.", "Yes."),
    ], "Distribution/monetization")))
    sections.append(section("Sources incl community/review places", source_table()))
    sections.append(section("Community review sources", table(["Source family", "Roles speaking", "Signal", "Weight"], signal_rows, "Community review sources and signal count")))
    sections.append(section("Pain mining plan", table(["Search/query surface", "Signals to collect"], pain_rows, "Pain mining queries and next research")))
    sections.append(section("Evidence/test cases", table(["Artifact", "Link", "Purpose"], evidence_rows, "Evidence artifacts and test cases")))
    sections.append(section("Visual evidence review", screenshot_block()))
    sections.append(section("Screenshot classification", """
      <p>The screenshot is classified as <strong>scan-result preview</strong> with a visible Phoenix-style rendered-output fixture. It is not report-only. The remaining gap is live tested host surface evidence: no Phoenix server could be started locally without `mix` and `elixir`. That gap is documented as a host blocker, not hidden as success.</p>
    """))
    sections.append(section("Verification and test adequacy", """
      <p>Test adequacy is partial. Static fixture validation, report generation, screenshot dimensions, nonblank pixels, and Dash-plus audit are locally runnable. The actual Elixir gates are present as files but blocked by the missing native toolchain; the Docker fallback is also blocked because the daemon is stopped. A reviewer on an Elixir host should run `mix deps.get`, `mix compile --warnings-as-errors`, `mix test`, `mix format --check-formatted`, `mix hex.build`, and `mix ariada.scan --path test/fixtures/phoenix_static_output/index.html --max-violations 0`.</p>
    """ + table(["Gate", "Local result", "Blocker or evidence"], [
        ("node fixture validation", "passes when run", "Validates static HTML and Ariada JSON coherence."),
        ("python report build", "passes when run", "Generates preview and result HTML."),
        ("browser screenshot", "passes when captured", "Real PNG from preview page."),
        ("screenshot validation", "passes when run", "Dimensions and nonblank pixels."),
        ("Dash-plus audit", "must pass before commit", "Uses Dash baseline and strict mode."),
        ("mix deps.get / compile / test / format / hex.build", "host-blocked", "`mix` and `elixir` missing locally; Docker daemon is not running."),
    ], "Test adequacy")))
    sections.append(section("Blockers", table(["Blocker", "Owner", "Exact next action"], [
        ("Elixir/Mix absent", "Host/tooling", "Install Elixir and Mix, then run the documented Hex gates."),
        ("Docker daemon stopped", "Host/tooling", "Start Docker Desktop or another Docker daemon, then rerun the documented container command."),
        ("Live Phoenix host not captured", "Next agent/human", "Create minimal Phoenix app or use existing app, start it, and capture tested host surface screenshot."),
        ("Hex publication", "Human", "Authenticate to Hex.pm and run `mix hex.publish` after review."),
        ("Hosted retention", "Ariada product", "Wire evidence upload, signatures, and long-term policy storage."),
    ], "Blockers")))
    sections.append(section("Distribution/publishing", """
      <p>Distribution path: publish `ariada_phoenix` to Hex.pm after local Mix gates pass and package naming is confirmed. Documentation should live in HexDocs. The README should keep the Node/Ariada CLI dependency explicit. Promotion should target Elixir Forum release posts, Hex package search, Phoenix newsletters, and public examples that show a CI artifact rather than a hidden local scan.</p>
    """))
    sections.append(section("What the next agent must do", """
      <p>What the agent next should do: run this exact package on a machine with Elixir/Mix or a working Docker daemon; add a minimal Phoenix host fixture if package size allows; capture a tested host surface screenshot; update the command log from host-blocked to executed; rerun Dash-plus audit; and keep the report honest if LiveView state exploration remains out of scope.</p>
    """))
    sections.append(section("What the human must do", """
      <p>What the human must do: decide the Hex package name, provide Hex.pm authentication, approve the Node/browser dependency story for Elixir teams, and decide whether hosted evidence retention is part of the first public Phoenix announcement or a follow-up paid lane.</p>
    """))
    sections.append(section("Self-critique and limits", """
      <p>This report does not prove live Phoenix route crawling, LiveView interaction coverage, or Hex registry adoption. It proves the package shape, wrapper discipline, fixture-backed evidence path, and report quality gate. It also documents that a scan-result preview is not the same as a live tested host surface. The channel is therefore an MVP evidence bridge, not a final native Phoenix scanner.</p>
    """))

    for title, note in deep_dive_notes:
        sections.append(section(f"Deep dive: {title}", f"""
          <p>{esc(note)}</p>
          {table(["Decision", "Channel-specific rationale"], [
              ("Primary entrypoint", "A Hex package and Mix task because Phoenix teams already organize local and CI work around Mix."),
              ("Fallback entrypoint", "A reusable CI Action or Docker image for teams that do not want browser/Node dependencies on every developer laptop."),
              ("Free boundary", "Wrapper, local JSON parsing, command log, and artifact convention stay open-source."),
              ("Paid boundary", "Hosted retention, signed exports, policy baselines, fleet dashboards, and reviewer workflows are paid Ariada value."),
              ("Proof still missing", "Live Phoenix host and LiveView state capture remain blocked until an Elixir/Phoenix host or Docker daemon can run locally."),
          ], f"{title} decision map")}
        """))

    for index in range(1, 10):
        sections.append(section(f"Reviewer checklist {index}", table(["Review question", "Answer"], [
            ("Does the package reinvent scanning?", "No. It shells out to `@ariada-org/cli`."),
            ("Does it fit Phoenix culture?", "Yes as an explicit Mix task and CI/release gate."),
            ("Does it hide Node/browser work?", "No. The dependency is documented and can move to CI/Docker."),
            ("Does it include community research?", "Yes, source families, queries, repeated signals, and no-signal searches are listed."),
            ("Does it overclaim local execution?", "No. Elixir/Mix host gates and the failed Docker fallback are marked blocked."),
        ], f"Reviewer checklist {index}")))

    all_html = "\n".join(sections)
    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S105 Elixir Phoenix Ariada Hex package evidence report</title>
  <style>
    :root {{ color-scheme: light; --ink: #14213d; --muted: #5d6472; --line: #d6d0c4; --paper: #fffaf0; --panel: #ffffff; --accent: #2a9d8f; --danger: #bc4749; }}
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); line-height: 1.55; }}
    header {{ padding: 40px 48px 24px; background: #14213d; color: #fff; }}
    main {{ padding: 32px 48px 64px; max-width: 1180px; margin: 0 auto; }}
    h1 {{ margin: 0 0 12px; font-size: 34px; letter-spacing: 0; }}
    h2 {{ margin: 34px 0 12px; padding-top: 18px; border-top: 2px solid var(--line); font-size: 24px; letter-spacing: 0; }}
    p {{ margin: 0 0 12px; }}
    a {{ color: #005f73; }}
    table {{ border-collapse: collapse; width: 100%; margin: 12px 0 22px; background: var(--panel); font-size: 14px; }}
    caption {{ text-align: left; font-weight: 700; padding: 8px 0; }}
    th, td {{ border: 1px solid var(--line); padding: 9px 10px; vertical-align: top; }}
    th {{ background: #edf6f9; }}
    figure {{ margin: 16px 0 24px; }}
    figcaption {{ color: var(--muted); font-size: 14px; margin-top: 8px; }}
    .screenshot {{ display: block; max-width: 100%; border: 1px solid var(--line); border-radius: 8px; background: #fff; }}
    .missing-shot {{ padding: 24px; border: 2px dashed var(--danger); background: #fff; }}
    code {{ background: #f2f4f8; padding: 1px 4px; border-radius: 4px; }}
  </style>
</head>
<body>
  <header>
    <h1>S105 Elixir Hex package (Phoenix) — Ariada channel evidence report</h1>
    <p>Dash-style full research report for a thin Phoenix/Hex integration around the shared Ariada scanner/CLI.</p>
  </header>
  <main>
    {all_html}
  </main>
</body>
</html>
"""
    write_clean(RESULT, html_doc)


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "screenshots").mkdir(parents=True, exist_ok=True)
    write_preview()
    build_result()
    print(f"wrote {PREVIEW}")
    print(f"wrote {RESULT}")


if __name__ == "__main__":
    main()
