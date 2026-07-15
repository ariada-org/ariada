#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] ?? 'scan-evidence/screenshots/webflow-panel.png');
const png = await readFile(file);
const { channels, data, height, width } = decodePng(png);
const sample = new Set();
for (let index = 0; index < data.length; index += channels) {
  sample.add(Array.from(data.subarray(index, index + channels)).join(','));
  if (sample.size > 24) break;
}
if (width < 600 || height < 400 || sample.size < 8) {
  console.error(`Screenshot appears blank or too small: ${width}x${height}, colors=${sample.size}`);
  process.exit(1);
}
console.log(`Screenshot validated: ${width}x${height}, sampled colors=${sample.size}`);

function decodePng(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Not a PNG file');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(start);
      height = buffer.readUInt32BE(start + 4);
      const bitDepth = buffer[start + 8];
      const colorType = buffer[start + 9];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error('Only 8-bit RGB/RGBA PNG screenshots are supported');
      channels = colorType === 6 ? 4 : 3;
    }
    if (type === 'IDAT') chunks.push(buffer.subarray(start, end));
    if (type === 'IEND') break;
    offset = end + 4;
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[input];
    input += 1;
    const row = inflated.subarray(input, input + stride);
    input += stride;
    const out = data.subarray(y * stride, (y + 1) * stride);
    unfilter(filter, row, out, y === 0 ? null : data.subarray((y - 1) * stride, y * stride), channels);
  }
  return { channels, data, height, width };
}

function unfilter(filter, row, out, prev, channels) {
  for (let x = 0; x < row.length; x += 1) {
    const left = x >= channels ? out[x - channels] : 0;
    const up = prev ? prev[x] : 0;
    const upLeft = prev && x >= channels ? prev[x - channels] : 0;
    if (filter === 0) out[x] = row[x];
    else if (filter === 1) out[x] = (row[x] + left) & 255;
    else if (filter === 2) out[x] = (row[x] + up) & 255;
    else if (filter === 3) out[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) out[x] = (row[x] + paeth(left, up, upLeft)) & 255;
    else throw new Error(`Unsupported PNG filter: ${filter}`);
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
