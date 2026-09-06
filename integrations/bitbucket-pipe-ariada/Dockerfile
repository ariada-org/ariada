# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
FROM node:22-bookworm-slim

RUN npm install --global @ariada-org/cli@0.3.0

COPY pipe/run.sh /usr/local/bin/ariada-bitbucket-pipe
RUN chmod +x /usr/local/bin/ariada-bitbucket-pipe

ENTRYPOINT ["ariada-bitbucket-pipe"]
