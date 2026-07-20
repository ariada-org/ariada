import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';

const TARGET_EXTENSIONS = new Set([
  '.astro',
  '.erb',
  '.handlebars',
  '.hbs',
  '.htm',
  '.html',
  '.jsx',
  '.liquid',
  '.php',
  '.svelte',
  '.tsx',
  '.twig',
  '.vue',
  '.xhtml',
]);

/** Environment variables consumed by the pre-commit wrapper. */
export interface PrecommitEnvironment {
  ARIADA_BIN?: string;
  ARIADA_PRECOMMIT_FORMAT?: string;
  ARIADA_PRECOMMIT_SEVERITY?: string;
  ARIADA_PRECOMMIT_URL_BASE?: string;
}

/** Runtime options for invoking the pre-commit wrapper in tests or the CLI. */
export interface PrecommitOptions {
  argv: string[];
  cwd: string;
  env: PrecommitEnvironment;
  stderr: NodeJS.WritableStream;
  stdout: NodeJS.WritableStream;
}

/** Result returned after the wrapper either skipped or invoked ariada. */
export interface PrecommitResult {
  exitCode: number;
  selectedFiles: string[];
  command?: string;
  args?: string[];
}

function targetExtension(path: string): string {
  const lower = path.toLowerCase();
  for (const extension of TARGET_EXTENSIONS) {
    if (lower.endsWith(extension)) return extension;
  }
  return '';
}

/** Filter pre-commit filenames to files the ariada source gate should inspect. */
export function selectTargetFiles(files: readonly string[]): string[] {
  return files.filter((file) => TARGET_EXTENSIONS.has(targetExtension(file)));
}

function toScanTarget(file: string, cwd: string, urlBase: string | undefined): string {
  if (!urlBase) return file;
  const base = urlBase.endsWith('/') ? urlBase : `${urlBase}/`;
  const relativePath = relative(cwd, file).replaceAll('\\', '/');
  return new URL(relativePath, base).toString();
}

/** Build the ariada CLI arguments for selected files. */
export function buildAriadaArgs(files: readonly string[], cwd: string, env: PrecommitEnvironment): string[] {
  const format = env.ARIADA_PRECOMMIT_FORMAT ?? 'json';
  const severity = env.ARIADA_PRECOMMIT_SEVERITY ?? 'serious';
  const targets = files.map((file) => toScanTarget(file, cwd, env.ARIADA_PRECOMMIT_URL_BASE));
  return ['scan', '--format', format, '--severity-threshold', severity, ...targets];
}

/** Run the ariada pre-commit wrapper once for a list of candidate files. */
export function runPrecommit(options: PrecommitOptions): PrecommitResult {
  const selectedFiles = selectTargetFiles(options.argv);
  if (selectedFiles.length === 0) {
    options.stdout.write('ariada-precommit: no supported HTML/template files selected\n');
    return { exitCode: 0, selectedFiles };
  }

  const command = options.env.ARIADA_BIN ?? 'ariada';
  const args = buildAriadaArgs(selectedFiles, options.cwd, options.env);
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });

  if (result.stdout) options.stdout.write(result.stdout);
  if (result.stderr) options.stderr.write(result.stderr);
  if (result.error) {
    options.stderr.write(`ariada-precommit: failed to start ${command}: ${result.error.message}\n`);
    return { exitCode: 127, selectedFiles, command, args };
  }

  return {
    exitCode: result.status ?? 1,
    selectedFiles,
    command,
    args,
  };
}
