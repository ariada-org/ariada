# Ariada Docker Image

This directory contains the Docker packaging for the Ariada CLI.

## Product

The image lets CI and server operators run Ariada without a local Node setup.
It bundles the CLI and a headless Chromium runtime for URL scans.

## Build

Run from the repository root so the Dockerfile can copy workspace packages:

```bash
docker build -f integrations/docker-ariada/Dockerfile -t ariada-cli:local .
```

## Smoke

```bash
docker run --rm ariada-cli:local --help
docker run --rm ariada-cli:local scan https://example.com --format=json --output-dir=/workspace/ariada-output
```

To write reports to the host:

```bash
mkdir -p ariada-output
docker run --rm -v "$PWD/ariada-output:/workspace/ariada-output" ariada-cli:local \
  scan https://example.com --format=json --output-dir=/workspace/ariada-output
```

## Publish

Publishing to GHCR or Docker Hub is intentionally outside this directory. The
release owner should tag the image after the local build and scan smoke pass.
