from __future__ import annotations

from importlib.metadata import distribution

from xblock.core import XBlock

from openedx_ariada.xblock import AriadaXBlock


def test_distribution_exposes_real_xblock_entrypoint() -> None:
    entries = distribution("openedx-ariada").entry_points
    xblock_entry = next(entry for entry in entries if entry.group == "xblock.v1")

    assert xblock_entry.name == "ariada"
    assert xblock_entry.load() is AriadaXBlock
    assert XBlock.load_class("ariada") is AriadaXBlock


def test_distribution_exposes_tutor_v1_entrypoint_without_loading_secrets() -> None:
    entries = distribution("openedx-ariada").entry_points
    tutor_entry = next(entry for entry in entries if entry.group == "tutor.plugin.v1")

    assert tutor_entry.name == "openedx-ariada"
    assert tutor_entry.value == "openedx_ariada.tutor"

