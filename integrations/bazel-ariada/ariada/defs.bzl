"""Public Ariada scan rule for declared web build outputs."""

def _ariada_scan_impl(ctx):
    source_files = ctx.attr.src[DefaultInfo].files.to_list()
    if len(source_files) != 1:
        fail("src must provide exactly one HTML file or one directory artifact")
    if ctx.attr.timeout_ms < 1 or ctx.attr.timeout_ms > 300000:
        fail("timeout_ms must be between 1 and 300000")
    if not ctx.attr.domains:
        fail("domains must contain at least one Ariada domain")

    source = source_files[0]
    result = ctx.actions.declare_file(ctx.label.name + ".result.json")
    status = ctx.actions.declare_file(ctx.label.name + ".status.json")
    args = ctx.actions.args()
    args.add("--cli", ctx.file.cli.path)
    args.add("--input", source.path)
    args.add("--result", result.path)
    args.add("--status", status.path)
    args.add("--label", str(ctx.label))
    args.add("--severity-threshold", ctx.attr.severity_threshold)
    args.add("--timeout-ms", str(ctx.attr.timeout_ms))
    for domain in ctx.attr.domains:
        args.add("--domain", domain)
    if ctx.attr.entry_path:
        args.add("--entry-path", ctx.attr.entry_path)
    if ctx.attr.fail_on_findings:
        args.add("--fail-on-findings")

    browser_inputs = list(ctx.files.browser_files)
    if ctx.file.browser_cache_marker:
        browser_inputs.append(ctx.file.browser_cache_marker)
        args.add("--browser-cache", ctx.file.browser_cache_marker.dirname)

    runtime_inputs = ctx.attr.cli_runtime[DefaultInfo].files
    ctx.actions.run(
        executable = ctx.executable._runner,
        arguments = [args],
        inputs = depset(
            [source, ctx.file.cli] + browser_inputs,
            transitive = [runtime_inputs],
        ),
        tools = [ctx.attr._runner[DefaultInfo].files_to_run],
        outputs = [result, status],
        env = {
            "BAZEL_BINDIR": ctx.bin_dir.path,
            "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
        },
        mnemonic = "AriadaScan",
        progress_message = "Ariada scan %{label}",
        use_default_shell_env = False,
    )

    return [
        DefaultInfo(files = depset([result, status])),
        OutputGroupInfo(
            ariada_result = depset([result]),
            ariada_status = depset([status]),
        ),
    ]

_ariada_scan = rule(
    implementation = _ariada_scan_impl,
    attrs = {
        "browser_cache_marker": attr.label(
            allow_single_file = True,
            doc = "Marker file whose directory is a declared Playwright browser cache root.",
        ),
        "browser_files": attr.label_list(
            allow_files = True,
            doc = "Declared browser runtime files included in the action cache key.",
        ),
        "cli": attr.label(
            allow_single_file = [".js"],
            default = Label("//vendor:node_modules/@ariada-org/cli/dist/bin.js"),
            doc = "Ariada CLI JavaScript entry point.",
        ),
        "cli_runtime": attr.label(
            default = Label("//vendor:runtime"),
            doc = "Exact offline runtime closure for the Ariada CLI.",
        ),
        "domains": attr.string_list(
            default = ["accessibility"],
            doc = "Ariada domains passed to the CLI.",
        ),
        "entry_path": attr.string(
            doc = "Relative HTML entry inside a directory artifact; defaults to index.html.",
        ),
        "fail_on_findings": attr.bool(
            default = False,
            doc = "Return exit 1 for findings after writing result artifacts.",
        ),
        "severity_threshold": attr.string(
            default = "moderate",
            values = ["minor", "moderate", "serious", "critical"],
            doc = "Minimum finding severity that produces semantic exit 1.",
        ),
        "src": attr.label(
            mandatory = True,
            doc = "Target providing exactly one declared HTML file or directory artifact.",
        ),
        "timeout_ms": attr.int(
            default = 30000,
            doc = "Browser navigation timeout in milliseconds.",
        ),
        "_runner": attr.label(
            default = Label("//ariada/private:runner"),
            executable = True,
            cfg = "exec",
        ),
    },
    doc = "Runs the Ariada CLI over a declared web build output.",
)

def ariada_scan(name, src, **kwargs):
    """Declares a cacheable Ariada scan action.

    Args:
      name: Bazel target name.
      src: Target yielding one HTML file or one directory artifact.
      **kwargs: Attributes accepted by the underlying rule.
    """
    _ariada_scan(
        name = name,
        src = src,
        **kwargs
    )
