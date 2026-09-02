"""Tutor 21 plugin hook for mounting this XBlock into the Open edX image."""

from tutor import hooks

hooks.Filters.MOUNTED_DIRECTORIES.add_item(("openedx", "openedx-ariada"))

