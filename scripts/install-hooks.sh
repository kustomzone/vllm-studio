#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_HOOK="$REPO_ROOT/scripts/hooks/post-commit"
TARGET_HOOK="$REPO_ROOT/.git/hooks/post-commit"

if [[ ! -f "$SOURCE_HOOK" ]]; then
  echo "❌ Source hook not found: $SOURCE_HOOK"
  exit 1
fi

if [[ ! -d "$REPO_ROOT/.git/hooks" ]]; then
  echo "❌ .git/hooks directory not found. Run this script from inside the repository."
  exit 1
fi

chmod +x "$SOURCE_HOOK"

if [[ -L "$TARGET_HOOK" ]]; then
  existing_target="$(readlink "$TARGET_HOOK")"
  if [[ "$existing_target" == "$SOURCE_HOOK" ]]; then
    echo "✅ post-commit hook already installed."
    exit 0
  fi
fi

if [[ -e "$TARGET_HOOK" || -L "$TARGET_HOOK" ]]; then
  backup_path="$TARGET_HOOK.backup.$(date +%Y%m%d-%H%M%S)"
  mv "$TARGET_HOOK" "$backup_path"
  echo "ℹ️ Existing post-commit hook backed up to: $backup_path"
fi

ln -s "$SOURCE_HOOK" "$TARGET_HOOK"
echo "✅ Installed post-commit hook: $TARGET_HOOK -> $SOURCE_HOOK"
