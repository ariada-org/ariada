// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

//! Which program the editor should start, and with what.
//!
//! The order matters and it is the only thing in this extension that can be
//! wrong in a way nobody notices: if the explicit setting stops winning, a
//! person who pointed the editor at their own build gets a different binary
//! than the one they named, silently, and everything still appears to work.
//!
//! So the decision lives here, over plain strings, away from the editor types
//! it cannot be tested through.

/// What to run, and with what arguments and environment.
#[derive(Debug)]
pub struct Launch {
    pub command: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// What the settings said, if anything was said.
pub struct Configured {
    pub path: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<Vec<(String, String)>>,
}

pub const ADAPTER_BINARY: &str = "ariada-zed-lsp";
pub const CLI_BINARY: &str = "ariada";
pub const SERVER_NAME: &str = "ariada-lsp";

/// In order: what the person configured, then the adapter if it is on the path,
/// then the command-line tool asked to speak the protocol. Failing all three,
/// a message that names what would satisfy it — an error that does not say what
/// to install is a dead end wearing an explanation.
pub fn resolve(
    configured: Option<Configured>,
    adapter_on_path: Option<String>,
    cli_on_path: Option<String>,
) -> Result<Launch, String> {
    if let Some(c) = configured {
        if let Some(path) = c.path {
            return Ok(Launch {
                command: path,
                args: c.args.unwrap_or_default(),
                env: c.env.unwrap_or_default(),
            });
        }
    }

    if let Some(path) = adapter_on_path {
        return Ok(Launch {
            command: path,
            args: Vec::new(),
            env: Vec::new(),
        });
    }

    if let Some(path) = cli_on_path {
        return Ok(Launch {
            command: path,
            args: vec!["lsp".to_string(), "--stdio".to_string()],
            env: Vec::new(),
        });
    }

    Err(format!(
        "Ariada diagnostics require `{}` on PATH or an explicit lsp.{} binary setting",
        ADAPTER_BINARY, SERVER_NAME
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn configured(path: &str) -> Option<Configured> {
        Some(Configured {
            path: Some(path.to_string()),
            args: Some(vec!["--verbose".to_string()]),
            env: Some(vec![("ARIADA_LOG".to_string(), "debug".to_string())]),
        })
    }

    #[test]
    fn a_configured_path_wins_over_anything_found_on_the_path() {
        let got = resolve(
            configured("/opt/mine/ariada-lsp"),
            Some("/usr/bin/ariada-zed-lsp".to_string()),
            Some("/usr/bin/ariada".to_string()),
        )
        .expect("a configured path is enough to start");
        assert_eq!(got.command, "/opt/mine/ariada-lsp");
        assert_eq!(got.args, vec!["--verbose".to_string()]);
        assert_eq!(
            got.env,
            vec![("ARIADA_LOG".to_string(), "debug".to_string())]
        );
    }

    #[test]
    fn settings_present_but_naming_no_path_fall_through() {
        // A settings block that configures everything except which binary to
        // run must not count as an answer, or the search stops at nothing.
        let got = resolve(
            Some(Configured {
                path: None,
                args: Some(vec!["--verbose".to_string()]),
                env: None,
            }),
            Some("/usr/bin/ariada-zed-lsp".to_string()),
            None,
        )
        .expect("the adapter on the path is still an answer");
        assert_eq!(got.command, "/usr/bin/ariada-zed-lsp");
        assert!(got.args.is_empty());
    }

    #[test]
    fn the_adapter_is_preferred_to_the_command_line_tool() {
        let got = resolve(
            None,
            Some("/usr/bin/ariada-zed-lsp".to_string()),
            Some("/usr/bin/ariada".to_string()),
        )
        .expect("the adapter is enough to start");
        assert_eq!(got.command, "/usr/bin/ariada-zed-lsp");
    }

    #[test]
    fn the_command_line_tool_is_asked_to_speak_the_protocol() {
        let got = resolve(None, None, Some("/usr/bin/ariada".to_string()))
            .expect("the command-line tool is enough to start");
        assert_eq!(got.command, "/usr/bin/ariada");
        assert_eq!(got.args, vec!["lsp".to_string(), "--stdio".to_string()]);
    }

    #[test]
    fn with_nothing_to_run_the_message_names_what_would_satisfy_it() {
        let err = resolve(None, None, None).expect_err("nothing to run is an error");
        assert!(err.contains(ADAPTER_BINARY), "names the adapter: {err}");
        assert!(err.contains(SERVER_NAME), "names the setting: {err}");
    }
}
