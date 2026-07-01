import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (file === undefined) {
  throw new Error('Usage: node scripts/validate-screenshot.mjs <png>');
}

const png = readFileSync(file);
const signature = png.subarray(0, 8).toString('hex');
if (signature !== '89504e470d0a1a0a') {
  throw new Error(`${file} is not a PNG file.`);
}

let offset = 8;
let width = 0;
let height = 0;
let colorType = 0;
const idat = [];

while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  const type = png.subarray(offset + 4, offset + 8).toString('ascii');
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  const data = png.subarray(dataStart, dataEnd);

  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    colorType = data[9] ?? 0;
  }

  if (type === 'IDAT') {
    idat.push(data);
  }

  offset = dataEnd + 4;
}

if (width < 320 || height < 240) {
  throw new Error(`${file} is too small for evidence: ${width}x${height}.`);
}

if (colorType !== 2 && colorType !== 6) {
  throw new Error(`${file} has unsupported PNG color type ${colorType}; expected RGB or RGBA.`);
}

const bytesPerPixel = colorType === 6 ? 4 : 3;
const inflated = inflateSync(Buffer.concat(idat));
const stride = width * bytesPerPixel;
const rows = [];
let sourceOffset = 0;

for (let y = 0; y < height; y += 1) {
  const filter = inflated[sourceOffset] ?? 0;
  sourceOffset += 1;
  const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
  sourceOffset += stride;
  const previous = rows[y - 1];
  unfilter(row, previous, filter, bytesPerPixel);
  rows.push(row);
}

const sample = new Set();
for (let y = 0; y < rows.length; y += Math.max(1, Math.floor(height / 80))) {
  const row = rows[y];
  if (row === undefined) {
    continue;
  }

  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 80))) {
    const index = x * bytesPerPixel;
    sample.add(`${row[index]},${row[index + 1]},${row[index + 2]}`);
  }
}

if (sample.size < 12) {
  throw new Error(`${file} appears blank or nearly blank; sampled ${sample.size} colors.`);
}

console.log(`Screenshot ${file} is ${width}x${height} with ${sample.size} sampled colors.`);

function unfilter(row, previous, filter, bytesPerPixel) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] ?? 0 : 0;
    const up = previous?.[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous?.[index - bytesPerPixel] ?? 0 : 0;

    if (filter === 1) {
      row[index] = (row[index] ?? 0) + left;
    } else if (filter === 2) {
      row[index] = (row[index] ?? 0) + up;
    } else if (filter === 3) {
      row[index] = (row[index] ?? 0) + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      row[index] = (row[index] ?? 0) + paeth(left, up, upLeft);
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter ${filter}.`);
    }
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}
