from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from ariada_fastapi import install_ariada

app = FastAPI()
install_ariada(
    app,
    targets=["/broken/"],
    cli_command="node ../../packages/ariada-cli/dist/bin.js",
)


@app.get("/broken/", response_class=HTMLResponse)
def broken() -> str:
    return """
<!doctype html>
<html lang="en">
<head><title>Ariada FastAPI fixture</title></head>
<body>
  <main>
    <h1>Checkout</h1>
    <form>
      <label>Name <input name="name"></label>
      <img src="/missing-hero.png">
      <button></button>
    </form>
  </main>
</body>
</html>
"""
