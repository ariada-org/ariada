// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;
use tempfile::tempdir;

#[test]
fn cargo_ariada_invokes_stub_cli_and_fails_on_fixture_violation() {
    let temp = tempdir().expect("tempdir");
    let bin_dir = temp.path().join("bin");
    let output_dir = temp.path().join("out");
    fs::create_dir(&bin_dir).expect("bin dir");

    let stub = bin_dir.join("ariada-stub");
    write_stub_cli(&stub);

    let status = Command::new(env!("CARGO_BIN_EXE_cargo-ariada"))
        .arg("scan")
        .arg("http://127.0.0.1:65535/")
        .arg("--domains")
        .arg("accessibility")
        .arg("--output-dir")
        .arg(&output_dir)
        .arg("--severity-threshold")
        .arg("moderate")
        .arg("--ariada-bin")
        .arg(&stub)
        .status()
        .expect("run cargo-ariada");

    assert_eq!(status.code(), Some(1));
    let report =
        fs::read_to_string(output_dir.join("multi-domain-report.json")).expect("stub report");
    assert!(report.contains("ariada/statement/page-link-from-footer"));
}

fn write_stub_cli(path: &Path) {
    fs::write(
        path,
        r#"#!/usr/bin/env sh
set -eu
out="ariada-output"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-dir" ]; then
    shift
    out="$1"
  fi
  shift || true
done
mkdir -p "$out"
cat > "$out/multi-domain-report.json" <<'JSON'
{
  "sites": ["http://127.0.0.1:65535/"],
  "domains": ["accessibility"],
  "grid": {
    "http://127.0.0.1:65535/": {
      "accessibility": [
        {
          "ruleId": "ariada/statement/page-link-from-footer",
          "severity": "moderate",
          "message": "Accessibility statement link is missing from the footer."
        }
      ]
    }
  }
}
JSON
printf 'stub Ariada scan wrote %s\n' "$out"
"#,
    )
    .expect("write stub cli");
    let mut perms = fs::metadata(path).expect("metadata").permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms).expect("chmod stub");
}
