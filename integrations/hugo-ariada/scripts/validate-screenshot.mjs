#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function inspectPng(path) {
  if (!existsSync(path)) throw new Error(`Missing screenshot: ${path}`);
  const buffer = readFileSync(path);
  if (!buffer.subarray(0, 8).equals(pngSignature)) throw new Error(`Not a PNG: ${path}`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format for validation: bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  let source = 0;
  let previous = Buffer.alloc(stride);
  let nonBlank = 0;
  const colors = new Set();

  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const row = Buffer.from(raw.subarray(source, source + stride));
    source += stride;
    unfilter(row, previous, channels, filter);
    for (let x = 0; x < width; x += 1) {
      const index = x * channels;
      const red = row[index];
      const green = row[index + 1];
      const blue = row[index + 2];
      const alpha = channels === 4 ? row[index + 3] : 255;
      if (alpha > 0 && !(red > 248 && green > 248 && blue > 248)) nonBlank += 1;
      if (colors.size < 256) colors.add(`${red},${green},${blue},${alpha}`);
    }
    previous = row;
  }

  return { path, width, height, nonBlank, colors: colors.size };
}

function unfilter(row, previous, channels, filter) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= channels ? row[index - channels] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= channels ? previous[index - channels] ?? 0 : 0;
    if (filter === 1) row[index] = (row[index] + left) & 0xff;
    else if (filter === 2) row[index] = (row[index] + up) & 0xff;
    else if (filter === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) row[index] = (row[index] + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error(`Unknown PNG filter: ${filter}`);
  }
}

function paeth(left, up, upLeft) {
  const prediction = left + up - upLeft;
  const pa = Math.abs(prediction - left);
  const pb = Math.abs(prediction - up);
  const pc = Math.abs(prediction - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node scripts/validate-screenshot.mjs <png> [png...]');
  process.exit(2);
}

const results = paths.map(inspectPng);
for (const result of results) {
  console.log(JSON.stringify(result));
  if (result.width < 640 || result.height < 360) throw new Error(`Screenshot too small: ${result.path}`);
  if (result.nonBlank < result.width * result.height * 0.05) throw new Error(`Screenshot appears blank: ${result.path}`);
  if (result.colors < 8) throw new Error(`Screenshot has too little color variation: ${result.path}`);
}
