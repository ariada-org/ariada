#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/classes"
rm -rf "$ROOT/build"
mkdir -p "$OUT"

javac -d "$OUT" \
  "$ROOT/src/org/ariada/eclipse/AriadaFinding.java" \
  "$ROOT/src/org/ariada/eclipse/AriadaMarker.java" \
  "$ROOT/src/org/ariada/eclipse/AriadaMarkerMapper.java" \
  "$ROOT/test/org/ariada/eclipse/AriadaMarkerMapperSmoke.java"

java -cp "$OUT" org.ariada.eclipse.AriadaMarkerMapperSmoke
