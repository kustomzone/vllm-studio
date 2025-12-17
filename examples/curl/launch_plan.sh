#!/usr/bin/env bash
set -euo pipefail

RECIPE_ID="${1:-}"
if [ -z "${RECIPE_ID}" ]; then
  echo "usage: $0 <recipe_id>" >&2
  exit 2
fi

: "${BASE_URL:=http://localhost:8080}"
: "${API_KEY:=}"

AUTH=()
if [ -n "${API_KEY}" ]; then
  AUTH=(-H "Authorization: Bearer ${API_KEY}")
fi

curl -fsS "${AUTH[@]}" "${BASE_URL}/recipes/${RECIPE_ID}/plan"
echo

