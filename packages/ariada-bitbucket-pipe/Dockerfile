# SPDX-License-Identifier: EUPL-1.2
FROM node:22-bookworm-slim

RUN npm install -g --ignore-scripts @ariada-org/cli@0.1.0

COPY pipe /usr/local/bin/pipe
RUN chmod +x /usr/local/bin/pipe

# Run as the image built-in non-root user (Semgrep/SonarCloud: avoid root).
USER node

ENTRYPOINT ["/usr/local/bin/pipe"]
