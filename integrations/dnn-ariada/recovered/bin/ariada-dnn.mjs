#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { run, runScan } from '@ariada-org/cli';

export async function runAriadaScan(url, options, stdout = process.stdout, stderr = process.stderr) {
  return runScan(url, options, stdout, stderr);
}

export async function runAriadaCli(arguments_) {
  return run(arguments_);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runAriadaCli(process.argv.slice(2));
}
