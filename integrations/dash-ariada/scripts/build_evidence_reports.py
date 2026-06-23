#!/usr/bin/env python3
from __future__ import annotations

import base64
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_REPORT = ROOT / "test-report"
SCAN_EVIDENCE = ROOT / "scan-evidence"
RESULT_FILE_URI = "file:///Users/pedro/adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def status_for(name: str) -> str:
    code = read(TEST_REPORT / "logs" / f"{name}.exit").strip()
    return "pass" if code == "0" else "fail"


def shell_log(name: str) -> str:
    return read(TEST_REPORT / "logs" / f"{name}.log").strip() or "(no output)"


def report_path() -> Path:
    multi = SCAN_EVIDENCE / "ariada-output" / "multi-domain-report.json"
    single = SCAN_EVIDENCE / "ariada-output" / "scan.json"
    return multi if multi.exists() else single


def scan_total(report: dict) -> int:
    grid = report.get("grid")
    if not isinstance(grid, dict):
        summary = report.get("summary")
        return int(summary.get("total", 0)) if isinstance(summary, dict) else 0
    total = 0
    for site in grid.values():
        if isinstance(site, dict):
            total += sum(len(v) for v in site.values() if isinstance(v, list))
    return total


def page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}}
main{{max-width:1040px;margin:0 auto;padding:32px 20px}}
h1{{font-size:1.9rem;margin:0 0 12px}}
h2{{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}}
h3{{font-size:1rem;margin:20px 0 8px}}
table{{border-collapse:collapse;width:100%;background:#fff}}
th,td{{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}}
code,pre{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}}
code{{background:#eef1f5;padding:1px 5px;border-radius:4px}}
pre{{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}}
figure{{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}}
img{{display:block;max-width:100%;height:auto}}
figcaption{{padding:10px 14px}}
.status{{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}}
.pass{{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}}
.warn{{background:#fff4ce;color:#744500;border:1px solid #eac54f}}
.block{{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}}
.note{{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:12px 14px}}
.links a{{display:inline-block;margin:0 12px 8px 0}}
.small{{color:#57606a;font-size:.92rem}}
</style>
</head>
<body><main>
<h1>{esc(title)}</h1>
{body}
</main></body></html>"""


def build_test_report() -> None:
    gates = [
        ("install", "pip install -e .[dev]"),
        ("ruff", "ruff check ."),
        ("pytest", "pytest -q"),
        ("compileall", "python -m compileall -q dash_ariada tests"),
        ("build", "python -m build"),
        ("ariada-cli-build", "pnpm --filter @ariada-org/cli build"),
        ("scan", "dash-ariada scan http://127.0.0.1:<fixture-port>"),
    ]
    rows = "\n".join(
        f"<tr><th scope='row'>{esc(name)}</th><td>{status_for(name)}</td>"
        f"<td><code>{esc(command)}</code></td></tr>"
        for name, command in gates
    )
    logs = "\n".join(
        f"<details><summary>{esc(name)} log</summary><pre>{esc(shell_log(name))}</pre></details>"
        for name, _command in gates
    )
    TEST_REPORT.mkdir(parents=True, exist_ok=True)
    (TEST_REPORT / "result.html").write_text(
        page(
            "Ariada Dash test report",
            f"<p>Focused local gates for the Dash helper.</p><table><tbody>{rows}</tbody></table><h2>Logs</h2>{logs}",
        ),
        encoding="utf-8",
    )


def build_scan_preview() -> None:
    path = report_path()
    report = json.loads(read(path)) if path.exists() else {}
    total = scan_total(report)
    command = read(SCAN_EVIDENCE / "command.log").strip()
    SCAN_EVIDENCE.mkdir(parents=True, exist_ok=True)
    (SCAN_EVIDENCE / "scan-result-preview.html").write_text(
        page(
            "Ariada Dash real scan preview",
            f"""
<p>Real Ariada CLI scan triggered through <code>dash-ariada scan http://127.0.0.1:&lt;fixture-port&gt;</code>.</p>
<p><strong>{total}</strong> finding(s) in <code>{esc(path.relative_to(ROOT))}</code>.</p>
<h2>Command Output</h2>
<pre>{esc(command or "(no command output)")}</pre>
<h2>Report Summary</h2>
<pre>{esc(json.dumps(report, indent=2)[:12000])}</pre>
""",
        ),
        encoding="utf-8",
    )


def build_scan_report() -> None:
    path = report_path()
    report = json.loads(read(path)) if path.exists() else {}
    total = scan_total(report)
    screenshot = SCAN_EVIDENCE / "screenshots" / "scan-result.png"
    if screenshot.exists():
        encoded = base64.b64encode(screenshot.read_bytes()).decode("ascii")
        shot = (
            "<figure><img alt='Screenshot of the Ariada Dash scan result' "
            f"src='data:image/png;base64,{encoded}'><figcaption>"
            "Встроенный браузерный скриншот реального preview результата скана. "
            "<a href='screenshots/scan-result.png'>Открыть PNG отдельно</a>.</figcaption></figure>"
        )
    else:
        shot = "<p><strong>Evidence gap:</strong> screenshot file was not produced.</p>"
    gates = [
        ("Установка пакета", "pip install -e .[dev]", "install"),
        ("Python lint", "ruff check .", "ruff"),
        ("Unit tests", "pytest -q", "pytest"),
        ("Компиляция Python bytecode", "python -m compileall -q dash_ariada tests", "compileall"),
        ("Сборка Python package", "python -m build", "build"),
        ("Сборка общего scanner CLI", "pnpm --filter @ariada-org/cli build", "ariada-cli-build"),
        ("Скан поверхности", "dash-ariada scan http://127.0.0.1:<fixture-port>", "scan"),
    ]
    gate_rows = "\n".join(
        "<tr>"
        f"<th scope='row'>{esc(label)}</th>"
        f"<td><span class='status {status_for(log)}'>{status_for(log)}</span></td>"
        f"<td><code>{esc(command)}</code></td>"
        f"<td><a href='../test-report/logs/{esc(log)}.log'>log</a> · "
        f"<a href='../test-report/logs/{esc(log)}.exit'>exit</a></td>"
        "</tr>"
        for label, command, log in gates
    )
    implemented_rows = "\n".join(
        [
            "<tr><th scope='row'>Python пакет</th><td><span class='status pass'>сделано</span></td><td><code>dash-ariada</code>: есть <code>pyproject.toml</code>, metadata для установки и console script.</td></tr>",
            "<tr><th scope='row'>CLI-обертка</th><td><span class='status pass'>сделано</span></td><td><code>dash-ariada scan &lt;app-url&gt;</code> принимает HTTP(S) URL работающего Dash приложения и вызывает общий Ariada CLI.</td></tr>",
            "<tr><th scope='row'>Помощник внутри приложения</th><td><span class='status pass'>сделано</span></td><td><code>render_summary()</code> возвращает Dash <code>html.Div</code> со статусом скана, если установлен Dash.</td></tr>",
            "<tr><th scope='row'>Правила сканера</th><td><span class='status pass'>переиспользовано</span></td><td>Локальная логика accessibility rules не добавлялась. Все проверки идут через <code>@ariada-org/cli</code>.</td></tr>",
            "<tr><th scope='row'>Локальный surface evidence</th><td><span class='status pass'>сделано</span></td><td>Локальный served Dash-like HTML fixture был просканирован helper-ом через общий CLI. Есть JSON, raw logs и screenshot evidence.</td></tr>",
            "<tr><th scope='row'>Публикация в PyPI</th><td><span class='status block'>не сделано</span></td><td>Нужны PyPI credentials и release approval от владельца.</td></tr>",
            "<tr><th scope='row'>Скан настоящего hosted Dash / Plotly app</th><td><span class='status block'>не сделано</span></td><td>Нужен реальный deployed app URL и доступ к аккаунту. Текущий evidence проверяет локальный served-DOM contract, а не production hosting.</td></tr>",
            "<tr><th scope='row'>Страница на docs site</th><td><span class='status warn'>следующий шаг</span></td><td>README пакета есть. Публичную docs-site страницу надо добавить после решения, что канал идет к публикации.</td></tr>",
        ]
    )
    role_rows = "\n".join(
        [
            "<tr><th scope='row'>Разработчик Dash / Plotly</th><td>Боль: перед demo или release нужно быстро проверить работающий analytics app, не вытаскивая HTML вручную.</td></tr>",
            "<tr><th scope='row'>Владелец data product</th><td>Боль: нужно доказательство, что dashboards для сотрудников, клиентов или публичных пользователей можно отдавать на accessibility review.</td></tr>",
            "<tr><th scope='row'>Аудитор accessibility</th><td>Боль: нужен повторяемый CLI output, raw JSON и скриншоты, а не устное “мы проверили”.</td></tr>",
            "<tr><th scope='row'>Владелец CI</th><td>Боль: надо встроить проверку в pipeline после запуска app на localhost во время тестов.</td></tr>",
            "<tr><th scope='row'>Основатель / release owner</th><td>Ответственность: PyPI publication и доступ к реальному hosted Dash/Plotly аккаунту.</td></tr>",
        ]
    )
    channel_rows = "\n".join(
        [
            "<tr><th scope='row'>Канал распространения</th><td>PyPI package <code>dash-ariada</code>.</td><td>Блокер: ждет PyPI/release credentials от человека.</td></tr>",
            "<tr><th scope='row'>Точка входа разработчика</th><td>Console command <code>dash-ariada scan &lt;app-url&gt;</code>.</td><td>Собран и протестирован локально.</td></tr>",
            "<tr><th scope='row'>Точка входа внутри app</th><td>Optional <code>render_summary()</code> Dash component helper.</td><td>Unit test есть; demo в реальном Dash runtime еще нужен.</td></tr>",
            "<tr><th scope='row'>Проектный hub</th><td><a href='../../../strategy/dashboards/DELIVERY_HUB.html'>DELIVERY_HUB.html</a>, строка S93.</td><td>Обновлено в этой ветке.</td></tr>",
            "<tr><th scope='row'>Канал ревью человеком</th><td>Email review packet с актуальным Diff ID.</td><td>Должен быть отправлен через Resend на <code>bricha2121@gmail.com</code> и содержать прямую ссылку на этот <code>file://</code> report.</td></tr>",
        ]
    )
    dash_channel_rows = "\n".join(
        [
            "<tr><th scope='row'>Что такое Dash</th><td>Dash это Python-фреймворк для интерактивных аналитических web dashboards. Обычно его используют data teams: Python-код поднимает web app, пользователь видит графики, таблицы, фильтры и callback-driven UI в браузере.</td></tr>",
            "<tr><th scope='row'>Почему это отдельный канал</th><td>Dash app нельзя надежно проверить как статический HTML файл: страница появляется после запуска Python server, callback state и browser rendering. Поэтому канал должен уметь сканировать живой URL.</td></tr>",
            "<tr><th scope='row'>Конкуренты в этом канале</th><td>Прямой Python data-app/dashboard канал забит: <code>Streamlit</code>, <code>Gradio</code>, <code>Bokeh</code>, <code>Panel</code>, <code>Voila</code>, <code>Shiny for Python</code>, <code>Taipy</code>, <code>Reflex</code>, <code>Solara</code>, <code>NiceGUI</code>, плюс самописные Flask/FastAPI dashboards. Смежные, но не прямые конкуренты: Tableau, Power BI, Looker, Superset, Metabase и hosted notebook/data-app platforms.</td></tr>",
            "<tr><th scope='row'>Насколько канал забит</th><td>Высокая насыщенность именно на уровне “как построить dashboard”. В канале уже есть mature tools для быстрых internal apps, ML demos, production dashboards, notebook-to-app flows и low-code BI. Но это не значит, что забит наш узкий канал: repeatable compliance/evidence layer для уже существующих Dash apps. Поэтому <code>dash-ariada</code> нельзя позиционировать как еще один dashboard framework; его позиция узкая: доказательная проверка живого Dash URL перед публикацией.</td></tr>",
            "<tr><th scope='row'>Какой рынок считаем</th><td>Не весь BI/analytics market. Здесь считается узкий Python dashboard / data-app developer-tool market: библиотеки, которые ставятся через PyPI и помогают Python-командам превращать data code в browser app.</td></tr>",
            "<tr><th scope='row'>Доля Dash по proxy</th><td>По PyPI downloads за последний месяц на 2026-06-23: Dash ≈ <strong>8.95M</strong>. В выбранной peer group из 11 Python dashboard/data-app пакетов суммарно ≈ <strong>59.87M</strong>, значит Dash ≈ <strong>14.9%</strong> по download proxy. Это не настоящая market share: PyPI downloads включают CI, bots, mirrors filtering limits и transitive installs.</td></tr>",
            "<tr><th scope='row'>Peer group proxy</th><td>Последний месяц PyPI: Streamlit 26.07M, Gradio 12.74M, Dash 8.95M, Bokeh 6.99M, Panel 3.14M, NiceGUI 1.19M, Reflex 0.26M, Shiny 0.21M, Solara 0.18M, Voila 0.13M, Taipy 0.01M. GitHub stars как secondary signal: Dash ~24.3k, Streamlit ~45.0k, Gradio ~43.0k, Reflex ~28.6k, Bokeh ~20.4k, Taipy ~19.2k, NiceGUI ~15.9k.</td></tr>",
            "<tr><th scope='row'>Вывод для продукта</th><td><strong>Не продавать Ariada как еще один способ строить dashboards.</strong> Это плохая позиция: покупатель уже выбрал Dash, Streamlit, Gradio, Power BI или Tableau, а смена framework стоит дорого и политически болезненна. Правильный wedge: <strong>“у вас уже есть Dash dashboard; добавьте повторяемый evidence layer в CI/release, чтобы доказать accessibility, security, privacy и другие compliance свойства перед публикацией”</strong>. Тогда Ariada становится не конкурентом Dash, а safety/compliance overlay поверх существующего Dash estate. Это снижает friction: разработчик не переписывает app, CI owner добавляет один scan step, reviewer получает артефакты, compliance owner получает audit trail. Первая версия должна выигрывать не красотой dashboard builder UX, а надежностью evidence: raw JSON, command log, screenshot, stable report, ссылки на PRD/docs/hub, повторяемость в pipeline. После этого расширение идет доменами: accessibility сначала, затем security/privacy для release-risk, затем sustainability/AI-readiness/structured-data для публичных и ESG/SEO-heavy dashboards.</td></tr>",
            "<tr><th scope='row'>Источники proxy</th><td><a href='https://pypistats.org/packages/dash'>PyPI Stats: dash</a>, <a href='https://pypistats.org/api/'>PyPI Stats API notes</a>, GitHub repo signals: <a href='https://github.com/plotly/dash'>plotly/dash</a>, <a href='https://github.com/streamlit/streamlit'>streamlit</a>, <a href='https://github.com/gradio-app/gradio'>gradio</a>, <a href='https://panel.holoviz.org/explanation/comparisons/compare_streamlit.html'>Panel comparison listing Streamlit/Jupyter/Bokeh/Dash alternatives</a>.</td></tr>",
            "<tr><th scope='row'>Кто будет искать такой модуль</th><td>Первый поисковый пользователь — Python/Dash developer или CI/platform owner: им проще всего поставить PyPI package и добавить один scan step. Экономический покупатель позже — data product owner, compliance/accessibility lead или DPO/legal ops, когда evidence становится обязательным release/procurement artifact.</td></tr>",
            "<tr><th scope='row'>Как будет распространяться</th><td>Основной низкофрикционный путь: PyPI package <code>dash-ariada</code> для разработчика. Коммерческий путь: CI snippets, hosted evidence retention, audit/export workflow and enterprise policy gates для platform/compliance buyer. Дополнительно: README, docs site page, Delivery Hub status row, examples для CI и snippets для Dash apps.</td></tr>",
            "<tr><th scope='row'>Что пользователь должен получить и зачем</th><td>Не “файлики ради файликов”, а release/review pack: команда <code>dash-ariada scan &lt;url&gt;</code> запускает проверку, raw JSON нужен CI/automation, command log нужен воспроизводимости, HTML report нужен reviewer-у, screenshot нужен человеку в ticket/PR, а hosted artifact retention нужен платящему compliance/platform owner-у как audit trail.</td></tr>",
        ]
    )
    role_offer_rows = "\n".join(
        [
            "<tr><th scope='row'>Python/Dash developer</th><td>“Поставь пакет и проверь dashboard до review.”</td><td>PyPI install, <code>dash-ariada scan &lt;url&gt;</code>, local HTML report, raw JSON.</td><td>Обычно не платит сам; он adoption hook.</td><td>Начинаем здесь: самый быстрый вход, потому что developer controls code/CI and can install PyPI package.</td><td><span class='status pass'>частично реализовано</span>: local CLI, report, screenshot. <span class='status block'>Блокер</span>: PyPI publication.</td></tr>",
            "<tr><th scope='row'>CI / platform owner</th><td>“Добавь gate в release pipeline и сохрани artifacts.”</td><td>GitHub/GitLab snippets, fail/no-fail thresholds, artifact upload, baseline/regression mode, hosted retention.</td><td>Платит или открывает бюджет: team/platform budget.</td><td>Вторая точка входа после developer proof: когда один developer показал evidence, CI owner стандартизирует это для всех Dash apps.</td><td><span class='status warn'>начато</span>: CLI artifact pattern есть. <span class='status block'>Блокер</span>: нет готовых CI snippets, artifact upload recipe, domain passthrough tests.</td></tr>",
            "<tr><th scope='row'>Data analyst / dashboard author</th><td>“Мой dashboard не завернули на accessibility/compliance review.”</td><td>Simple local command, optional <code>render_summary()</code>, checklist text in report.</td><td>Редко платит напрямую; влияет на adoption через pain.</td><td>Не начинаем с него как buyer: analyst хочет ship faster, но не владеет compliance budget. Используем как user story and demo persona.</td><td><span class='status warn'>минимально</span>: helper exists. <span class='status block'>Блокер</span>: нет polished Dash component UX and real Dash demo.</td></tr>",
            "<tr><th scope='row'>Data product owner</th><td>“Мне надо выпустить customer/public dashboard без compliance bottleneck.”</td><td>Release-ready evidence pack, status summary, risk trend, export links.</td><td>Платит через product/platform budget when dashboard is customer-facing or procurement-scoped.</td><td>Подключаем после developer/CI proof: owner buys when the evidence reduces release risk.</td><td><span class='status warn'>позиционирование есть</span>. <span class='status block'>Блокер</span>: нет hosted dashboard, retention, trend view, pricing package.</td></tr>",
            "<tr><th scope='row'>Accessibility reviewer / auditor</th><td>“Дайте проверяемые артефакты, а не скрин из Slack.”</td><td>Stable HTML report, raw JSON, screenshot, command log, PRD/docs/hub links, rule mapping.</td><td>Может быть buyer в agency/audit firm; чаще влияет на purchase.</td><td>Входит как reviewer after first scans: его feedback делает artifacts defensible.</td><td><span class='status pass'>локально хорошо</span>: report/log/json/screenshot. <span class='status block'>Блокер</span>: production-host evidence, rule mapping depth by domain.</td></tr>",
            "<tr><th scope='row'>Compliance officer / DPO / legal ops</th><td>“Мне нужен audit trail по accessibility/privacy/security перед публикацией.”</td><td>Multi-domain evidence, retention, signed exports, policy thresholds, access control, audit log.</td><td>Главный economic buyer для enterprise plan.</td><td>Не стартуем с него cold: ему нужен уже работающий developer/CI workflow. Подключаем, когда есть recurring evidence and multi-domain coverage.</td><td><span class='status block'>не реализовано</span>: hosted retention, SSO, signed exports, privacy/security evidence on Dash. Это срочный commercial-product слой.</td></tr>",
        ]
    )
    distribution_rows = "\n".join(
        [
            "<tr><th scope='row'>Перед публикацией</th><td>Получить PyPI credentials, выбрать package owner, подтвердить имя <code>dash-ariada</code>, прогнать hosted Dash/Plotly app evidence на реальном URL.</td></tr>",
            "<tr><th scope='row'>Документация</th><td>Добавить публичную docs-site страницу: quick start, CI example, Dash app example, что сохраняется в evidence, limitations и ссылка на этот report как образец.</td></tr>",
            "<tr><th scope='row'>Где рекламировать</th><td>GitHub topics и README: <code>dash</code>, <code>plotly-dash</code>, <code>python</code>, <code>accessibility</code>, <code>wcag</code>, <code>ci</code>, <code>compliance</code>, <code>dashboard-testing</code>. После PyPI: PyPI long description, docs changelog, GitHub release notes.</td></tr>",
            "<tr><th scope='row'>Кому показывать</th><td>Data engineering teams, analytics teams, accessibility consultants, maintainers of internal dashboards, public-sector digital teams, teams with WCAG review gates before release.</td></tr>",
            "<tr><th scope='row'>Следующий commit от агента</th><td>Сделать такой же reviewer-ready report template для остальных channels, чтобы каждый report начинался с описания канала и заканчивался дистрибуцией.</td></tr>",
            "<tr><th scope='row'>Следующее действие человека</th><td>Одобрить или отклонить review packet, дать PyPI/account доступы или явно отметить канал как repository-only до появления release credentials.</td></tr>",
        ]
    )
    domain_expansion_rows = "\n".join(
        [
            "<tr><th scope='row'>0. Cross-domain engine / contract</th><td>P0: общий <code>DomainModule</code> contract, single-pass DOM walker и cross-domain interaction detector.</td><td>Без этого каждый домен будет отдельным сканером и потеряется главный moat: один scan, один report, связи между доменами.</td><td>Источник: <a href='../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'>P0 PRD</a>.</td></tr>",
            "<tr><th scope='row'>1. Accessibility</th><td>Текущий S93 scope. Fixture index: 47 rules.</td><td>Самая сильная стартовая боль: WCAG/EAA review gate, release blockers, аудиторам нужны доказательства. Для Dash это особенно важно, потому что app browser-rendered и часто используется в публичных/internal analytics.</td><td>Уже сделано локально: <code>dash-ariada scan &lt;url&gt;</code>, JSON/log/screenshot/report evidence.</td></tr>",
            "<tr><th scope='row'>2. Security</th><td>Fixture index: 8 rules. Headers/TLS/CSP/mixed-content layer.</td><td>Dash dashboards часто живут как internal tools или customer-facing analytics. Platform owner хочет знать, что release не сломал CSP/HSTS/cookies и что security policy не блокирует accessibility scripts.</td><td>Следующая версия: <code>--domains accessibility,security</code> demo на Dash fixture с CSP/header findings.</td></tr>",
            "<tr><th scope='row'>3. Privacy</th><td>Fixture index: 4 rules сейчас; PRD описывает расширение до dark-pattern checks.</td><td>Внешние dashboards могут ставить analytics/tracking cookies или собирать пользовательские фильтры/сегменты. DPO/compliance owner платит за доказательство, что pre-consent tracking и banner defects не попали в release.</td><td>Версия после security: cookie/network snapshot evidence и privacy/security interaction on cookie/request joins.</td></tr>",
            "<tr><th scope='row'>4. Sustainability</th><td>Fixture index: 5 rules. Page weight, image format, lazy-load, third-party count, carbon rating.</td><td>Dash apps легко становятся тяжелыми из-за graphs, JS bundles, data tables и third-party scripts. ESG/CSRD buyer слабее, чем accessibility/security, но strong differentiator для public-sector и enterprise ESG reporting.</td><td>Добавлять после privacy для public dashboards; раньше, если customer продает ESG/digital sustainability.</td></tr>",
            "<tr><th scope='row'>5. AI readiness</th><td>Fixture index: 9 rules. robots, llms.txt, crawler blocking, JS-only rendering, JSON-LD coverage.</td><td>Важно только для public dashboards/data portals. Internal dashboards usually no. Сильная история: JS-only Dash rendering может вредить и accessibility, и AI crawler visibility.</td><td>Добавлять как public-dashboard upsell: “your data portal is accessible and AI-citable”.</td></tr>",
            "<tr><th scope='row'>6. Structured data</th><td>Fixture index: 5 rules. JSON-LD product/article/image/price parsing.</td><td>Для обычного internal Dash это низкий приоритет. Для public reports, product analytics portals, dataset catalogs и investor/research pages это SEO/AI-readiness support layer.</td><td>Добавлять последним или вместе с AI readiness для public data portals.</td></tr>",
            "<tr><th scope='row'>7. Performance</th><td><span class='status block'>planned, not implemented</span>. Заведен отдельный PRD: <a href='../../../product/plans/2026-06-23-D07-domain-performance.md'>D07 performance domain</a>.</td><td>Для Dash это реальная боль: heavy graphs, callback lag, large tables, layout shifts. Но домен нельзя заявлять shipped, пока нет <code>performanceDomain</code>, fixtures and CLI evidence.</td><td>Следующее: создать <code>packages/core-engine/src/domains/performance.ts</code>, fixtures, tests and <code>dash-ariada scan --domains accessibility,performance</code> evidence.</td></tr>",
            "<tr><th scope='row'>8. SEO</th><td><span class='status block'>planned / PRD-backed</span>. Внутренние документы Ariada уже выделяют SEO как отдельный домен: canonical, meta description, sitemap, robots, OG/Twitter, hreflang and JSON-LD hygiene.</td><td>Для internal Dash низкий приоритет; для public dashboards, data portals, investor dashboards and published reports это discoverability/revenue pain.</td><td>Создать D08 SEO domain PRD или привязать к L6: fixtures for public Dash report pages, canonical/meta/OG/sitemap/robots checks, and source-aware fix mapping.</td></tr>",
            "<tr><th scope='row'>9. GEO / AIEO</th><td><span class='status block'>planned / PRD-backed</span>. L6 GEO/AIEO PRD описывает AI crawler policy, llms.txt, citation/readability, AI answer visibility and content-quality scoring.</td><td>Для public data portals Dash может стать “AI-citable dashboard”: не просто доступен человеку, но понятен ChatGPT/Perplexity/Gemini/Claude and correctly summarized.</td><td>Создать Dash public-data fixture: robots/llms.txt, chunk anchors, dataset summary, AI-crawler policy, citation-ready metadata; не смешивать с shipped AI-readiness без отдельного evidence.</td></tr>",
            "<tr><th scope='row'>10. i18n / localization</th><td><span class='status block'>planned / standards-backed</span>. Multi-domain standards mapping уже включает i18n Localization.</td><td>EU/public-sector dashboards often need language, date/number/currency, RTL and translated label evidence; this overlaps accessibility and trust.</td><td>Создать D10 i18n domain PRD, multilingual Dash fixture, locale/date/currency checks and hreflang interaction with SEO.</td></tr>",
            "<tr><th scope='row'>11. PCI / payment</th><td><span class='status block'>conditional planned</span>. Multi-domain standards mapping включает PCI DSS, but only applies if payment/card flow exists.</td><td>Большинство Dash dashboards не принимают платежи. Но embedded paid reports, checkout-like upgrade panels or billing portals need payment-surface evidence.</td><td>Mark not applicable by default for analytics-only Dash. Build only if Dash channel includes billing/checkout surface; otherwise keep as conditional domain.</td></tr>",
            "<tr><th scope='row'>12. Jurisdiction / penalty exposure</th><td><span class='status block'>platform-backed candidate</span>. PLATFORM_SPEC describes jurisdiction rate cards and fine exposure estimation.</td><td>Compliance buyer wants not only “finding exists”, but “which jurisdictions and penalties matter for this dashboard audience”.</td><td>Connect report metadata to geography/audience config and penalty estimator. Do not compute legal advice; show risk bands and source links.</td></tr>",
            "<tr><th scope='row'>13. Brand / design-token compliance</th><td><span class='status block'>platform-backed candidate</span>. PLATFORM_SPEC names brand-token compliance as module M6.</td><td>Dash dashboards used in customer portals often drift from brand/design system: colors, contrast tokens, logos, disclaimers and chart palettes.</td><td>Build only after accessibility/performance because it depends on stable visual capture and token sources; candidate for design-system teams.</td></tr>",
        ]
    )
    narrow_compliance_competitor_rows = "\n".join(
        [
            "<tr><th scope='row'>Web accessibility / EAA / WCAG evidence</th><td>Deque axe/axe DevTools, Accessibility Insights, Lighthouse, Pa11y, WAVE, Siteimprove, Level Access, Equalize-style platform scanners.</td><td>Канал насыщен checker-ами, но слабее в Dash-specific CI evidence: raw JSON + command log + screenshot + stable report + PRD/docs/hub links, завязанные на уже существующий live Dash URL.</td><td>Сильный стартовый домен: EAA/WCAG pain понятен, отчет можно приложить к review, и текущий Ariada CLI уже дает работающий evidence path.</td></tr>",
            "<tr><th scope='row'>Security / release-risk evidence</th><td>OWASP ZAP, Snyk, Semgrep, GitHub CodeQL/Dependabot, SecurityHeaders, Mozilla Observatory, CSP Evaluator.</td><td>Они сильны в code/dependency/header security, но не продают единый dashboard-release evidence pack вместе с accessibility/privacy/sustainability. Для Dash важен web surface layer: CSP, cookies, mixed content, headers, third-party scripts на живой странице.</td><td>Второй домен после accessibility: CI owner уже привык к security gates, значит можно расширять тем же scan artifact, не меняя workflow.</td></tr>",
            "<tr><th scope='row'>Privacy / GDPR / consent evidence</th><td>OneTrust, Cookiebot/Usercentrics, Didomi, Osano, Datadog/Synthetic privacy checks, ручные DPO-аудиты.</td><td>CMP vendors управляют баннерами/consent, но не всегда дают developer-friendly per-release evidence по Dash app URL. Ariada должна фиксировать cookies, trackers, consent-before-tracking defects, request/cookie joins and privacy/security interactions.</td><td>Третий домен: покупатель DPO/legal ops появляется только когда report доказывает, что release не нарушил consent/privacy posture.</td></tr>",
            "<tr><th scope='row'>Sustainability / digital carbon / WSG evidence</th><td>Website Carbon Calculator, Ecograder, Lighthouse performance proxies, Green Web Foundation checks, EcoIndex, Wholegrain-style audits.</td><td>Эти tools дают sustainability score или carbon estimate, но не показывают конфликт “accessibility fix увеличил page weight” внутри одного compliance report. Для Dash это особенно важно из-за тяжелых graphs, tables, JS bundles and data payloads.</td><td>Четвертый домен: не главный blocker release, но хороший enterprise/public-sector differentiator and ESG story.</td></tr>",
            "<tr><th scope='row'>AI Act / AI transparency / AI-readiness evidence</th><td>TrustArc/OneTrust AI governance, Credo AI, Holistic AI, model governance suites, crawler/SEO tools, emerging llms.txt/AI visibility checkers.</td><td>AI governance suites работают на policy/model inventory уровне. Ariada для Dash должна быть web-surface evidence: AI-generated labels, robots/llms.txt, crawlability, structured summaries, whether JS-only dashboards are readable/citable by AI crawlers.</td><td>Пятый домен: высокий strategic upside для public dashboards/data portals, но не каждый internal Dash app имеет AI Act exposure.</td></tr>",
            "<tr><th scope='row'>Structured data / SEO / data portal discoverability</th><td>Google Rich Results Test, Schema.org validators, Screaming Frog, Semrush/Ahrefs site audits.</td><td>Они сильны в SEO/site crawl. Ariada должна использовать structured-data как часть multi-domain evidence: “этот public dashboard is accessible, crawlable, has machine-readable dataset/report metadata”.</td><td>Шестой домен: нужен для public data portals, investor/research dashboards and AI-readiness, но low priority for internal dashboards.</td></tr>",
            "<tr><th scope='row'>Traditional SEO evidence</th><td>Semrush, Ahrefs, Moz, Screaming Frog, Sitebulb, Google Search Console, Lighthouse SEO audits.</td><td>SEO suites видят site-level crawl/keywords, но usually do not attach release-level Dash CI artifacts: command log, raw JSON, screenshot, PRD link and reviewer-ready report tied to a live app URL.</td><td>Для Dash продавать не “SEO suite”, а public dashboard release evidence: canonical/meta/OG/sitemap/robots/hreflang regressions caught before publishing.</td></tr>",
            "<tr><th scope='row'>GEO / AIEO / AI-search visibility</th><td>Profound, Otterly.AI, AthenaHQ, Peec AI, Scrunch AI, Goodie AI, Bluefish AI, plus emerging llms.txt/crawler-policy tools.</td><td>GEO tools track citations/visibility, but not necessarily source-code/CI evidence for a browser-rendered Dash dashboard. Ariada wedge: public data portal is accessible, crawlable, AI-readable and evidence-backed in one report.</td><td>Build after SEO/structured-data for public dashboards. Do not claim citation tracking until L6 capability exists.</td></tr>",
            "<tr><th scope='row'>i18n / localization evidence</th><td>Lokalise, Phrase, Crowdin, Smartling, Transifex, i18next tooling, manual localization QA.</td><td>Localization tools manage strings/workflow; Ariada should prove rendered dashboard locale correctness: lang/dir, date/number/currency, untranslated labels, hreflang and accessibility-language interactions.</td><td>Strong for EU/public-sector Dash dashboards; weaker for single-language internal analytics.</td></tr>",
            "<tr><th scope='row'>PCI / payment evidence</th><td>PCI scanners, Stripe Radar/payment compliance docs, ASV vendors, checkout QA tools.</td><td>Most Dash apps are not payment surfaces. Ariada should only enter if dashboard embeds billing, paid report checkout or account upgrade flows.</td><td>Conditional domain: default not applicable, but high severity if payment/card surface detected.</td></tr>",
            "<tr><th scope='row'>Jurisdiction / penalty exposure</th><td>GRC platforms, legal counsel, compliance spreadsheets, OneTrust/TrustArc adjacent workflows.</td><td>GRC tools manage programs; Ariada can connect concrete findings to jurisdiction-aware risk bands in the evidence report, especially accessibility/privacy/AI disclosure.</td><td>Useful for buyer conversation, but must avoid legal-advice claims.</td></tr>",
            "<tr><th scope='row'>Brand / content governance</th><td>Frontify, Brandfolder, Bynder, Acrolinx, Writer, Grammarly Business, content governance platforms.</td><td>They manage brand/content rules; Ariada can check rendered dashboard artifacts against brand tokens, stale owner metadata, disclaimers, broken links and review dates.</td><td>Candidate domain for public dashboards and customer portals; not first release gate.</td></tr>",
            "<tr><th scope='row'>Dash-specific gap</th><td>Dash/Plotly, Streamlit, Gradio, Panel, Bokeh, Voila and BI tools mostly sell building/hosting/sharing dashboards, not compliance evidence across these domains.</td><td>Это и есть wedge: не “лучший dashboard builder”, а “один compliance/evidence overlay поверх уже выбранного dashboard estate”.</td><td>Продуктово это защищает от framework wars: Ariada добавляют после выбора Dash, а не вместо Dash.</td></tr>",
        ]
    )
    dash_implementation_map_rows = "\n".join(
        [
            "<tr><th scope='row'>Already working now</th><td><code>dash-ariada scan &lt;url&gt;</code> -> shared <code>@ariada-org/cli</code> -> <code>multi-domain-report.json</code> / raw log / screenshot / HTML report.</td><td>Этого хватает для accessibility v0 review evidence по served Dash-like surface.</td><td>Сохранить как главный contract для всех будущих доменов.</td></tr>",
            "<tr><th scope='row'>Already in core / ready to expose</th><td>CLI parser already documents <code>--domains accessibility,privacy,security,sustainability,structured-data,ai-readiness</code>; built-in domains are registered in core discovery.</td><td>Dash adapter сейчас не делает отдельный domain selection UX; он может просто прокинуть аргументы в общий CLI.</td><td>Добавить <code>dash-ariada scan --domains accessibility,security</code> passthrough and tests.</td></tr>",
            "<tr><th scope='row'>Needs urgent implementation</th><td>Dash fixture per domain: one representative Dash app with headers/cookies/scripts/heavy charts/JSON-LD/robots cases.</td><td>Без этого отчет будет говорить о domains теоретически, но не доказывать их на Dash channel.</td><td>Создать <code>tests/fixtures/domain_matrix_app.py</code> или static served output fixture, плюс expected findings per domain.</td></tr>",
            "<tr><th scope='row'>Needs urgent implementation</th><td>Report renderer that shows domain tabs/cells, interaction findings and role-oriented “what this means” text.</td><td>Raw multi-domain JSON есть, но reviewer-facing Dash report должен объяснять accessibility/security/privacy/sustainability together.</td><td>Расширить <code>build_evidence_reports.py</code> from single scan summary to domain matrix summary.</td></tr>",
            "<tr><th scope='row'>Needs urgent implementation</th><td>CI artifact recipe: GitHub Actions / GitLab CI snippets for starting Dash app, waiting for health URL, scanning, uploading artifacts.</td><td>Dash app exists as live server, so CI contract is harder than static HTML scan.</td><td>Ship <code>examples/github-actions.yml</code> and <code>examples/gitlab-ci.yml</code> with <code>python -m dash_app</code> + <code>dash-ariada scan</code>.</td></tr>",
            "<tr><th scope='row'>Human/account gate</th><td>PyPI publication, real Plotly/Dash Enterprise app URL, auth-protected dashboard test.</td><td>Cannot be faked locally. It needs credentials or a chosen production-like demo.</td><td>Keep as blocker, not as “done”.</td></tr>",
        ]
    )
    dash_connector_rows = "\n".join(
        [
            "<tr><th scope='row'>CLI connector</th><td><code>dash-ariada scan &lt;url&gt; [--domains accessibility,security]</code></td><td>Primary interface for CI/release. Thin wrapper over Ariada CLI. Must support domain passthrough, output dir, no-fail/fail thresholds and artifact paths.</td></tr>",
            "<tr><th scope='row'>Python helper</th><td><code>from dash_ariada import render_summary</code></td><td>Optional in-app status panel. Not the main product; useful for demo and local visibility, but compliance value remains in CI artifacts.</td></tr>",
            "<tr><th scope='row'>Pytest fixture</th><td><code>dash_ariada.pytest.scan_dash_app(app, domains=[...])</code></td><td>Future interface for teams already testing Dash callbacks. Should start server, wait for route, run scan, attach report path to test output.</td></tr>",
            "<tr><th scope='row'>GitHub/GitLab CI connector</th><td>Reusable step that starts Dash, waits on <code>/health</code> or configured route, runs <code>dash-ariada scan</code>, uploads artifacts.</td><td>Most valuable paid path: CI owner buys evidence retention and policy gates.</td></tr>",
            "<tr><th scope='row'>Docker connector</th><td>Container image with browser deps, Python helper and Ariada CLI pinned.</td><td>Needed for reliable headless browser runs in enterprise CI without local Playwright/Chromium drift.</td></tr>",
            "<tr><th scope='row'>Plotly Cloud / Dash Enterprise connector</th><td>Config-driven hosted URL scan plus optional auth/session setup.</td><td>Human/account blocked. Needed before claiming production-host evidence.</td></tr>",
            "<tr><th scope='row'>Evidence API connector</th><td>Upload <code>multi-domain-report.json</code>, screenshot and logs to hosted Ariada evidence store.</td><td>Paid layer: retention, SSO, reviewer comments, signed exports and audit trail.</td></tr>",
        ]
    )
    missing_domain_rows = "\n".join(
        [
            "<tr><th scope='row'>Reliability / availability</th><td>Dashboard responds, no 5xx/timeouts, health URL works, critical routes load.</td><td>High for CI owner; overlaps monitoring but valuable as release evidence.</td><td>After performance, because Dash release risk is not only “page slow” but also “app did not come up”.</td></tr>",
            "<tr><th scope='row'>Legal / policy notices</th><td>Privacy policy, accessibility statement, cookie notice, contact path, statement freshness.</td><td>Medium-high for public dashboards and procurement.</td><td>Pair with accessibility/privacy once docs/export workflow exists.</td></tr>",
            "<tr><th scope='row'>Data quality / provenance</th><td>Dataset timestamp, source link, methodology/disclaimer, stale-data warnings.</td><td>Medium-high for public data portals; very Dash-specific.</td><td>Strong candidate because Dash often presents numbers that need source/trust evidence.</td></tr>",
            "<tr><th scope='row'>Localization / i18n</th><td>Language, locale, date/currency formats, translated labels, fallback gaps.</td><td>Medium for EU/public-sector dashboards.</td><td>Build when Dash fixtures include multilingual data.</td></tr>",
            "<tr><th scope='row'>AI provenance / authorship</th><td>AI-generated summaries or insights labeled, source/model disclosure, human review marker.</td><td>Medium; separate from AI-readiness if workflow/provenance becomes a buyer pain.</td><td>Evaluate after AI-readiness web-surface checks are real.</td></tr>",
            "<tr><th scope='row'>Content quality / governance</th><td>Broken links, stale copy, missing owner/review metadata.</td><td>Medium; useful for public reports but not first commercial wedge.</td><td>Could be merged with legal/data-quality if scope stays small.</td></tr>",
            "<tr><th scope='row'>Usability / dashboard UX heuristics</th><td>Loading states, empty states, filter reset, error clarity, table pagination.</td><td>Medium for Dash; weak legal pull but strong product-quality signal.</td><td>Use only if customer asks; otherwise keep behind performance/accessibility.</td></tr>",
            "<tr><th scope='row'>Observability / evidence operations</th><td>Scan provenance, artifact retention health, report freshness, route coverage, flaky-run markers, who acknowledged an override.</td><td>New candidate from this review. Buyer is CI/platform/compliance owner: they need trust in the evidence system itself.</td><td>Build when hosted evidence API exists; otherwise report can become compliance theater.</td></tr>",
            "<tr><th scope='row'>Data ethics / fairness</th><td>Bias warnings for demographic slices, missing cohort definitions, fairness caveats, sensitive-attribute disclosure.</td><td>New candidate. Useful for public/regulated analytics dashboards, healthcare, finance and HR; not generic Dash.</td><td>Needs domain PRD and expert review. Do not automate serious fairness claims without policy model and human attestation.</td></tr>",
            "<tr><th scope='row'>Incident readiness / responsible disclosure</th><td>Security contact, vulnerability disclosure, status page link, outage/support contact, data correction channel.</td><td>New candidate. Helps public dashboards and customer portals where users need a path to report broken data, security issues or accessibility defects.</td><td>Could be a lightweight legal/reliability subdomain before becoming its own D-domain.</td></tr>",
            "<tr><th scope='row'>Procurement / vendor-risk evidence</th><td>Vendor data processing hints, subprocessors, hosting region, SOC2/ISO links, accessibility statement and DPA links.</td><td>New candidate. B2B buyer cares when Dash dashboard is embedded in a customer portal or procurement package.</td><td>Build only after legal/privacy/security because it aggregates their evidence into buyer-facing procurement pack.</td></tr>",
            "<tr><th scope='row'>Knowledge freshness / decision staleness</th><td>Whether a dashboard's numbers, commentary and cached extracts are too old for the decisions it supports.</td><td>New candidate and very Dash-specific: stale metrics can be more harmful than a missing meta tag.</td><td>Likely merge with data quality/provenance; needs explicit dataset freshness metadata contract.</td></tr>",
        ]
    )
    monetization_rows = "\n".join(
        [
            "<tr><th scope='row'>Разработчик Dash</th><td>Обычно не главный плательщик. Он “покупает” скорость: одна команда, локальный report, меньше ручного audit ping-pong.</td><td>Free OSS/PyPI package, docs, examples, GitHub Action snippets. Это adoption channel, не основной revenue.</td><td>Value: меньше времени на evidence preparation и fewer release surprises.</td></tr>",
            "<tr><th scope='row'>CI / platform owner</th><td>Платит за надежность pipeline: artifact retention, baselines, PR comments, multi-property runs, flaky retry policy, SSO/team permissions.</td><td>Pro Team / hosted artifacts / managed CI integration. Возможный pricing anchor из internal Ariada strategy: Pro/Team per user/site/month, ниже enterprise DXP, выше pure free OSS.</td><td>Value: controlled release gate вместо screenshots в Slack.</td></tr>",
            "<tr><th scope='row'>Accessibility reviewer / audit lead</th><td>Платит или влияет на покупку, когда нужен повторяемый audit pack.</td><td>Evidence bundle, statement generator, VPAT/ACR HTML, reviewer workflow, signed report, remediation tracking.</td><td>Value: defensible artifacts вместо “we ran a scan”.</td></tr>",
            "<tr><th scope='row'>Compliance officer / DPO / legal ops</th><td>Экономический buyer, если домены расширены до privacy/security/accessibility and audit trail.</td><td>Enterprise compliance pack: retention, audit log, SSO/SCIM, policy thresholds, multi-domain reports, export to procurement/regulator formats.</td><td>Value: lower regulatory/release risk and procurement readiness.</td></tr>",
            "<tr><th scope='row'>Data product owner</th><td>Платит indirectly через platform/compliance budget, если dashboard customer-facing.</td><td>Hosted report links, team dashboard, release scorecards, domain-by-domain readiness.</td><td>Value: ship dashboard without compliance bottleneck.</td></tr>",
            "<tr><th scope='row'>Founder / sales motion</th><td>Продает не “dashboard builder”, а “compliance evidence for live dashboards”.</td><td>Land with free adapter, expand to hosted artifacts, then enterprise audit trail + multi-domain domains.</td><td>Value: wedge avoids framework wars and attaches to existing Dash estates.</td></tr>",
        ]
    )
    sales_model_rows = "\n".join(
        [
            "<tr><th scope='row'>Plotly / Dash</th><td>Open-source Dash framework plus Plotly Cloud / Dash Enterprise for publishing, collaboration, access control, enterprise deployment.</td><td>Ariada should not copy this. Dash sells building and deploying apps; Ariada sells evidence that those apps are safe/compliant enough to release.</td><td><a href='https://plotly.com/pricing/'>Plotly pricing</a>, <a href='https://plotly.com/get-pricing/'>Dash Enterprise pricing contact</a>, <a href='https://dash.plotly.com/dash-enterprise'>Dash Enterprise docs</a>.</td></tr>",
            "<tr><th scope='row'>Streamlit</th><td>Free public Community Cloud and enterprise/professional path via Snowflake ecosystem.</td><td>Streamlit monetizes hosting/sharing/professional deployment. Ariada monetizes audit evidence and governance, even if the app stays self-hosted.</td><td><a href='https://streamlit.io/cloud'>Streamlit Community Cloud</a>, <a href='https://streamlit.io/'>Streamlit home</a>.</td></tr>",
            "<tr><th scope='row'>Gradio / Hugging Face</th><td>Free/easy demos, Hugging Face Spaces hosting, Hub storage/infrastructure and enterprise platform economics.</td><td>Gradio monetizes model/demo infrastructure. Ariada should avoid GPU/demo hosting competition and sell release confidence for governed dashboards.</td><td><a href='https://huggingface.co/pricing'>Hugging Face pricing</a>, <a href='https://huggingface.co/docs/hub/en/spaces-sdks-gradio'>Gradio Spaces docs</a>.</td></tr>",
            "<tr><th scope='row'>Tableau</th><td>Role-based BI subscription: Viewer/Explorer/Creator; enterprise edition higher per-seat pricing.</td><td>Tableau sells BI seats and governance. Ariada should be priced as compliance overlay, not per-viewer dashboard BI.</td><td><a href='https://www.tableau.com/pricing'>Tableau pricing</a>.</td></tr>",
            "<tr><th scope='row'>Power BI</th><td>Microsoft ecosystem per-user licensing plus Premium/Fabric capacity path.</td><td>Power BI competes on enterprise analytics distribution. Ariada can integrate around evidence exports, not compete for BI authoring.</td><td><a href='https://www.microsoft.com/en-us/power-platform/products/power-bi/pricing'>Power BI pricing</a>.</td></tr>",
            "<tr><th scope='row'>Looker</th><td>Platform pricing plus user pricing; enterprise semantic model and embedded analytics.</td><td>Looker sells governed analytics platform. Ariada sells scan/evidence governance for web surfaces, including Dash apps outside Looker.</td><td><a href='https://cloud.google.com/looker/pricing'>Looker pricing</a>.</td></tr>",
            "<tr><th scope='row'>Ariada proposed model for Dash channel</th><td>Free adapter → hosted artifact retention/team workflow → enterprise multi-domain evidence, SSO/SCIM, audit log, signed reports, baselines and exports.</td><td>This model monetizes the payer's risk and coordination cost, not the developer's love of dashboards.</td><td>Internal pricing anchors: <a href='../../../product/plans/2026-05-18-master-strategy-RU-synthesis.md'>master strategy synthesis</a>; public OSS boundary: <a href='../../../docs/PLATFORM_SPEC.md'>PLATFORM_SPEC</a>.</td></tr>",
        ]
    )
    handoff_rows = "\n".join(
        [
            "<tr><th scope='row'>Агент ждет от человека</th><td>Review comments по отчету, PyPI decision, реальный Dash/Plotly URL для production-host evidence. Аппрув нужен только если публикуем/пушим release artifact или просим подписать human-attributed commit.</td></tr>",
            "<tr><th scope='row'>Человек ждет от агента</th><td>Применить этот формат к остальным reports, не подменять реальные evidence screenshots synthetic previews, держать ссылки на PRD/docs/hub рядом с каждым report.</td></tr>",
            "<tr><th scope='row'>Release owner ждет от продукта</th><td>Понятный public positioning: “scan live Dash dashboards for multi-domain compliance evidence in CI”.</td></tr>",
            "<tr><th scope='row'>Reviewer ждет от report</th><td>Открыть один файл и увидеть что за канал, что проверено, что заблокировано, где raw evidence, какие домены покрыты, и что реально надо решить человеку.</td></tr>",
        ]
    )
    term_rows = "\n".join(
        [
            "<tr><th scope='row'>Канал</th><td>Способ попасть к пользователю. Для S93 это Python/Dash ecosystem: PyPI, Dash docs/examples, CI snippets и GitHub discovery.</td></tr>",
            "<tr><th scope='row'>Модуль</th><td>Код в <code>integrations/dash-ariada/</code>, который дает CLI и optional Dash helper. Он не заменяет scanner core.</td></tr>",
            "<tr><th scope='row'>Поверхность</th><td>То, что реально проверяется браузером. Здесь это served Dash-like page на localhost, потому что Dash app существует как web URL.</td></tr>",
            "<tr><th scope='row'>Evidence</th><td>Набор доказательств: HTML report, raw JSON, command log, exit codes и screenshot. Это нужно reviewer-у и release owner-у.</td></tr>",
        ]
    )
    readiness_rows = "\n".join(
        [
            "<tr><th scope='row'>Local review ready</th><td><span class='status pass'>да</span></td><td>Adapter contract, CLI invocation, scan output, logs, screenshot и report links проверены локально.</td></tr>",
            "<tr><th scope='row'>Production evidence ready</th><td><span class='status block'>нет</span></td><td>Нет реального deployed Dash/Plotly app URL и account context.</td></tr>",
            "<tr><th scope='row'>Distribution ready</th><td><span class='status block'>нет</span></td><td>Нет PyPI credentials/release approval и публичной docs-site страницы.</td></tr>",
            "<tr><th scope='row'>Template ready for other reports</th><td><span class='status pass'>да</span></td><td>Этот report теперь можно использовать как формат для остальных channels: начало с channel explanation, конец с distribution plan.</td></tr>",
        ]
    )
    competitor_diff_rows = "\n".join(
        [
            "<tr><th scope='row'>Dash</th><td>Dash строит production-grade Python dashboards и имеет собственный testing/deployment ecosystem.</td><td><code>dash-ariada</code> не строит dashboard и не конкурирует за UI framework choice. Он сканирует уже запущенный Dash URL и сохраняет accessibility evidence.</td><td>Лучше для compliance/review evidence. Хуже для app authoring, layout, callbacks и deployment.</td></tr>",
            "<tr><th scope='row'>Streamlit</th><td>Сильный быстрый путь от Python script к data app, удобный для data scientists и AI/ML teams.</td><td>Ariada не пытается быть проще Streamlit. Отличие: не authoring speed, а repeatable scan artifacts для review gates.</td><td>Лучше в доказуемости и cross-channel scanner reuse. Хуже в интерактивном app creation UX.</td></tr>",
            "<tr><th scope='row'>Gradio</th><td>Сильный в ML demos, model interfaces, share links и быстрых публичных демо.</td><td>Ariada не дает model demo UI. Отличие: аудит живой поверхности и доказательства для accessibility/compliance.</td><td>Лучше для regulated release checklist. Хуже для “show model to user in seconds”.</td></tr>",
            "<tr><th scope='row'>Panel / Bokeh / Voila</th><td>Сильны в PyData/Jupyter, visualization ecosystem и notebook-to-app workflows.</td><td>Ariada не заменяет notebook/data workflow. Отличие: один scanner core и одинаковый evidence pattern для Dash и других channels.</td><td>Лучше как общий audit layer над разными surfaces. Хуже как dashboard composition framework.</td></tr>",
            "<tr><th scope='row'>Tableau / Power BI / Looker / Superset / Metabase</th><td>BI platforms решают authoring, sharing, governance и embedded analytics на platform level.</td><td>Ariada Dash helper не является BI platform. Он нужен Python-командам, у которых уже есть Dash apps и которым нужно доказательство accessibility scan.</td><td>Лучше для developer-owned Python CI. Хуже для enterprise BI governance и no-code authoring.</td></tr>",
        ]
    )
    direction_rows = "\n".join(
        [
            "<tr><th scope='row'>Дизайн</th><td>Сейчас: минимальный HTML evidence report и optional <code>render_summary()</code>.</td><td>Нет polished Dash component UI, theming, severity visualization, charts, before/after remediation view.</td><td>v0.2: branded evidence report theme; v0.3: embedded Dash summary component with severity cards and links to findings.</td></tr>",
            "<tr><th scope='row'>UX</th><td>Сейчас: CLI-first workflow <code>dash-ariada scan &lt;url&gt;</code>.</td><td>Нет guided setup, config wizard, watch mode, CI template generator, failure triage UX.</td><td>v0.2: <code>dash-ariada init</code> and CI snippets; v0.3: local interactive report with filters, assignee notes and remediation checklist.</td></tr>",
            "<tr><th scope='row'>Умность</th><td>Сейчас: умность находится в общем scanner output; adapter не добавляет interpretation layer.</td><td>Нет prioritization by role, duplicate clustering, suggested fixes, risk scoring, route/component attribution.</td><td>v0.2: map findings to WCAG/user impact; v0.3: smart grouping by Dash component/route; v0.4: remediation suggestions and regression explanations.</td></tr>",
            "<tr><th scope='row'>Надежность</th><td>Сейчас: unit tests, lint, build, local served-surface scan, screenshot evidence.</td><td>Нет matrix по Dash versions, Python versions, auth flows, callback-heavy apps, Docker/CI hosted run, real deployed target.</td><td>v0.2: Python/Dash version matrix; v0.3: Docker fixture and GitHub Actions template; v0.4: authenticated/production target evidence mode.</td></tr>",
            "<tr><th scope='row'>Дистрибуция</th><td>Сейчас: пакет локально собран, PyPI publication blocked.</td><td>Нет PyPI release, docs-site page, examples gallery, changelog/release note, public SEO page.</td><td>v0.2: publish after credentials; v0.3: docs and examples; v0.4: case-study page for accessibility evidence in dashboard release gates.</td></tr>",
        ]
    )
    role_pain_fit_rows = "\n".join(
        [
            "<tr><th scope='row'>Dash developer</th><td>“Перед release надо быстро проверить живой dashboard.”</td><td><span class='status pass'>частично закрыто</span></td><td>CLI scan есть. Не хватает init wizard, examples, callback-heavy fixture, better local report UX.</td></tr>",
            "<tr><th scope='row'>Accessibility reviewer</th><td>“Мне нужны raw artifacts, screenshot, logs, Diff ID, а не слова.”</td><td><span class='status pass'>хорошо закрыто локально</span></td><td>Есть HTML report, JSON, command log, screenshot, links. Не хватает production-host evidence и stable public docs URL.</td></tr>",
            "<tr><th scope='row'>CI owner</th><td>“Нужно встроить в pipeline и не ловить flaky browser failures.”</td><td><span class='status warn'>начато</span></td><td>Команда есть. Не хватает official GitHub Actions/GitLab snippets, Docker fixture, retry policy, artifacts upload recipe.</td></tr>",
            "<tr><th scope='row'>Product / release owner</th><td>“Нужно понимать, можно ли публиковать и кому это продавать.”</td><td><span class='status warn'>начато</span></td><td>Есть market/competitor context и blocker list. Не хватает pricing/packaging decision, PyPI release, public positioning page.</td></tr>",
            "<tr><th scope='row'>Founder / sales</th><td>“Где wedge и почему нас не съедят Streamlit/Gradio/Dash?”</td><td><span class='status warn'>сформулировано</span></td><td>Wedge: accessibility evidence layer for existing Dash apps. Не хватает proof from real customer dashboard and public demo.</td></tr>",
        ]
    )
    source_rows = "\n".join(
        [
            "<tr><th scope='row'>Что такое Dash</th><td><a href='https://dash.plotly.com/'>Dash documentation</a>, <a href='https://github.com/plotly/dash'>plotly/dash GitHub</a>, <a href='https://pypistats.org/packages/dash'>PyPI Stats: dash</a>.</td><td>Описание Dash как Python framework для reactive/data web apps, dependencies, repository signal, download proxy.</td></tr>",
            "<tr><th scope='row'>Dash testing / reliability baseline</th><td><a href='https://dash.plotly.com/testing'>Dash Testing docs</a>, <a href='https://dash.plotly.com/dash-enterprise/preparing'>Preparing Your App for Dash Enterprise</a>.</td><td>Почему production Dash apps имеют отдельные testing/deployment concerns; почему adapter должен работать с live URL и evidence artifacts.</td></tr>",
            "<tr><th scope='row'>Streamlit competitor context</th><td><a href='https://docs.streamlit.io/'>Streamlit docs</a>, <a href='https://github.com/streamlit/streamlit'>streamlit GitHub</a>.</td><td>Streamlit positioning: fast Python data apps for data scientists and AI/ML engineers; used as competitor for quick app authoring, not evidence layer.</td></tr>",
            "<tr><th scope='row'>Gradio competitor context</th><td><a href='https://gradio.app/'>Gradio home</a>, <a href='https://gradio.app/guides/quickstart'>Gradio quickstart</a>, <a href='https://gradio.app/guides/sharing-your-app'>Gradio sharing docs</a>, <a href='https://github.com/gradio-app/gradio'>gradio GitHub</a>.</td><td>Gradio positioning: ML demos, share links, quick interfaces around functions/models.</td></tr>",
            "<tr><th scope='row'>Panel / PyData competitor context</th><td><a href='https://panel.holoviz.org/'>Panel docs</a>, <a href='https://panel.holoviz.org/explanation/comparisons/compare_dash.html'>Panel vs Dash</a>, <a href='https://panel.holoviz.org/explanation/comparisons/compare_streamlit.html'>Panel vs Streamlit</a>.</td><td>Panel/Jupyter/PyData angle and why Dash is more standalone-dashboard oriented.</td></tr>",
            "<tr><th scope='row'>Market proxy methodology</th><td><a href='https://pypistats.org/api/'>PyPI Stats API notes</a>, <a href='https://pypi.org/stats/'>PyPI public datasets</a>, GitHub repository stars from GitHub API.</td><td>PyPI downloads and GitHub stars are noisy proxy signals, not real revenue/user market share.</td></tr>",
            "<tr><th scope='row'>Local implementation evidence</th><td><a href='../README.md'>README модуля</a>, <a href='../test-report/result.html'>Test report</a>, <a href='ariada-output/multi-domain-report.json'>Raw scanner JSON</a>, <a href='command.log'>Raw scan log</a>, <a href='screenshots/scan-result.png'>Screenshot PNG</a>.</td><td>Что реально сделано в этой ветке и какими локальными артефактами это подтверждено.</td></tr>",
            "<tr><th scope='row'>Product plan / project state</th><td><a href='../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack10.md#s93--dash-component--new-integrationsdash-ariada'>PRD / handoff S93</a>, <a href='../../../strategy/dashboards/DELIVERY_HUB.html'>Delivery Hub</a>.</td><td>Откуда взят stream S93, package path, channel status and delivery status.</td></tr>",
            "<tr><th scope='row'>Ariada domain expansion map</th><td><a href='../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'>P0 domain contract</a>, <a href='../../../product/plans/2026-06-03-P1-domain-accessibility.md'>P1 accessibility</a>, <a href='../../../product/plans/2026-06-03-P2-domain-privacy.md'>P2 privacy</a>, <a href='../../../product/plans/2026-06-03-P3-domain-security.md'>P3 security</a>, <a href='../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'>P4 AI readiness</a>, <a href='../../../product/plans/2026-06-03-P5-domain-structured-data.md'>P5 structured data</a>, <a href='../../../product/plans/2026-06-03-P6-domain-sustainability.md'>P6 sustainability</a>, <a href='../../../product/plans/2026-06-23-D07-domain-performance.md'>D07 performance</a>, <code>packages/ariada-test-fixtures/fixtures/domains/domains-index.json</code>.</td><td>Порядок расширения доменов для Dash и текущие rule-count proxy: accessibility 47, ai-readiness 9, security 8, structured-data 5, sustainability 5, privacy 4; performance is planned/not implemented.</td></tr>",
            "<tr><th scope='row'>Ariada wider domain sources</th><td><a href='../../../product/standards/MULTI_DOMAIN_STANDARDS_MAPPING.md'>MULTI_DOMAIN_STANDARDS_MAPPING</a>, <a href='../../../product/plans/2026-05-04-l6-geo-aieo-prd.md'>L6 GEO/AIEO PRD</a>, <a href='../../../patents/shared/L6_GEO_AIEO_PATENT_GAP_ANALYSIS.md'>L6 GEO/AIEO patent gap analysis</a>, <a href='../../../patents/shared/PREDOPT_CROSS_DOMAIN_EXPANSION_ANALYSIS.md'>PredOpt cross-domain expansion</a>, <a href='../../../patents/filed/paid/A/PATENT_A_MULTI_DOMAIN_EXPANSION_ANALYSIS.md'>Patent A multi-domain expansion</a>, <a href='../../../docs/PLATFORM_SPEC.md'>PLATFORM_SPEC</a>.</td><td>Источник расширенного каталога: WSG, CWV/performance, GDPR, SEO, security, i18n, PCI DSS, EU AI Act, GEO/AIEO, jurisdiction/penalty, brand-token compliance and content governance. Это не значит, что все уже реализовано.</td></tr>",
            "<tr><th scope='row'>Internal SEO/GEO pain evidence</th><td><a href='../../../research/output/SEO_AUDIT_DRACULASCAN_ARIADA_2026-04-28.md'>SEO audit: draculascan/ariada</a>.</td><td>Показывает, что SEO/GEO-подобные проблемы уже были найдены внутри Ariada: canonical/meta/OG/JSON-LD/sitemap/robots/AI-crawler gaps. Использовано как аргумент, что public Dash dashboards тоже нуждаются в discoverability evidence.</td></tr>",
            "<tr><th scope='row'>Performance source anchors</th><td><a href='https://web.dev/articles/vitals'>web.dev Web Vitals</a>, <a href='https://developers.google.com/search/docs/appearance/core-web-vitals'>Google Search Central Core Web Vitals</a>, <a href='https://www.w3.org/TR/performance-timeline/'>W3C Performance Timeline</a>, <a href='https://www.w3.org/TR/resource-timing/'>W3C Resource Timing</a>, <a href='https://www.w3.org/TR/navigation-timing-2/'>W3C Navigation Timing Level 2</a>.</td><td>Source basis for the new planned performance domain: LCP/INP/CLS, navigation timing, resource timing and browser performance primitives.</td></tr>",
            "<tr><th scope='row'>External regulatory sources</th><td><a href='https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'>European Commission: European Accessibility Act</a>, <a href='https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en'>AccessibleEU: EAA comes into effect 28 June 2025</a>, <a href='https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'>EUR-Lex GDPR Regulation (EU) 2016/679</a>, <a href='https://commission.europa.eu/law/law-topic/data-protection_en'>European Commission: data protection</a>, <a href='https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50'>EU AI Act service desk: Article 50 transparency</a>, <a href='https://www.w3.org/TR/web-sustainability-guidelines/'>W3C Web Sustainability Guidelines</a>.</td><td>Почему accessibility/privacy/AI/sustainability являются отдельными buyer pains, а не просто engineering nice-to-have.</td></tr>",
            "<tr><th scope='row'>External competitor categories</th><td><a href='https://www.deque.com/axe/'>Deque axe</a>, <a href='https://www.zaproxy.org/'>OWASP ZAP</a>, <a href='https://securityheaders.com/'>SecurityHeaders</a>, <a href='https://cookiebot.com/'>Cookiebot</a>, <a href='https://www.onetrust.com/'>OneTrust</a>, <a href='https://www.websitecarbon.com/'>Website Carbon Calculator</a>, <a href='https://ecograder.com/'>Ecograder</a>, <a href='https://search.google.com/test/rich-results'>Google Rich Results Test</a>.</td><td>Карта “кто уже силен” по узкому compliance/evidence каналу: accessibility, security, privacy, sustainability, structured-data.</td></tr>",
            "<tr><th scope='row'>Sales/pricing model comparison</th><td><a href='https://plotly.com/pricing/'>Plotly pricing</a>, <a href='https://plotly.com/get-pricing/'>Plotly get pricing</a>, <a href='https://streamlit.io/cloud'>Streamlit Cloud</a>, <a href='https://huggingface.co/pricing'>Hugging Face pricing</a>, <a href='https://www.tableau.com/pricing'>Tableau pricing</a>, <a href='https://www.microsoft.com/en-us/power-platform/products/power-bi/pricing'>Power BI pricing</a>, <a href='https://cloud.google.com/looker/pricing'>Looker pricing</a>.</td><td>Сравнение моделей продаж: framework/cloud/BI monetization у конкурентов vs Ariada evidence/compliance overlay.</td></tr>",
        ]
    )
    further_research_rows = "\n".join(
        [
            "<tr><th scope='row'>Dash pain mining</th><td><a href='https://community.plotly.com/c/dash/16'>Plotly Dash community forum</a>, <a href='https://github.com/plotly/dash/issues'>Dash GitHub issues</a>, Stack Overflow tag <code>plotly-dash</code>.</td><td>Искать боли: deployment, callbacks, flaky tests, auth, slow pages, enterprise release gates, accessibility complaints, “how do I test...” threads.</td></tr>",
            "<tr><th scope='row'>Competitor pain mining</th><td><a href='https://discuss.streamlit.io/'>Streamlit forum</a>, <a href='https://github.com/streamlit/streamlit/issues'>Streamlit issues</a>, <a href='https://github.com/gradio-app/gradio/issues'>Gradio issues</a>, <a href='https://github.com/holoviz/panel/issues'>Panel issues</a>.</td><td>Искать повторяющиеся complaints: CI, auth, deployment, accessibility, browser testing, component regressions, screenshot/evidence needs.</td></tr>",
            "<tr><th scope='row'>Accessibility/compliance pain mining</th><td>WCAG audit reports, public-sector accessibility statements, VPAT/ACR examples, GitHub issues containing <code>accessibility</code>, <code>wcag</code>, <code>aria</code>, <code>keyboard</code>, <code>screen reader</code>.</td><td>Вытащить роли reviewer/compliance owner и реальные phrasing боли: “need proof”, “audit evidence”, “regression”, “release blocked”.</td></tr>",
            "<tr><th scope='row'>Buying/user interviews</th><td>Dash-heavy teams: internal analytics, scientific dashboards, public sector data portals, healthcare/finance reporting, research labs.</td><td>Проверить willingness to pay: нужен ли standalone package, CI action, hosted report, enterprise policy gate или consulting/remediation bundle.</td></tr>",
            "<tr><th scope='row'>Search queries for next research</th><td><code>site:community.plotly.com dash accessibility wcag</code>; <code>site:github.com/plotly/dash/issues accessibility</code>; <code>dash deployment testing ci accessibility</code>; <code>streamlit accessibility issue</code>; <code>gradio accessibility issue</code>; <code>dashboard wcag audit evidence</code>.</td><td>Держать запросы в research playbook, чтобы следующий pack не начинался с нуля.</td></tr>",
            "<tr><th scope='row'>Signals to collect</th><td>Frequency of issues, upvotes/reactions, maintainer responses, workaround complexity, enterprise mentions, release blockers, “we moved from X to Y” comments.</td><td>Не считать один angry comment рынком. Нужны кластеры боли и цитаты, привязанные к роли.</td></tr>",
        ]
    )
    community_review_rows = "\n".join(
        [
            "<tr><th scope='row'>Source families</th><td>Signal count target: 6 source families searched for this Dash channel: Plotly official community forum, Plotly/Dash GitHub issues, Stack Overflow, Reddit BI/data-science/Python communities, adjacent competitor communities, Hacker News/search surfaces.</td><td>These are channel-specific because Dash users discuss browser-rendered analytics apps in Python/data communities, not Maven or CMS forums.</td></tr>",
            "<tr><th scope='row'>Plotly Community Forum</th><td><a href='https://community.plotly.com/c/dash/16'>Dash Python category</a>, <a href='https://community.plotly.com/t/accessibility-read-about-software/69624'>accessibility discussion</a>, <a href='https://community.plotly.com/t/solved-datatables-and-accessibility/31085'>DataTables accessibility thread</a>.</td><td>Role signals: Dash developer, dashboard author, accessibility reviewer. Repeated pattern: component accessibility and DataTable/dropdown/screen-reader concerns.</td></tr>",
            "<tr><th scope='row'>GitHub issues</th><td><a href='https://github.com/plotly/dash/issues?q=accessibility'>plotly/dash accessibility search</a>, <a href='https://github.com/plotly/dash-table/issues/644'>dash-table accessibility issue #644</a>, <a href='https://github.com/plotly/dash/issues?q=testing+ci'>Dash testing/CI issue search</a>.</td><td>Role signals: developer/maintainer. Repeated pattern: accessibility gaps are often component-level and need rendered-browser evidence, not static source lint.</td></tr>",
            "<tr><th scope='row'>Stack Overflow</th><td><a href='https://stackoverflow.com/questions/tagged/plotly-dash'>plotly-dash tag</a>, <a href='https://stackoverflow.com/questions/tagged/plotly-dash?tab=Unanswered'>unanswered plotly-dash questions</a>, <a href='https://stackoverflow.com/search?q=%5Bplotly-dash%5D+accessibility'>plotly-dash accessibility search</a>, <a href='https://stackoverflow.com/search?q=%5Bplotly-dash%5D+deployment+ci'>deployment/CI search</a>.</td><td>Role signals: implementation developers. Strong for workflow pain and debugging language; weak for economic buyer evidence.</td></tr>",
            "<tr><th scope='row'>Reddit communities</th><td><a href='https://www.reddit.com/r/BusinessIntelligence/comments/1blplly/whos_actually_using_open_source_data/'>r/BusinessIntelligence open-source data visualization discussion</a>, <a href='https://www.reddit.com/r/datascience/comments/1do88tl/boss_is_adamant_about_using_python_to_create_a/'>r/datascience Python dashboard discussion</a>, <a href='https://www.reddit.com/r/Python/comments/6imhxa/plotly_has_just_released_dash_20_a_shinylike_tool/'>r/Python Dash release discussion</a>, <a href='https://www.reddit.com/r/BusinessIntelligence/comments/wac1br/i_built_an_interactive_dashboard_using_dash_and/'>BI dashboard experience thread</a>.</td><td>Role signals: analyst, BI practitioner, data scientist, dashboard author. Repeated pattern: framework choice and deployment politics matter; Ariada should not compete as another builder.</td></tr>",
            "<tr><th scope='row'>Adjacent competitor communities</th><td><a href='https://discuss.streamlit.io/'>Streamlit forum</a>, <a href='https://github.com/streamlit/streamlit/issues?q=accessibility'>Streamlit accessibility issues</a>, <a href='https://github.com/gradio-app/gradio/issues?q=accessibility'>Gradio accessibility issues</a>, <a href='https://github.com/holoviz/panel/issues?q=accessibility'>Panel accessibility issues</a>.</td><td>Role signals: dashboard framework developers and maintainers. Repeated pattern: accessibility/testing/deployment pain is not Dash-only, so Ariada can become a dashboard evidence overlay.</td></tr>",
            "<tr><th scope='row'>Hacker News / broader discussion</th><td><a href='https://hn.algolia.com/?q=Plotly%20Dash'>HN search: Plotly Dash</a>, <a href='https://hn.algolia.com/?q=Streamlit%20Dash%20dashboard'>HN search: Streamlit Dash dashboard</a>, <a href='https://hn.algolia.com/?q=dashboard%20accessibility'>HN search: dashboard accessibility</a>.</td><td>Role signals: technical evaluators and founders. Use as weak signal only unless repeated comments cluster around deployment/compliance pain.</td></tr>",
            "<tr><th scope='row'>Repeated patterns</th><td>Pattern 1: component-level accessibility gaps; Pattern 2: deployment/CI/testing friction; Pattern 3: framework-choice politics between Dash/Streamlit/BI tools; Pattern 4: public vs internal dashboard compliance expectations.</td><td>Product impact: keep <code>dash-ariada</code> as evidence overlay over existing Dash apps, not a dashboard builder.</td></tr>",
            "<tr><th scope='row'>No-signal searches</th><td>Marketplace reviews are weak for Dash because PyPI does not provide review-style discussion; use PyPI only for package/distribution facts. Private Discord/Slack communities were not used because public archived evidence is required.</td><td>Do not silently omit missing surfaces; mark them weak/no-signal and prefer public forum/issues/Stack Overflow/Reddit.</td></tr>",
        ]
    )
    adequacy_rows = "\n".join(
        [
            "<tr><th scope='row'>Доказано</th><td><code>dash-ariada scan &lt;url&gt;</code> запускается, передает URL в общий Ariada CLI, получает scanner output и сохраняет evidence artifacts.</td></tr>",
            "<tr><th scope='row'>Доказано</th><td>Локальная served surface отрабатывает как browser-rendered target, а не как статический markdown/report без браузера.</td></tr>",
            "<tr><th scope='row'>Не доказано</th><td>PyPI install из публичного registry, потому что публикация требует credentials и human release approval.</td></tr>",
            "<tr><th scope='row'>Не доказано</th><td>Работа против настоящего Dash Enterprise / Plotly Cloud app с auth, callbacks, routing и production data state.</td></tr>",
            "<tr><th scope='row'>Следующий сильный тест</th><td>Взять реальный deployed Dash app URL, прогнать <code>dash-ariada scan</code>, приложить новый screenshot, raw JSON и command log как отдельный production-host evidence run.</td></tr>",
        ]
    )
    (SCAN_EVIDENCE / "result.html").write_text(
        page(
            "S93 Dash: отчет по модулю и evidence",
            f"""
<p class="note"><strong>Коротко:</strong> эта ветка добавляет тонкую интеграцию для Dash.
Разработчик может просканировать работающий Dash/Plotly analytics app через Ariada.
Новые accessibility rules здесь не пишутся: модуль вызывает общий scanner CLI и сохраняет
локальный evidence по served-DOM контракту. Текущий статус:
<span class="status pass">локально готово к review</span>
<span class="status block">публикация заблокирована PyPI/account доступом</span>.</p>

<h2>Что такое Dash и почему это канал Ariada</h2>
<table><tbody>{dash_channel_rows}</tbody></table>

<h2>Channel culture fit: что любит и отвергает Dash/Python-аудитория</h2>
<p>Dash-аудитория принимает Python/PyPI entrypoint, короткую локальную CLI-команду, pytest/CI automation
и browser evidence, если scanner запускается явно перед review или release. Она хуже принимает тяжелый
ручной bootstrap, неявные Node/browser downloads в каждом notebook run и замену выбранного dashboard framework.
Поэтому <code>dash-ariada</code> должен оставаться thin PyPI adapter over Ariada CLI: local developer может
запустить scan осознанно, CI/platform owner кеширует browser/runtime dependencies, а платный слой продает
retention, policy gates, signed exports and multi-domain dashboard evidence.</p>

<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
<p>Стартовать надо не с абстрактного “пользователя”, а с adoption path. Первый hook — Python/Dash developer,
потому что он может поставить PyPI package и показать локальный evidence. Второй hook — CI/platform owner,
потому что он превращает разовую проверку в release gate. Деньги появляются у data product owner,
accessibility/compliance lead and DPO/legal ops, когда artifacts становятся audit trail and release/procurement evidence.</p>
<table><thead><tr><th>Роль</th><th>Что им обещаем</th><th>Что предлагаем</th><th>Кто платит</th><th>Когда заходим</th><th>Реализация / blockers</th></tr></thead><tbody>{role_offer_rows}</tbody></table>

<h2>Порядок расширения доменов Ariada для Dash</h2>
<p>Здесь “домен” означает compliance/analysis area Ariada, а не website domain.
Текущая repo-карта доменов подтверждена через <code>packages/ariada-test-fixtures/fixtures/domains/domains-index.json</code>
и P0/P1-P6 PRD; расширенная продуктовая карта взята из standards/platform/patent docs. Performance теперь заведен как planned D07,
но еще не реализован в code/fixtures. Для Dash важно расширяться не “по красоте”, а по buyer pain:
что быстрее блокирует release, создает платный enterprise use-case или делает public dashboard discoverable/compliance-ready.</p>
<table><thead><tr><th>Порядок</th><th>Домен Ariada</th><th>Почему именно так для Dash</th><th>Что делать дальше</th></tr></thead><tbody>{domain_expansion_rows}</tbody></table>

<h2>Каких доменов еще не хватает</h2>
<p>Это backlog-карта, не обещание shipped functionality. Каждый домен ниже должен получить отдельный PRD/package/fixture set перед тем,
как его можно будет показывать как готовый scanner domain.</p>
<table><thead><tr><th>Кандидат</th><th>Что проверяет</th><th>Зачем покупателю</th><th>Когда строить</th></tr></thead><tbody>{missing_domain_rows}</tbody></table>

<h2>Конкуренты именно в нашем узком compliance/evidence канале</h2>
<p>Dashboard frameworks и BI platforms конкурируют только если мы ошибочно продаем Ariada как builder.
В нашем реальном канале конкуренты другие: accessibility scanners, security scanners, privacy/CMP tools,
sustainability checkers, AI-governance/AI-readiness tools and SEO/structured-data crawlers. Поэтому ниже карта по доменам,
а не общий список “Dash vs Streamlit”.</p>
<table><thead><tr><th>Домен</th><th>Кто уже силен</th><th>Где остается щель для Ariada</th><th>Вывод для Dash</th></tr></thead><tbody>{narrow_compliance_competitor_rows}</tbody></table>

<h2>Мэп на готовые механизмы Ariada и срочные пробелы</h2>
<table><thead><tr><th>Статус</th><th>Механизм</th><th>Что это значит для Dash</th><th>Следующее действие</th></tr></thead><tbody>{dash_implementation_map_rows}</tbody></table>

<h2>Технические интерфейсы и коннекторы для Dash</h2>
<table><thead><tr><th>Интерфейс</th><th>Форма</th><th>Для чего нужен</th></tr></thead><tbody>{dash_connector_rows}</tbody></table>

<h2>Как зарабатывать на Dash channel</h2>
<p>Деньги находятся не в продаже нового dashboard framework. Деньги находятся в продаже уверенности: “наш живой dashboard прошел нужные проверки, evidence сохранен, release gate повторяем, auditor видит артефакты”.</p>
<table><thead><tr><th>Роль</th><th>Кто платит / влияет</th><th>Что продаем</th><th>Какое value покупают</th></tr></thead><tbody>{monetization_rows}</tbody></table>

<h2>Модели продаж конкурентов в канале</h2>
<table><thead><tr><th>Игрок</th><th>Как зарабатывает</th><th>Что это значит для Ariada</th><th>Источники</th></tr></thead><tbody>{sales_model_rows}</tbody></table>

<h2>Отличия от конкурентов и где мы лучше/хуже</h2>
<p>Главный вывод: <code>dash-ariada</code> не должен соревноваться с Dash, Streamlit или Gradio как framework для создания приложений.
Его позиция сильнее как узкий evidence/compliance layer: проверить уже существующий dashboard, сохранить scanner output,
скриншот и report, чтобы это можно было показать reviewer-у или положить в CI artifacts.</p>
<table><thead><tr><th>Конкурент / группа</th><th>В чем силен конкурент</th><th>Наше отличие</th><th>Где лучше / где хуже</th></tr></thead><tbody>{competitor_diff_rows}</tbody></table>

<h2>Мэп ролей и болей на текущую реализацию</h2>
<table><thead><tr><th>Роль</th><th>Боль</th><th>Насколько закрыто</th><th>Что нужно следующей версией</th></tr></thead><tbody>{role_pain_fit_rows}</tbody></table>

<h2>Направления развития: дизайн, UX, умность, надежность</h2>
<table><thead><tr><th>Направление</th><th>Что есть сейчас</th><th>Чего нет</th><th>Совет по версиям</th></tr></thead><tbody>{direction_rows}</tbody></table>

<h2>Источники и документы</h2>
<table><thead><tr><th>Что подтверждает</th><th>Источник</th><th>Как использовано в отчете</th></tr></thead><tbody>{source_rows}</tbody></table>

<h2>Где дальше искать боли, роли и отзывы</h2>
<table><thead><tr><th>Направление поиска</th><th>Где искать</th><th>Что извлекать</th></tr></thead><tbody>{further_research_rows}</tbody></table>

<h2>Community review sources</h2>
<p>Этот блок обязателен перед выпуском отчета. Он не заменяет официальные docs; он показывает, где реальные Dash/Python/data пользователи обсуждают боли, objections and adoption signals. Один тред не считается рынком: выводы ниже должны подтверждаться source families and repeated patterns.</p>
<table><thead><tr><th>Source / signal</th><th>Channel-specific evidence</th><th>How it changes product decisions</th></tr></thead><tbody>{community_review_rows}</tbody></table>

<h2>Словарь этого отчета</h2>
<table><tbody>{term_rows}</tbody></table>

<h2>Ссылки для ревью</h2>
<p class="links">
  <a href="{RESULT_FILE_URI}">Открыть этот report через file://</a>
  <a href="../README.md">README модуля</a>
  <a href="../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack10.md#s93--dash-component--new-integrationsdash-ariada">PRD / handoff S93</a>
  <a href="../../../strategy/dashboards/DELIVERY_HUB.html">Delivery hub / карта статусов</a>
  <a href="../test-report/result.html">Test report / команды и логи</a>
  <a href="screenshots/scan-result.png">Скриншот PNG</a>
  <a href="ariada-output/multi-domain-report.json">Raw scanner JSON</a>
  <a href="command.log">Raw scan log</a>
</p>

<h2>Что это за модуль</h2>
<table><tbody>
<tr><th scope="row">Модуль</th><td>Accessibility scan helper для Dash / Plotly apps, stream <code>S93</code>, путь <code>integrations/dash-ariada/</code>.</td></tr>
<tr><th scope="row">Проблема</th><td>Dash dashboards являются served web applications, а не статическими документами. Команде нужен повторяемый способ сканировать rendered app URL и сохранять evidence в CI или перед release.</td></tr>
<tr><th scope="row">Канал поставки</th><td>Python package для PyPI плюс README и hub documentation в этом репозитории.</td></tr>
<tr><th scope="row">Какое ядро используется</th><td><code>@ariada-org/cli</code>, общий Ariada multi-domain scanner и Playwright capture stack. Этот пакет только оборачивает общий CLI.</td></tr>
<tr><th scope="row">Связь с патентом</th><td>В PRD указано: none. Adapter только направляет существующий CLI на served Dash URL.</td></tr>
</tbody></table>

<h2>Пользователи, роли и боли</h2>
<table><tbody>{role_rows}</tbody></table>

<h2>Каналы и поверхности</h2>
<table><thead><tr><th>Поверхность / канал</th><th>Для чего нужен</th><th>Статус</th></tr></thead><tbody>{channel_rows}</tbody></table>

<h2>Что реализовано и что не реализовано</h2>
<table><tbody>{implemented_rows}</tbody></table>

<h2>Готовность по уровням</h2>
<table><thead><tr><th>Уровень</th><th>Готово?</th><th>Почему</th></tr></thead><tbody>{readiness_rows}</tbody></table>

<h2>Насколько адекватен тест</h2>
<p>Тест адекватен для adapter contract: он проверяет, что <code>dash-ariada</code>
принимает served app URL, вызывает общий Ariada CLI, читает generated JSON report,
не ломает локальный evidence run на найденных accessibility findings при <code>--no-fail</code>,
и создает браузерный screenshot страницы evidence.</p>
<p>Тест не является полной hosted-product acceptance проверкой. Он не доказывает PyPI publishing,
Dash Enterprise deployment, Plotly Cloud deployment, authentication flows или production dashboard
с реальными callbacks. Для этого нужны аккаунты человека и выбранное реальное приложение.</p>
<table><tbody>{adequacy_rows}</tbody></table>

<h2>Какие gates были запущены</h2>
<table><thead><tr><th>Gate</th><th>Статус</th><th>Команда</th><th>Evidence</th></tr></thead><tbody>{gate_rows}</tbody></table>

<h2>Результат scan</h2>
<p><strong>{total}</strong> finding(s) найдено общим scanner CLI на representative served Dash-like surface.</p>
{shot}

<h2>Command output / сырой вывод команды</h2>
<pre>{esc(read(SCAN_EVIDENCE / "command.log") or "(no command output)")}</pre>

<h2>Что должен сделать агент дальше</h2>
<table><tbody>
<tr><th scope="row">Применить этот формат к остальным каналам</th><td>Пересобрать остальные <code>scan-evidence/result.html</code> в таком же reviewer-ready виде: роли, боли, статус реализации, ядро, проверенная поверхность, адекватность теста и следующие действия.</td></tr>
<tr><th scope="row">Добавить public docs page после acceptance</th><td>Создать или привязать docs-site страницу для Dash usage, если канал утверждается к публикации.</td></tr>
<tr><th scope="row">Запустить real host demo, когда будет аккаунт</th><td>Просканировать реальный deployed Dash или Plotly app URL и приложить отдельные screenshots/logs как дополнительный evidence run.</td></tr>
</tbody></table>

<h2>Что должен сделать человек дальше</h2>
<table><tbody>
<tr><th scope="row">Ревью отчета</th><td>Дать правки по отчету и positioning. Аппрув commit не нужен для research/report-only изменений; approval gate нужен только для публикации, public push, release artifact или human-attributed commit.</td></tr>
<tr><th scope="row">Решение по публикации</th><td>Дать PyPI credentials или решить, что adapter пока остается только в repository.</td></tr>
<tr><th scope="row">Реальная Dash цель</th><td>Дать deployed Dash/Plotly app URL, если перед публикацией нужен production-host evidence.</td></tr>
</tbody></table>

<h2>Кто чего ждет дальше</h2>
<table><tbody>{handoff_rows}</tbody></table>

<h2>Дальнейшая дистрибуция и продвижение</h2>
<table><tbody>{distribution_rows}</tbody></table>

<p class="small">Generated from <code>integrations/dash-ariada/scripts/build_evidence_reports.py</code>.
Этот отчет специально длиннее raw scan report, чтобы reviewer без внутреннего контекста видел,
что существует, чего не хватает, кто владелец следующего действия и достаточно ли сильный evidence.</p>
""",
        ),
        encoding="utf-8",
    )


def main() -> None:
    build_test_report()
    build_scan_preview()
    build_scan_report()


if __name__ == "__main__":
    main()
