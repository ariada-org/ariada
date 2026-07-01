import http from "node:http";

export function createMockServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/v1/health") {
      return sendJson(response, 200, {
        status: "ok",
        service: "ariada-hosted-scan",
        version: "0.1.0"
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/scans") {
      const body = await readJson(request);
      const hasUrl = typeof body.url === "string" && body.url.length > 0;
      const hasHtml = typeof body.html === "string" && body.html.length > 0;

      if (hasUrl === hasHtml) {
        return sendJson(response, 400, {
          error: "invalid_request",
          message: "Provide exactly one of url or html."
        });
      }

      const kind = hasUrl ? "url" : "html";
      const label = hasUrl ? body.url : "inline-html";

      return sendJson(
        response,
        200,
        {
          scanId: `ariada_mock_${kind}_001`,
          status: "completed",
          target: {
            kind,
            label
          },
          summary: {
            findings: 1,
            critical: 0,
            serious: 1,
            moderate: 0,
            minor: 0
          },
          findings: [
            {
              id: "button-name",
              impact: "serious",
              wcag: ["WCAG 4.1.2"],
              message: "Button must have discernible text.",
              selector: "button:nth-of-type(1)"
            }
          ],
          evidence: {
            reportUrl: `https://api.ariada.ai/reports/ariada_mock_${kind}_001`,
            engine: "ariada-hosted-scan"
          }
        },
        {
          "X-RateLimit-Limit": "1000",
          "X-RateLimit-Remaining": "999"
        }
      );
    }

    return sendJson(response, 404, {
      error: "not_found",
      message: "Mock endpoint not found."
    });
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.argv[2] ?? "8787", 10);
  createMockServer().listen(port, "127.0.0.1", () => {
    console.error(`[rapidapi-ariada] mock listening on http://127.0.0.1:${port}`);
  });
}
