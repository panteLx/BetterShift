#!/bin/sh
# Generate version information from git

VERSION_FILE="./public/version.json"

# Get git branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Get short commit hash
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Get commit date
COMMIT_DATE=$(git log -1 --format=%cd --date=iso 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

# Combine branch and hash for version tag
if [ "$BRANCH" != "unknown" ] && [ "$COMMIT_HASH" != "unknown" ]; then
  VERSION_TAG="${BRANCH}-${COMMIT_HASH}"
else
  VERSION_TAG="dev-local"
fi

# Create public directory if it doesn't exist
mkdir -p ./public

# Write version info to JSON file
cat > "$VERSION_FILE" <<EOF
{
  "version": "${VERSION_TAG}",
  "branch": "${BRANCH}",
  "commitHash": "${COMMIT_HASH}",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commitDate": "${COMMIT_DATE}"
}
EOF

echo "Generated version info: ${VERSION_TAG}"
