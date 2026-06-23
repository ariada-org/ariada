# Ariada for.NET

.NET global tool and MSBuild task for running Ariada accessibility evidence gates
from ASP.NET, Razor, Blazor, MVC, and static publish outputs.

This integration is intentionally thin. It shells out to the shared
`@ariada-org/cli` package and parses the JSON artefact that the CLI writes. It
does not port or reimplement scanner rules in C#.

## What It Provides

- `dotnet-ariada`, a global tool entrypoint for CI and local developer runs.
- `Ariada.Scan`, an MSBuild task that can fail `dotnet build` or `dotnet publish`
 when the shared scanner reports findings at or above the configured threshold.
- A shared core library for CLI invocation, JSON parsing, and gate decisions.
- A static ASP.NET-like publish fixture used for local scan evidence.

## Global Tool Usage

```sh
dotnet tool install --global Ariada.DotNet.Tool
dotnet-ariada scan https://localhost:5001 --threshold serious
dotnet-ariada scan./bin/Release/net8.0/publish/wwwroot --domains accessibility,security
```

The wrapper expects `ariada` from `@ariada-org/cli` to be available on `PATH`:

```sh
npm install --global @ariada-org/cli
```

## MSBuild Usage

After adding the task package to an ASP.NET project, configure the target:

```xml
<PropertyGroup>
 <AriadaScanTarget>$(PublishDir)wwwroot</AriadaScanTarget>
 <AriadaSeverityThreshold>serious</AriadaSeverityThreshold>
 <AriadaScanOnPublish>true</AriadaScanOnPublish>
</PropertyGroup>
```

The target invokes:

```sh
ariada scan <target> --format json --output-dir <obj>/ariada-output
```

## Local Verification

`dotnet` is not installed in the current Codex environment, so the.NET gates are
documented as host blockers in the evidence report. The files are still structured
for these commands:

```sh
dotnet build -c Release
dotnet test -c Release
dotnet pack -c Release
dotnet format --verify-no-changes
node scripts/validate-structure.mjs
```

## Distribution Blockers

NuGet publication needs founder-controlled NuGet.org credentials and API key. Do
not claim the package is published until `dotnet nuget push` has been run from a
founder-approved release environment.

