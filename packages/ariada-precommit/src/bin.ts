#!/usr/bin/env node
import { runPrecommit } from './index.js';

const result = runPrecommit({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  stderr: process.stderr,
  stdout: process.stdout,
});

process.exitCode = result.exitCode;
