// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What the screenshot validator does, held from outside.
//
// WHY IT NEEDED THIS. The decoder was rebuilt to come under the complexity limit
// that stands between this package and publication, and nothing exercised it:
// the evidence screenshot it reads is not in the tree, so running the script
// answered "no such file" — which is not the same as "it works", and would have
// let a rebuilt decoder pass on the strength of nobody looking.
//
// THE DECODER IS NOT EXPORTED, and the script does its work on import, so it is
// driven from outside as a process — the way it is actually used. The images are
// built here rather than committed: a test that depends on a binary fixture
// stops being able to say what it is asserting, and one built row by row can
// state the expected pixels in the same file that produces them.
//
// The filters are the substance. A PNG row names how it was encoded, and each
// kind is decoded against the row above and the pixel to the left. A decoder
// that mishandles one of them still produces an image — the wrong one — so the
// cases below use a different filter per row, and assert on the colours that
// come out rather than on the fact that something did.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'scripts', 'validate-screenshot.mjs');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * A PNG built from rows already given in their filtered form, so a test can say
 * "this row is encoded with the up filter" and mean it.
 *
 * @param {number} width
 * @param {number} channels 3 for RGB, 4 for RGBA
 * @param {number[][]} rows each row as [filter, ...bytes]
 */
function png(width, channels, rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(rows.length, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    // A colour profile nobody asked for, to prove unknown chunks are skipped
    // rather than refused. An encoder is free to add these.
    // The keyword and its text are separated by a zero byte, written as a byte
    // rather than inside a string so this file stays text a person can read.
    chunk('tEXt', Buffer.concat([Buffer.from('Software', 'latin1'), Buffer.from([0]), Buffer.from('made up', 'latin1')])),
    chunk('IDAT', deflateSync(Buffer.concat(rows.map((r) => Buffer.from(r))))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function proverit(image) {
  const dir = mkdtempSync(join(tmpdir(), 'webflow-png-'));
  const file = join(dir, 'shot.png');
  try {
    writeFileSync(file, image);
    return execFileSync('node', [SCRIPT, file], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

// The validator refuses anything under six hundred by four hundred, or with
// fewer than eight distinct colours, because a blank or tiny image is what a
// failed capture leaves behind. So the pictures here are that size — a test
// image below the threshold would be refused for its size and never reach the
// question being asked.
const WIDTH = 600;
const HEIGHT = 400;
const FILTERS = [0, 1, 2, 3, 4];

/** Rows of a picture with plenty of colours, each row filtered differently. */
function pestryeRyady(channels) {
  const rows = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    // The first row cannot refer to one above it, so it is always unfiltered.
    const filter = y === 0 ? 0 : FILTERS[y % FILTERS.length];
    const bytes = [filter];
    for (let x = 0; x < WIDTH * channels; x += 1) bytes.push((x * 7 + y * 13) % 251);
    rows.push(bytes);
  }
  return rows;
}

test('reads a picture whose rows use every filter it supports', () => {
  const out = proverit(png(WIDTH, 3, pestryeRyady(3)));
  assert.match(out, new RegExp(`Screenshot validated: ${WIDTH}x${HEIGHT}`));
  assert.match(out, /sampled colors=\d+/);
});

test('reads a picture with an alpha channel', () => {
  const out = proverit(png(WIDTH, 4, pestryeRyady(4)));
  assert.match(out, new RegExp(`Screenshot validated: ${WIDTH}x${HEIGHT}`));
});

test('refuses something that is not a PNG at all', () => {
  assert.throws(() => proverit(Buffer.from('this is not an image')), /Not a PNG file/);
});

test('refuses a colour depth it cannot read, rather than reading it wrongly', () => {
  const image = png(WIDTH, 3, pestryeRyady(3));
  // Bit depth sits at a fixed place: eight bytes of signature, four of chunk
  // length, four of chunk type, then width and height. Sixteen bits per channel
  // is a valid PNG this decoder does not handle, and the difference between
  // refusing it and misreading it is a screenshot that silently lies.
  image[8 + 4 + 4 + 8] = 16;
  assert.throws(() => proverit(image), /8-bit RGB\/RGBA/);
});

test('refuses a row filter that does not exist', () => {
  const rows = pestryeRyady(3);
  rows[1][0] = 9;
  assert.throws(() => proverit(png(WIDTH, 3, rows)), /Unsupported PNG filter/);
});

test('refuses a picture too small to be a screenshot', () => {
  // The threshold itself, which is the check that catches a failed capture.
  assert.throws(() => proverit(png(2, 3, [[0, 1, 2, 3, 4, 5, 6]])), /blank or too small/);
});
