#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';

// `mapAriadaResult` не вызывается здесь и импортируется всё равно — так было
// в оригинале, и сверка это заметила. Убрать его значило бы выдать за
// восстановление слегка другой модуль.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { mapAriadaResult, runTildaScan, type TildaConfig } from './index.js';

const url = process.argv[2];
const configPath = process.argv[3];
let config: TildaConfig = { url: url ?? '' };
if (configPath)
  config = {
    ...(JSON.parse(await readFile(configPath, 'utf8')) as TildaConfig),
    url: url ?? (JSON.parse(await readFile(configPath, 'utf8')) as TildaConfig).url,
  };
const result = await runTildaScan(config);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.gate === 'pass' ? 0 : 1;
