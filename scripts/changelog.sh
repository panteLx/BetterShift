#!/bin/bash

# Render the release changelog between two refs as markdown on stdout.
# Used by .github/workflows/release.yml and by .LOCAL/test-changelog.sh, so a
# local preview always matches what the release will publish.
#
# Usage: scripts/changelog.sh <from-ref> <to-ref>

set -euo pipefail

FROM_REF="${1:?usage: changelog.sh <from-ref> <to-ref>}"
TO_REF="${2:?usage: changelog.sh <from-ref> <to-ref>}"

COMMITS=$(git log "$FROM_REF".."$TO_REF" --pretty=format:"%s|%h" --no-merges)

if [ -z "$COMMITS" ]; then
  echo "_No changes._"
  exit 0
fi

# `npm version` puts a bump commit whose subject is the bare version number on
# top of the tag. Drop it only when it is actually there — a hand-made tag has
# a real commit in that position.
NEWEST=$(echo "$COMMITS" | head -n 1 | cut -d'|' -f1)
if [[ "$NEWEST" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  COMMITS=$(echo "$COMMITS" | tail -n +2)
  if [ -z "$COMMITS" ]; then
    echo "_No changes._"
    exit 0
  fi
fi

# Types that describe internal work only. They stay in the git history but are
# not part of what a release note tells users.
INTERNAL_TYPES="refactor|ci|style|test|build"
KNOWN_TYPES="feat|fix|perf|docs|chore|$INTERNAL_TYPES"

render() {
  local heading="$1" body="$2"
  if [ -n "$body" ]; then
    printf '### %s\n\n%s\n\n' "$heading" "$body"
  fi
}

section() {
  render "$1" "$(echo "$COMMITS" | grep -E "$2" | sed 's/|/ /;s/^/- /' || true)"
}

# Breaking changes are marked with a `!` before the colon (feat!:, chore(x)!:).
# Listed first and again under their own type, so an upgrade note is never
# buried in a long list.
section "⚠️ Breaking Changes" "^[a-z]+(\([^)]*\))?!:"
section "✨ Features"          "^feat(\([^)]*\))?!?:"
section "🐛 Bug Fixes"         "^fix(\([^)]*\))?!?:"
section "⚡ Performance"       "^perf(\([^)]*\))?!?:"
section "📝 Documentation"     "^docs(\([^)]*\))?!?:"
section "🔧 Chores"            "^chore(\([^)]*\))?!?:"

# Anything that follows no convention at all. Internal types are matched here
# as well and thrown away with it, so they drop out of the changelog entirely.
render "🔀 Other Changes" \
  "$(echo "$COMMITS" \
    | grep -vE "^($KNOWN_TYPES)(\([^)]*\))?!?:" \
    | sed 's/|/ /;s/^/- /' || true)"
