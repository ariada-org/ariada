#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const required = [
  'dotnet-ariada.sln',
  'README.md',
  'src/Ariada.DotNet.Core/Ariada.DotNet.Core.csproj',
  'src/Ariada.DotNet.Core/AriadaCliRunner.cs',
  'src/Ariada.DotNet.Core/AriadaReportParser.cs',
  'src/Ariada.DotNet.Tool/Ariada.DotNet.Tool.csproj',
  'src/Ariada.DotNet.Tool/Program.cs',
  'src/Ariada.DotNet.MSBuild/Ariada.DotNet.MSBuild.csproj',
  'src/Ariada.DotNet.MSBuild/AriadaScanTask.cs',
  'src/Ariada.DotNet.MSBuild/build/Ariada.DotNet.MSBuild.targets',
  'tests/Ariada.DotNet.Tests/AriadaReportParserTests.cs',
  'examples/aspnet-static-output/wwwroot/index.html',
];

const failures = [];
for (const file of required) {
  try {
    await access(new URL(file, root));
  } catch {
    failures.push(`missing ${file}`);
  }
}

const runner = await readFile(new URL('src/Ariada.DotNet.Core/AriadaCliRunner.cs', root), 'utf8');
if (!runner.includes('"scan"') || !runner.includes('--output-dir')) {
  failures.push('AriadaCliRunner must build ariada scan command arguments');
}
if (!runner.includes('ProcessStartInfo')) {
  failures.push('AriadaCliRunner must invoke the shared CLI as a subprocess');
}

const msbuild = await readFile(new URL('src/Ariada.DotNet.MSBuild/AriadaScanTask.cs', root), 'utf8');
if (!msbuild.includes('AriadaCliRunner') || !msbuild.includes('Log.LogError')) {
  failures.push('MSBuild task must reuse core runner and fail the build on gate errors');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`PASS dotnet-ariada structure (${required.length} files)`);

