#!/usr/bin/env bash
set -euo pipefail

out_dir=""
while [[ $# -gt 0 ]]; do
 case "$1" in
 --output-dir)
 out_dir="$2"
 shift 2
;;
 *)
 shift
;;
 esac
done

if [[ -z "$out_dir" ]]; then
 echo "missing --output-dir" >&2
 exit 2
fi

mkdir -p "$out_dir"
cat > "$out_dir/scan.json" <<'JSON'
{
 "$schema": "https://ariada.org/schemas/cli-scan.v1.json",
 "url": "https://maven.example.test",
 "scanId": "MAVEN-IT-FAIL",
 "startedAt": "2026-06-23T08:00:00.000Z",
 "completedAt": "2026-06-23T08:00:01.000Z",
 "durationMs": 1000,
 "summary": {
 "total": 1,
 "byImpact": {
 "minor": 0,
 "moderate": 0,
 "serious": 1,
 "critical": 0
 }
 },
 "report": {
 "scanId": "MAVEN-IT-FAIL",
 "url": "https://maven.example.test",
 "findings": {
 "a11y": [
 {
 "ruleId": "image-alt",
 "severity": "serious",
 "message": "Image needs alternate text."
 }
 ]
 }
 },
 "exitCode": 1
}
JSON
echo "Wrote $out_dir/scan.json"
exit 1
