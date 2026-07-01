from __future__ import annotations

from flask import Flask

from ariada_flask import init_app

app = Flask(__name__)
app.config["ARIADA_SCAN_TARGETS"] = ["/broken/"]
app.config["ARIADA_CLI_COMMAND"] = "node ../../packages/ariada-cli/dist/bin.js"


@app.get("/broken/")
def broken() -> str:
    return """
<!doctype html>
<html lang="en">
<head><title>Ariada Flask fixture</title></head>
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


init_app(app)
