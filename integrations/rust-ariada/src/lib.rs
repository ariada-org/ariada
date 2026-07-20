// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

use serde::Deserialize;
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

pub const EXIT_OK: i32 = 0;
pub const EXIT_VIOLATIONS: i32 = 1;
pub const EXIT_INVALID_ARGS: i32 = 2;
pub const EXIT_RUNTIME_ERROR: i32 = 3;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Target {
    Url(String),
    StaticDir(PathBuf),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Options {
    pub target: Target,
    pub output_dir: PathBuf,
    pub domains: Vec<String>,
    pub severity_threshold: String,
    pub ariada_bin: String,
    pub timeout: Duration,
}

impl Options {
    pub fn validate(&self) -> Result<(), GateError> {
        if self.ariada_bin.trim().is_empty() {
            return Err(GateError::InvalidArgs(
                "provide a non-empty Ariada CLI command".to_string(),
            ));
        }
        if severity_rank(&self.severity_threshold).is_none() {
            return Err(GateError::InvalidArgs(format!(
                "unknown severity threshold {:?}",
                self.severity_threshold
            )));
        }
        match &self.target {
            Target::Url(url) if valid_http_url(url) => Ok(()),
            Target::Url(_) => Err(GateError::InvalidArgs(
                "provide a parseable http(s) URL or --static-dir".to_string(),
            )),
            Target::StaticDir(path) if path.is_dir() => Ok(()),
            Target::StaticDir(path) => Err(GateError::InvalidArgs(format!(
                "static output dir does not exist or is not a directory: {}",
                path.display()
            ))),
        }
    }
}

#[derive(Debug)]
pub enum GateError {
    InvalidArgs(String),
    Runtime(String),
}

impl fmt::Display for GateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GateError::InvalidArgs(message) | GateError::Runtime(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for GateError {}

pub trait Runner {
    fn run(&self, name: &str, args: &[String]) -> CommandResult;
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Default)]
pub struct ExecRunner;

impl Runner for ExecRunner {
    fn run(&self, name: &str, args: &[String]) -> CommandResult {
        match Command::new(name).args(args).output() {
            Ok(output) => CommandResult {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                exit_code: output.status.code().unwrap_or(EXIT_RUNTIME_ERROR),
            },
            Err(error) => CommandResult {
                stdout: String::new(),
                stderr: error.to_string(),
                exit_code: EXIT_RUNTIME_ERROR,
            },
        }
    }
}

pub fn run_gate(
    opts: &Options,
    runner: &dyn Runner,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> Result<i32, GateError> {
    opts.validate()?;
    fs::create_dir_all(&opts.output_dir)
        .map_err(|err| GateError::Runtime(format!("create output dir: {err}")))?;

    let _server;
    let target_url = match &opts.target {
        Target::Url(url) => url.clone(),
        Target::StaticDir(path) => {
            _server = StaticServer::start(path)?;
            _server.url()
        }
    };

    let args = build_ariada_args(opts, &target_url);
    let result = runner.run(&opts.ariada_bin, &args);
    write!(stdout, "{}", result.stdout)
        .map_err(|err| GateError::Runtime(format!("write stdout: {err}")))?;
    write!(stderr, "{}", result.stderr)
        .map_err(|err| GateError::Runtime(format!("write stderr: {err}")))?;

    let report_path = opts.output_dir.join("multi-domain-report.json");
    let report = match MultiDomainReport::from_path(&report_path) {
        Ok(report) => report,
        Err(_) if result.exit_code != EXIT_OK => return Ok(normalize_exit(result.exit_code)),
        Err(error) => {
            return Err(GateError::Runtime(format!(
                "read Ariada report {}: {error}",
                report_path.display()
            )))
        }
    };

    let findings = report.findings_at_or_above(&opts.severity_threshold);
    if findings > 0 {
        writeln!(
            stdout,
            "cargo-ariada: {findings} finding(s) at or above {}",
            opts.severity_threshold
        )
        .map_err(|err| GateError::Runtime(format!("write stdout: {err}")))?;
        return Ok(EXIT_VIOLATIONS);
    }

    writeln!(
        stdout,
        "cargo-ariada: no findings at or above {}",
        opts.severity_threshold
    )
    .map_err(|err| GateError::Runtime(format!("write stdout: {err}")))?;
    Ok(EXIT_OK)
}

pub fn build_ariada_args(opts: &Options, target_url: &str) -> Vec<String> {
    let mut args = vec![
        "scan".to_string(),
        target_url.to_string(),
        "--format".to_string(),
        "both".to_string(),
        "--output-dir".to_string(),
        opts.output_dir.to_string_lossy().to_string(),
        "--severity-threshold".to_string(),
        opts.severity_threshold.clone(),
    ];
    if !opts.domains.is_empty() {
        args.push("--domains".to_string());
        args.push(opts.domains.join(","));
    }
    args
}

#[derive(Debug, Deserialize)]
struct Finding {
    severity: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MultiDomainReport {
    grid: HashMap<String, HashMap<String, Vec<Finding>>>,
}

impl MultiDomainReport {
    fn from_path(path: &Path) -> Result<Self, String> {
        let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
        let report: MultiDomainReport =
            serde_json::from_str(&raw).map_err(|err| err.to_string())?;
        if report.grid.is_empty() {
            return Err("Ariada report has no grid".to_string());
        }
        Ok(report)
    }

    fn findings_at_or_above(&self, threshold: &str) -> usize {
        let min_rank = severity_rank(threshold).unwrap_or(2);
        self.grid
            .values()
            .flat_map(HashMap::values)
            .flatten()
            .filter(|finding| {
                let rank = finding
                    .severity
                    .as_deref()
                    .and_then(severity_rank)
                    .unwrap_or(2);
                rank >= min_rank
            })
            .count()
    }
}

fn severity_rank(value: &str) -> Option<u8> {
    match value {
        "minor" => Some(1),
        "moderate" => Some(2),
        "serious" => Some(3),
        "critical" => Some(4),
        _ => None,
    }
}

fn normalize_exit(code: i32) -> i32 {
    if (EXIT_OK..=EXIT_RUNTIME_ERROR).contains(&code) {
        code
    } else {
        EXIT_RUNTIME_ERROR
    }
}

fn valid_http_url(value: &str) -> bool {
    let Some((scheme, rest)) = value.split_once("://") else {
        return false;
    };
    matches!(scheme, "http" | "https") && !rest.trim().is_empty() && !rest.starts_with('/')
}

struct StaticServer {
    address: SocketAddr,
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl StaticServer {
    fn start(root: &Path) -> Result<Self, GateError> {
        let root = root
            .canonicalize()
            .map_err(|err| GateError::Runtime(format!("canonicalize static dir: {err}")))?;
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|err| GateError::Runtime(format!("start static fixture server: {err}")))?;
        let address = listener
            .local_addr()
            .map_err(|err| GateError::Runtime(format!("read static server address: {err}")))?;
        listener
            .set_nonblocking(true)
            .map_err(|err| GateError::Runtime(format!("configure static server: {err}")))?;

        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let handle = thread::spawn(move || {
            while !thread_stop.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _)) => serve_one(stream, &root),
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(20));
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            address,
            stop,
            handle: Some(handle),
        })
    }

    fn url(&self) -> String {
        format!("http://{}/", self.address)
    }
}

