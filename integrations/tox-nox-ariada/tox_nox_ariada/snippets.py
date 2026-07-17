from __future__ import annotations


def tox_env_snippet(target: str) -> str:
    return "\n".join(
        [
            "[testenv:a11y]",
            "deps = tox-nox-ariada",
            "commands =",
            f"    ariada-toxnox scan {target} --no-fail",
        ]
    )


def nox_session_snippet(target: str) -> str:
    return "\n".join(
        [
            "import nox",
            "",
            "",
            "@nox.session",
            "def a11y(session):",
            '    session.install("tox-nox-ariada")',
            f'    session.run("ariada-toxnox", "scan", "{target}", "--no-fail")',
        ]
    )
