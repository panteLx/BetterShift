#!/bin/bash
# Create initial database snapshot for demo resets
# Run this once to capture the current database state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_DIR}/data/sqlite.db"
SNAPSHOT_PATH="${PROJECT_DIR}/data/demo-snapshot.db"

echo "========================================="
echo "Create Demo Snapshot"
echo "========================================="

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at: $DB_PATH"
    echo "Please ensure your application is running and has a database."
    exit 1
fi

# Create snapshot
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating snapshot from current database..."
sudo cp "$DB_PATH" "$SNAPSHOT_PATH"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Snapshot created: $SNAPSHOT_PATH"

echo ""
echo "========================================="
echo "✅ Snapshot created successfully!"
echo "========================================="
echo ""
echo "You can now run ./demo/reset-demo.sh to restore to this state."
echo ""
