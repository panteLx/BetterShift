#!/bin/sh
# Chowns the writable paths, then drops root to "node" via su-exec.
# Not a plain `USER node`: existing deployments bind-mount a ./data that earlier
# root-run images left root-owned, which the container could then not write.

set -e

# Mirrors lib/db/db-path.mjs's resolveDatabasePath(): DATABASE_URL wins, else
# the default under /app/data. A custom DATABASE_URL needs its own directory
# chowned, not the hardcoded default -- otherwise db:migrate still fails as
# "node" even though this script ran.
db_path="${DATABASE_URL#file:}"
db_path="${db_path:-/app/data/sqlite.db}"
db_dir="$(dirname "$db_path")"

# Already non-root: nothing to drop to, and no privilege to chown with. Both
# paths ship owned by "node"; any other uid needs the host side sorted out.
if [ "$(id -u)" != "0" ]; then
    mkdir -p "$db_dir" /app/public/uploads 2>/dev/null || true
    exec "$@"
fi

for dir in "$db_dir" /app/public/uploads; do
    mkdir -p "$dir"
    owner="$(stat -c '%u:%g' "$dir")"
    if [ "$owner" != "$(id -u node):$(id -g node)" ]; then
        chown -R node:node "$dir" 2>/dev/null || true
    fi
done

exec su-exec node "$@"
