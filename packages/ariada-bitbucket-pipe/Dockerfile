# SPDX-License-Identifier: EUPL-1.2
FROM node:22-bookworm-slim

RUN npm install -g @ariada-org/cli

COPY pipe /usr/local/bin/pipe
RUN chmod +x /usr/local/bin/pipe

ENTRYPOINT ["/usr/local/bin/pipe"]
