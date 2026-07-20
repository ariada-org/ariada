local M = {}

local namespace = vim.api.nvim_create_namespace("ariada")

local defaults = {
  cli = "ariada",
  severity_threshold = "moderate",
  timeout_ms = 30000,
  output_dir = nil,
}

local config = vim.deepcopy(defaults)

local severity_map = {
  critical = vim.diagnostic.severity.ERROR,
  serious = vim.diagnostic.severity.ERROR,
  moderate = vim.diagnostic.severity.WARN,
  minor = vim.diagnostic.severity.INFO,
}

local function join_path(...)
  local sep = package.config:sub(1, 1)
  return table.concat({ ... }, sep)
end

local function flatten_findings(scan)
  local report = scan.report or scan
  local findings = report.findings or {}
  local out = {}

  if vim.islist(findings) then
    for _, finding in ipairs(findings) do
      table.insert(out, finding)
    end
    return out
  end

  for _, group in pairs(findings) do
    if type(group) == "table" then
      for _, finding in ipairs(group) do
        table.insert(out, finding)
      end
    end
  end
  return out
end

local function line_for_finding(finding)
  if type(finding.line) == "number" and finding.line > 0 then
    return finding.line - 1
  end
  if type(finding.loc) == "table" and type(finding.loc.line) == "number" and finding.loc.line > 0 then
    return finding.loc.line - 1
  end
  return 0
end

local function diagnostic_for_finding(finding)
  local element = type(finding.element) == "table" and finding.element or {}
  local selector = element.selector and (" " .. element.selector) or ""
  local rule = finding.ruleId or "ariada"
  local severity = finding.severity or "moderate"
  local message = finding.message or "Accessibility finding"

  return {
    lnum = line_for_finding(finding),
    col = 0,
    end_lnum = line_for_finding(finding),
    end_col = 1,
    severity = severity_map[severity] or vim.diagnostic.severity.WARN,
    source = "ariada",
    code = rule,
    message = string.format("[%s] %s: %s%s", severity, rule, message, selector),
    user_data = finding,
  }
end

local function quickfix_for_diagnostic(bufnr, diagnostic)
  return {
    bufnr = bufnr,
    lnum = diagnostic.lnum + 1,
    col = diagnostic.col + 1,
    text = diagnostic.message,
    type = diagnostic.severity == vim.diagnostic.severity.ERROR and "E" or "W",
  }
end

function M.setup(opts)
  config = vim.tbl_deep_extend("force", defaults, opts or {})
end

function M.parse_scan_json(lines)
  local text = type(lines) == "table" and table.concat(lines, "\n") or lines
  local ok, parsed = pcall(vim.json.decode, text)
  if not ok then
    return nil, parsed
  end
  return flatten_findings(parsed), nil
end

function M.apply_scan_json(bufnr, lines)
  bufnr = bufnr or vim.api.nvim_get_current_buf()
  local findings, err = M.parse_scan_json(lines)
  if not findings then
    vim.notify("Ariada: unable to parse scan.json: " .. tostring(err), vim.log.levels.ERROR)
    return false
  end

  local diagnostics = {}
  for _, finding in ipairs(findings) do
    table.insert(diagnostics, diagnostic_for_finding(finding))
  end

  vim.diagnostic.set(namespace, bufnr, diagnostics, {})

  local quickfix = {}
  for _, diagnostic in ipairs(diagnostics) do
    table.insert(quickfix, quickfix_for_diagnostic(bufnr, diagnostic))
  end
  vim.fn.setqflist(quickfix, "r", { title = "Ariada accessibility findings" })

  vim.notify(string.format("Ariada: %d finding(s)", #diagnostics), vim.log.levels.INFO)
  return true
end

local function scan_target(opts)
  if opts.target and opts.target ~= "" then
    return opts.target
  end
  if vim.b.ariada_url then
    return vim.b.ariada_url
  end
  if vim.g.ariada_url then
    return vim.g.ariada_url
  end
  return nil
end

local function command_parts(target, output_dir)
  return {
    config.cli,
    "scan",
    target,
    "--format",
    "json",
    "--output-dir",
    output_dir,
    "--severity-threshold",
    config.severity_threshold,
    "--timeout-ms",
    tostring(config.timeout_ms),
  }
end

local function on_exit(bufnr, output_dir, code, stderr_lines)
  local scan_json = join_path(output_dir, "scan.json")
  local ok, lines = pcall(vim.fn.readfile, scan_json)
  if not ok then
    local stderr = table.concat(stderr_lines or {}, "\n")
    vim.notify("Ariada: scan did not produce scan.json: " .. stderr, vim.log.levels.ERROR)
    return
  end

  M.apply_scan_json(bufnr, lines)
  if code ~= 0 and code ~= 1 then
    vim.notify("Ariada: CLI exited with code " .. tostring(code), vim.log.levels.ERROR)
  end
end

function M.run(opts)
  opts = opts or {}
  local bufnr = vim.api.nvim_get_current_buf()
  local target = scan_target(opts)
  if not target then
    vim.notify("Ariada: pass a URL to :Ariada or set g:ariada_url", vim.log.levels.ERROR)
    return
  end

  local output_dir = config.output_dir or vim.fn.tempname()
  vim.fn.mkdir(output_dir, "p")
  local cmd = command_parts(target, output_dir)
  vim.notify("Ariada: scanning " .. target, vim.log.levels.INFO)

  if vim.system then
    vim.system(cmd, { text = true }, function(result)
      vim.schedule(function()
        local stderr = vim.split(result.stderr or "", "\n", { plain = true })
        on_exit(bufnr, output_dir, result.code, stderr)
      end)
    end)
    return
  end

  local stderr_lines = {}
  vim.fn.jobstart(cmd, {
    stderr_buffered = true,
    on_stderr = function(_, data)
      stderr_lines = data or {}
    end,
    on_exit = function(_, code)
      vim.schedule(function()
        on_exit(bufnr, output_dir, code, stderr_lines)
      end)
    end,
  })
end

return M
