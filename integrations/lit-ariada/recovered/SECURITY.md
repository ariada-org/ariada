# Security policy

Report suspected vulnerabilities privately to `security@ariada.org`. Do not include secrets, private customer URLs, or production scan artifacts in public issues.

## Boundaries

The Web Test Runner command accepts only credential-free loopback HTTP fixture URLs. This prevents the browser-side command from becoming a general SSRF primitive. Component selectors must be custom-element tag names, timeouts are bounded, process output and JSON artifacts have size limits, and scanner operational failures remain failures.

The package has no install lifecycle hook and never downloads a browser. Consumers must provision a Playwright 1.60-compatible browser and point `PLAYWRIGHT_BROWSERS_PATH` at its cache. No token or registry credential is required at runtime.
