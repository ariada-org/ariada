from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "ariada-django-local-fixture"
DEBUG = True
ROOT_URLCONF = "minimal_project.urls"
ALLOWED_HOSTS = ["testserver", "127.0.0.1", "localhost"]
INSTALLED_APPS = ["ariada_django"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

ARIADA_SCAN_TARGETS = ["/broken/"]
