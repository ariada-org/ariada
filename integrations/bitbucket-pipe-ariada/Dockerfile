# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370

# Pinned, and installed without lifecycle scripts. An unpinned install makes the
# image a different image every time it is built, which is not something a
# pipeline user can review; --ignore-scripts keeps a dependency's install hooks
# from running as part of building it.
#
# The same pipe has a second build file under packages/; the two match in
# what they install and which user they run as.
RUN npm install --global --ignore-scripts @ariada-org/cli@0.3.0

COPY pipe/run.sh /usr/local/bin/ariada-bitbucket-pipe
RUN chmod +x /usr/local/bin/ariada-bitbucket-pipe

# Run as the image's built-in non-root user, so a compromised process inside the
# container is not root.
USER node

ENTRYPOINT ["ariada-bitbucket-pipe"]
