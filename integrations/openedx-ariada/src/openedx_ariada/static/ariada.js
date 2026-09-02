function AriadaOpenEdX(runtime, element) {
  "use strict";

  var form = element.querySelector(".ariada-openedx__form");
  var target = element.querySelector('input[name="target"]');
  var button = element.querySelector('button[type="submit"]');
  var status = element.querySelector(".ariada-openedx__status");
  var result = element.querySelector(".ariada-openedx__result");
  var counts = element.querySelector(".ariada-openedx__counts");
  var body = element.querySelector("tbody");
  var full = element.querySelector(".ariada-openedx__full");
  var scanUrl = runtime.handlerUrl(element, "scan_page");

  try {
    var current = new URL(window.location.href);
    current.hash = "";
    target.value = current.toString();
  } catch (_error) {
    target.value = "";
  }

  function appendCell(row, value) {
    var cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }

  function render(payload) {
    counts.replaceChildren();
    for (const impact of ["critical", "serious", "moderate", "minor", "unknown"]) {
      var item = document.createElement("li");
      var value = document.createElement("strong");
      var label = document.createElement("span");
      value.textContent = String(payload.counts[impact] || 0);
      label.textContent = impact;
      item.append(value, label);
      counts.appendChild(item);
    }

    body.replaceChildren();
    for (const finding of payload.findings) {
      var row = document.createElement("tr");
      appendCell(row, finding.ruleId);
      appendCell(row, finding.severity);
      var standards = []
        .concat((finding.wcag || []).map(function (item) { return "WCAG " + item; }))
        .concat((finding.en301549 || []).map(function (item) { return "EN 301 549 " + item; }));
      appendCell(row, standards.join(", ") || "Not supplied");
      appendCell(row, finding.message);
      body.appendChild(row);
    }
    full.href = payload.fullReportUrl;
    result.hidden = false;
    status.textContent =
      "Scan complete: " + payload.total + " finding" + (payload.total === 1 ? "" : "s") +
      " in " + payload.durationMs + " ms." +
      (payload.findingsTruncated ? " The table shows the first 50." : "");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    result.hidden = true;
    button.disabled = true;
    status.textContent = "Ariada is scanning the rendered page.";
    fetch(scanUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target.value })
    })
      .then(async function (response) {
        // A body that is not JSON still has to be read before the status is
        // judged, so a server error page does not become a parse error.
        let payload;
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          throw new Error(payload.error || "The Ariada scan failed.");
        }
        return payload;
      })
      .then(render)
      .catch(function (error) {
        status.textContent = error.message || "The Ariada scan failed.";
      })
      .finally(function () {
        button.disabled = false;
      });
  });
}