impl Drop for StaticServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(self.address);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn serve_one(mut stream: TcpStream, root: &Path) {
    let mut buffer = [0_u8; 2048];
    let Ok(read) = stream.read(&mut buffer) else {
        return;
    };
    let request = String::from_utf8_lossy(&buffer[..read]);
    let Some(path) = request_path(&request) else {
        let _ = stream.write_all(response(400, "text/plain", b"bad request").as_bytes());
        return;
    };
    let file_path = safe_join(root, &path).unwrap_or_else(|| root.join("index.html"));
    let file_path = if file_path.is_dir() {
        file_path.join("index.html")
    } else {
        file_path
    };

    match fs::read(&file_path) {
        Ok(body) => {
            let content_type = if file_path.extension().and_then(|ext| ext.to_str()) == Some("html")
            {
                "text/html; charset=utf-8"
            } else {
                "application/octet-stream"
            };
            let header = response(200, content_type, &body);
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(&body);
        }
        Err(_) => {
            let _ = stream.write_all(response(404, "text/plain", b"not found").as_bytes());
        }
    }
}

fn request_path(request: &str) -> Option<String> {
    let line = request.lines().next()?;
    let mut parts = line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let raw_path = parts.next()?.split('?').next().unwrap_or("/");
    Some(raw_path.trim_start_matches('/').to_string())
}

