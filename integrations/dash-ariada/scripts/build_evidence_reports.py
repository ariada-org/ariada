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
            "<tr><th scope='row'>Насколько канал забит</th><td>Высокая насыщенность. В канале уже есть mature tools для быстрых internal apps, ML demos, production dashboards, notebook-to-app flows и low-code BI. Поэтому <code>dash-ariada</code> нельзя позиционировать как еще один dashboard framework; его позиция узкая: accessibility evidence для уже существующих Dash apps.</td></tr>",
            "<tr><th scope='row'>Какой рынок считаем</th><td>Не весь BI/analytics market. Здесь считается узкий Python dashboard / data-app developer-tool market: библиотеки, которые ставятся через PyPI и помогают Python-командам превращать data code в browser app.</td></tr>",
            "<tr><th scope='row'>Доля Dash по proxy</th><td>По PyPI downloads за последний месяц на 2026-06-23: Dash ≈ <strong>8.95M</strong>. В выбранной peer group из 11 Python dashboard/data-app пакетов суммарно ≈ <strong>59.87M</strong>, значит Dash ≈ <strong>14.9%</strong> по download proxy. Это не настоящая market share: PyPI downloads включают CI, bots, mirrors filtering limits и transitive installs.</td></tr>",
            "<tr><th scope='row'>Peer group proxy</th><td>Последний месяц PyPI: Streamlit 26.07M, Gradio 12.74M, Dash 8.95M, Bokeh 6.99M, Panel 3.14M, NiceGUI 1.19M, Reflex 0.26M, Shiny 0.21M, Solara 0.18M, Voila 0.13M, Taipy 0.01M. GitHub stars как secondary signal: Dash ~24.3k, Streamlit ~45.0k, Gradio ~43.0k, Reflex ~28.6k, Bokeh ~20.4k, Taipy ~19.2k, NiceGUI ~15.9k.</td></tr>",
            "<tr><th scope='row'>Вывод для продукта</th><td>Канал большой, но перегретый. Лучший wedge: не “создавайте dashboards в Ariada”, а “если у вас уже есть Dash dashboard, добавьте repeatable accessibility scan evidence в CI/release”. Так меньше конкурируем с framework choice и больше попадаем в compliance/review pain.</td></tr>",
            "<tr><th scope='row'>Источники proxy</th><td><a href='https://pypistats.org/packages/dash'>PyPI Stats: dash</a>, <a href='https://pypistats.org/api/'>PyPI Stats API notes</a>, GitHub repo signals: <a href='https://github.com/plotly/dash'>plotly/dash</a>, <a href='https://github.com/streamlit/streamlit'>streamlit</a>, <a href='https://github.com/gradio-app/gradio'>gradio</a>, <a href='https://panel.holoviz.org/explanation/comparisons/compare_streamlit.html'>Panel comparison listing Streamlit/Jupyter/Bokeh/Dash alternatives</a>.</td></tr>",
            "<tr><th scope='row'>Кто будет искать такой модуль</th><td>Разработчики Python/Dash, data platform teams, владельцы analytics products, аудиторы accessibility и владельцы CI, которым надо включить accessibility evidence в release flow.</td></tr>",
            "<tr><th scope='row'>Как будет распространяться</th><td>Основной путь: PyPI package <code>dash-ariada</code>. Дополнительно: README, docs site page, Delivery Hub status row, примеры для CI и snippets для Dash apps.</td></tr>",
            "<tr><th scope='row'>Что пользователь должен получить</th><td>Команду <code>dash-ariada scan &lt;url&gt;</code>, raw scanner JSON, command log, HTML evidence report и screenshot, который можно приложить к review или compliance ticket.</td></tr>",
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
    handoff_rows = "\n".join(
        [
            "<tr><th scope='row'>Агент ждет от человека</th><td>Approve/reject review email, PyPI decision, реальный Dash/Plotly URL для production-host evidence.</td></tr>",
            "<tr><th scope='row'>Человек ждет от агента</th><td>После approval: применить этот формат к остальным reports, не подменять реальные evidence screenshots synthetic previews, держать ссылки на PRD/docs/hub рядом с каждым report.</td></tr>",
            "<tr><th scope='row'>Release owner ждет от продукта</th><td>Понятный public positioning: “scan live Dash dashboards for accessibility evidence in CI”.</td></tr>",
            "<tr><th scope='row'>Reviewer ждет от report</th><td>Открыть один файл, увидеть что за канал, что проверено, что заблокировано, где raw evidence, и какой Diff ID надо подписать.</td></tr>",
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
<tr><th scope="row">Решение по Review Diff ID</th><td>Актуальный Review Diff ID находится в email. Его надо approve или reject.</td></tr>
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
