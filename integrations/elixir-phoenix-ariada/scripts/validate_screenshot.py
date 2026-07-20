#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2

import struct
import sys
import zlib


def read_png(path):
    with open(path, "rb") as handle:
        data = handle.read()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SystemExit("not a PNG")

    pos = 8
    width = height = None
    color_type = None
    bit_depth = None
    chunks = []
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", payload[:10])
        elif kind == b"IDAT":
            chunks.append(payload)
    if width is None or height is None:
        raise SystemExit("missing IHDR")
    return width, height, bit_depth, color_type, zlib.decompress(b"".join(chunks))


def main():
    path = sys.argv[1]
    width, height, bit_depth, color_type, raw = read_png(path)
    if width < 900 or height < 600:
        raise SystemExit(f"screenshot too small: {width}x{height}")
    if bit_depth != 8 or color_type not in (2, 6):
        raise SystemExit(f"unsupported PNG format: bit_depth={bit_depth} color_type={color_type}")

    channels = 3 if color_type == 2 else 4
    stride = width * channels
    reconstructed = []
    previous = bytearray(stride)
    pos = 0
    for _ in range(height):
        filter_type = raw[pos]
        pos += 1
        scanline = bytearray(raw[pos : pos + stride])
        pos += stride
        for index in range(stride):
            left = scanline[index - channels] if index >= channels else 0
            up = previous[index]
            up_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                scanline[index] = (scanline[index] + left) & 0xFF
            elif filter_type == 2:
                scanline[index] = (scanline[index] + up) & 0xFF
            elif filter_type == 3:
                scanline[index] = (scanline[index] + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                predictor = left + up - up_left
                distances = (abs(predictor - left), abs(predictor - up), abs(predictor - up_left))
                paeth = (left, up, up_left)[distances.index(min(distances))]
                scanline[index] = (scanline[index] + paeth) & 0xFF
            elif filter_type != 0:
                raise SystemExit(f"unsupported PNG filter type {filter_type}")
        reconstructed.append(bytes(scanline))
        previous = scanline

    sample = b"".join(reconstructed[:: max(1, height // 40)])
    unique_values = len(set(sample))
    if unique_values < 16:
        raise SystemExit(f"screenshot appears blank: only {unique_values} unique byte values")

    print(f"screenshot ok: {width}x{height}, nonblank unique byte values={unique_values}")


if __name__ == "__main__":
    main()