fn safe_join(root: &Path, request_path: &str) -> Option<PathBuf> {
    let mut path = root.to_path_buf();
    for component in Path::new(request_path).components() {
        match component {
            Component::Normal(part) => path.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(path)
}

fn response(status: u16, content_type: &str, body: &[u8]) -> String {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use tempfile::tempdir;

    #[test]
    fn builds_cli_args_and_passes_when_report_is_clean() {
        let dir = tempdir().expect("tempdir");
        let runner =
            FakeRunner::with_report(r#"{"grid":{"http://127.0.0.1:8080/":{"accessibility":[]}}}"#);
        let opts = Options {
            target: Target::Url("http://127.0.0.1:8080/".to_string()),
            output_dir: dir.path().to_path_buf(),
            domains: vec!["accessibility".to_string(), "privacy".to_string()],
            severity_threshold: "serious".to_string(),
            ariada_bin: "ariada".to_string(),
            timeout: Duration::from_secs(30),
        };

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let exit = run_gate(&opts, &runner, &mut stdout, &mut stderr).expect("run gate");

        assert_eq!(exit, EXIT_OK);
        assert!(String::from_utf8(stdout)
            .expect("stdout utf8")
            .contains("no findings at or above serious"));
        assert!(stderr.is_empty());
        assert_eq!(
            runner.last_args(),
            vec![
                "scan",
                "http://127.0.0.1:8080/",
                "--format",
                "both",
                "--output-dir",
                dir.path().to_str().expect("utf8 dir"),
                "--severity-threshold",
                "serious",
                "--domains",
                "accessibility,privacy"
            ]
        );
    }

    #[test]
    fn fails_gate_when_report_has_findings_at_threshold() {
        let dir = tempdir().expect("tempdir");
        let runner = FakeRunner::with_report(
            r#"{"grid":{"http://127.0.0.1:8080/":{"accessibility":[{"severity":"minor"},{"severity":"moderate"},{"severity":"critical"}]}}}"#,
        );
        let opts = Options {
            target: Target::Url("http://127.0.0.1:8080/".to_string()),
            output_dir: dir.path().to_path_buf(),
            domains: Vec::new(),
            severity_threshold: "moderate".to_string(),
            ariada_bin: "ariada".to_string(),
            timeout: Duration::from_secs(30),
        };

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let exit = run_gate(&opts, &runner, &mut stdout, &mut stderr).expect("run gate");

        assert_eq!(exit, EXIT_VIOLATIONS);
        assert!(String::from_utf8(stdout)
            .expect("stdout utf8")
            .contains("2 finding(s) at or above moderate"));
    }

    #[test]
    fn rejects_invalid_inputs() {
        for target in [
            Target::Url(String::new()),
            Target::Url("file:///tmp/index.html".to_string()),
        ] {
            let opts = Options {
                target,
                output_dir: PathBuf::from("ariada-output"),
                domains: Vec::new(),
                severity_threshold: "moderate".to_string(),
                ariada_bin: "ariada".to_string(),
                timeout: Duration::from_secs(30),
            };
            assert!(matches!(opts.validate(), Err(GateError::InvalidArgs(_))));
        }

        let opts = Options {
            target: Target::Url("https://example.test/".to_string()),
            output_dir: PathBuf::from("ariada-output"),
            domains: Vec::new(),
            severity_threshold: "blocker".to_string(),
            ariada_bin: "ariada".to_string(),
            timeout: Duration::from_secs(30),
        };
        assert!(matches!(opts.validate(), Err(GateError::InvalidArgs(_))));
    }

    #[test]
    fn returns_cli_failure_when_no_report_was_written() {
        let dir = tempdir().expect("tempdir");
        let runner = FakeRunner {
            report: None,
            result: CommandResult {
                stdout: String::new(),
                stderr: "boom".to_string(),
                exit_code: EXIT_RUNTIME_ERROR,
            },
            last_args: RefCell::new(Vec::new()),
        };
        let opts = Options {
            target: Target::Url("https://example.test/".to_string()),
            output_dir: dir.path().to_path_buf(),
            domains: Vec::new(),
            severity_threshold: "moderate".to_string(),
            ariada_bin: "ariada".to_string(),
            timeout: Duration::from_secs(30),
        };

        let exit = run_gate(&opts, &runner, &mut Vec::new(), &mut Vec::new()).expect("exit");

        assert_eq!(exit, EXIT_RUNTIME_ERROR);
    }

    struct FakeRunner {
        report: Option<String>,
        result: CommandResult,
        last_args: RefCell<Vec<String>>,
    }

    impl FakeRunner {
        fn with_report(report: &str) -> Self {
            Self {
                report: Some(report.to_string()),
                result: CommandResult::default(),
                last_args: RefCell::new(Vec::new()),
            }
        }

        fn last_args(&self) -> Vec<String> {
            self.last_args.borrow().clone()
        }
    }

    impl Runner for FakeRunner {
        fn run(&self, _name: &str, args: &[String]) -> CommandResult {
            *self.last_args.borrow_mut() = args.to_vec();
            if let Some(report) = &self.report {
                let output_dir = args
                    .windows(2)
                    .find_map(|pair| (pair[0] == "--output-dir").then(|| PathBuf::from(&pair[1])))
                    .expect("output dir arg");
                fs::create_dir_all(&output_dir).expect("create output dir");
                fs::write(output_dir.join("multi-domain-report.json"), report)
                    .expect("write report");
            }
            self.result.clone()
        }
    }
}
