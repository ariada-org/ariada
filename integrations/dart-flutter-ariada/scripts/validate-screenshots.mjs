#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const integration = dirname(scriptDir);
const files = [
  join(integration, 'scan-evidence/screenshots/tested-host-surface.png'),
  join(integration, 'scan-evidence/screenshots/scan-result.png'),
];

function pngInfo(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const chunks = [];
  let offset = 8;
  while (offset + 8 < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    chunks.push({ type, dataStart, length });
    offset = dataStart + length + 4;
    if (type === 'IEND') break;
  }
  const idatBytes = chunks
    .filter((chunk) => chunk.type === 'IDAT')
    .reduce((total, chunk) => total + chunk.length, 0);
  return { width, height, idatBytes };
}

for (const file of files) {
  const info = pngInfo(readFileSync(file));
  if (info.width < 320 || info.height < 240) {
    throw new Error(`${file} has too-small dimensions ${info.width}x${info.height}`);
  }
  if (info.idatBytes < 2048) {
    throw new Error(`${file} has too little image data (${info.idatBytes} IDAT bytes), likely blank`);
  }
  console.log(`${file}: ${info.width}x${info.height}, IDAT ${info.idatBytes} bytes`);
}
