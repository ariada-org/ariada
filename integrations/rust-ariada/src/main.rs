// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

use cargo_ariada::{run_gate, ExecRunner, Options, Target, EXIT_INVALID_ARGS, EXIT_RUNTIME_ERROR};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

#[derive(Debug, Parser)]
#[command(name = "cargo-ariada")]
#[command(about = "Cargo subcommand wrapper for the shared Ariada CLI scanner")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// HTTP(S) URL to scan when omitting the scan subcommand.
    target: Option<String>,

    /// Directory for Ariada JSON artifacts.
    #[arg(long, default_value = "ariada-output")]
    output_dir: PathBuf,

    /// Comma-separated Ariada domains to scan.
    #[arg(long, value_delimiter = ',')]
    domains: Vec<String>,

    /// Minimum severity that fails the gate.
    #[arg(long, default_value = "moderate")]
    severity_threshold: String,

    /// Ariada CLI binary to execute.
    #[arg(long, env = "ARIADA_BIN", default_value = "ariada")]
    ariada_bin: String,

    /// Built static-output directory to serve and scan.
    #[arg(long)]
    static_dir: Option<PathBuf>,

    /// Reserved scan timeout knob for future shared CLI parity.
    #[arg(long, default_value_t = 120)]
    timeout_seconds: u64,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Run Ariada against a URL or a built static-output directory.
    Scan(ScanArgs),
}

#[derive(Debug, Parser)]
struct ScanArgs {
    /// HTTP(S) URL to scan.
    target: Option<String>,

    /// Directory for Ariada JSON artifacts.
    #[arg(long, default_value = "ariada-output")]
    output_dir: PathBuf,

    /// Comma-separated Ariada domains to scan.
    #[arg(long, value_delimiter = ',')]
    domains: Vec<String>,

    /// Minimum severity that fails the gate.
    #[arg(long, default_value = "moderate")]
    severity_threshold: String,

    /// Ariada CLI binary to execute.
    #[arg(long, env = "ARIADA_BIN", default_value = "ariada")]
    ariada_bin: String,

    /// Built static-output directory to serve and scan.
    #[arg(long)]
    static_dir: Option<PathBuf>,

    /// Reserved scan timeout knob for future shared CLI parity.
    #[arg(long, default_value_t = 120)]
    timeout_seconds: u64,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let options = match cli.command {
        Some(Commands::Scan(args)) => options_from_parts(
            args.target,
            args.static_dir,
            args.output_dir,
            args.domains,
            args.severity_threshold,
            args.ariada_bin,
            args.timeout_seconds,
        ),
        None => options_from_parts(
            cli.target,
            cli.static_dir,
            cli.output_dir,
            cli.domains,
            cli.severity_threshold,
            cli.ariada_bin,
            cli.timeout_seconds,
        ),
    };

    let options = match options {
        Ok(options) => options,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::from(EXIT_INVALID_ARGS as u8);
        }
    };

    match run_gate(
        &options,
        &ExecRunner,
        &mut std::io::stdout(),
        &mut std::io::stderr(),
    ) {
        Ok(code) => ExitCode::from(code as u8),
        Err(error) => {
            eprintln!("{error}");
            let code = match error {
                cargo_ariada::GateError::InvalidArgs(_) => EXIT_INVALID_ARGS,
                cargo_ariada::GateError::Runtime(_) => EXIT_RUNTIME_ERROR,
            };
            ExitCode::from(code as u8)
        }
    }
}

fn options_from_parts(
    target: Option<String>,
    static_dir: Option<PathBuf>,
    output_dir: PathBuf,
    domains: Vec<String>,
    severity_threshold: String,
    ariada_bin: String,
    timeout_seconds: u64,
) -> Result<Options, String> {
    let target = match (target, static_dir) {
        (Some(url), None) => Target::Url(url),
        (None, Some(path)) => Target::StaticDir(path),
        (Some(_), Some(_)) => {
            return Err("provide either a URL or --static-dir, not both".to_string())
        }
        (None, None) => return Err("provide a URL or --static-dir".to_string()),
    };

    Ok(Options {
        target,
        output_dir,
        domains,
        severity_threshold,
        ariada_bin,
        timeout: Duration::from_secs(timeout_seconds),
    })
}
