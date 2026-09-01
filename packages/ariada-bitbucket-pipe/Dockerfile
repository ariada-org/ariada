# SPDX-License-Identifier: EUPL-1.2
FROM node:22-bookworm-slim

# Pinned, and installed without lifecycle scripts. An unpinned install makes the
# image a different image every time it is built, which is not something a
# pipeline user can review; --ignore-scripts keeps a dependency's install hooks
# from running as part of building it.
RUN npm install -g --ignore-scripts @ariada-org/cli@0.3.0

COPY pipe /usr/local/bin/pipe
RUN chmod +x /usr/local/bin/pipe

# Run as the image's built-in non-root user so a compromised process in the
# container does not run as root.
USER node

ENTRYPOINT ["/usr/local/bin/pipe"]
