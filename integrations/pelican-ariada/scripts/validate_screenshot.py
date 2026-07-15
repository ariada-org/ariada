#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    default = Path("scan-evidence/screenshots/scan-result.png")
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    image = Image.open(path).convert("RGB")
    width, height = image.size
    sample = image.resize((64, 64))
    colors = sample.getcolors(maxcolors=4096) or []
    nonwhite = sum(count for count, color in colors if color != (255, 255, 255))
    if width < 640 or height < 360:
        print(f"FAIL {path}: dimensions {width}x{height} are too small")
        return 1
    if nonwhite < 64:
        print(f"FAIL {path}: sampled nonblank pixels {nonwhite} too low")
        return 1
    print(f"PASS {path}: {width}x{height}, sampled nonblank pixels {nonwhite}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
