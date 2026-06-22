# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2

FROM node:22-bookworm-slim AS build

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @ariada-org/cli... build
RUN pnpm --filter @ariada-org/cli --prod deploy /opt/ariada

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/ariada /opt/ariada
COPY integrations/docker-ariada/entrypoint.sh /usr/local/bin/ariada-entrypoint

RUN chmod +x /usr/local/bin/ariada-entrypoint /opt/ariada/dist/bin.js \
  && ln -s /opt/ariada/dist/bin.js /usr/local/bin/ariada

WORKDIR /workspace

# Run as non-root (Semgrep/SonarCloud).
USER node

ENTRYPOINT ["/usr/local/bin/ariada-entrypoint"]
CMD ["--help"]
