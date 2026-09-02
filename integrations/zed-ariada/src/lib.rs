// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

mod resolve;

use resolve::{Configured, ADAPTER_BINARY, CLI_BINARY, SERVER_NAME};
use zed_extension_api::{self as zed, settings::LspSettings};

struct AriadaExtension;

impl zed::Extension for AriadaExtension {
    fn new() -> Self {
        Self
    }

    /// Reads the three places a program could come from and hands them to the
    /// decision in `resolve`, which is where the order is written down and
    /// where it is tested. Nothing is decided here.
    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let settings = LspSettings::for_worktree(SERVER_NAME, worktree)?;
        let configured = settings.binary.map(|binary| Configured {
            path: binary.path,
            args: binary.arguments,
            env: binary
                .env
                .map(|env| env.into_iter().collect::<Vec<(String, String)>>()),
        });

        let launch = resolve::resolve(
            configured,
            worktree.which(ADAPTER_BINARY),
            worktree.which(CLI_BINARY),
        )?;

        Ok(zed::Command {
            command: launch.command,
            args: launch.args,
            env: launch.env,
        })
    }
}

zed::register_extension!(AriadaExtension);
