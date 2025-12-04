#!/bin/bash
# Standalone demo reset script for BetterShift
# Resets the database to the initial snapshot state
# Works with Docker containers - handles permissions correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="${CONTAINER_NAME:-bettershift}"
DB_PATH="${PROJECT_DIR}/data/sqlite.db"
SNAPSHOT_PATH="${PROJECT_DIR}/data/demo-snapshot.db"

echo "========================================="
echo "BetterShift Demo Reset"
echo "========================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database reset..."

# Check if snapshot exists
if [ ! -f "$SNAPSHOT_PATH" ]; then
    echo "Error: Demo snapshot not found at: $SNAPSHOT_PATH"
    echo "Please run: ./demo/create-snapshot.sh first"
    exit 1
fi

# Stop container temporarily to avoid conflicts
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping container..."
if ! (cd "$PROJECT_DIR" && docker compose stop "$CONTAINER_NAME"); then
    echo "Error: Failed to stop container"
    exit 1
fi

# Remove current database and restore from snapshot
sudo rm -f "$DB_PATH"
sudo cp "$SNAPSHOT_PATH" "$DB_PATH"
sudo chown $(stat -c '%u:%g' "$PROJECT_DIR/data") "$DB_PATH"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Database restored from snapshot"

# Start container again
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting container..."
(cd "$PROJECT_DIR" && docker compose start "$CONTAINER_NAME")

# Wait for container to be healthy
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for container to be ready..."
timeout 60 sh -c "cd '$PROJECT_DIR' && until docker compose ps '$CONTAINER_NAME' | grep -q '(healthy)'; do sleep 2; done" || echo "Warning: Container may not be fully healthy"

echo ""
echo "========================================="
echo "✅ Database reset complete!"
echo "========================================="
echo ""
