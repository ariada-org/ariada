# Ariada for Umbraco

Umbraco 13+ package scaffold for back-office rendered page scans. It keeps the
.NET package outside the pnpm workspace and delegates scanning to Ariada.

## What It Does

- Provides a package project targeting `net8.0`.
- Adds a scan service that builds an Ariada request for a published content URL.
- Leaves back-office dashboard wiring to the Umbraco host application.

## Local Verification

```sh
node scripts/validate-structure.mjs
dotnet build Ariada.Umbraco.csproj
```

## Host Blocker

`dotnet` is required for build/NuGet packaging. Umbraco host smoke needs a
running Umbraco 13 site and back-office credentials. Marketplace and NuGet
publishing are founder actions.
