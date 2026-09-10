#!/bin/sh
# Chowns the writable paths, then drops root to "node" via su-exec.
# Not a plain `USER node`: existing deployments bind-mount a ./data that earlier
# root-run images left root-owned, which the container could then not write.

set -e

# Already non-root: nothing to drop to, and no privilege to chown with. Both
# paths ship owned by "node"; any other uid needs the host side sorted out.
if [ "$(id -u)" != "0" ]; then
    mkdir -p /app/data /app/public/uploads 2>/dev/null || true
    exec "$@"
fi

for dir in /app/data /app/public/uploads; do
    mkdir -p "$dir"
    owner="$(stat -c '%u:%g' "$dir")"
    if [ "$owner" != "$(id -u node):$(id -g node)" ]; then
        chown -R node:node "$dir" 2>/dev/null || true
    fi
done

exec su-exec node "$@"
