from __future__ import annotations

from django.http import HttpResponse
from django.urls import path


def broken_view(_request):
    return HttpResponse(
        """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Ariada Django fixture</title>
</head>
<body>
  <main>
    <h1>Ariada Django fixture</h1>
    <img src="/static/product.png">
    <button></button>
    <form>
      <input name="email" type="email">
    </form>
  </main>
</body>
</html>"""
    )


urlpatterns = [path("broken/", broken_view)]
