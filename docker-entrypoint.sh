#!/bin/sh
# Entrypoint for the runner stage: fixes ownership of writable, bind-mounted
# paths and then drops from root to the unprivileged "node" user before
# exec'ing the real command. This exists instead of a plain `USER node`
# directive because existing self-hosted deployments bind-mount ./data
# (and, since the uploads volume was added, ./data/uploads) from the host,
# where it is commonly root-owned from earlier root-run images. A bare
# `USER node` would leave the container unable to write its own database on
# upgrade. Running as root here only long enough to chown, then dropping
# privileges via su-exec, keeps upgrades working while the app itself still
# runs unprivileged.
set -e

# Everything below is the root path. When the container is started with an
# explicit user (`docker run --user`, compose `user:`), there is nothing to
# drop to and no privilege to chown with: su-exec would still attempt the
# identity-changing syscalls and abort before the app ever starts.
if [ "$(id -u)" != "0" ]; then
    exec "$@"
fi

for dir in /app/data /app/public/uploads; do
    mkdir -p "$dir"
    # Skip the chown when ownership is already correct, so an upgrade of a
    # deployment whose volumes are fine does not walk the whole tree.
    owner="$(stat -c '%u:%g' "$dir")"
    if [ "$owner" != "$(id -u node):$(id -g node)" ]; then
        chown -R node:node "$dir" 2>/dev/null || true
    fi
done

exec su-exec node "$@"
