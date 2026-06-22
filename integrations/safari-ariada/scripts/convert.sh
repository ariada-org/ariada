#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
integration_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(cd "$integration_dir/../.." && pwd)"
config_file="$integration_dir/config/safari-wrapper.json"

read_config() {
  node -e "const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(c[process.argv[2]]);" "$config_file" "$1"
}

app_name="$(read_config appName)"
bundle_identifier="$(read_config bundleIdentifier)"
web_extension_dir="$(read_config webExtensionDir)"
project_dir="$(read_config projectDir)"

web_extension_abs="$(cd "$integration_dir" && cd "$web_extension_dir" && pwd)"
project_dir_abs="$integration_dir/$project_dir"

if [[ ! -f "$web_extension_abs/manifest.json" ]]; then
  echo "Missing manifest.json in $web_extension_abs" >&2
  echo "Run: pnpm -F @ariada-org/extension-chrome build" >&2
  exit 1
fi

converter="$(xcrun --find safari-web-extension-converter)"
mkdir -p "$(dirname "$project_dir_abs")"

"$converter" "$web_extension_abs" \
  --project-location "$project_dir_abs" \
  --app-name "$app_name" \
  --bundle-identifier "$bundle_identifier" \
  --swift \
  --macos-only \
  --no-open \
  --no-prompt \
  --force

echo "Generated Safari project at $project_dir_abs"

