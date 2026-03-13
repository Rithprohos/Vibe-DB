#!/bin/bash

set -e

BUMP_TYPE=${1:-patch}
PUSH_TAG=${2:-""}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
PACKAGE_JSON="$ROOT_DIR/package.json"

RAW_VERSION=$(cd "$ROOT_DIR" && npm version "$BUMP_TYPE" --no-git-tag-version --silent)
NEW_VERSION="${RAW_VERSION#v}"
TAG_NAME="v$NEW_VERSION"

TMP=$(mktemp)
jq ".version = \"$NEW_VERSION\"" "$TAURI_CONF" > "$TMP" && mv "$TMP" "$TAURI_CONF"

git add "$PACKAGE_JSON" "$TAURI_CONF"
git commit -m "chore: bump version to $NEW_VERSION"
git tag "$TAG_NAME"

echo "Version bumped to $NEW_VERSION and tagged as $TAG_NAME."

if [ "$PUSH_TAG" = "--push" ]; then
  git push origin HEAD --tags
  echo "Pushed to origin with tags."
else
  echo "Push with: git push origin main --tags"
fi
