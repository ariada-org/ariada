# Docker Smoke Notes

## Local Commands

```bash
docker build -f integrations/docker-ariada/Dockerfile -t ariada-cli:local .
docker run --rm ariada-cli:local --help
docker run --rm ariada-cli:local scan https://example.com --format=json
```

## Expected Result

- `docker build` produces a local `ariada-cli:local` image.
- `docker run --rm ariada-cli:local --help` prints CLI help.
- A URL scan writes JSON output or exits with the documented violation code.

## Known Environment Blocker

If Docker Desktop is not exposing its socket, the build fails before reading the
Dockerfile with an error similar to:

```text
failed to connect to the docker API at unix://$HOME/.docker/run/docker.sock
```

Expected actor: local workstation owner starts or repairs Docker Desktop, then
reruns the smoke commands.
