// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

use zed_extension_api::{self as zed, settings::LspSettings};

const SERVER_NAME: &str = "ariada-lsp";
const ADAPTER_BINARY: &str = "ariada-zed-lsp";
const CLI_BINARY: &str = "ariada";

struct AriadaExtension;

impl zed::Extension for AriadaExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let settings = LspSettings::for_worktree(SERVER_NAME, worktree)?;

        if let Some(binary) = settings.binary {
            if let Some(path) = binary.path {
                return Ok(zed::Command {
                    command: path,
                    args: binary.arguments.unwrap_or_default(),
                    env: binary
                        .env
                        .unwrap_or_default()
                        .into_iter()
                        .collect::<Vec<(String, String)>>(),
                });
            }
        }

        if let Some(path) = worktree.which(ADAPTER_BINARY) {
            return Ok(zed::Command {
                command: path,
                args: Vec::new(),
                env: Vec::new(),
            });
        }

        if let Some(path) = worktree.which(CLI_BINARY) {
            return Ok(zed::Command {
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
}

zed::register_extension!(AriadaExtension);
