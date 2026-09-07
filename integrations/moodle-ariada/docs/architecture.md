# Architecture

local_ariada is a thin Moodle adapter over @ariada-org/cli.

1. A teacher with local/ariada:scan submits a course URL.
2. url_policy requires Moodle's exact origin.
3. Moodle stores a queued record and schedules an ad hoc task.
4. Cron invokes the fixed CLI path from the production ZIP without a shell.
5. Exit 0 (clean) and 1 (findings) parse multi-domain-report.json.
6. Teachers see course reports; site managers can see all reports.

The plugin contains no accessibility rules, browser automation, or fallback
scanner. It stores canonical JSON for traceability and implements Moodle's
Privacy API for records associated with the requesting user.

## Security boundaries

- Targets are HTTP(S), contain no URL credentials, and match $CFG->wwwroot's
  scheme, host, and effective port.
- --allow-private is administrator-controlled and never relaxes same-origin
  validation.
- proc_open receives an argument vector; no shell is involved.
- Runtime path, domain, output directory, process time, stream size, report size,
  and displayed history are bounded.
- Browser installation is never a web request, cron action, lifecycle script,
  or scan-gate side effect.

